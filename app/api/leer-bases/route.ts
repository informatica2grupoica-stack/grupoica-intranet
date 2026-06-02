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
  try {
    const body = await req.json();
    bucket = body.bucket || 'bases-licitaciones';
    path = body.path;
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

    const prompt = `Eres experto en licitaciones de Mercado Público Chile. Este PDF son las BASES de una licitación.
Extrae TODOS los productos/ítems solicitados con sus especificaciones técnicas completas.
Para cada ítem incluye: número de ítem, nombre del producto, especificaciones técnicas detalladas
(medidas, materiales, marcas de referencia "equivalente/similar/superior a X"), cantidad y unidad de medida.
Responde SOLO JSON con esta forma exacta:
{"items":[{"item":"4.1","nombre":"...","especificaciones":"...","cantidad":"10","unidad":"Unidades"}]}`;

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
    let items: any[] = [];
    try {
      items = JSON.parse(txt).items || [];
    } catch {
      return NextResponse.json({ error: 'Gemini devolvió formato inesperado' }, { status: 500 });
    }

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
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error procesando el PDF' }, { status: 500 });
  }
}
