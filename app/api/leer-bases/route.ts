// app/api/leer-bases/route.ts
// Lee un PDF de bases de licitación con Gemini.
// Estrategia robusta: dual call (con/sin JSON mode), parser tolerante, reformateo de emergencia.
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

// Modelos en orden de preferencia (actualizado junio 2026)
// Retirados: gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro
const GEMINI_MODELS = [
  'gemini-3.5-flash',   // Actual estable — mejor para PDFs largos
  'gemini-2.5-flash',   // Fallback rápido
  'gemini-2.5-pro',     // Fallback con mayor contexto
  'gemini-2.5-flash-lite', // Fallback ligero
];

// ─── Subir PDF a Gemini (con reintentos) ─────────────────────────────────────

async function subirAGemini(bytes: ArrayBuffer, size: number): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ctrlStart = new AbortController();
      const tidStart = setTimeout(() => ctrlStart.abort(), 25000);
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
        const t = await start.text().catch(() => '');
        throw new Error(`Upload init ${start.status}: ${t.slice(0, 150)}`);
      }

      const uploadUrl = start.headers.get('X-Goog-Upload-URL');
      if (!uploadUrl) throw new Error('Gemini no entregó URL de subida');

      const ctrlUp = new AbortController();
      const tidUp = setTimeout(() => ctrlUp.abort(), 90000);
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
        const t = await up.text().catch(() => '');
        throw new Error(`Upload falló ${up.status}: ${t.slice(0, 150)}`);
      }

      const info = await up.json().catch(() => ({}));
      const fileUri = info?.file?.uri;
      const fileName = info?.file?.name;
      if (!fileUri || !fileName) throw new Error('Gemini no devolvió URI del archivo');

      // Esperar ACTIVE
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 8000);
          const r = await fetch(`${GEMINI_BASE}/v1beta/${fileName}?key=${GEMINI_KEY}`, { signal: ctrl.signal });
          clearTimeout(tid);
          if (!r.ok) continue;
          const st = await r.json().catch(() => ({}));
          if (st?.state === 'ACTIVE') return fileUri;
          if (st?.state === 'FAILED') throw new Error('Gemini FAILED al procesar el PDF');
        } catch (e: unknown) {
          if ((e as Error)?.message?.includes('FAILED')) throw e;
        }
      }
      throw new Error('Timeout >90s esperando que Gemini procese el PDF');
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === 0) {
        console.warn(`[leer-bases] upload intento 1 falló: ${lastError.message} — reintentando...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }
  throw lastError ?? new Error('Error desconocido subiendo el PDF');
}

// ─── Una llamada a Gemini con timeout ────────────────────────────────────────

async function llamarGemini(
  model: string,
  prompt: string,
  fileUri: string,
  forceJson: boolean
): Promise<string | null> {
  const genBody: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }, { fileData: { mimeType: 'application/pdf', fileUri } }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 16384,
      ...(forceJson ? { responseMimeType: 'application/json' } : {}),
    },
  };

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 90000);
  try {
    const url = `${GEMINI_BASE}/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(genBody),
    });
    clearTimeout(tid);

    if (res.status === 429) {
      console.warn(`[leer-bases] ${model} 429 rate-limit, esperando 8s...`);
      await new Promise((r) => setTimeout(r, 8000));
      return null;
    }
    if (res.status === 403) {
      const t = await res.text().catch(() => '');
      console.warn(`[leer-bases] ${model} 403 sin acceso (API key o región): ${t.slice(0, 200)}`);
      return null;
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.warn(`[leer-bases] ${model} HTTP ${res.status}: ${t.slice(0, 300)}`);
      return null;
    }

    const out = await res.json().catch(() => ({}));
    const txt: string = out?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!txt || txt.trim().length < 20) {
      const reason = out?.candidates?.[0]?.finishReason || '';
      const block  = out?.promptFeedback?.blockReason || '';
      const safety = JSON.stringify(out?.candidates?.[0]?.safetyRatings || []);
      console.warn(`[leer-bases] ${model} forceJson=${forceJson} respuesta vacía — reason=${reason} block=${block} safety=${safety}`);
      return null;
    }
    return txt;
  } catch (e: unknown) {
    clearTimeout(tid);
    const msg = (e as Error)?.message || String(e);
    console.warn(`[leer-bases] ${model} excepción (forceJson=${forceJson}): ${msg.slice(0, 200)}`);
    return null;
  }
}

