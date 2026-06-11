// app/api/buscar-productos/route.ts
// Motor de búsqueda multi-etapa: query-understanding IA → Serper Shopping + Orgánico → ranking avanzado
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 55;

const SERPER_KEY = process.env.SERPER_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
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
  // EPP — lentes / protección visual
  antiparra: 'lente', anteojo: 'lente', anteojos: 'lente',
  gafa: 'lente', gafas: 'lente',
  visor: 'lente',        // "visor claro" → no penaliza cuando el resultado dice "lente claro"
  // EPP — calzado y guantes
  guantes: 'guante', botas: 'bota',
  // EPP — palabras contextuales que no deben bajar el score
  seguridad: 'seguridad', industrial: 'seguridad',
  // Herramientas — variantes de nombre
  alicate: 'alicate', alicates: 'alicate',
  // Metales / ferretería chilena
  fierro: 'acero', golilla: 'arandela', golillas: 'arandela', pernos: 'perno', tornillos: 'tornillo',
  pletina: 'platina', angulo: 'angular', perfil: 'perfil',
  // Pinturas — chileno → comercial
  tineta: 'balde', galón: 'galon', galon: 'galon',
  anticorrosivo: 'anticorrosivo', barniz: 'barniz', esmalte: 'esmalte', oleo: 'oleo',
  // Maderas
  dimensionado: 'pino', impregnado: 'impregnado', cepillado: 'cepillado',
  // Plomería
  sifon: 'sifon', copla: 'union', codo: 'codo', tee: 'tee',
  // Electricidad
  conduit: 'conduit', tablero: 'tablero',
  // Mallas
  chiporro: 'rodillo',
  pomeles: 'bisagra', pomel: 'bisagra',
  // Adjetivos genéricos que suelen no estar en títulos de productos
  equivalente: 'similar', similar: 'similar',
};

function raiz(w: string): string {
  let x = SINONIMOS[w] || w;
  if (x.length > 4 && x.endsWith('s')) x = x.slice(0, -1);
  return x;
}

function tokensMatch(s: string): string[] {
  return tokens(s).map(raiz);
}

