// lib/gemini/documentos.ts
// Utilidades compartidas para subir documentos a Gemini File API, generar
// contenido multimodal (multi-archivo) y parsear respuestas JSON tolerantes.
// Usado por: app/api/leer-bases (1 PDF) y app/api/viabilidad-analizar (N documentos).
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import * as XLSX from 'xlsx';

export const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
export const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

// Modelos en orden de preferencia (actualizado junio 2026)
// Retirados: gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro
export const GEMINI_MODELS = [
  'gemini-3.5-flash',   // Actual estable — mejor para PDFs largos
  'gemini-2.5-flash',   // Fallback rápido
  'gemini-2.5-pro',     // Fallback con mayor contexto
  'gemini-2.5-flash-lite', // Fallback ligero
];

export type GeminiPart =
  | { text: string }
  | { fileData: { mimeType: string; fileUri: string } };

// ─── Subir archivo a Gemini (con reintentos) ─────────────────────────────────

export async function subirArchivoAGemini(
  bytes: ArrayBuffer,
  size: number,
  mimeType: string,
  displayName: string
): Promise<string> {
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
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: displayName } }),
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
          'Content-Type': mimeType,
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
          if (st?.state === 'FAILED') throw new Error('Gemini FAILED al procesar el archivo');
        } catch (e: unknown) {
          if ((e as Error)?.message?.includes('FAILED')) throw e;
        }
      }
      throw new Error('Timeout >90s esperando que Gemini procese el archivo');
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === 0) {
        console.warn(`[gemini] upload intento 1 falló: ${lastError.message} — reintentando...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }
  throw lastError ?? new Error('Error desconocido subiendo el archivo');
}

// ─── Una llamada a Gemini con timeout ────────────────────────────────────────

export async function llamarGemini(
  model: string,
  parts: GeminiPart[],
  forceJson: boolean,
  maxOutputTokens = 16384
): Promise<string | null> {
  const genBody: Record<string, unknown> = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens,
      ...(forceJson ? { responseMimeType: 'application/json' } : {}),
    },
  };

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 110000);
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
      console.warn(`[gemini] ${model} 429 rate-limit, esperando 8s...`);
      await new Promise((r) => setTimeout(r, 8000));
      return null;
    }
    if (res.status === 403) {
      const t = await res.text().catch(() => '');
      console.warn(`[gemini] ${model} 403 sin acceso (API key o región): ${t.slice(0, 200)}`);
      return null;
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.warn(`[gemini] ${model} HTTP ${res.status}: ${t.slice(0, 300)}`);
      return null;
    }

    const out = await res.json().catch(() => ({}));
    const txt: string = out?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!txt || txt.trim().length < 20) {
      const reason = out?.candidates?.[0]?.finishReason || '';
      const block  = out?.promptFeedback?.blockReason || '';
      const safety = JSON.stringify(out?.candidates?.[0]?.safetyRatings || []);
      console.warn(`[gemini] ${model} forceJson=${forceJson} respuesta vacía — reason=${reason} block=${block} safety=${safety}`);
      return null;
    }
    return txt;
  } catch (e: unknown) {
    clearTimeout(tid);
    const msg = (e as Error)?.message || String(e);
    console.warn(`[gemini] ${model} excepción (forceJson=${forceJson}): ${msg.slice(0, 200)}`);
    return null;
  }
}

// ─── Generar con Gemini: estrategia dual + fallback de modelos ───────────────

export async function generarConGemini(parts: GeminiPart[], maxOutputTokens = 16384): Promise<string> {
  console.log(`[gemini] Intentando con modelos: ${GEMINI_MODELS.join(', ')}`);

  for (const model of GEMINI_MODELS) {
    console.log(`[gemini] → Probando ${model} (JSON-mode)...`);

    // Intento A: CON responseMimeType=json (respuesta limpia)
    const txtJson = await llamarGemini(model, parts, true, maxOutputTokens);
    if (txtJson && txtJson.trim().length > 30) {
      console.log(`[gemini] ✅ ${model} JSON-mode OK — ${txtJson.length} chars`);
      return txtJson;
    }

    console.log(`[gemini] → Probando ${model} (texto-libre)...`);

    // Intento B: SIN responseMimeType (texto libre con JSON dentro)
    const txtLibre = await llamarGemini(model, parts, false, maxOutputTokens);
    if (txtLibre && txtLibre.trim().length > 30) {
      console.log(`[gemini] ✅ ${model} texto-libre OK — ${txtLibre.length} chars`);
      return txtLibre;
    }

    console.warn(`[gemini] ❌ ${model} falló ambos intentos, probando siguiente modelo...`);
  }

  throw new Error(
    `Ningún modelo de Gemini pudo procesar el documento. ` +
    `Modelos probados: ${GEMINI_MODELS.join(', ')}. ` +
    `Verifica que la API key tenga acceso a estos modelos en https://aistudio.google.com`
  );
}

// ─── Parser JSON ultra-tolerante ─────────────────────────────────────────────
// Intenta extraer datos aunque el JSON esté truncado, mal formado o use claves distintas.

