// app/api/leer-bases/route.ts
// Lee un PDF de bases de licitación con Gemini y extrae productos con sus specs.
// Correcciones de robustez: timeouts, reintentos, fallback de modelo, validación de JSON parcial.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

// Modelos en orden de preferencia — si el primero falla se intenta el siguiente
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

// ─── Subir PDF a Gemini con timeout y reintentos ────────────────────────────

async function subirAGemini(bytes: ArrayBuffer, size: number): Promise<string> {
  // Intento 1: upload resumable (mejor para PDFs grandes)
  // Intento 2: si falla, reintentar una vez más
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // 1) Iniciar upload resumable con timeout
      const ctrlStart = new AbortController();
      const tidStart = setTimeout(() => ctrlStart.abort(), 20000);
      const start = await fetch(`${GEMINI_BASE}/upload/v1beta/files?key=${GEMINI_KEY}`, {
        method: 'POST',
        signal: ctrlStart.signal,
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(size),
          'X-Goog-Upload-Header-Content-Type': 'application/pdf',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: `bases_${Date.now()}.pdf` } }),
      });
      clearTimeout(tidStart);

      if (!start.ok) {
        const errText = await start.text().catch(() => '');
        throw new Error(`Gemini upload init ${start.status}: ${errText.slice(0, 150)}`);
      }

      const uploadUrl = start.headers.get('X-Goog-Upload-URL');
      if (!uploadUrl) throw new Error('Gemini no entregó URL de subida (header vacío)');

      // 2) Subir bytes con timeout
      const ctrlUp = new AbortController();
      const tidUp = setTimeout(() => ctrlUp.abort(), 60000); // 60s para subir el PDF
      const up = await fetch(uploadUrl, {
        method: 'POST',
        signal: ctrlUp.signal,
        headers: {
          'X-Goog-Upload-Command': 'upload, finalize',
          'X-Goog-Upload-Offset': '0',
          'Content-Length': String(size),
          'Content-Type': 'application/pdf',
        },
        body: bytes,
      });
      clearTimeout(tidUp);

      if (!up.ok) {
        const errText = await up.text().catch(() => '');
        throw new Error(`Gemini upload falló ${up.status}: ${errText.slice(0, 150)}`);
      }

      const info = await up.json().catch(() => ({}));
      const fileUri = info?.file?.uri;
      const fileName = info?.file?.name;
      if (!fileUri || !fileName) {
        throw new Error(`Gemini no devolvió el URI del archivo (respuesta: ${JSON.stringify(info).slice(0, 100)})`);
      }

      // 3) Esperar ACTIVE con timeout total de 90s (30 intentos × 3s)
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const ctrlPoll = new AbortController();
          const tidPoll = setTimeout(() => ctrlPoll.abort(), 8000);
          const r = await fetch(`${GEMINI_BASE}/v1beta/${fileName}?key=${GEMINI_KEY}`, {
            signal: ctrlPoll.signal,
          });
          clearTimeout(tidPoll);
          if (!r.ok) continue; // ignorar error de polling y reintentar
          const st = await r.json().catch(() => ({}));
          if (st?.state === 'ACTIVE') return fileUri;
          if (st?.state === 'FAILED') throw new Error(`Gemini no pudo procesar el PDF (estado FAILED en intento ${i + 1})`);
        } catch (pollErr: unknown) {
          if ((pollErr as Error)?.message?.includes('FAILED')) throw pollErr;
          // timeout de polling → continuar esperando
        }
      }
      throw new Error('Tiempo de espera agotado procesando el PDF (>90s)');
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === 0) {
        console.warn(`[leer-bases] Intento ${attempt + 1} falló: ${lastError.message} — reintentando...`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  throw lastError ?? new Error('Error desconocido subiendo PDF a Gemini');
}

// ─── Llamar a Gemini Generate con fallback de modelo ────────────────────────

async function generarConGemini(prompt: string, fileUri: string): Promise<string> {
  const genBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          { fileData: { mimeType: 'application/pdf', fileUri } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  for (const model of GEMINI_MODELS) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 90000); // 90s máximo por modelo
      const gen = await fetch(
        `${GEMINI_BASE}/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(genBody),
        }
      );
      clearTimeout(tid);

      if (gen.status === 429) {
        console.warn(`[leer-bases] ${model} rate limit (429) — probando siguiente modelo`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      if (gen.status === 503 || gen.status === 500) {
        console.warn(`[leer-bases] ${model} error ${gen.status} — probando siguiente modelo`);
        continue;
      }
      if (!gen.ok) {
        const t = await gen.text().catch(() => '');
        console.warn(`[leer-bases] ${model} HTTP ${gen.status}: ${t.slice(0, 120)}`);
        continue;
      }

      const out = await gen.json().catch(() => ({}));
      const txt = out?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!txt) {
        // Puede haber finish_reason SAFETY u otros
        const reason = out?.candidates?.[0]?.finishReason || 'desconocido';
        console.warn(`[leer-bases] ${model} respuesta vacía — finishReason: ${reason}`);
        if (reason === 'SAFETY' || reason === 'RECITATION') continue;
      }
      console.log(`[leer-bases] ${model} OK — ${txt.length} chars`);
      return txt;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[leer-bases] ${model} excepción: ${msg}`);
    }
  }
  throw new Error('Todos los modelos Gemini fallaron. Intenta de nuevo en unos minutos.');
}