// Normaliza dimensiones para comparación: unifica formatos antes del score
function normalizarParaScore(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quitar acentos
    .replace(/\[mm\]/g, 'mm').replace(/\[m\]\b/g, 'm').replace(/\[cm\]/g, 'cm')
    .replace(/(\d),(\d)/g, '$1.$2')            // coma decimal → punto
    .replace(/(\d)\s*[xX×]\s*(\d)/g, '$1x$2') // 100 X 50 → 100x50
    .replace(/(\d)\s*"\s*/g, '$1pulg ')        // 3/4" → 3/4pulg
    .replace(/(\d)\s*(mm|cm|m|kg|lt|lts|litro|litros)\b/g, '$1$2') // unir número+unidad
    .replace(/\bpulgadas?\b/g, 'pulg')
    .replace(/[^\w\s.\/]/g, ' ')
    .replace(/\s{2,}/g, ' ').trim();
}

function calcularScore(buscado: string, encontrado: string): number {
  // Usar versiones normalizadas para el matching
  const bN = preprocesarProducto(buscado);
  const b = tokensMatch(bN);
  const e = tokensMatch(encontrado);
  if (!b.length || !e.length) return 50;
  const setB = new Set(b), setE = new Set(e);
  const comunes = [...setB].filter((w) => setE.has(w)).length;
  if (comunes === 0) return 5;
  const cobertura = comunes / setB.size;
  const precision = comunes / setE.size;
  // Para nombres de licitación con muchos tokens descriptivos (> 5 tokens únicos),
  // dar más peso a la precisión que a la cobertura — si el resultado tiene todos sus
  // tokens cubiertos (precision alta), el match es bueno aunque el query tenga extras.
  const pesoCobertura = setB.size > 5 ? 0.35 : 0.5;
  const pesoPrecision = setB.size > 5 ? 0.65 : 0.5;
  const f1 = (cobertura * pesoCobertura + precision * pesoPrecision);

  // Comparar números con dimensiones normalizadas
  const bScore = normalizarParaScore(bN);
  const eScore = normalizarParaScore(encontrado);
  const numsB = bScore.match(/\d+(?:\.\d+)?/g) || [];
  const numsE = new Set(eScore.match(/\d+(?:\.\d+)?/g) || []);
  let bonusNum = 0;
  if (numsB.length) {
    const hits = numsB.filter((n) => numsE.has(n)).length;
    bonusNum = (hits / numsB.length) * 15; // subir de 12 → 15 pts para dimensiones
  }
  return Math.max(0, Math.min(100, Math.round(f1 * 85 + bonusNum)));
}

// ─── Preprocesamiento de nombre del producto ──────────────────────────────────
// Limpia nombres de licitaciones chilenas antes de buscar:
//  - Elimina códigos internos de proveedor ("B ", "C2 ", "B SC ", "B MSD ")
//  - Normaliza formatos de dimensiones ([MM]→mm, coma→punto, X→x)
//  - Expande abreviaturas chilenas de construcción
//  - Quita truncamientos (nombres cortados en Excel)

// Términos chilenos de construcción → término comercial para búsqueda
const PREFIJOS_INTERNOS = /^(?:B\s+SC\s+|B\s+MSD\s+|B\s+MK\s+|B\s+VG\s+|[A-Z]\d{0,2}\s+)(?=\S)/i;
// Pares [regex, reemplazo] — notar que los regex NO usan flag /g
// para evitar que .test() avance lastIndex y rompa la lógica
const PALABRAS_GLOSARIO: [RegExp, string][] = [
  [/\bMalla\s+Acma\b/i, 'Malla electrosoldada galvanizada'],
  [/\bMalla\s+Raschel\b/i, 'Malla sombra raschel'],
  [/\bMalla\s+Concertina\b/i, 'Alambre concertina'],
  [/\bPino\s+Verde\b/i, 'Pino bruto'],
  [/\bPino\s+Impregnado\b/i, 'Pino impregnado CCA'],
  [/\bRodillo\s+Chiporro\b/i, 'Rodillo pintura'],
  [/\bChiporro\b/i, 'Rodillo pintura'],
  // NOTA: Pomel NO se reemplaza — "pomel" es el nombre comercial en Chile (pieza de fijación madera)
  [/\bHilo\s+Esp[aá]rrago\b/i, 'Espárrago roscado'],
  // NOTA: Picaporte Carcelero NO se reemplaza — es un nombre buscable directamente
  [/\bCerestain\b/i, 'Ceresita impregnante madera'],
  [/\bTinetas?\b/i, 'Balde pintura'],
  [/\bPrensa\s+[Ee]stopa\b/i, 'Prensaestopa'],
  [/\bConduit\s+EMT\b/i, 'Tubería conduit EMT'],
  [/\bTeja\s+Continua\b/i, 'Teja plástica continua'],
  [/\bCaballete\s+Colonial\b/i, 'Caballete teja'],
  [/\bLaucha\s+Pasacables\b/i, 'Pasacables guía eléctrica'],
  [/\bEstruct-Viga\b/i, 'Viga pino estructural'],
  [/\bSalas?\s+de\s+Ba[ñn]o\b/i, 'Inodoro distancia entre ejes'],
];

// ─── Simplificador para retry cuando Serper devuelve 0 resultados ─────────────
// Elimina cantidades y especificaciones que confunden la búsqueda
// ─── Limpia el nombre del producto para usarlo como query de búsqueda ────────
// Convierte símbolos problemáticos en texto, elimina cantidades y ruido
function limpiarParaQuery(nombre: string): string {
  return nombre
    // Convertir pulgadas (" o '') a texto ANTES de todo
    .replace(/(\d)\s*[""]\s*/g, '$1 pulg ')   // 3/4" → 3/4 pulg
    .replace(/(\d)\s*'\s*/g, '$1 pulg ')       // 3/4' → 3/4 pulg
    // Quitar cantidades al final: "100 un", "100 U/N", "100 Unidades", "Pack de 25", "2 Unidades"
    .replace(/\s+\d+\s*U\/N\s*$/i, '')
    .replace(/\s+\(?\d+\s*un(?:idades?)?\)?$/i, '')
    .replace(/\s+Pack\s+de\s+\d+$/i, '')
    .replace(/\s+\d+\s*(?:unidades?|piezas?|pzs?)$/i, '')
    // Quitar bloques entre paréntesis con cantidades: "(100 un)", "(pack 25)", "(2 Unidades)"
    .replace(/\s*\(\d+[^)]*\)/gi, '')
    .replace(/\s*\([^)]{0,8}\)/gi, '')
    // Quitar "equivalente" y similares
    .replace(/\s+equivalente\b/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function simplificarParaBusqueda(nombre: string): string {
  let n = limpiarParaQuery(nombre);
  // Si queda muy largo, usar solo las primeras 5 palabras (el nombre comercial)
  const palabras = n.split(/\s+/);
  if (palabras.length > 5) n = palabras.slice(0, 5).join(' ');
  return n.trim() || nombre;
}

function preprocesarProducto(nombre: string): string {
  if (!nombre) return nombre;
  let n = nombre.trim();

  // 1. Quitar prefijos internos de licitación al inicio: "B ", "C2 ", "B SC ", "B MSD "
  n = n.replace(PREFIJOS_INTERNOS, '').trim();

  // 2. Normalizar corchetes de unidades: [MM]→mm, [M]→m, [CM]→cm, [PULG]→pulg
  n = n.replace(/\[\s*MM\s*\]/gi, 'mm')
       .replace(/\[\s*M\s*\](?=\s|$)/gi, 'm')
       .replace(/\[\s*CM\s*\]/gi, 'cm')
       .replace(/\[\s*PULG\s*\]/gi, 'pulg')
       .replace(/\[|\]/g, ' ');

  // 3. Coma decimal en dimensiones (solo entre dígitos): 0,35 → 0.35
  n = n.replace(/(\d),(\d)/g, '$1.$2');

  // 4. Quitar truncamientos al final: "Tornillo Autoperforante (" → limpia
  n = n.replace(/\s*[\(]+\s*$/, '').trim();

  // 5. Aplicar glosario de términos chilenos (reemplaza todas las ocurrencias)
  for (const [re, reemplazo] of PALABRAS_GLOSARIO) {
    if (re.test(n)) {
      n = n.replace(new RegExp(re.source, 'gi'), reemplazo);
    }
  }

  return n.replace(/\s{2,}/g, ' ').trim();
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
  // Maderas
  if (/madera|pino|mdf|osb|terciado|tabla|cielo|aglomerado|melamina|fibrocemento/.test(n)) return 'madera';
  // Metales estructurales
  if (/fierro|acero|tubo|perfil|barra|viga|plancha|pletina|angulo|angular|malla acma|malla electrosoldada|alambre/.test(n)) return 'metal_acero';
  // Cubierta y zinc
  if (/zinc|teja|cubierta|caballete|polipanel|policarbonato/.test(n)) return 'cubierta_techo';
  // Cemento y áridos
  if (/cemento|hormigon|arena|grava|mortero|yeso|pintacal|estuco/.test(n)) return 'cemento_hormigon';
  // Pinturas
  if (/pintura|esmalte|latex|barniz|anticorrosivo|oleo|tineta|galon|diluyente|sellador|impermeabilizante|tapagoteras|cerestain|adhesivo.*contact/.test(n)) return 'pintura_recubrimiento';
  // Fontanería/plomería
  if (/pvc|sifon|codo.*bronce|tee|copla|valvula|llave.*paso|tubo.*hidraulico|flexible.*llave|manguera.*riego|aspersor|gotero/.test(n)) return 'plomeria_sanitaria';
  // Electricidad
  if (/cable|conduit|tablero|interruptor|diferencial|contactor|foco|reflector|led|timer|prensa.*estopa|alambre.*electrico|enchufe/.test(n)) return 'electrico';
  // Señalética
  if (/letrero|senal|transito|valla|cono|baliza|bandera/.test(n)) return 'senaletica';
  // Tornillería y fijaciones
  if (/tornillo|perno|tuerca|golilla|clavo|tarugo|grampa|remache|bisagra|pomel|corredera|cerradura|candado/.test(n)) return 'tornilleria_fijacion';
  // Herramientas y consumibles
  if (/disco.*corte|disco.*desbaste|disco.*diamantado|soldadura|electrod|lija|brocha|rodillo|chiporro|espatula|pistola.*calafat/.test(n)) return 'herramientas_consumibles';
  return 'ferreteria_general';
}

function analizarProducto(producto: string) {
  // Usar nombre preprocesado para mejor análisis (sin códigos internos)
  const productoLimpio = preprocesarProducto(producto);
  const categoria = clasificarCategoria(productoLimpio);
  const medidas = extraerMedidas(productoLimpio);
  const n = normalizar(productoLimpio);
  return {
    nombre_original: producto,
    nombre_limpio: productoLimpio,
    nombre_normalizado: n,
    categoria,
    palabras_clave: tokens(productoLimpio),
    medidas: { tiene_medidas: Object.keys(medidas).length > 0, detalle: medidas, texto_legible: medidasATexto(medidas) },
    especificaciones_tecnicas: extraerEspecificaciones(productoLimpio),
    unidades_relevantes: [],
    es_accesorio: /repuesto|accesorio|carbon|estuche|funda/.test(n),
    marca_detectada: MARCAS.find((m) => n.includes(m)) || null,
    tipo_producto: inferirTipoProducto(productoLimpio),
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

async function entenderConsultaIA(producto: string, contexto: string, region?: string): Promise<Entidades> {
  const fallback: Entidades = { marca: null, modelo: null, sku: null, specs: [], variantes: [producto], categoria_ia: null, es_especifico: false };
  if (!GEMINI_KEY) return fallback;
  try {
    const regionCtx = region?.trim() ? ` Búsqueda específica para la región de ${region}, Chile.` : '';
    const ctxLine = contexto?.trim()
      ? `Contexto del usuario: ${contexto}.${regionCtx}`
      : `No se especificó un rubro — infiere el rubro/categoría del producto a partir de su propia descripción (puede ser ferretería, construcción, vestuario, calzado, EPP, electrónica, mobiliario, oficina, aseo, etc.) y genera las variantes acorde a ese rubro.${regionCtx}`;

    const systemPrompt = `Eres experto en compras públicas de Chile (Mercado Público) y en retail chileno de cualquier rubro (ferretería, construcción, vestuario, calzado, EPP, electrónica, mobiliario, oficina, aseo, etc.). ${ctxLine}
El producto proviene de un Excel de cotización de licitación chilena (MercadoPúblico). Puede contener:
- Códigos internos al inicio: "B ", "C2 ", "B SC ", "B MSD " — IGNÓRALOS al generar variantes
- Dimensiones, tallas o especificaciones técnicas extensas en formatos no-comerciales — normalízalos
- Terminología chilena específica (ver glosario abajo, aplica solo si el rubro es ferretería/construcción)

IMPORTANTE: NO inventes marcas ni modelos comerciales que no estén explícitamente mencionados en el producto. Si el producto es una descripción genérica con especificaciones técnicas (ej. "calzado térmico impermeable, suela antideslizante, talla X"), las variantes deben describir el PRODUCTO GENÉRICO con sus características más distintivas (no un modelo de marca inventado).

GLOSARIO CONSTRUCCIÓN CHILE (traduce al término comercial si el rubro es ferretería/construcción):
tineta=balde bidón pintura 4L | galón=galón pintura 4 litros | chiporro=rodillo pintura | pomeles/pomel=bisagra puerta
malla acma=malla electrosoldada galvanizada | malla raschel=malla sombra | malla concertina=alambre concertina
pino verde=pino bruto sin secar | pino seco cepillado=pino cepillado seco | pino impregnado=pino CCA tratado
cerestain=impregnante madera ceresita | hilo espárrago=espárrago roscado | picaporte carcelero=pasador puerta
teja continua=teja plástica | plancha zinc acanalada=cubierta zinc ondulada techo | terciado=madera terciada contrachapada
b sc hormigon=hormigon premix saco | prensa estopa=prensaestopa | conduit emt=conduit tubería eléctrica
salas de baño=módulo inodoro distancia entre ejes

Analiza el producto y genera variantes comerciales para Google Shopping Chile.
Responde SOLO JSON válido con esta estructura exacta:
{
  "marca": "marca detectada o null",
  "modelo": "número de modelo/referencia o null",
  "sku": "código SKU o null",
  "specs": ["especificaciones técnicas clave"],
  "variantes": ["3 consultas comerciales para Google Shopping Chile, de más específica a más general"],
  "categoria_ia": "categoría comercial del producto",
  "es_especifico": true,
  "nombre_comercial": "nombre comercial limpio sin códigos internos"
}

REGLAS para variantes:
1. Eliminar prefijos internos (B, C2, B SC, B MSD) del inicio del nombre
2. Usar términos que aparecen en tiendas chilenas según el rubro (ferretería: Sodimac, Easy, Construmart, Imperial; vestuario/calzado/EPP: Decathlon, Falabella, Dimarsa; electrónica/oficina: Pc Factory, Lider, Falabella; etc.)
3. Primera variante: nombre comercial genérico + características distintivas clave + Chile
4. Segunda variante: producto genérico + características clave + precio Chile
5. Tercera variante: solo producto genérico + Chile (más amplia)
6. Para dimensiones/medidas: usar formato "NxN mm", "N pulg" o "talla N" en vez de formatos técnicos
${region ? `\nRegión: ${region} — incluir en al menos una variante.` : ''}`;

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 12000);

    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: `Producto de licitación: "${producto}"` }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 600, responseMimeType: 'application/json' },
    };

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal }
    );
    clearTimeout(tid);

    if (!r.ok) return fallback;
    const d = await r.json();
    const rawText: string = d.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const parsed = JSON.parse(rawText);

    const variantes: string[] = Array.isArray(parsed.variantes)
      ? parsed.variantes.filter((v: unknown) => typeof v === 'string' && v.trim())
      : [];
    const nombreComercial = typeof parsed.nombre_comercial === 'string' ? parsed.nombre_comercial.trim() : '';
    if (nombreComercial && nombreComercial !== producto && !variantes.includes(nombreComercial)) {
      variantes.push(nombreComercial);
    }
    const productoSinCodigo = preprocesarProducto(producto);
    if (productoSinCodigo && !variantes.some(v => v.toLowerCase().includes(productoSinCodigo.toLowerCase().slice(0, 15)))) {
      variantes.push(productoSinCodigo);
    }
    return {
      marca: parsed.marca || null,
      modelo: parsed.modelo || null,
      sku: parsed.sku || null,
      specs: Array.isArray(parsed.specs) ? parsed.specs.filter(Boolean) : [],
      variantes: variantes.slice(0, 4),
      categoria_ia: parsed.categoria_ia || null,
      es_especifico: Boolean(parsed.es_especifico),
    };
  } catch {
    return fallback;
  }
}

