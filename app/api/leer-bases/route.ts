// app/api/leer-bases/route.ts
// Lee un PDF de bases de licitación (incluso escaneado) con Gemini y extrae
// los productos con sus especificaciones técnicas, cantidades y unidades.
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

async function subirAGemini(bytes: ArrayBuffer, size: number): Promise<string> {
  // 1) Iniciar upload resumable
  const start = await fetch(`${GEMINI_BASE}/upload/v1beta/files?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(size),
      'X-Goog-Upload-Header-Content-Type': 'application/pdf',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'bases.pdf' } }),
  });
  const uploadUrl = start.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) throw new Error('Gemini no entregó URL de subida');

  // 2) Subir bytes
  const up = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Command': 'upload, finalize', 'X-Goog-Upload-Offset': '0', 'Content-Length': String(size) },
    body: bytes,
  });
  const info = await up.json();
  const fileUri = info?.file?.uri;
  const fileName = info?.file?.name;
  if (!fileUri) throw new Error('Gemini no devolvió el archivo subido');

  // 3) Esperar a que esté ACTIVE (procesado)
  for (let i = 0; i < 25; i++) {
    const r = await fetch(`${GEMINI_BASE}/v1beta/${fileName}?key=${GEMINI_KEY}`);
    const st = await r.json();
    if (st?.state === 'ACTIVE') return fileUri;
    if (st?.state === 'FAILED') throw new Error('Gemini falló al procesar el PDF');
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error('Tiempo de espera agotado procesando el PDF');
}

export async function POST(req: Request) {
  if (!GEMINI_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 });

  let bucket = '', path = '';
  let itemsExcel: Array<{ numero: string; detalle: string; conversion?: string }> = [];
  try {
    const body = await req.json();
    bucket = body.bucket || 'bases-licitaciones';
    path = body.path;
    itemsExcel = Array.isArray(body.itemsExcel) ? body.itemsExcel.slice(0, 120) : [];
    if (!path) return NextResponse.json({ error: 'Falta path del PDF' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  try {
    // Descargar el PDF desde Supabase Storage (lo subió el navegador)
    const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path);
    if (dlErr || !blob) return NextResponse.json({ error: `No se pudo leer el PDF: ${dlErr?.message}` }, { status: 400 });
    const bytes = await blob.arrayBuffer();

    // Subir a Gemini y extraer
    const fileUri = await subirAGemini(bytes, bytes.byteLength);

    let prompt = `Eres experto en licitaciones de Mercado Público Chile. Este PDF son las BASES de una licitación.
Extrae TODOS los productos/ítems solicitados con sus especificaciones técnicas completas.
Para cada ítem incluye: número, nombre, especificaciones técnicas detalladas
(medidas, materiales, marcas de referencia "equivalente/similar/superior a X"), cantidad y unidad.`;

    if (itemsExcel.length) {
      prompt += `

ADEMÁS, tengo esta lista de ítems de mi COSTEO (Excel) que voy a cotizar:
${JSON.stringify(itemsExcel.map((i) => ({ numero: i.numero, detalle: i.detalle })))}

Tu tarea PRINCIPAL: para CADA ítem de MI costeo, genera una "busqueda" mejorada que sea lo que conviene
escribir en un buscador de productos para encontrar EXACTAMENTE lo que piden las bases.
- Si al ítem le faltan especificaciones (medida, material, marca de referencia, color, capacidad), COMPLÉTALO con lo que dicen las bases.
- Si el ítem ya está bien descrito, devuelve la búsqueda igual o casi igual.
- NO inventes specs que no estén en las bases. Mantén el nombre base del producto.
- Empareja cada ítem de mi costeo con el ítem correspondiente de las bases por significado, no solo por texto.

Responde SOLO JSON con esta forma EXACTA:
{
  "items":[{"item":"4.1","nombre":"...","especificaciones":"...","cantidad":"10","unidad":"Unidades"}],
  "enriquecidos":[{"numero":"1","busqueda":"texto mejorado para buscar","agregado":"qué specs se añadieron (o vacío si no faltaba nada)"}]
}`;
    } else {
      prompt += `
Responde SOLO JSON: {"items":[{"item":"4.1","nombre":"...","especificaciones":"...","cantidad":"10","unidad":"Unidades"}]}`;
    }

    const genBody = {
      contents: [{ parts: [{ text: prompt }, { fileData: { mimeType: 'application/pdf', fileUri } }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json' },
    };
    const gen = await fetch(`${GEMINI_BASE}/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(genBody),
    });
    if (!gen.ok) {
      const t = await gen.text();
      return NextResponse.json({ error: `Gemini error: ${t.slice(0, 200)}` }, { status: 500 });
    }
    const out = await gen.json();
    const txt = out?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(txt);
    } catch {
      return NextResponse.json({ error: 'Gemini devolvió formato inesperado' }, { status: 500 });
    }
    const items: any[] = parsed.items || [];
    const enriquecidos: any[] = parsed.enriquecidos || [];

    // Limpiar: borrar el PDF temporal del storage
    supabase.storage.from(bucket).remove([path]).catch(() => {});

    return NextResponse.json({
      ok: true,
      total: items.length,
      items: items.map((it: any) => ({
        item: String(it.item ?? '').trim(),
        nombre: String(it.nombre ?? '').trim(),
        especificaciones: String(it.especificaciones ?? '').trim(),
        cantidad: String(it.cantidad ?? '').trim(),
        unidad: String(it.unidad ?? '').trim(),
      })),
      enriquecidos: enriquecidos.map((e: any) => ({
        numero: String(e.numero ?? '').trim(),
        busqueda: String(e.busqueda ?? '').trim(),
        agregado: String(e.agregado ?? '').trim(),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error procesando el PDF' }, { status: 500 });
  }
}