// ─── Generar con Gemini: estrategia dual + fallback de modelos ───────────────

async function generarConGemini(prompt: string, fileUri: string): Promise<string> {
  console.log(`[leer-bases] Intentando con modelos: ${GEMINI_MODELS.join(', ')}`);

  for (const model of GEMINI_MODELS) {
    console.log(`[leer-bases] → Probando ${model} (JSON-mode)...`);

    // Intento A: CON responseMimeType=json (respuesta limpia)
    const txtJson = await llamarGemini(model, prompt, fileUri, true);
    if (txtJson && txtJson.trim().length > 30) {
      console.log(`[leer-bases] ✅ ${model} JSON-mode OK — ${txtJson.length} chars`);
      return txtJson;
    }

    console.log(`[leer-bases] → Probando ${model} (texto-libre)...`);

    // Intento B: SIN responseMimeType (texto libre con JSON dentro)
    const txtLibre = await llamarGemini(model, prompt, fileUri, false);
    if (txtLibre && txtLibre.trim().length > 30) {
      console.log(`[leer-bases] ✅ ${model} texto-libre OK — ${txtLibre.length} chars`);
      return txtLibre;
    }

    console.warn(`[leer-bases] ❌ ${model} falló ambos intentos, probando siguiente modelo...`);
  }

  throw new Error(
    `Ningún modelo de Gemini pudo procesar el PDF. ` +
    `Modelos probados: ${GEMINI_MODELS.join(', ')}. ` +
    `Verifica que la API key tenga acceso a estos modelos en https://aistudio.google.com`
  );
}

// ─── Parser JSON ultra-tolerante ─────────────────────────────────────────────
// Intenta extraer datos aunque el JSON esté truncado, mal formado o use claves distintas.

