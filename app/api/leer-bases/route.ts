// app/api/leer-bases/route.ts
// Lee un PDF de bases de licitación con Gemini.
// Estrategia robusta: dual call (con/sin JSON mode), parser tolerante, reformateo de emergencia.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  GEMINI_KEY, GEMINI_BASE,
  subirArchivoAGemini, generarConGemini, parsearJSONSeguro, normalizarClaves,
} from '@/lib/gemini/documentos';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Reformateo de emergencia: si el texto no tiene JSON, pedirle a Gemini que lo formatee ──

async function reformatearComoJSON(txtCrudo: string, itemsExcel: Array<{ numero: string; detalle: string }>): Promise<Record<string, unknown> | null> {
  if (!txtCrudo || txtCrudo.length < 10) return null;
  console.log('[leer-bases] Reformateando respuesta como JSON con segunda llamada...');

  const promptReformat = `Tienes esta información sobre ítems de una licitación:

${txtCrudo.slice(0, 3000)}

${itemsExcel.length ? `Y estos ítems de planilla Excel a cotizar:
${JSON.stringify(itemsExcel.slice(0, 50).map(i => ({ numero: i.numero, detalle: i.detalle })))}

Devuelve SOLO este JSON:
{
  "items": [{"item":"1","nombre":"nombre exacto del producto","especificaciones":"specs completas","cantidad":"10","unidad":"Unidades"}],
  "enriquecidos": [{"numero":"1","busqueda":"término optimizado para buscador Chile","agregado":"specs añadidas o vacío"}]
}` : `Devuelve SOLO este JSON:
{"items": [{"item":"1","nombre":"...","especificaciones":"...","cantidad":"10","unidad":"Unidades"}]}`}

IMPORTANTE: Responde ÚNICAMENTE el JSON, sin texto antes ni después.`;

  for (const model of ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 45000);
      const res = await fetch(
        `${GEMINI_BASE}/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptReformat }] }],
            generationConfig: { temperature: 0.05, maxOutputTokens: 8192, responseMimeType: 'application/json' },
          }),
        }
      );
      clearTimeout(tid);
      if (!res.ok) continue;
      const out = await res.json().catch(() => ({}));
      const txt = out?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!txt || txt.length < 10) continue;
      console.log(`[leer-bases] Reformat ${model} OK — ${txt.length} chars`);
      try { return normalizarClaves(JSON.parse(txt)); } catch { /* continuar */ }
    } catch { /* continuar */ }
  }
  return null;
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!GEMINI_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY no configurada en el servidor' }, { status: 500 });
  }

  let bucket = '', path = '';
  let itemsExcel: Array<{ numero: string; detalle: string; conversion?: string }> = [];

  try {
    const body = await req.json();
    bucket = body.bucket || 'bases-licitaciones';
    path = body.path;
    itemsExcel = Array.isArray(body.itemsExcel) ? body.itemsExcel.slice(0, 150) : [];
    if (!path) return NextResponse.json({ error: 'Falta path del PDF' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  try {
    // ── 1) Descargar PDF ─────────────────────────────────────────────────────
    const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path);
    if (dlErr || !blob) {
      return NextResponse.json({ error: `No se pudo descargar el PDF: ${dlErr?.message || 'archivo no encontrado'}` }, { status: 400 });
    }
    const bytes = await blob.arrayBuffer();
    const sizeKB = Math.round(bytes.byteLength / 1024);
    console.log(`[leer-bases] PDF: ${sizeKB} KB`);

    if (bytes.byteLength < 500) return NextResponse.json({ error: 'El PDF está vacío o corrupto' }, { status: 400 });
    if (bytes.byteLength > 60 * 1024 * 1024) return NextResponse.json({ error: 'El PDF supera los 60MB' }, { status: 400 });

    // ── 2) Subir a Gemini ────────────────────────────────────────────────────
    console.log('[leer-bases] Subiendo a Gemini...');
    const fileUri = await subirArchivoAGemini(bytes, bytes.byteLength, 'application/pdf', `bases_${Date.now()}.pdf`);
    console.log(`[leer-bases] Gemini URI OK: ${fileUri}`);

    // ── 3) Prompt ────────────────────────────────────────────────────────────
    let prompt: string;
    if (itemsExcel.length) {
      prompt = `Eres experto en licitaciones de Mercado Público Chile.
Este PDF son las BASES TÉCNICAS de una licitación. Analízalo completamente.

Tengo esta lista de ítems de mi planilla Excel (COSTEO):
${JSON.stringify(itemsExcel.slice(0, 100).map(i => ({ numero: i.numero, detalle: i.detalle })), null, 2)}

TAREA: Para cada ítem de mi Excel, genera una "busqueda" mejorada para encontrar ESE producto en internet chileno.
- Corrige nombres mal escritos o incompletos usando la información del PDF de bases
- Agrega specs técnicas que falten (medidas, material, marca de referencia, voltaje, capacidad)
- NO inventes specs que no estén en el PDF
- La busqueda debe ser útil para Google Shopping Chile
- En "agregado" pon qué specs añadiste (o déjalo vacío si ya estaba completo)

Responde SOLO con este JSON exacto (sin texto antes, sin texto después):
{
  "items": [
    {"item": "1", "nombre": "nombre del producto en las bases", "especificaciones": "specs completas del PDF", "cantidad": "10", "unidad": "Unidades"}
  ],
  "enriquecidos": [
    {"numero": "1", "busqueda": "busqueda optimizada para Google Chile", "agregado": "specs añadidas desde las bases"}
  ]
}`;
    } else {
      prompt = `Eres experto en licitaciones de Mercado Público Chile.
Este PDF son las BASES TÉCNICAS de una licitación.

Extrae TODOS los ítems/productos con sus especificaciones técnicas completas.

Responde SOLO con este JSON (sin texto antes, sin texto después):
{"items": [{"item": "1", "nombre": "nombre del producto", "especificaciones": "specs completas", "cantidad": "10", "unidad": "Unidades"}]}`;
    }

    // ── 4) Generar con Gemini ────────────────────────────────────────────────
    console.log('[leer-bases] Generando...');
    const txt = await generarConGemini([
      { text: prompt },
      { fileData: { mimeType: 'application/pdf', fileUri } },
    ]);

    // ── 5) Parsear ───────────────────────────────────────────────────────────
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = parsearJSONSeguro(txt);
    } catch (parseErr: unknown) {
      // Parser primario falló → reformatear con segunda llamada
      console.warn('[leer-bases] Parser primario falló:', (parseErr as Error).message);
      parsed = await reformatearComoJSON(txt, itemsExcel);
    }

    if (!parsed) {
      return NextResponse.json({
        error: 'Gemini no pudo extraer la información del PDF. Verifica que sea un PDF de texto con listado de ítems.',
        tip: 'Si el PDF es escaneado (imagen), primero conviértelo a PDF con texto (usando Adobe Acrobat o similar).',
      }, { status: 422 });
    }

    const items = Array.isArray(parsed.items) ? parsed.items as Record<string, unknown>[] : [];
    const enriquecidos = Array.isArray(parsed.enriquecidos) ? parsed.enriquecidos as Record<string, unknown>[] : [];

    if (!items.length && !enriquecidos.length) {
      return NextResponse.json({
        error: 'El PDF no contiene ítems reconocibles. Asegúrate de que sea un documento de bases técnicas con listado de productos.',
        tip: 'PDFs de muchas páginas con tablas complejas pueden requerir más tiempo. Intenta de nuevo.',
      }, { status: 422 });
    }

    // ── 6) Limpiar storage ───────────────────────────────────────────────────
    supabase.storage.from(bucket).remove([path]).catch(() => {});

    console.log(`[leer-bases] ✅ ${items.length} ítems, ${enriquecidos.length} enriquecidos`);

    return NextResponse.json({
      ok: true,
      total: items.length,
      items: items.map((it) => ({
        item: String(it.item ?? '').trim(),
        nombre: String(it.nombre ?? '').trim(),
        especificaciones: String(it.especificaciones ?? '').trim(),
        cantidad: String(it.cantidad ?? '').trim(),
        unidad: String(it.unidad ?? '').trim(),
      })),
      enriquecidos: enriquecidos.map((e) => ({
        numero: String(e.numero ?? '').trim(),
        busqueda: String(e.busqueda ?? '').trim(),
        agregado: String(e.agregado ?? '').trim(),
      })),
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    console.error('[leer-bases] Error crítico:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
