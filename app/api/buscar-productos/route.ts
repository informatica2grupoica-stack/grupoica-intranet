// app/api/buscar-productos/route.ts
// Motor de búsqueda multi-etapa: query-understanding IA → Serper Shopping + Orgánico → ranking avanzado
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 55;

const SERPER_KEY = process.env.SERPER_API_KEY || '';
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const IVA = 1.19;

const INDICADORES_EXTRANJEROS = [
  'amazon', 'ebay', 'aliexpress', 'wish.com', 'walmart', 'home depot', 'homedepot',
  'lowes', 'alibaba', 'etsy', 'temu', 'shein', 'banggood', 'dhgate',
  '.com.ar', '.com.mx', '.com.pe', '.com.co', '.com.br',
];

// ─── Utilidades ───────────────────────────────────────────────────────────────

function normalizar(t: string): string {
  return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function limpiarNombre(n: string): string {
  return (n || '')
    .replace(/\s*[\|–—]\s*.*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function limpiarPrecio(raw: unknown): number | null {
  const s = String(raw ?? '').replace(/[^\d]/g, '');
  if (!s) return null;
  const p = parseInt(s, 10);
  return p >= 500 && p <= 500_000_000 ? p : null;
}

function tokens(s: string): string[] {
  return normalizar(s).replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
}

const SINONIMOS: Record<string, string> = {
  antiparra: 'lente', antiparras: 'lente', anteojo: 'lente', anteojos: 'lente', gafa: 'lente', gafas: 'lente',
  fierro: 'acero', golilla: 'arandela', golillas: 'arandela', pernos: 'perno', tornillos: 'tornillo',
  guantes: 'guante', botas: 'bota',
};

function raiz(w: string): string {
  let x = SINONIMOS[w] || w;
  if (x.length > 4 && x.endsWith('s')) x = x.slice(0, -1);
  return x;
}

function tokensMatch(s: string): string[] {
  return tokens(s).map(raiz);
}

function calcularScore(buscado: string, encontrado: string): number {
  const b = tokensMatch(buscado);
  const e = tokensMatch(encontrado);
  if (!b.length || !e.length) return 50;
  const setB = new Set(b), setE = new Set(e);
  const comunes = [...setB].filter((w) => setE.has(w)).length;
  if (comunes === 0) return 5;
  const cobertura = comunes / setB.size;
  const precision = comunes / setE.size;
  const f1 = (2 * cobertura * precision) / (cobertura + precision);
  const numsB = normalizar(buscado).match(/\d+(?:[.,]\d+)?/g) || [];
  const numsE = new Set(normalizar(encontrado).match(/\d+(?:[.,]\d+)?/g) || []);
  let bonusNum = 0;
  if (numsB.length) bonusNum = (numsB.filter((n) => numsE.has(n)).length / numsB.length) * 12;
  return Math.max(0, Math.min(100, Math.round(f1 * 85 + bonusNum)));
}

// ─── Bonus por entidades IA ───────────────────────────────────────────────────

function aplicarBonusEntidades(scoreBase: number, nombreResultado: string, entidades: Entidades): number {
  const n = normalizar(nombreResultado);
  let bonus = 0;
  if (entidades.marca && normalizar(entidades.marca).length > 1 && n.includes(normalizar(entidades.marca))) {
    bonus += 20;
  }
  if (entidades.modelo && normalizar(entidades.modelo).length > 1 && n.includes(normalizar(entidades.modelo))) {
    bonus += 15;
  }
  if (entidades.sku && normalizar(entidades.sku).length > 1 && n.includes(normalizar(entidades.sku))) {
    bonus += 20;
  }
  const specs = (entidades.specs || []).filter(Boolean).map(normalizar);
  if (specs.length) {
    const matches = specs.filter((s) => n.includes(s)).length;
    bonus += Math.min(15, matches * 5);
  }
  // Penalizar accesorios si no se busca accesorio explícitamente
  if (!entidades.es_especifico) {
    const accesorioKw = ['repuesto', 'accesorio', 'pieza', 'para ', 'kit para'];
    if (accesorioKw.some((kw) => n.includes(kw))) bonus -= 20;
  }
  return Math.max(0, Math.min(100, scoreBase + bonus));
}

function nivelConcordancia(score: number): [string, string] {
  if (score >= 90) return ['exacta', '✅ Coincidencia exacta'];
  if (score >= 75) return ['alta', '🟢 Alta coincidencia'];
  if (score >= 60) return ['parcial', '🟡 Coincidencia parcial'];
  if (score >= 40) return ['baja', '🟠 Baja coincidencia'];
  return ['nula', '🔴 Sin coincidencia'];
}

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

function extraerMedidas(texto: string): Record<string, unknown> {
  const t = (texto || '').toLowerCase();
  const m: Record<string, unknown> = {};
  const d3 = t.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/);
  if (d3) m.dim3 = [d3[1], d3[2], d3[3]].map((x) => parseFloat(x.replace(',', '.')));
  const d2 = t.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/);
  if (d2) m.dim2 = [d2[1], d2[2]].map((x) => parseFloat(x.replace(',', '.')));
  const pulg = t.match(/(\d+(?:[.,]\d+)?)\s*(?:"|pulgadas?|pulg\b|inch)/);
  if (pulg) m.pulgadas = parseFloat(pulg[1].replace(',', '.'));
  const mm = t.match(/(\d+(?:[.,]\d+)?)\s*mm\b/);
  if (mm) m.mm = parseFloat(mm[1].replace(',', '.'));
  const kg = t.match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
  if (kg) m.kg = parseFloat(kg[1].replace(',', '.'));
  const lts = t.match(/(\d+(?:[.,]\d+)?)\s*(?:lt|lts|litros?)\b/);
  if (lts) m.litros = parseFloat(lts[1].replace(',', '.'));
  if (/\bgal[oó]n|gal\b|\bgl\b/.test(t)) m.galon = true;
  if (/\btineta\b/.test(t)) m.tineta = true;
  if (/1\/4|cuarto/.test(t)) m.cuarto = true;
  return m;
}

function medidasATexto(m: Record<string, unknown>): string {
  const p: string[] = [];
  if (Array.isArray(m.dim3)) p.push((m.dim3 as number[]).join('x'));
  if (Array.isArray(m.dim2)) p.push((m.dim2 as number[]).join('x'));
  if (m.pulgadas) p.push(`${m.pulgadas}"`);
  if (m.mm) p.push(`${m.mm}mm`);
  if (m.kg) p.push(`${m.kg}kg`);
  if (m.litros) p.push(`${m.litros}lt`);
  if (m.galon) p.push('galón');
  if (m.tineta) p.push('tineta');
  if (m.cuarto) p.push('1/4');
  return p.length ? p.join(', ') : 'sin medidas';
}

function conflictoMedidas(mb: Record<string, unknown>, me: Record<string, unknown>): boolean {
  if (mb.galon && (me.tineta || me.cuarto)) return true;
  if (typeof mb.pulgadas === 'number' && typeof me.pulgadas === 'number' && Math.abs(mb.pulgadas - me.pulgadas) > 0.1) return true;
  if (typeof mb.litros === 'number' && typeof me.litros === 'number' && Math.abs(mb.litros - me.litros) > 0.5) return true;
  if (typeof mb.mm === 'number' && typeof me.mm === 'number' && Math.abs(mb.mm - me.mm) > 0.5) return true;
  return false;
}

function extraerEspecificaciones(texto: string): string[] {
  const t = normalizar(texto);
  const s = new Set<string>();
  ['acero', 'hierro', 'fierro', 'pino', 'madera', 'cemento', 'galvanizado', 'inoxidable', 'zincado',
   'brillante', 'opaco', 'satinado', 'mate', 'semibrillo', 'blanco', 'negro', 'rojo', 'azul', 'amarillo',
   'verde', 'gris', 'interior', 'exterior', 'antihumedad', 'antihongos'].forEach((w) => { if (t.includes(w)) s.add(w); });
  return [...s];
}

function inferirTipoProducto(nombre: string) {
  const n = normalizar(nombre);
  return {
    maquinaria_pesada: /retroexcavadora|minicargador|grua|compactador|pavimentadora/.test(n),
    herramienta_electrica: /taladro|amoladora|sierra|esmeril|compresor|soldadora|atornillador|lijadora/.test(n),
    material_construccion: /cemento|hormigon|arena|grava|madera|fierro|acero|tubo|placa|tabla|barra|perfil|plancha|terciado|osb/.test(n),
    articulo_pequeno: /clavo|tornillo|perno|tuerca|remache|tarugo|golilla|arandela/.test(n),
    pintura_quimico: /pintura|anticorrosivo|barniz|esmalte|sellador|impermeabilizante|oleo|latex|diluyente|aguarras|cerestain|laca/.test(n),
    senaletica_vial: /letrero|senal|transito|paso cebra|tachas|delineador|valla|cono|baliza/.test(n),
  };
}

const MARCAS = ['sherwin', 'sipa', 'ceresita', 'soquina', 'passol', 'tajamar', 'tricolor', 'gerdau',
  'cintac', 'arauco', 'masisa', 'melon', 'stanley', 'bosch', 'dewalt', 'makita', 'hilti', 'sika', 'inchalam', 'cbb',
  'siemens', 'weg', 'leroy', 'merlin', 'schneider', 'abb', 'legrand', 'philips', 'osram', '3m'];

function clasificarCategoria(nombre: string): string {
  const n = normalizar(nombre);
  if (/madera|pino|mdf|osb|terciado|tabla/.test(n)) return 'madera';
  if (/fierro|acero|tubo|perfil|barra|viga|plancha/.test(n)) return 'metal_acero';
  if (/cemento|hormigon|arena|grava|mortero/.test(n)) return 'cemento_hormigon';
  if (/pintura|esmalte|latex|barniz|anticorrosivo|oleo/.test(n)) return 'pintura_recubrimiento';
  if (/letrero|senal|transito|valla|cono/.test(n)) return 'senaletica';
  return 'ferreteria_general';
}

function analizarProducto(producto: string) {
  const categoria = clasificarCategoria(producto);
  const medidas = extraerMedidas(producto);
  const n = normalizar(producto);
  return {
    nombre_original: producto,
    nombre_normalizado: n,
    categoria,
    palabras_clave: tokens(producto),
    medidas: { tiene_medidas: Object.keys(medidas).length > 0, detalle: medidas, texto_legible: medidasATexto(medidas) },
    especificaciones_tecnicas: extraerEspecificaciones(producto),
    unidades_relevantes: [],
    es_accesorio: /repuesto|accesorio|disco|carbon|estuche|funda/.test(n),
    marca_detectada: MARCAS.find((m) => n.includes(m)) || null,
    tipo_producto: inferirTipoProducto(producto),
  };
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Entidades {
  marca: string | null;
  modelo: string | null;
  sku: string | null;
  specs: string[];
  variantes: string[];
  categoria_ia: string | null;
  es_especifico: boolean;
}

interface ItemRaw {
  tienda: string;
  nombre: string;
  precio_con_iva: number;
  url: string;
  fuente: string;
}

// ─── ETAPA 0: Query Understanding con IA ─────────────────────────────────────

async function entenderConsultaIA(producto: string, contexto: string): Promise<Entidades> {
  const fallback: Entidades = { marca: null, modelo: null, sku: null, specs: [], variantes: [producto], categoria_ia: null, es_especifico: false };
  if (!DEEPSEEK_KEY) return fallback;
  try {
    const ctxLine = contexto?.trim() ? `Contexto del usuario: ${contexto}.` : 'Rubro: ferretería y construcción en Chile.';
    const prompt = `Eres experto en productos industriales, ferretería y construcción en Chile. ${ctxLine}
Analiza el producto y extrae entidades clave. Genera variantes de búsqueda optimizadas (de más específica a más general).

Responde SOLO JSON:
{
  "marca": "nombre de marca o null",
  "modelo": "número de modelo/referencia o null",
  "sku": "código SKU/parte o null",
  "specs": ["lista de especificaciones técnicas detectadas"],
  "variantes": ["3 consultas optimizadas para buscar en Google Shopping Chile"],
  "categoria_ia": "categoría del producto",
  "es_especifico": true/false
}

Ejemplos de variantes:
- "Motor Siemens 5HP 380V" → ["Motor eléctrico Siemens 5HP 380V trifásico Chile", "Motor 5HP 380V precio Chile", "motor eléctrico 5HP Chile"]
- "Cemento 25kg" → ["cemento corriente 25kg saco precio Chile", "cemento Portland 25kg Chile", "cemento bolsa 25kg"]
- "Perno M12 inox" → ["Perno M12 acero inoxidable Chile precio", "perno hexagonal M12 inoxidable Chile", "perno M12 Chile ferretería"]`;

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: `Producto: "${producto}"` }],
        temperature: 0.1, max_tokens: 400, response_format: { type: 'json_object' },
      }),
    });
    clearTimeout(tid);
    if (!r.ok) return fallback;
    const d = await r.json();
    const parsed = JSON.parse(d.choices?.[0]?.message?.content || '{}');
    const variantes: string[] = Array.isArray(parsed.variantes) ? parsed.variantes.filter((v: unknown) => typeof v === 'string' && v.trim()) : [];
    if (!variantes.includes(producto)) variantes.unshift(producto);
    return {
      marca: parsed.marca || null,
      modelo: parsed.modelo || null,
      sku: parsed.sku || null,
      specs: Array.isArray(parsed.specs) ? parsed.specs.filter(Boolean) : [],
      variantes: variantes.slice(0, 3),
      categoria_ia: parsed.categoria_ia || null,
      es_especifico: Boolean(parsed.es_especifico),
    };
  } catch {
    return fallback;
  }
}