// ─── ETAPA 1a: Serper Shopping (multi-variante) ───────────────────────────────

async function buscarSerperShopping(variantes: string[], limitePorVariante: number, region?: string): Promise<ItemRaw[]> {
  if (!SERPER_KEY) return [];
  const resultadosTodos: ItemRaw[] = [];
  const urlsVistas = new Set<string>();

  await Promise.allSettled(variantes.map(async (variante) => {
    try {
      const queryConRegion = region?.trim() ? `${variante} ${region}` : variante;
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch('https://google.serper.dev/shopping', {
        method: 'POST',
        headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({ q: queryConRegion, gl: 'cl', hl: 'es', location: region?.trim() ? `${region}, Chile` : 'Chile', num: 20 }),
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

async function buscarSerperOrganico(query: string, limite: number, region?: string): Promise<ItemRaw[]> {
  if (!SERPER_KEY) return [];
  try {
    const locationStr = region?.trim() ? region : 'Chile';
    const queryFinal = region?.trim()
      ? `${query} precio ${region} Chile comprar`
      : `${query} precio Chile comprar`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ q: queryFinal, gl: 'cl', hl: 'es', location: locationStr, num: 20 }),
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
  if (!GEMINI_KEY || !resultados.length) return resultados;
  const scoreTop = resultados[0]?.score ?? 100;
  const tieneEntidad = Boolean(entidades.marca || entidades.modelo || entidades.sku);
  if (scoreTop >= 80 && !tieneEntidad) return resultados;
  try {
    const top = resultados.slice(0, 15);
    const payload = top.map((r, i) => ({ id: i, nombre: r.nombre.substring(0, 100), tienda: r.tienda.substring(0, 30), precio: r.precio_valor }));
    const systemPrompt = `Eres validador experto de productos industriales para el mercado chileno.

Producto buscado: "${producto}"
Marca: ${entidades.marca || 'no especificada'}
Modelo: ${entidades.modelo || 'no especificado'}
SKU: ${entidades.sku || 'no especificado'}
Specs: ${entidades.specs.join(', ') || 'ninguna'}

Para cada resultado determina si es exactamente el producto correcto.
Responde SOLO JSON válido con esta estructura:
{
  "validaciones": [
    {"id": 0, "producto_correcto": true, "confianza": 90, "motivo": "Coincide marca y modelo"},
    {"id": 1, "producto_correcto": false, "confianza": 30, "motivo": "Diferente voltaje"}
  ]
}`;

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 12000);
    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: `Valida estos ${payload.length} resultados:\n${JSON.stringify(payload)}` }] }],
      generationConfig: { temperature: 0.05, maxOutputTokens: 800, responseMimeType: 'application/json' },
    };
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal }
    );
    clearTimeout(tid);
    if (!r.ok) return resultados;
    const d = await r.json();
    const rawText: string = d.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const parsed = JSON.parse(rawText);
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
  const minimo = Math.min(parseInt(sp.get('minimo') || '5', 10), 5); // máx 5 por item (ahorro Serper)
  const conversion = (sp.get('conversion') || 'unidad').trim().toLowerCase();
  const contexto = (sp.get('contexto') || '').trim();
  const region = (sp.get('region') || '').trim();

  if (!producto) {
    return NextResponse.json({ numero_item: numeroItem, producto, resultados: [], total_encontrados: 0, suficientes: false, categoria: 'desconocida', analisis_producto: {} });
  }

  if (!SERPER_KEY) {
    return NextResponse.json({ error: 'SERPER_API_KEY no configurada' }, { status: 500 });
  }

  // ── PREPROCESAMIENTO ─────────────────────────────────────────────────────────
  const productoLimpio = preprocesarProducto(producto);
  // Query directo: nombre limpio con pulgadas convertidas a texto (safe para Serper)
  const queryDirecto = limpiarParaQuery(productoLimpio);

  // ── ETAPA 0: Query Understanding con IA ─────────────────────────────────────
  const entidades = await entenderConsultaIA(productoLimpio, contexto, region);
  // SIEMPRE incluir el query directo (nombre exacto del Excel limpio) como primera opción
  // Esto garantiza que productos como "Pomel 3/4 pulg", "Perno Coche 5/16", etc. se busquen directo
  const variantesIA = entidades.variantes.filter(v => v.trim().length > 3);
  const variantes = [queryDirecto, ...variantesIA.filter(v =>
    v.toLowerCase().slice(0, 10) !== queryDirecto.toLowerCase().slice(0, 10)
  )].filter(Boolean);

  let crudos: ItemRaw[] = [];
  try {
    // ── ETAPA 1: Búsqueda multi-fuente en paralelo ──────────────────────────
    const [shopping, organico] = await Promise.all([
      buscarSerperShopping(variantes, Math.max(minimo * 2, 20), region),
      buscarSerperOrganico(variantes[0], 10, region),
    ]);
    crudos = [...shopping, ...organico];

    // Reintento 1: si pocos resultados, probar última variante (más general)
    if (crudos.length < 5 && variantes.length > 1) {
      const reintento = await buscarSerperShopping([variantes[variantes.length - 1]], minimo, region);
      crudos.push(...reintento);
    }

    // Reintento 2: si CERO resultados, buscar con nombre simplificado
    if (crudos.length === 0) {
      const simplificado = simplificarParaBusqueda(productoLimpio);
      if (simplificado.length > 3) {
        const [shop2, org2] = await Promise.all([
          buscarSerperShopping([simplificado], Math.max(minimo, 10), region),
          buscarSerperOrganico(simplificado, 5, region),
        ]);
        crudos = [...shop2, ...org2];
      }
    }

    // Reintento 3: si aún 0, usar solo las primeras 3 palabras del nombre original
    if (crudos.length === 0) {
      const nuclear = productoLimpio.split(/\s+/).slice(0, 3).join(' ');
      if (nuclear.length > 3) {
        const [shop3, org3] = await Promise.all([
          buscarSerperShopping([nuclear + ' Chile precio'], Math.max(minimo, 10), region),
          buscarSerperOrganico(nuclear, 5, region),
        ]);
        crudos = [...shop3, ...org3];
      }
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
    // Usar productoLimpio para el scoring (sin prefijos internos ni formatos técnicos)
    .map((r) => mapearResultado(r, productoLimpio, analisis, conversion, entidades))
    .sort((a, b) => b.score - a.score)
    .slice(0, minimo * 3);

  // ── ETAPA 2: Validación IA (para productos específicos o score bajo) ────────
  const scoreTop = resultadosMapeados[0]?.score ?? 0;
  // Bajar el umbral: si tenemos nombre limpio diferente al original, la validación IA es más necesaria
  const necesitaValidacion = scoreTop < 80 || Boolean(entidades.marca || entidades.modelo || entidades.sku) || productoLimpio !== producto;
  let resultadosFinales = resultadosMapeados;
  if (necesitaValidacion && resultadosMapeados.length >= 3) {
    // Pasar el nombre limpio a la validación IA también
    resultadosFinales = await validarLoteIA(productoLimpio, entidades, resultadosMapeados);
    // Re-ordenar post-validación
    resultadosFinales.sort((a, b) => {
      const aCorr = a.producto_correcto_ia !== false ? 1 : 0;
      const bCorr = b.producto_correcto_ia !== false ? 1 : 0;
      if (bCorr !== aCorr) return bCorr - aCorr;
      return b.score - a.score;
    });
  }

  // ── Normaliza nombre de tienda para deduplicar ─────────────────────────────
  // "Sodimac" y "sodimac.cl" → "sodimac" | "Easy" y "easy.cl" → "easy"
  const normTienda = (t: string) =>
    (t || '').toLowerCase()
      .replace(/\s+(s\.?a\.?|spa|ltda?\.?|limitada|store|chile)\s*$/i, '')
      .replace(/\.(cl|com|net|org)\s*$/i, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 25);

  // Deduplicar: máx 1 resultado por proveedor por ítem
  const tiendasVistas = new Set<string>();
  const resultadosDedupTienda: ResultadoMapeado[] = [];
  for (const r of resultadosFinales) {
    const tiendaKey = normTienda(r.tienda || '');
    if (!tiendaKey || tiendasVistas.has(tiendaKey)) continue;
    tiendasVistas.add(tiendaKey);
    resultadosDedupTienda.push(r);
    if (resultadosDedupTienda.length >= minimo) break;
  }
  const resultadosSlice = resultadosDedupTienda.length >= 3
    ? resultadosDedupTienda.slice(0, minimo)
    : resultadosFinales.slice(0, minimo);

  // ── Marcar resultados locales de la región ───────────────────────────────────
  // Claves normalizadas (sin acentos, minúsculas) para coincidir con regionKey
  const REGION_KEYWORDS: Record<string, string[]> = {
    'valparaiso': ['valpo', 'valparaiso', 'vina', 'quillota', 'sanantonio', 'losandes'],
    'metropolitana': ['santiago', 'stgo', 'providencia', 'lascondes', 'nunoa', 'maipu'],
    'biobio': ['concepcion', 'talcahuano', 'biobio', 'lota', 'coronel'],
    'maule': ['talca', 'curico', 'linares', 'constitucion'],
    "o'higgins": ['rancagua', 'ohiggins', 'sanfernando'],
    'la araucania': ['temuco', 'araucania', 'villarrica'],
    'los lagos': ['puertomontt', 'osorno', 'loslagos', 'chiloe'],
    'aysen': ['aysen', 'coyhaique'],
    'antofagasta': ['antofagasta', 'calama'],
    'coquimbo': ['laserena', 'coquimbo', 'ovalle'],
    'atacama': ['copiapo', 'vallenar'],
    'tarapaca': ['iquique', 'altohospicio'],
    'arica y parinacota': ['arica'],
    'magallanes': ['puntaarenas', 'magallanes'],
    'nuble': ['chillan', 'nuble'],
    'los rios': ['valdivia', 'losrios'],
  };
  const regionKey = (region || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const kwsRegion = REGION_KEYWORDS[regionKey] || (region ? [regionKey.replace(/\s+/g, '')] : []);

  const marcarLocal = (r: ResultadoMapeado) => {
    if (!kwsRegion.length) return r;
    const texto = ((r.tienda || '') + ' ' + (r.nombre || '') + ' ' + (r.link || ''))
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');
    const esLocal = kwsRegion.some(k => texto.includes(k));
    return esLocal ? { ...r, es_local_region: true } : r;
  };

  const resultadosConLocal = resultadosSlice.map(marcarLocal);

  return NextResponse.json({
    numero_item: numeroItem,
    producto,
    producto_limpio: productoLimpio !== producto ? productoLimpio : undefined,
    categoria,
    resultados: resultadosConLocal,
    total_encontrados: resultadosSlice.length,
    suficientes: resultadosSlice.length >= minimo,
    deficit: Math.max(0, minimo - resultadosSlice.length),
    pais_busqueda: 'CL',
    region_busqueda: region || null,
    queries_ia: variantes,
    expandido_ia: variantes.length > 1,
    analisis_producto: analisis,
    entidades_detectadas: entidades,
  });
}