function parsearJSONSeguro(txt: string): Record<string, unknown> {
  if (!txt || txt.trim().length < 5) throw new Error('Respuesta de Gemini vacía');

  console.log(`[leer-bases] Parseando ${txt.length} chars. Preview: ${txt.slice(0, 200).replace(/\n/g, ' ')}`);

  let limpio = txt.trim();

  // Quitar markdown
  limpio = limpio.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();

  // ── Intento 1: JSON completo directo ─────────────────────────────────────
  const primeraLlave = limpio.indexOf('{');
  if (primeraLlave >= 0) {
    const candidato = limpio.slice(primeraLlave);
    const ultimaLlave = candidato.lastIndexOf('}');
    if (ultimaLlave >= 0) {
      try {
        const parsed = JSON.parse(candidato.slice(0, ultimaLlave + 1));
        if (typeof parsed === 'object') {
          console.log('[leer-bases] Intento 1 OK (JSON completo)');
          return normalizarClaves(parsed);
        }
      } catch { /* continuar */ }
    }
  }

  // ── Intento 2: Array en raíz (Gemini devolvió [...] en vez de {...}) ──────
  const primerCorchete = limpio.indexOf('[');
  if (primerCorchete >= 0 && (primeraLlave < 0 || primerCorchete < primeraLlave)) {
    const candidato = limpio.slice(primerCorchete);
    const ultimoCorchete = candidato.lastIndexOf(']');
    if (ultimoCorchete >= 0) {
      try {
        const arr = JSON.parse(candidato.slice(0, ultimoCorchete + 1));
        if (Array.isArray(arr)) {
          console.log('[leer-bases] Intento 2 OK (array en raíz)');
          return { items: arr };
        }
      } catch { /* continuar */ }
    }
  }

  // ── Intento 3: JSON truncado — completar llaves faltantes ─────────────────
  if (primeraLlave >= 0) {
    let candidato = limpio.slice(primeraLlave);
    // Contar llaves abiertas para determinar cuántas faltan
    let abiertas = 0;
    let corchetes = 0;
    for (const ch of candidato) {
      if (ch === '{') abiertas++;
      if (ch === '}') abiertas--;
      if (ch === '[') corchetes++;
      if (ch === ']') corchetes--;
    }
    // Completar cierre
    // Primero cerrar strings incompletos simplemente truncando en el último '}' conocido
    if (abiertas > 0 || corchetes > 0) {
      // Quitar la parte truncada hasta el último objeto completo
      const ultimoObj = candidato.lastIndexOf('},');
      const ultimoObjFin = candidato.lastIndexOf('}');
      const corte = Math.max(ultimoObj, 0);
      if (corte > 50) {
        candidato = candidato.slice(0, corte + 1);
        // Cerrar arrays/objetos que quedaron abiertos
        let a = 0, c = 0;
        for (const ch of candidato) { if (ch === '{') a++; if (ch === '}') a--; if (ch === '[') c++; if (ch === ']') c--; }
        if (c > 0) candidato += ']'.repeat(c);
        if (a > 0) candidato += '}'.repeat(a);
        try {
          const parsed = JSON.parse(candidato);
          if (typeof parsed === 'object') {
            console.log('[leer-bases] Intento 3 OK (JSON truncado recuperado)');
            return normalizarClaves(parsed);
          }
        } catch { /* continuar */ }
      }
    }
  }

  // ── Intento 4: Extracción de arrays por clave con regex ───────────────────
  const result: Record<string, unknown> = {};
  // Buscar tanto claves estándar como variantes que Gemini pueda usar
  const clavesItems = ['items', 'ítems', 'productos', 'productos_encontrados', 'lista', 'lista_items', 'detalle', 'articulos'];
  const clavesEnrich = ['enriquecidos', 'busquedas', 'mejorados', 'optimizados'];

  for (const clave of clavesItems) {
    const re = new RegExp(`"${clave}"\\s*:\\s*(\\[)`, 'i');
    const match = re.exec(limpio);
    if (match) {
      const start = match.index + match[0].length - 1;
      const fragmento = extraerArrayBalanceado(limpio, start);
      if (fragmento) {
        try { result.items = JSON.parse(fragmento); console.log(`[leer-bases] Intento 4 OK — clave "${clave}"`); break; } catch { /* continuar */ }
      }
    }
  }
  for (const clave of clavesEnrich) {
    const re = new RegExp(`"${clave}"\\s*:\\s*(\\[)`, 'i');
    const match = re.exec(limpio);
    if (match) {
      const start = match.index + match[0].length - 1;
      const fragmento = extraerArrayBalanceado(limpio, start);
      if (fragmento) {
        try { result.enriquecidos = JSON.parse(fragmento); break; } catch { /* continuar */ }
      }
    }
  }

  if (Object.keys(result).length > 0) {
    console.log('[leer-bases] Intento 4 OK (regex array)');
    return result;
  }

  // No se pudo parsear — lanzar con preview del contenido recibido
  throw new Error(
    `Gemini devolvió texto no procesable (${txt.length} chars). ` +
    `Inicio: "${txt.slice(0, 150).replace(/\n/g, ' ')}"`
  );
}

// Extrae un array JSON balanceado a partir de la posición del '[' de apertura
function extraerArrayBalanceado(txt: string, inicio: number): string | null {
  let depth = 0;
  for (let i = inicio; i < txt.length; i++) {
    const c = txt[i];
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') { depth--; if (depth === 0) return txt.slice(inicio, i + 1); }
  }
  // Array truncado — intentar completar con último objeto completo
  const fragmento = txt.slice(inicio);
  const ultimaObj = fragmento.lastIndexOf('},');
  if (ultimaObj > 10) {
    const recortado = fragmento.slice(0, ultimaObj + 1) + ']';
    return recortado;
  }
  return null;
}

// Normaliza claves: si Gemini usó "productos" en vez de "items", etc.
function normalizarClaves(obj: Record<string, unknown>): Record<string, unknown> {
  const sinonimos: Record<string, string> = {
    productos: 'items', ítems: 'items', lista: 'items', articulos: 'items',
    busquedas: 'enriquecidos', mejorados: 'enriquecidos', optimizados: 'enriquecidos',
  };
  const resultado: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    resultado[sinonimos[k.toLowerCase()] || k] = v;
  }
  return resultado;
}

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
    const fileUri = await subirAGemini(bytes, bytes.byteLength);
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
    const txt = await generarConGemini(prompt, fileUri);

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