// ─── ETAPA 1a: Serper Shopping (multi-variante) ───────────────────────────────

async function buscarSerperShopping(variantes: string[], limitePorVariante: number): Promise<ItemRaw[]> {
  if (!SERPER_KEY) return [];
  const resultadosTodos: ItemRaw[] = [];
  const urlsVistas = new Set<string>();

  await Promise.allSettled(variantes.map(async (variante) => {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch('https://google.serper.dev/shopping', {
        method: 'POST',
        headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({ q: variante, gl: 'cl', hl: 'es', location: 'Chile', num: 20 }),
      });
      clearTimeout(tid);
      if (!r.ok) return;
      const data = await r.json();
      const items = data.shopping || [];
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
        const clave = link || normalizar(nombre);
        if (urlsVistas.has(clave)) continue;
        urlsVistas.add(clave);
        resultadosTodos.push({ tienda, nombre: nombre.slice(0, 150), precio_con_iva: precio, url: link, fuente: 'serper_shopping' });
        if (resultadosTodos.length >= limitePorVariante * variantes.length) break;
      }
    } catch {
      // Continúa con otras variantes
    }
  }));
  return resultadosTodos;
}

// ─── ETAPA 1b: Serper Búsqueda Orgánica (web general) ────────────────────────

async function buscarSerperOrganico(query: string, limite: number): Promise<ItemRaw[]> {
  if (!SERPER_KEY) return [];
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ q: `${query} precio Chile comprar`, gl: 'cl', hl: 'es', location: 'Chile', num: 20 }),
    });
    clearTimeout(tid);
    if (!r.ok) return [];
    const data = await r.json();
    const organic = data.organic || [];
    const resultados: ItemRaw[] = [];
    for (const item of organic) {
      const link = item.link || '';
      if (!link) continue;
      const linkL = link.toLowerCase();
      if (INDICADORES_EXTRANJEROS.some((x) => linkL.includes(x))) continue;
      const esChileno = linkL.includes('.cl') || linkL.includes('mercadolibre') || linkL.includes('falabella') || linkL.includes('paris');
      if (!esChileno) continue;
      const titulo = limpiarNombre(item.title || '');
      if (titulo.length < 4) continue;
      const snippet = item.snippet || '';
      const pm = (snippet + ' ' + titulo).match(/\$\s*([\d\.,]{3,})/);
      const precio = pm ? limpiarPrecio(pm[1].replace(/\./g, '').replace(',', '.')) : null;
      if (!precio) continue;
      const domainMatch = link.match(/https?:\/\/(?:www\.)?([^/]+)/);
      const tienda = domainMatch?.[1]?.slice(0, 40) || 'Web';
      resultados.push({ tienda, nombre: titulo.slice(0, 150), precio_con_iva: precio, url: link, fuente: 'serper_organico' });
      if (resultados.length >= limite) break;
    }
    return resultados;
  } catch {
    return [];
  }
}

