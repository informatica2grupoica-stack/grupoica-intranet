// app/api/buscar-productos/route.ts
// Búsqueda de productos en Vercel — llama a Serper (Google Shopping) directo.
// Reemplaza al servidor Flask del notebook. Devuelve el MISMO contrato que /python/busqueda-robusta.
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SERPER_KEY = process.env.SERPER_API_KEY || '';
const IVA = 1.19;

const INDICADORES_EXTRANJEROS = [
  'amazon', 'ebay', 'aliexpress', 'wish.com', 'walmart', 'home depot', 'homedepot',
  'lowes', 'alibaba', 'etsy', 'temu', 'shein', 'banggood', 'dhgate',
  '.com.ar', '.com.mx', '.com.pe', '.com.co', '.com.br',
];

// ─── Utilidades de texto/score ────────────────────────────────────────────────
function normalizar(t: string): string {
  return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function limpiarNombre(n: string): string {
  return (n || '')
    .replace(/\s*[\|–—]\s*.*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function limpiarPrecio(raw: any): number | null {
  const s = String(raw ?? '').replace(/[^\d]/g, '');
  if (!s) return null;
  const p = parseInt(s, 10);
  return p >= 500 && p <= 500_000_000 ? p : null;
}

function tokens(s: string): string[] {
  return normalizar(s).split(/\s+/).filter((w) => w.length > 2);
}

// Score 0-100: solapamiento de palabras + bonus por números/medidas coincidentes
function calcularScore(buscado: string, encontrado: string): number {
  const b = tokens(buscado);
  const e = new Set(tokens(encontrado));
  if (!b.length) return 50;
  const comunes = b.filter((w) => e.has(w)).length;
  const jaccard = comunes / b.length;
  // Números/medidas (ej: 2", 12mm, 25kg)
  const numsB = (normalizar(buscado).match(/\d+(?:[.,]\d+)?/g) || []);
  const numsE = new Set(normalizar(encontrado).match(/\d+(?:[.,]\d+)?/g) || []);
  let bonusNum = 0;
  if (numsB.length) {
    const m = numsB.filter((n) => numsE.has(n)).length / numsB.length;
    bonusNum = m * 15;
  }
  const score = Math.round(jaccard * 80 + bonusNum + (comunes > 0 ? 5 : 0));
  return Math.max(0, Math.min(100, score));
}

function nivelConcordancia(score: number): [string, string] {
  if (score >= 90) return ['exacta', '✅ Coincidencia exacta'];
  if (score >= 75) return ['alta', '🟢 Alta coincidencia'];
  if (score >= 60) return ['parcial', '🟡 Coincidencia parcial'];
  if (score >= 40) return ['baja', '🟠 Baja coincidencia'];
  return ['nula', '🔴 Sin coincidencia'];
}

// Detector de empaque: avisa si el resultado no calza con la unidad pedida
const PATRONES_EMPAQUE: [RegExp, string][] = [
  [/\bcaja\b|\bcajas\b/i, 'caja'],
  [/\bpack\b|\bpaquete\b|\bset\b|\bkit\b/i, 'pack'],
  [/\bbolsa\b|\bsaco\b/i, 'bolsa/saco'],
  [/\b\d+\s*(un|unid|unidades|pcs|piezas)\b/i, 'multipack'],
  [/\bdocena\b/i, 'docena'],
  [/\b\d+\s*kg\b/i, 'por kg'],
  [/\bgal[oó]n\b|\bgl\b/i, 'galón'],
  [/\brollo\b|\bbobina\b/i, 'rollo'],
];

function detectarEmpaque(nombre: string, conversion: string): [string, boolean] {
  const n = normalizar(nombre);
  const conv = (conversion || 'unidad').toLowerCase().trim();
  let empaque = '';
  for (const [re, label] of PATRONES_EMPAQUE) {
    if (re.test(n)) { empaque = label; break; }
  }
  if (!empaque) return ['unidad', false];
  if (['unidad', 'und', 'un', ''].includes(conv)) {
    if (['caja', 'pack', 'multipack', 'docena', 'por kg', 'rollo'].includes(empaque)) return [empaque, true];
    return [empaque, false];
  }
  return [empaque, false];
}

function clasificarCategoria(nombre: string): string {
  const n = normalizar(nombre);
  if (/madera|pino|mdf|osb|terciado|tabla/.test(n)) return 'madera';
  if (/fierro|acero|tubo|perfil|barra|viga|plancha/.test(n)) return 'metal_acero';
  if (/cemento|hormigon|arena|grava|mortero/.test(n)) return 'cemento_hormigon';
  if (/pintura|esmalte|latex|barniz|anticorrosivo|oleo/.test(n)) return 'pintura_recubrimiento';
  if (/letrero|senal|transito|valla|cono/.test(n)) return 'senaletica';
  return 'ferreteria_general';
}

// ─── Expansión inteligente con IA (solo términos vagos) ─────────────────────
const STOPWORDS = new Set(['con', 'para', 'por', 'los', 'las', 'del', 'una', 'uno', 'marca', 'similar', 'unidades', 'unidad', 'medidas', 'varias', 'de', 'el', 'la', 'o']);

function tokensSignificativos(s: string): string[] {
  return normalizar(s).split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

// Devuelve 1-3 consultas. Si el término es vago, la IA propone variantes específicas.
async function expandirConsulta(producto: string, contexto: string): Promise<string[]> {
  const toks = tokensSignificativos(producto);
  const esVago = toks.length <= 2; // ej: "arena", "cemento", "clavo"
  if (!esVago || !process.env.DEEPSEEK_API_KEY) return [producto];
  try {
    const ctxLine = contexto?.trim()
      ? `Rubro/contexto del usuario: ${contexto}.`
      : 'Rubro: ferretería y construcción en Chile.';
    const prompt = `Eres experto en productos de ferretería y construcción en Chile. ${ctxLine}
El usuario busca: "${producto}". El término es vago o incompleto.
Devuelve un JSON con 2 o 3 variantes ESPECÍFICAS y comunes en el mercado chileno que cubran las opciones más probables.
Ejemplos:
- "arena" -> {"queries":["arena fina","arena gruesa"]}
- "cemento" -> {"queries":["cemento corriente 25kg","cemento alta resistencia 25kg"]}
- "clavo" -> {"queries":["clavo corriente","clavo galvanizado"]}
Responde SOLO el JSON.`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: producto }],
        temperature: 0.2, max_tokens: 200, response_format: { type: 'json_object' },
      }),
    });
    clearTimeout(tid);
    if (!r.ok) return [producto];
    const d = await r.json();
    const parsed = JSON.parse(d.choices?.[0]?.message?.content || '{}');
    const queries: string[] = Array.isArray(parsed.queries) ? parsed.queries.filter((q: any) => typeof q === 'string' && q.trim()) : [];
    if (!queries.length) return [producto];
    // Incluir SIEMPRE el término original + variantes (deduplicado, máx 3)
    return Array.from(new Set([producto, ...queries])).slice(0, 3);
  } catch {
    return [producto];
  }
}