// ─── Parsear JSON tolerante a texto extra ────────────────────────────────────

function parsearJSONSeguro(txt: string): Record<string, unknown> {
  // Gemini a veces devuelve ```json ... ``` o texto antes del JSON
  let limpio = txt.trim();
  // Quitar markdown code blocks
  limpio = limpio.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  // Buscar el primer { o [
  const inicio = limpio.search(/[{[]/);
  if (inicio > 0) limpio = limpio.slice(inicio);
  // Buscar el último } o ]
  const fin = Math.max(limpio.lastIndexOf('}'), limpio.lastIndexOf(']'));
  if (fin > 0) limpio = limpio.slice(0, fin + 1);

  try {
    return JSON.parse(limpio);
  } catch {
    // Intento de recuperación: extraer arrays con regex si JSON está roto
    console.warn('[leer-bases] JSON mal formado, intentando extracción parcial...');
    const itemsMatch = limpio.match(/"items"\s*:\s*(\[[\s\S]*?\])/);
    const enrichMatch = limpio.match(/"enriquecidos"\s*:\s*(\[[\s\S]*?\])/);
    const result: Record<string, unknown> = {};
    if (itemsMatch) {
      try { result.items = JSON.parse(itemsMatch[1]); } catch { result.items = []; }
    }
    if (enrichMatch) {
      try { result.enriquecidos = JSON.parse(enrichMatch[1]); } catch { result.enriquecidos = []; }
    }
    if (Object.keys(result).length === 0) throw new Error('No se pudo extraer datos del PDF');
    return result;
  }
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
    if (!path) return NextResponse.json({ error: 'Falta path del PDF en el body' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  try {
    // ── 1) Descargar PDF desde Supabase ─────────────────────────────────────
    const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path);
    if (dlErr || !blob) {
      return NextResponse.json(
        { error: `No se pudo descargar el PDF desde el servidor: ${dlErr?.message || 'archivo no encontrado'}` },
        { status: 400 }
      );
    }
    const bytes = await blob.arrayBuffer();
    const sizeKB = Math.round(bytes.byteLength / 1024);
    console.log(`[leer-bases] PDF descargado: ${sizeKB} KB`);

    if (bytes.byteLength < 500) {
      return NextResponse.json({ error: 'El PDF está vacío o es demasiado pequeño' }, { status: 400 });
    }
    if (bytes.byteLength > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'El PDF supera el límite de 50MB' }, { status: 400 });
    }

    // ── 2) Subir a Gemini ────────────────────────────────────────────────────
    console.log('[leer-bases] Subiendo a Gemini...');
    const fileUri = await subirAGemini(bytes, bytes.byteLength);
    console.log(`[leer-bases] Gemini URI: ${fileUri}`);

    // ── 3) Construir prompt ──────────────────────────────────────────────────
    let prompt = `Eres experto en licitaciones de Mercado Público Chile y en búsqueda de productos industriales.
Este PDF son las BASES TÉCNICAS de una licitación pública.

Extrae TODOS los productos/ítems solicitados con sus especificaciones técnicas completas.
Para cada ítem incluye: número de ítem, nombre del producto, especificaciones técnicas completas
(medidas exactas, materiales, marcas de referencia como "equivalente o superior a X", capacidad, voltaje, etc.), cantidad y unidad de medida.`;

    if (itemsExcel.length) {
      prompt += `

TAREA PRINCIPAL: Tengo esta lista de ítems de mi planilla COSTEO (Excel) que voy a cotizar:
${JSON.stringify(itemsExcel.map((i) => ({ numero: i.numero, detalle: i.detalle })), null, 2)}

Para CADA ítem de MI planilla, genera una "busqueda" optimizada para encontrar EXACTAMENTE ese producto en internet.
REGLAS:
- Si el ítem tiene nombre incompleto o mal escrito, corrígelo con lo que dicen las bases
- Si le faltan especificaciones (medida, material, voltaje, marca de referencia), AGRÉGALAS desde las bases
- Si el ítem ya está bien descrito y completo, devuelve la búsqueda similar (puedes mejorar redacción)
- NO inventes especificaciones que no estén en el PDF de bases
- La "busqueda" debe ser lo que escribirías en Google para encontrar ese producto específico en Chile
- En "agregado" pon SOLO las especificaciones que añadiste (o déjalo vacío si no añadiste nada)
- Empareja por significado del producto, no solo por texto literal

Responde SOLO JSON con esta estructura EXACTA (sin texto antes ni después):
{
  "items": [
    {"item": "4.1", "nombre": "Nombre del producto en las bases", "especificaciones": "especificaciones completas", "cantidad": "10", "unidad": "Unidades"}
  ],
  "enriquecidos": [
    {"numero": "1", "busqueda": "término de búsqueda optimizado para Google", "agregado": "specs que se añadieron desde las bases, o vacío"}
  ]
}`;
    } else {
      prompt += `

Responde SOLO JSON (sin texto antes ni después):
{"items": [{"item": "4.1", "nombre": "...", "especificaciones": "...", "cantidad": "10", "unidad": "Unidades"}]}`;
    }

    // ── 4) Generar con Gemini (con fallback de modelo) ───────────────────────
    console.log('[leer-bases] Generando con Gemini...');
    const txt = await generarConGemini(prompt, fileUri);

    // ── 5) Parsear respuesta ─────────────────────────────────────────────────
    let parsed: Record<string, unknown> = {};
    if (txt) {
      parsed = parsearJSONSeguro(txt);
    }

    const items: unknown[] = Array.isArray(parsed.items) ? parsed.items : [];
    const enriquecidos: unknown[] = Array.isArray(parsed.enriquecidos) ? parsed.enriquecidos : [];

    if (!items.length && !enriquecidos.length) {
      console.warn('[leer-bases] Gemini no extrajo ítems. Respuesta:', txt.slice(0, 300));
      return NextResponse.json(
        { error: 'Gemini no encontró ítems en el PDF. Verifica que el documento sea un PDF de bases legible (no escaneado sin OCR).' },
        { status: 422 }
      );
    }

    // ── 6) Limpiar PDF temporal del storage ──────────────────────────────────
    supabase.storage.from(bucket).remove([path]).catch(() => {});

    console.log(`[leer-bases] Éxito: ${items.length} ítems, ${enriquecidos.length} enriquecidos`);

    return NextResponse.json({
      ok: true,
      total: items.length,
      modelo_usado: 'gemini',
      items: (items as Record<string, unknown>[]).map((it) => ({
        item: String(it.item ?? '').trim(),
        nombre: String(it.nombre ?? '').trim(),
        especificaciones: String(it.especificaciones ?? '').trim(),
        cantidad: String(it.cantidad ?? '').trim(),
        unidad: String(it.unidad ?? '').trim(),
      })),
      enriquecidos: (enriquecidos as Record<string, unknown>[]).map((e) => ({
        numero: String(e.numero ?? '').trim(),
        busqueda: String(e.busqueda ?? '').trim(),
        agregado: String(e.agregado ?? '').trim(),
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    console.error('[leer-bases] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