// ─── ETAPA 2: Validación por lote con IA ─────────────────────────────────────

async function validarLoteIA(producto: string, entidades: Entidades, resultados: ResultadoMapeado[]): Promise<ResultadoMapeado[]> {
  if (!DEEPSEEK_KEY || !resultados.length) return resultados;
  const scoreTop = resultados[0]?.score ?? 100;
  const tieneEntidad = Boolean(entidades.marca || entidades.modelo || entidades.sku);
  if (scoreTop >= 80 && !tieneEntidad) return resultados;
  try {
    const top = resultados.slice(0, 15);
    const payload = top.map((r, i) => ({ id: i, nombre: r.nombre.substring(0, 100), tienda: r.tienda.substring(0, 30), precio: r.precio_valor }));
    const prompt = `Eres validador experto de productos industriales para el mercado chileno.

Producto buscado: "${producto}"
Marca: ${entidades.marca || 'no especificada'}
Modelo: ${entidades.modelo || 'no especificado'}
SKU: ${entidades.sku || 'no especificado'}
Specs: ${entidades.specs.join(', ') || 'ninguna'}

Para cada resultado determina si es exactamente el producto correcto.
Responde SOLO JSON:
{
  "validaciones": [
    {"id": 0, "producto_correcto": true, "confianza": 90, "motivo": "Coincide marca y modelo"},
    {"id": 1, "producto_correcto": false, "confianza": 30, "motivo": "Diferente voltaje"}
  ]
}`;

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Valida estos ${payload.length} resultados:\n${JSON.stringify(payload)}` },
        ],
        temperature: 0.05, max_tokens: 800, response_format: { type: 'json_object' },
      }),
    });
    clearTimeout(tid);
    if (!r.ok) return resultados;
    const d = await r.json();
    const parsed = JSON.parse(d.choices?.[0]?.message?.content || '{}');
    const validaciones = new Map<number, { confianza: number; producto_correcto: boolean; motivo: string }>(
      (parsed.validaciones || []).filter((v: { id?: number }) => typeof v?.id === 'number').map((v: { id: number; confianza: number; producto_correcto: boolean; motivo: string }) => [v.id, v])
    );
    top.forEach((res, i) => {
      const val = validaciones.get(i);
      if (val) {
        res.confianza_ia = val.confianza;
        res.producto_correcto_ia = val.producto_correcto;
        res.motivo_ia = val.motivo;
        // Ajustar score según validación IA
        if (!val.producto_correcto && val.confianza < 50) {
          res.score = Math.min(res.score, 35);
        } else if (val.producto_correcto && val.confianza >= 80) {
          res.score = Math.min(100, res.score + 10);
        }
      }
    });
    // Re-ordenar: correctos primero
    top.sort((a, b) => {
      const aCorr = a.producto_correcto_ia !== false ? 1 : 0;
      const bCorr = b.producto_correcto_ia !== false ? 1 : 0;
      if (bCorr !== aCorr) return bCorr - aCorr;
      return (b.confianza_ia ?? b.score) - (a.confianza_ia ?? a.score);
    });
    return [...top, ...resultados.slice(15)];
  } catch {
    return resultados;
  }
}

// ─── Tipo resultado enriquecido ───────────────────────────────────────────────

interface ResultadoMapeado {
  tienda: string;
  nombre: string;
  precio_valor: number;
  precio_neto: number;
  precio_formateado: string;
  link: string;
  canal: string;
  pais: string;
  busqueda_original: string;
  score: number;
  nivel_concordancia: string;
  etiqueta_concordancia: string;
  categoria: string;
  conversion: string;
  unidad_detectada: string;
  alerta_unidad: boolean;
  medidas_encontradas: string;
  specs_encontradas: string[];
  palabras_comunes: string[];
  palabras_faltantes: string[];
  conflicto_medidas: boolean;
  confianza_ia?: number;
  producto_correcto_ia?: boolean;
  motivo_ia?: string;
}

// ─── Mapear resultado crudo a enriquecido ─────────────────────────────────────

function mapearResultado(r: ItemRaw, producto: string, analisis: ReturnType<typeof analizarProducto>, conversion: string, entidades: Entidades): ResultadoMapeado {
  const scoreBase = calcularScore(producto, r.nombre);
  const score = aplicarBonusEntidades(scoreBase, r.nombre, entidades);
  const [nivel, etiqueta] = nivelConcordancia(score);
  const [unidadDet, alertaUnidad] = detectarEmpaque(r.nombre, conversion);
  const medRes = extraerMedidas(r.nombre);
  const palabrasR = new Set(tokens(r.nombre));
  const palabrasProducto = analisis.palabras_clave;
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
    categoria: analisis.categoria,
    conversion,
    unidad_detectada: unidadDet,
    alerta_unidad: alertaUnidad,
    medidas_encontradas: medidasATexto(medRes),
    specs_encontradas: extraerEspecificaciones(r.nombre),
    palabras_comunes: palabrasProducto.filter((w) => palabrasR.has(w)),
    palabras_faltantes: palabrasProducto.filter((w) => !palabrasR.has(w)),
    conflicto_medidas: analisis.medidas.tiene_medidas && conflictoMedidas(analisis.medidas.detalle, medRes),
  };
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const producto = (sp.get('producto') || '').trim();
  const numeroItem = sp.get('numero') || '';
  const minimo = parseInt(sp.get('minimo') || '15', 10);
  const conversion = (sp.get('conversion') || 'unidad').trim().toLowerCase();
  const contexto = (sp.get('contexto') || '').trim();

  if (!producto) {
    return NextResponse.json({ numero_item: numeroItem, producto, resultados: [], total_encontrados: 0, suficientes: false, categoria: 'desconocida', analisis_producto: {} });
  }

  if (!SERPER_KEY) {
    return NextResponse.json({ error: 'SERPER_API_KEY no configurada' }, { status: 500 });
  }

  // ── ETAPA 0: Query Understanding con IA ─────────────────────────────────────
  console.log(`🧠 [${numeroItem}] Query Understanding: "${producto}"`);
  const entidades = await entenderConsultaIA(producto, contexto);
  const variantes = entidades.variantes.length ? entidades.variantes : [producto];
  console.log(`💡 Variantes: ${JSON.stringify(variantes)}`);
  if (entidades.marca) console.log(`🏷️  Marca: ${entidades.marca} | Modelo: ${entidades.modelo} | SKU: ${entidades.sku}`);

  let crudos: ItemRaw[] = [];
  try {
    // ── ETAPA 1: Búsqueda multi-fuente en paralelo ──────────────────────────
    console.log(`📡 [${numeroItem}] Búsqueda multi-fuente (Shopping + Orgánico)...`);
    const [shopping, organico] = await Promise.all([
      buscarSerperShopping(variantes, Math.max(minimo * 2, 20)),
      buscarSerperOrganico(variantes[0], 10),
    ]);
    crudos = [...shopping, ...organico];
    console.log(`📦 Shopping: ${shopping.length} | Orgánico: ${organico.length} | Total: ${crudos.length}`);

    // Reintento si pocos resultados
    if (crudos.length < 8 && variantes.length > 1) {
      console.log(`🔄 Reintento con variante alternativa: ${variantes[variantes.length - 1]}`);
      const reintento = await buscarSerperShopping([variantes[variantes.length - 1]], minimo);
      crudos.push(...reintento);
      console.log(`📦 Reintento: ${reintento.length} | Total: ${crudos.length}`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ numero_item: numeroItem, producto, resultados: [], total_encontrados: 0, suficientes: false, categoria: clasificarCategoria(producto), error: msg });
  }

  const analisis = analizarProducto(producto);
  const categoria = analisis.categoria;

  // Dedupe y mapear con scoring avanzado
  const vistos = new Set<string>();
  const resultadosMapeados: ResultadoMapeado[] = crudos
    .filter((r) => {
      const k = r.url || normalizar(r.nombre);
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .map((r) => mapearResultado(r, producto, analisis, conversion, entidades))
    .sort((a, b) => b.score - a.score)
    .slice(0, minimo * 3);

  // ── ETAPA 2: Validación IA (para productos específicos o score bajo) ────────
  const scoreTop = resultadosMapeados[0]?.score ?? 0;
  const necesitaValidacion = scoreTop < 75 || Boolean(entidades.marca || entidades.modelo || entidades.sku);
  let resultadosFinales = resultadosMapeados;
  if (necesitaValidacion && resultadosMapeados.length >= 3) {
    console.log(`🤖 [${numeroItem}] Validación IA (score_top=${scoreTop})...`);
    resultadosFinales = await validarLoteIA(producto, entidades, resultadosMapeados);
    // Re-ordenar post-validación
    resultadosFinales.sort((a, b) => {
      const aCorr = a.producto_correcto_ia !== false ? 1 : 0;
      const bCorr = b.producto_correcto_ia !== false ? 1 : 0;
      if (bCorr !== aCorr) return bCorr - aCorr;
      return b.score - a.score;
    });
  }

  const resultadosSlice = resultadosFinales.slice(0, minimo * 2);

  return NextResponse.json({
    numero_item: numeroItem,
    producto,
    categoria,
    resultados: resultadosSlice,
    total_encontrados: resultadosSlice.length,
    suficientes: resultadosSlice.length >= minimo,
    deficit: Math.max(0, minimo - resultadosSlice.length),
    pais_busqueda: 'CL',
    queries_ia: variantes,
    expandido_ia: variantes.length > 1,
    analisis_producto: analisis,
    entidades_detectadas: entidades,
  });
}