export function parsearJSONSeguro(txt: string, sinonimos?: Record<string, string>): Record<string, unknown> {
  if (!txt || txt.trim().length < 5) throw new Error('Respuesta de Gemini vacía');

  console.log(`[gemini] Parseando ${txt.length} chars. Preview: ${txt.slice(0, 200).replace(/\n/g, ' ')}`);

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
          console.log('[gemini] Intento 1 OK (JSON completo)');
          return normalizarClaves(parsed, sinonimos);
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
          console.log('[gemini] Intento 2 OK (array en raíz)');
          return { items: arr };
        }
      } catch { /* continuar */ }
    }
  }

  // ── Intento 3: JSON truncado — completar comillas/llaves faltantes ────────
  if (primeraLlave >= 0) {
    const candidatoOriginal = limpio.slice(primeraLlave);
    let abiertas = 0, corchetes = 0, enString = false;
    for (let i = 0; i < candidatoOriginal.length; i++) {
      const ch = candidatoOriginal[i];
      if (ch === '"' && candidatoOriginal[i - 1] !== '\\') enString = !enString;
      if (!enString) {
        if (ch === '{') abiertas++;
        else if (ch === '}') abiertas--;
        else if (ch === '[') corchetes++;
        else if (ch === ']') corchetes--;
      }
    }

    if (abiertas > 0 || corchetes > 0 || enString) {
      // Intento 3a: cerrar el string que quedó abierto (si lo hay) y las llaves/corchetes pendientes
      const reparado = candidatoOriginal.replace(/,\s*$/, '')
        + (enString ? '"' : '')
        + ']'.repeat(Math.max(corchetes, 0))
        + '}'.repeat(Math.max(abiertas, 0));
      try {
        const parsed = JSON.parse(reparado);
        if (typeof parsed === 'object') {
          console.log('[gemini] Intento 3a OK (JSON truncado reparado, string cerrado)');
          return normalizarClaves(parsed, sinonimos);
        }
      } catch { /* continuar */ }

      // Intento 3b: descartar el último par clave-valor incompleto y cerrar
      const ultimoObj = candidatoOriginal.lastIndexOf('},');
      const corte = Math.max(ultimoObj, 0);
      if (corte > 50) {
        let candidato = candidatoOriginal.slice(0, corte + 1);
        let a = 0, c = 0;
        for (const ch of candidato) { if (ch === '{') a++; if (ch === '}') a--; if (ch === '[') c++; if (ch === ']') c--; }
        if (c > 0) candidato += ']'.repeat(c);
        if (a > 0) candidato += '}'.repeat(a);
        try {
          const parsed = JSON.parse(candidato);
          if (typeof parsed === 'object') {
            console.log('[gemini] Intento 3b OK (JSON truncado recuperado)');
            return normalizarClaves(parsed, sinonimos);
          }
        } catch { /* continuar */ }
      }
    }
  }

  // ── Intento 4: Extracción de arrays por clave con regex ───────────────────
  const result: Record<string, unknown> = {};
  const clavesItems = ['items', 'ítems', 'productos', 'productos_encontrados', 'lista', 'lista_items', 'detalle', 'articulos'];
  const clavesEnrich = ['enriquecidos', 'busquedas', 'mejorados', 'optimizados'];

  for (const clave of clavesItems) {
    const re = new RegExp(`"${clave}"\\s*:\\s*(\\[)`, 'i');
    const match = re.exec(limpio);
    if (match) {
      const start = match.index + match[0].length - 1;
      const fragmento = extraerArrayBalanceado(limpio, start);
      if (fragmento) {
        try { result.items = JSON.parse(fragmento); console.log(`[gemini] Intento 4 OK — clave "${clave}"`); break; } catch { /* continuar */ }
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
    console.log('[gemini] Intento 4 OK (regex array)');
    return result;
  }

  throw new Error(
    `Gemini devolvió texto no procesable (${txt.length} chars). ` +
    `Inicio: "${txt.slice(0, 150).replace(/\n/g, ' ')}"`
  );
}

// Extrae un array JSON balanceado a partir de la posición del '[' de apertura
export function extraerArrayBalanceado(txt: string, inicio: number): string | null {
  let depth = 0;
  for (let i = inicio; i < txt.length; i++) {
    const c = txt[i];
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') { depth--; if (depth === 0) return txt.slice(inicio, i + 1); }
  }
  const fragmento = txt.slice(inicio);
  const ultimaObj = fragmento.lastIndexOf('},');
  if (ultimaObj > 10) {
    const recortado = fragmento.slice(0, ultimaObj + 1) + ']';
    return recortado;
  }
  return null;
}

// ─── Extracción de texto desde documentos Office ─────────────────────────────
// Gemini generateContent no soporta Word/Excel como fileData, así que el texto
// se extrae aquí y se envía como parte de tipo {text} dentro del prompt.

const MIME_OFFICE_TEXTO = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword',                                                       // .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',        // .xlsx
  'application/vnd.ms-excel',                                                 // .xls
]);

export function esDocumentoOffice(mimeType: string): boolean {
  return MIME_OFFICE_TEXTO.has(mimeType);
}

export async function extraerTextoOffice(bytes: ArrayBuffer, mimeType: string, nombre: string): Promise<string> {
  const buffer = Buffer.from(bytes);

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const { value } = await mammoth.extractRawText({ buffer });
    return value.trim();
  }

  if (mimeType === 'application/msword') {
    const doc = await new WordExtractor().extract(buffer);
    return doc.getBody().trim();
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mimeType === 'application/vnd.ms-excel') {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    return wb.SheetNames.map((name) => {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
      return `--- Hoja: ${name} ---\n${csv}`;
    }).join('\n\n').trim();
  }

  throw new Error(`No se pudo extraer texto de "${nombre}": tipo no soportado (${mimeType})`);
}

// Normaliza claves: si Gemini usó "productos" en vez de "items", etc.
export function normalizarClaves(obj: Record<string, unknown>, extra?: Record<string, string>): Record<string, unknown> {
  const sinonimos: Record<string, string> = {
    productos: 'items', ítems: 'items', lista: 'items', articulos: 'items',
    busquedas: 'enriquecidos', mejorados: 'enriquecidos', optimizados: 'enriquecidos',
    ...(extra || {}),
  };
  const resultado: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    resultado[sinonimos[k.toLowerCase()] || k] = v;
  }
  return resultado;
}