// ─── Serper ────────────────────────────────────────────────────────────────────
async function buscarSerper(producto: string, limite: number) {
  if (!SERPER_KEY) return [];
  const r = await fetch('https://google.serper.dev/shopping', {
    method: 'POST',
    headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: producto, gl: 'cl', hl: 'es', location: 'Chile' }),
  });
  if (!r.ok) return [];
  const data = await r.json();
  const items = data.shopping || [];
  const out: any[] = [];
  for (const it of items) {
    const nombre = limpiarNombre(it.title || '');
    if (nombre.length < 4) continue;
    let precio: number | null = null;
    if (it.priceValue) precio = Math.round(Number(it.priceValue));
    if (!precio) precio = limpiarPrecio(it.price);
    if (!precio) continue;
    const tienda = (it.source || 'Google Shopping').slice(0, 40);
    const link = it.link || '';
    if (INDICADORES_EXTRANJEROS.some((x) => tienda.toLowerCase().includes(x) || link.toLowerCase().includes(x))) continue;
    out.push({ tienda, nombre: nombre.slice(0, 150), precio_con_iva: precio, url: link, fuente: 'serper_shopping' });
    if (out.length >= limite) break;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const producto = (sp.get('producto') || '').trim();
  const numeroItem = sp.get('numero') || '';
  const minimo = parseInt(sp.get('minimo') || '15', 10);
  const conversion = (sp.get('conversion') || 'unidad').trim().toLowerCase();
  const contexto = (sp.get('contexto') || '').trim();

  if (!producto) {
    return NextResponse.json({
      numero_item: numeroItem, producto, resultados: [], total_encontrados: 0,
      suficientes: false, categoria: 'desconocida', analisis_producto: {},
    });
  }

  if (!SERPER_KEY) {
    return NextResponse.json({ error: 'SERPER_API_KEY no configurada en Vercel' }, { status: 500 });
  }

  let crudos: any[] = [];
  let queriesUsadas: string[] = [producto];
  try {
    // Expansión inteligente: si el término es vago, la IA genera variantes
    queriesUsadas = await expandirConsulta(producto, contexto);
    const lotes = await Promise.all(queriesUsadas.map((q) => buscarSerper(q, Math.max(minimo * 2, 20))));
    crudos = lotes.flat();
  } catch (e: any) {
    return NextResponse.json({
      numero_item: numeroItem, producto, resultados: [], total_encontrados: 0,
      suficientes: false, categoria: clasificarCategoria(producto), error: e.message,
    });
  }

  // Dedupe por url/nombre
  const vistos = new Set<string>();
  const categoria = clasificarCategoria(producto);
  const resultados = crudos
    .filter((r) => {
      const k = r.url || normalizar(r.nombre);
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .map((r) => {
      const score = calcularScore(producto, r.nombre);
      const [nivel, etiqueta] = nivelConcordancia(score);
      const [unidadDet, alertaUnidad] = detectarEmpaque(r.nombre, conversion);
      return {
        tienda: r.tienda,
        nombre: r.nombre,
        precio_valor: r.precio_con_iva,
        precio_neto: Math.round(r.precio_con_iva / IVA),
        precio_formateado: `$${r.precio_con_iva.toLocaleString('es-CL')}`,
        link: r.url,
        canal: r.fuente,
        pais: 'CL',
        busqueda_original: producto,
        score,
        nivel_concordancia: nivel,
        etiqueta_concordancia: etiqueta,
        categoria,
        conversion,
        unidad_detectada: unidadDet,
        alerta_unidad: alertaUnidad,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, minimo * 2);

  return NextResponse.json({
    numero_item: numeroItem,
    producto,
    categoria,
    resultados,
    total_encontrados: resultados.length,
    suficientes: resultados.length >= minimo,
    deficit: Math.max(0, minimo - resultados.length),
    pais_busqueda: 'CL',
    queries_ia: queriesUsadas,
    expandido_ia: queriesUsadas.length > 1,
    analisis_producto: {
      nombre_original: producto,
      categoria,
      palabras_clave: tokens(producto),
    },
  });
}
