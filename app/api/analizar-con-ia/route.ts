// app/api/analizar-con-ia/route.ts
// Filtro IA post-búsqueda: DeepSeek (reranking estructurado) + Gemini (validación semántica).
// DeepSeek ordena y descarta. Gemini valida los inciertos y los top resultados.
// Ambos corren en paralelo y sus resultados se fusionan.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 55;

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

const cacheIA = new Map<string, { resultados: unknown; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ProductoResultado {
  tienda: string;
  nombre: string;
  precio_valor: number;
  precio_formateado: string;
  link: string;
  canal: string;
  busqueda_original: string;
  score: number;
  nivel_concordancia: string;
  medidas_encontradas: string;
  specs_encontradas: string[];
  palabras_comunes: string[];
  palabras_faltantes: string[];
  conflicto_medidas: boolean;
  confianza_ia?: number;
  confianza_gemini?: number;
  confianza_deepseek?: number;
  validado_gemini?: boolean;
  [key: string]: unknown;
}

interface AnalisisProducto {
  nombre_original: string;
  nombre_normalizado: string;
  categoria: string;
  palabras_clave: string[];
  medidas: { tiene_medidas: boolean; detalle: Record<string, unknown>; texto_legible: string };
  especificaciones_tecnicas: string[];
  unidades_relevantes: string[];
  es_accesorio: boolean;
  marca_detectada: string | null;
  tipo_producto: {
    maquinaria_pesada: boolean;
    herramienta_electrica: boolean;
    material_construccion: boolean;
    articulo_pequeno: boolean;
    pintura_quimico: boolean;
    senaletica_vial: boolean;
  };
}

interface EntidadesDetectadas {
  marca?: string | null;
  modelo?: string | null;
  sku?: string | null;
  specs?: string[];
}

// ─── Prompt compartido para ambos modelos ─────────────────────────────────────

function construirContextoProducto(
  producto: string,
  analisis: AnalisisProducto,
  entidades?: EntidadesDetectadas
): string {
  const tp = analisis.tipo_producto;
  const medidas = analisis.medidas;
  const marcaFinal = entidades?.marca || analisis.marca_detectada || 'cualquiera';
  const modeloFinal = entidades?.modelo || 'no especificado';
  const skuFinal = entidades?.sku || 'no especificado';
  const specsExtra = [...(analisis.especificaciones_tecnicas || []), ...(entidades?.specs || [])].filter(Boolean).join(', ');

  let ctx = `PRODUCTO BUSCADO: "${producto}"
Categoría: ${analisis.categoria}
Palabras clave: ${analisis.palabras_clave.join(', ')}
Medidas críticas: ${medidas.texto_legible}${medidas.tiene_medidas ? ' ← VERIFICAR OBLIGATORIO' : ''}
Especificaciones: ${specsExtra || 'ninguna'}
Marca: ${marcaFinal} | Modelo: ${modeloFinal} | SKU: ${skuFinal}`;

  if (tp.maquinaria_pesada) ctx += '\nTIPO: Maquinaria pesada — RECHAZAR repuestos, piezas, accesorios.';
  if (tp.herramienta_electrica) ctx += '\nTIPO: Herramienta eléctrica — RECHAZAR discos, carbones, estuches.';
  if (tp.material_construccion) ctx += '\nTIPO: Material de construcción — las MEDIDAS son el criterio principal.';
  if (tp.articulo_pequeno) ctx += '\nTIPO: Artículo pequeño (clavo/tornillo/perno) — medida/calibre OBLIGATORIO.';
  if (tp.pintura_quimico) ctx += '\nTIPO: Pintura/químico — verificar tipo Y presentación (litros/galones).';
  if (tp.senaletica_vial) ctx += '\nTIPO: Señalética — verificar que sea el mismo tipo de elemento.';

  return ctx;
}

// ─── DEEPSEEK: Reranking estructurado rápido ─────────────────────────────────

async function rerankerDeepSeek(
  producto: string,
  analisis: AnalisisProducto,
  resultados: ProductoResultado[],
  entidades?: EntidadesDetectadas
): Promise<{ rankingIds: number[]; descartados: number[]; confianzas: Record<number, number>; calidad: string; observacion: string } | null> {
  if (!DEEPSEEK_KEY) return null;

  const ctx = construirContextoProducto(producto, analisis, entidades);
  const payload = resultados.slice(0, 25).map((r, i) => ({
    id: i,
    nombre: r.nombre.substring(0, 100),
    tienda: r.tienda.substring(0, 25),
    precio: r.precio_valor,
    score_base: r.score,
    medidas: r.medidas_encontradas || 'sin medidas',
    specs: r.specs_encontradas || [],
    palabras_faltantes: r.palabras_faltantes || [],
    conflicto_medidas: r.conflicto_medidas || false,
  }));

  const prompt = `Eres RERANK-IA, experto en productos industriales para Chile.

${ctx}

ESCALA DE CONFIANZA:
90-100: Producto exacto (mismo nombre, tipo, medidas, specs)
70-89:  Mismo producto, variación menor (marca diferente, presentación similar)
50-69:  Misma categoría pero difieren medidas o specs importantes
25-49:  Producto relacionado pero incorrecto
0-24:   Completamente diferente o es accesorio cuando se busca el producto completo

PENALIZACIONES:
-30 repuesto/accesorio cuando se busca el producto completo
-25 medidas completamente diferentes
-20 tipo de producto diferente
-20 material diferente
-15 presentación muy diferente (1lt vs 20lt, 1kg vs 25kg)

Responde SOLO JSON:
{
  "ranking_ids": [2, 0, 5, 1, 3],
  "ids_descartados": [7, 8],
  "confianzas": {"0": 85, "1": 42, "2": 92},
  "calidad_general": "buena|media|baja",
  "observacion": "máx 100 chars sobre calidad de los resultados"
}`;

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 18000);
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Reordena y filtra estos ${payload.length} resultados:\n${JSON.stringify(payload, null, 2)}` },
        ],
        temperature: 0.05,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    });
    clearTimeout(tid);
    if (!r.ok) return null;
    const d = await r.json();
    const parsed = JSON.parse(d.choices?.[0]?.message?.content || '{}');
    const confs: Record<number, number> = {};
    Object.entries(parsed.confianzas || {}).forEach(([k, v]) => { confs[Number(k)] = Number(v); });
    return {
      rankingIds: Array.isArray(parsed.ranking_ids) ? parsed.ranking_ids.map(Number) : [],
      descartados: Array.isArray(parsed.ids_descartados) ? parsed.ids_descartados.map(Number) : [],
      confianzas: confs,
      calidad: parsed.calidad_general || 'media',
      observacion: parsed.observacion || '',
    };
  } catch {
    return null;
  }
}

// ─── GEMINI: Validación semántica profunda ────────────────────────────────────
// Gemini es mejor para entender contexto técnico y semántica de producto.
// Se usa para validar los top 8 resultados y los de confianza media (40-70).

async function validadorGemini(
  producto: string,
  analisis: AnalisisProducto,
  resultados: ProductoResultado[],
  entidades?: EntidadesDetectadas
): Promise<Record<number, { confianza: number; correcto: boolean; motivo: string }> | null> {
  if (!GEMINI_KEY) return null;

  const ctx = construirContextoProducto(producto, analisis, entidades);
  const top = resultados.slice(0, 8);
  const payload = top.map((r, i) => ({
    id: i,
    nombre: r.nombre.substring(0, 120),
    tienda: r.tienda.substring(0, 30),
    medidas: r.medidas_encontradas || 'no indicadas',
    specs: (r.specs_encontradas || []).join(', '),
  }));

  const prompt = `Eres un experto técnico en productos industriales, materiales de construcción y ferretería para el mercado chileno.

${ctx}

Tu tarea: para cada producto encontrado, determina si ES o NO ES el producto buscado.
Analiza semánticamente: nombre completo, especificaciones técnicas, compatibilidad de medidas y tipo de producto.

Sé conservador: un producto "similar" que no tiene las mismas specs NO es correcto.

Responde SOLO JSON:
{
  "validaciones": [
    {"id": 0, "correcto": true, "confianza": 88, "motivo": "Mismo producto, voltaje y potencia coinciden"},
    {"id": 1, "correcto": false, "confianza": 25, "motivo": "Es accesorio, no el motor completo"}
  ]
}
confianza 0-100. motivo máx 80 chars en español.`;

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 25000);
    const r = await fetch(
      `${GEMINI_BASE}/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${prompt}\n\nProductos a validar:\n${JSON.stringify(payload, null, 2)}`,
            }],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1500,
            responseMimeType: 'application/json',
          },
        }),
      }
    );
    clearTimeout(tid);
    if (!r.ok) return null;
    const data = await r.json();
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!txt) return null;
    const parsed = JSON.parse(txt);
    const resultado: Record<number, { confianza: number; correcto: boolean; motivo: string }> = {};
    (parsed.validaciones || []).forEach((v: { id: number; confianza: number; correcto: boolean; motivo: string }) => {
      if (typeof v.id === 'number') resultado[v.id] = { confianza: v.confianza, correcto: Boolean(v.correcto), motivo: v.motivo || '' };
    });
    return resultado;
  } catch {
    return null;
  }
}

// ─── Fusionar resultados de ambos modelos ─────────────────────────────────────

function fusionarResultados(
  resultados: ProductoResultado[],
  deepseek: { rankingIds: number[]; descartados: number[]; confianzas: Record<number, number>; calidad: string; observacion: string } | null,
  gemini: Record<number, { confianza: number; correcto: boolean; motivo: string }> | null
): { resultadosFinales: ProductoResultado[]; calidad: string; observacion: string } {
  // Si ningún modelo respondió → orden local por score
  if (!deepseek && !gemini) {
    const ordenados = [...resultados].sort((a, b) => {
      if (a.conflicto_medidas && !b.conflicto_medidas) return 1;
      if (!a.conflicto_medidas && b.conflicto_medidas) return -1;
      return b.score - a.score;
    });
    return { resultadosFinales: ordenados, calidad: 'media', observacion: 'Orden local (IA no disponible)' };
  }

  // Construir mapa de confianzas fusionadas
  const confianzaFinal = new Map<number, number>();
  const motivoFinal = new Map<number, string>();
  const incorrectoGemini = new Set<number>();

  // Aplicar confianzas de DeepSeek
  if (deepseek) {
    Object.entries(deepseek.confianzas).forEach(([k, v]) => confianzaFinal.set(Number(k), v));
  }

  // Refinar con Gemini (tiene más peso en validación semántica)
  if (gemini) {
    Object.entries(gemini).forEach(([k, val]) => {
      const idx = Number(k);
      const confDS = confianzaFinal.get(idx) ?? resultados[idx]?.score ?? 0;
      const confGem = val.confianza;
      // Gemini tiene 60% de peso, DeepSeek 40% en la confianza final
      const fusionada = Math.round(confGem * 0.6 + confDS * 0.4);
      confianzaFinal.set(idx, fusionada);
      if (val.motivo) motivoFinal.set(idx, val.motivo);
      if (!val.correcto && confGem < 45) incorrectoGemini.add(idx);
    });
  }

  // Determinar descartados: DeepSeek descarta + Gemini invalida con alta confianza
  const descartados = new Set<number>(deepseek?.descartados ?? []);
  incorrectoGemini.forEach((idx) => {
    // Solo descartar si Gemini tiene confianza < 40 (es suficientemente seguro)
    const gemVal = gemini?.[idx];
    if (gemVal && gemVal.confianza < 40 && !gemVal.correcto) descartados.add(idx);
  });

  // Ordenar por ranking DeepSeek primero, luego ajustar con confianza fusionada
  let rankingIds = deepseek?.rankingIds ?? resultados.map((_, i) => i);
  rankingIds = rankingIds.filter((id) => !descartados.has(id) && id >= 0 && id < resultados.length);

  // Si no hay ranking IDs válidos, usar todos
  if (!rankingIds.length) {
    rankingIds = resultados.map((_, i) => i).filter((i) => !descartados.has(i));
  }

  const resultadosFinales: ProductoResultado[] = rankingIds.map((id) => {
    const res = { ...resultados[id] };
    const conf = confianzaFinal.get(id);
    if (conf !== undefined) {
      res.confianza_ia = conf;
      res.confianza_deepseek = deepseek?.confianzas[id];
      res.confianza_gemini = gemini?.[id]?.confianza;
      res.validado_gemini = gemini !== null;
      // Ajustar score para que coincida con la confianza fusionada
      if (conf > res.score + 5) res.score = Math.min(100, Math.round((res.score + conf) / 2));
      if (conf < res.score - 20) res.score = Math.round((res.score + conf) / 2);
    }
    if (motivoFinal.has(id)) res.motivo_ia = motivoFinal.get(id);
    return res;
  });

  // Re-ordenar por confianza_ia si disponible, si no por score
  resultadosFinales.sort((a, b) => {
    const ca = a.confianza_ia ?? a.score;
    const cb = b.confianza_ia ?? b.score;
    return cb - ca;
  });

  return {
    resultadosFinales,
    calidad: deepseek?.calidad || 'media',
    observacion: deepseek?.observacion || '',
  };
}

// ─── Fallback local sin IA ────────────────────────────────────────────────────

function ordenarLocal(resultados: ProductoResultado[]): ProductoResultado[] {
  return [...resultados].sort((a, b) => {
    if (a.conflicto_medidas && !b.conflicto_medidas) return 1;
    if (!a.conflicto_medidas && b.conflicto_medidas) return -1;
    return b.score - a.score;
  });
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const {
      producto,
      numero_item = '',
      minimo_requerido = 9,
      resultados_raw = [],
      analisis_producto = null,
      entidades_detectadas = null,
      force_refresh = false,
    } = body;

    if (!producto?.trim()) {
      return NextResponse.json({ error: 'Se requiere nombre del producto', resultados: [], suficientes: false, deficit: minimo_requerido, numero_item }, { status: 400 });
    }

    // ── Cache ────────────────────────────────────────────────────────────────
    const cacheKey = `${producto}_${minimo_requerido}`;
    if (!force_refresh && cacheIA.has(cacheKey)) {
      const cached = cacheIA.get(cacheKey)!;
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json({ ...(cached.resultados as object), from_cache: true });
      }
      cacheIA.delete(cacheKey);
    }

    let resultados: ProductoResultado[] = resultados_raw || [];
    if (!resultados.length) {
      return NextResponse.json({ success: true, numero_item, producto, resultados: [], total_encontrados: 0, suficientes: false, deficit: minimo_requerido, tiempo_ms: 0 });
    }

    console.log(`🔍 [${numero_item}] "${producto}" — ${resultados.length} resultados, IA: DS=${!!DEEPSEEK_KEY} GM=${!!GEMINI_KEY}`);

    // ── Análisis por defecto si no viene del frontend ────────────────────────
    const analisis: AnalisisProducto = analisis_producto ?? {
      nombre_original: producto,
      nombre_normalizado: producto.toLowerCase(),
      categoria: 'ferreteria_general',
      palabras_clave: producto.toLowerCase().split(' ').filter((p: string) => p.length > 2),
      medidas: { tiene_medidas: false, detalle: {}, texto_legible: 'sin medidas' },
      especificaciones_tecnicas: [],
      unidades_relevantes: [],
      es_accesorio: false,
      marca_detectada: null,
      tipo_producto: { maquinaria_pesada: false, herramienta_electrica: false, material_construccion: false, articulo_pequeno: false, pintura_quimico: false, senaletica_vial: false },
    };

    const entidades: EntidadesDetectadas = entidades_detectadas || {};

    // ── Si no hay ninguna API → orden local inmediato ────────────────────────
    if (!DEEPSEEK_KEY && !GEMINI_KEY) {
      const ordenados = ordenarLocal(resultados);
      return NextResponse.json({ success: true, numero_item, producto, resultados: ordenados.slice(0, Math.max(minimo_requerido, 20)), total_encontrados: ordenados.length, suficientes: ordenados.length >= minimo_requerido, deficit: Math.max(0, minimo_requerido - ordenados.length), calidad_resultados: 'media', observacion_ia: 'Sin claves IA configuradas', tiempo_ms: Date.now() - startTime, from_cache: false });
    }

    // ── Ejecutar DeepSeek y Gemini EN PARALELO ───────────────────────────────
    // DeepSeek hace el reranking completo (rápido).
    // Gemini valida semánticamente los top 8 (más lento pero más preciso).
    // El resultado se fusiona dando mayor peso a Gemini en la validación.
    type DSResult = { rankingIds: number[]; descartados: number[]; confianzas: Record<number, number>; calidad: string; observacion: string } | null;
    type GMResult = Record<number, { confianza: number; correcto: boolean; motivo: string }> | null;
    let deepseekOut: DSResult = null;
    let geminiOut: GMResult = null;

    if (resultados.length >= 2) {
      const tieneEntidad = Boolean(entidades.marca || entidades.modelo || entidades.sku);
      const scoreTop = resultados[0]?.score ?? 0;
      const usarGemini = GEMINI_KEY && (tieneEntidad || scoreTop < 80 || analisis.medidas.tiene_medidas);

      const [dsRes, gmRes] = await Promise.all([
        DEEPSEEK_KEY ? rerankerDeepSeek(producto, analisis, resultados, entidades) as Promise<DSResult> : Promise.resolve<DSResult>(null),
        usarGemini ? validadorGemini(producto, analisis, resultados, entidades) as Promise<GMResult> : Promise.resolve<GMResult>(null),
      ]);
      deepseekOut = dsRes;
      geminiOut = gmRes;

      console.log(`✅ DS: ${deepseekOut ? `${deepseekOut.rankingIds.length} rankeados, ${deepseekOut.descartados.length} descartados` : 'no disponible'} | GM: ${geminiOut ? `${Object.keys(geminiOut).length} validados` : 'no usado'}`);
    }

    // ── Fusionar resultados ──────────────────────────────────────────────────
    const { resultadosFinales, calidad, observacion } = fusionarResultados(resultados, deepseekOut, geminiOut);

    const maxRes = Math.max(minimo_requerido, 20);
    const slice = resultadosFinales.slice(0, maxRes);
    const respuesta = {
      success: true,
      numero_item,
      producto,
      resultados: slice,
      total_encontrados: slice.length,
      suficientes: slice.length >= minimo_requerido,
      deficit: Math.max(0, minimo_requerido - slice.length),
      minimo_requerido,
      calidad_resultados: calidad,
      observacion_ia: observacion,
      modelos_usados: [deepseekOut ? 'deepseek' : null, geminiOut ? 'gemini' : null].filter(Boolean),
      tiempo_ms: Date.now() - startTime,
      from_cache: false,
    };

    if (slice.length > 0) cacheIA.set(cacheKey, { resultados: respuesta, timestamp: Date.now() });
    return NextResponse.json(respuesta);

  } catch (error: unknown) {
    console.error('❌ Error crítico en analizar-con-ia:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Error interno', resultados: [], suficientes: false, total_encontrados: 0, deficit: 9, tiempo_ms: 0 }, { status: 500 });
  }
}

export async function DELETE() {
  cacheIA.clear();
  return NextResponse.json({ message: 'Cache limpiado' });
}
