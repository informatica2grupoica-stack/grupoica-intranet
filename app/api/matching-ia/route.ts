// app/api/matching-ia/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

type NivelMatching = 'exacto' | 'parcial' | 'bajo';

interface ResultadoRaw {
  tienda: string;
  nombre: string;
  precio_valor: number;
  precio_formateado: string;
  link: string;
  canal: string;
  busqueda_original: string;
  score: number;                        // Score 0-100 calculado por Python
  nivel_concordancia: string;           // exacta | alta | parcial | baja | nula
  medidas_encontradas: string;          // Ej: "150x50mm, 6m"
  specs_encontradas: string[];          // Ej: ["acero", "estructural"]
  palabras_comunes: string[];           // Palabras que SÍ coinciden
  palabras_faltantes: string[];         // Palabras del buscado que NO están
  conflicto_medidas: boolean;           // True si las medidas difieren
}

interface AnalisisProducto {
  nombre_original: string;
  nombre_normalizado: string;
  categoria: string;
  palabras_clave: string[];
  medidas: {
    tiene_medidas: boolean;
    detalle: Record<string, unknown>;
    texto_legible: string;             // Ej: "150x50mm, 6m"
  };
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

interface MatchingResult {
  porcentaje: number;
  nivel: NivelMatching;
  razon: string;
  penalizaciones: string[];
  bonificaciones: string[];
}

// ---------------------------------------------------------------------------
// PROMPT PRINCIPAL — Motor de matching semántico
// ---------------------------------------------------------------------------

function construirPromptSistema(
  productoBuscado: string,
  analisisProducto: AnalisisProducto
): string {
  const tp = analisisProducto.tipo_producto;
  const medidas = analisisProducto.medidas;

  // ── Bloque 1: Identidad y misión ──────────────────────────────────────────
  let prompt = `Eres MATCH-IA, un motor de matching semántico especializado en productos de ferretería, construcción, aceros, pinturas y señalética para el mercado chileno (CLP).

Tu única función es comparar productos encontrados contra el producto buscado y asignar un porcentaje de coincidencia (0-100) con una justificación clara.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCTO BUSCADO: "${productoBuscado}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ANÁLISIS ESTRUCTURAL DEL BUSCADO:
  • Categoría detectada   : ${analisisProducto.categoria}
  • Palabras clave        : ${analisisProducto.palabras_clave.join(', ') || 'ninguna'}
  • Especificaciones      : ${analisisProducto.especificaciones_tecnicas.join(', ') || 'ninguna'}
  • Medidas               : ${medidas.texto_legible}
  • Tiene medidas críticas: ${medidas.tiene_medidas ? 'SÍ — las medidas son OBLIGATORIAS' : 'NO'}
  • Marca detectada       : ${analisisProducto.marca_detectada || 'no especificada'}
  • Unidades esperadas    : ${analisisProducto.unidades_relevantes.join(', ') || 'cualquiera'}
  • Es accesorio          : ${analisisProducto.es_accesorio ? 'SÍ' : 'NO'}
`;

  // ── Bloque 2: Reglas específicas por tipo de producto ────────────────────
  prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS ESPECIALES PARA ESTE PRODUCTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  if (tp.maquinaria_pesada) {
    prompt += `
⚠️  TIPO: MAQUINARIA PESADA / AGRÍCOLA
  → RECHAZA accesorios, repuestos, filtros, neumáticos, piezas sueltas.
  → PRIORIZA la máquina completa. Penaliza -30 si es repuesto/pieza.
  → Si el nombre incluye "para [máquina]" o "repuesto [máquina]" → score máximo 40.
`;
  }

  if (tp.herramienta_electrica) {
    prompt += `
⚠️  TIPO: HERRAMIENTA ELÉCTRICA / MOTORIZADA
  → RECHAZA: discos, carbones, estuches, extensiones, brocas sueltas.
  → PRIORIZA la herramienta completa (con motor/mecanismo).
  → Penaliza -25 si es accesorio de la herramienta, no la herramienta misma.
`;
  }

  if (tp.material_construccion) {
    prompt += `
⚠️  TIPO: MATERIAL DE CONSTRUCCIÓN
  → Las MEDIDAS son el criterio principal de coincidencia.
  → Si hay conflicto de medidas (ej: buscado 150mm vs encontrado 100mm) → score máximo 50.
  → Verifica que el TIPO de material coincida (ej: no confundas acero estriado con liso).
  → Penaliza -20 si el material es diferente (ej: acero vs aluminio).
`;
  }

  if (tp.articulo_pequeno) {
    prompt += `
⚠️  TIPO: ARTÍCULO DE FERRETERÍA (clavo, tornillo, perno, etc.)
  → La MEDIDA/CALIBRE es obligatoria. Penaliza -30 si la medida difiere.
  → Verifica que sea la misma forma (hexagonal, phillips, cabeza plana, etc.).
  → Penaliza -15 si el material difiere (acero vs latón vs plástico).
`;
  }

  if (tp.pintura_quimico) {
    prompt += `
⚠️  TIPO: PINTURA / RECUBRIMIENTO QUÍMICO
  → Verifica: tipo (látex, esmalte, anticorrosivo, barniz), presentación (litros, galones).
  → Penaliza -20 si el TIPO de pintura es diferente.
  → Penaliza -15 si la presentación (volumen) difiere significativamente.
  → Acepta diferencias de marca si el tipo y volumen coinciden.
`;
  }

  if (tp.senaletica_vial) {
    prompt += `
⚠️  TIPO: SEÑALÉTICA / SEGURIDAD VIAL
  → Verifica que sea el mismo tipo de señal o elemento vial.
  → Penaliza -25 si el material o categoría de señal es diferente.
  → Penaliza -15 si las dimensiones no coinciden.
`;
  }

  if (medidas.tiene_medidas) {
    prompt += `
⚠️  MEDIDAS CRÍTICAS DETECTADAS: "${medidas.texto_legible}"
  → Cualquier resultado con medidas DIFERENTES recibe automáticamente score ≤ 55.
  → Si el resultado NO menciona medidas y el buscado sí las tiene → penaliza -20.
  → La coincidencia exacta de medidas da un BONO de +15 sobre el score base.
`;
  }

  // ── Bloque 3: Escala de puntuación ────────────────────────────────────────
  prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESCALA DE PUNTUACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
90-100 EXACTO      → Mismo producto: nombre, tipo, medidas y especificaciones coinciden.
70-89  ALTO        → Mismo producto con pequeñas variaciones (marca diferente, presentación similar).
50-69  PARCIAL     → Misma categoría pero varían medidas, tipo o especificaciones.
25-49  BAJO        → Producto relacionado pero incorrecto (ej: perno vs tornillo, liso vs estriado).
0-24   NULO        → Producto completamente diferente o accesorio no relacionado.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BONIFICACIONES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+15 → Medidas coinciden exactamente
+10 → Misma marca detectada
+10 → Mismas especificaciones técnicas (galvanizado, estriado, anticorrosivo, etc.)
+5  → Tienda especializada en la categoría (ej: aceroscmpc para aceros)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PENALIZACIONES AUTOMÁTICAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-30 → Es repuesto/accesorio cuando se busca el producto completo
-25 → Medidas completamente diferentes (ej: 50mm vs 150mm)
-20 → Tipo de producto diferente (ej: esmalte vs látex, estriado vs liso)
-20 → Material diferente (acero vs aluminio, pino vs MDF)
-15 → Presentación muy diferente (1lt vs 20lt, 1kg vs 25kg)
-10 → El resultado no menciona medidas cuando el buscado sí las tiene

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPUESTA — SOLO JSON, SIN TEXTO ADICIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "resultados": [
    {
      "id": 0,
      "porcentaje": 92,
      "nivel": "exacto",
      "razon": "Misma pieza, medida y material. Solo difiere marca.",
      "penalizaciones": [],
      "bonificaciones": ["Medidas exactas +15", "Spec anticorrosivo +10"]
    }
  ],
  "mejor_match_id": 0,
  "resumen": "Texto breve explicando la calidad general de los resultados encontrados."
}

nivel debe ser: "exacto" (≥90) | "alto" (70-89) | "parcial" (50-69) | "bajo" (25-49) | "nulo" (<25)
razon: máximo 80 caracteres, en español, específica y útil para el usuario final.
penalizaciones y bonificaciones: lista corta con la razón y el valor aplicado.
`;

  return prompt;
}

// ---------------------------------------------------------------------------
// CONSTRUCCIÓN DEL PAYLOAD PARA LA IA
// Formatea cada resultado con su metadata enriquecida del Python
// ---------------------------------------------------------------------------

function construirPayloadResultados(resultados: ResultadoRaw[]): object[] {
  return resultados.slice(0, 30).map((r, idx) => ({
    id: idx,
    tienda: (r.tienda || '').substring(0, 30),
    nombre: (r.nombre || '').substring(0, 120),
    precio: r.precio_valor || 0,
    // Metadata pre-analizada por Python — reduce carga cognitiva de la IA
    score_python: r.score || 0,
    nivel_python: r.nivel_concordancia || '',
    medidas: r.medidas_encontradas || 'no especificadas',
    specs: r.specs_encontradas || [],
    palabras_en_comun: r.palabras_comunes || [],
    palabras_faltantes: r.palabras_faltantes || [],
    conflicto_medidas: r.conflicto_medidas || false,
  }));
}

// ---------------------------------------------------------------------------
// ALGORITMO DE FALLBACK (sin IA disponible)
// Usa el análisis pre-calculado por Python directamente
// ---------------------------------------------------------------------------

function usarAlgoritmoBasico(
  productoBuscado: string,
  resultadosRaw: ResultadoRaw[],
  analisisProducto?: AnalisisProducto
): NextResponse {
  const resultadosConMatch = resultadosRaw.map((r, idx) => {
    // Usar el score calculado por Python como base
    let porcentaje = r.score || 0;

    // Penalización adicional si hay conflicto de medidas detectado
    if (r.conflicto_medidas) {
      porcentaje = Math.min(porcentaje, 50);
    }

    // Bonus si hay muchas palabras en común
    const palabrasComunes = r.palabras_comunes?.length || 0;
    if (palabrasComunes >= 3) porcentaje = Math.min(100, porcentaje + 5);

    // Penalización si faltan muchas palabras clave
    const palabrasFaltantes = r.palabras_faltantes?.length || 0;
    if (palabrasFaltantes >= 3) porcentaje = Math.max(0, porcentaje - 10);

    porcentaje = Math.min(100, Math.max(0, Math.round(porcentaje)));

    let nivel: NivelMatching = 'bajo';
    if (porcentaje >= 90) nivel = 'exacto';
    else if (porcentaje >= 70) nivel = 'parcial'; // Usa 'parcial' para 'alto' en fallback
    else if (porcentaje >= 50) nivel = 'parcial';

    const razon = r.conflicto_medidas
      ? 'Medidas no coinciden con lo buscado'
      : palabrasComunes >= 3
        ? `${palabrasComunes} términos coincidentes: ${r.palabras_comunes.slice(0, 3).join(', ')}`
        : palabrasFaltantes > 0
          ? `Faltan términos: ${r.palabras_faltantes.slice(0, 2).join(', ')}`
          : 'Coincidencia aproximada por nombre';

    return {
      ...r,
      matching: { porcentaje, nivel, razon, penalizaciones: [], bonificaciones: [] }
    };
  });

  resultadosConMatch.sort((a, b) => b.matching.porcentaje - a.matching.porcentaje);

  return NextResponse.json({
    success: true,
    mejor_match: resultadosConMatch[0] || null,
    todos_resultados: resultadosConMatch,
    usado_ia: false,
    resumen: `Matching local para "${productoBuscado}": ${resultadosConMatch.filter(r => r.matching.porcentaje >= 70).length} resultados relevantes.`,
    tiempo_ms: 0,
  });
}

// ---------------------------------------------------------------------------
// HANDLER PRINCIPAL
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      producto_buscado,
      resultados_raw,
      analisis_producto,   // ← Viene del Python v3.0 (analisis_buscado)
    }: {
      producto_buscado: string;
      resultados_raw: ResultadoRaw[];
      analisis_producto?: AnalisisProducto;
    } = body;

    // ── Validación ──────────────────────────────────────────────────────────
    if (!producto_buscado || !resultados_raw || resultados_raw.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Faltan datos para el matching',
        mejor_match: null,
        todos_resultados: [],
      });
    }

    // ── Sin API Key → fallback inmediato ────────────────────────────────────
    if (!process.env.DEEPSEEK_API_KEY) {
      console.warn('⚠️ Sin DEEPSEEK_API_KEY — usando algoritmo local');
      return usarAlgoritmoBasico(producto_buscado, resultados_raw, analisis_producto);
    }

    // ── Construir prompt y payload ───────────────────────────────────────────
    const promptSistema = construirPromptSistema(
      producto_buscado,
      analisis_producto ?? {
        nombre_original: producto_buscado,
        nombre_normalizado: producto_buscado.toLowerCase(),
        categoria: 'ferreteria_general',
        palabras_clave: producto_buscado.split(' ').filter(p => p.length > 2),
        medidas: { tiene_medidas: false, detalle: {}, texto_legible: 'sin medidas' },
        especificaciones_tecnicas: [],
        unidades_relevantes: [],
        es_accesorio: false,
        marca_detectada: null,
        tipo_producto: {
          maquinaria_pesada: false,
          herramienta_electrica: false,
          material_construccion: false,
          articulo_pequeno: false,
          pintura_quimico: false,
          senaletica_vial: false,
        },
      }
    );

    const payloadResultados = construirPayloadResultados(resultados_raw);

    console.log(`🤖 Matching IA para: "${producto_buscado}" (${resultados_raw.length} resultados)`);

    // ── Llamada a DeepSeek ───────────────────────────────────────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const iaResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: promptSistema },
            {
              role: 'user',
              content: `Evalúa estos ${payloadResultados.length} productos encontrados:\n\n${JSON.stringify(payloadResultados, null, 2)}`,
            },
          ],
          temperature: 0.05,       // Mínima variabilidad — queremos consistencia
          max_tokens: 3000,
          response_format: { type: 'json_object' },
        }),
      });

      clearTimeout(timeoutId);

      if (!iaResponse.ok) {
        console.warn(`⚠️ DeepSeek respondió ${iaResponse.status} — usando fallback`);
        return usarAlgoritmoBasico(producto_buscado, resultados_raw, analisis_producto);
      }

      const iaData = await iaResponse.json();
      const contenido = iaData.choices?.[0]?.message?.content;

      if (!contenido) {
        throw new Error('Respuesta IA vacía');
      }

      const parsed = JSON.parse(contenido);
      const rankingIA: Array<{
        id: number;
        porcentaje: number;
        nivel: string;
        razon: string;
        penalizaciones: string[];
        bonificaciones: string[];
      }> = parsed.resultados || [];

      if (rankingIA.length === 0) {
        throw new Error('IA no retornó resultados');
      }

      // ── Enriquecer resultados originales con datos de la IA ─────────────
      const resultadosConMatch = rankingIA
        .filter(match => match.id >= 0 && match.id < resultados_raw.length)
        .map(match => ({
          ...resultados_raw[match.id],
          matching: {
            porcentaje: Math.min(100, Math.max(0, Math.round(match.porcentaje))),
            nivel: (match.nivel as NivelMatching) || 'bajo',
            razon: match.razon || '',
            penalizaciones: match.penalizaciones || [],
            bonificaciones: match.bonificaciones || [],
          },
        }));

      // Ordenar por porcentaje IA descendente
      resultadosConMatch.sort((a, b) => b.matching.porcentaje - a.matching.porcentaje);

      const mejorMatchId = parsed.mejor_match_id ?? 0;
      const mejorMatch =
        resultadosConMatch.find((_, idx) => idx === mejorMatchId) ||
        resultadosConMatch[0] ||
        null;

      console.log(
        `✅ Matching IA completado en ${Date.now() - startTime}ms — mejor: ${mejorMatch?.nombre?.substring(0, 50)} (${mejorMatch?.matching?.porcentaje}%)`
      );

      return NextResponse.json({
        success: true,
        mejor_match: mejorMatch,
        todos_resultados: resultadosConMatch,
        usado_ia: true,
        resumen: parsed.resumen || '',
        tiempo_ms: Date.now() - startTime,
      });

    } catch (iaError: unknown) {
      clearTimeout(timeoutId);
      const msg = iaError instanceof Error ? iaError.message : 'timeout o error de red';
      console.warn(`⚠️ Error IA (${msg}) — usando fallback local`);
      return usarAlgoritmoBasico(producto_buscado, resultados_raw, analisis_producto);
    }

  } catch (error: unknown) {
    console.error('❌ Error crítico en matching-ia:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno',
        mejor_match: null,
        todos_resultados: [],
      },
      { status: 500 }
    );
  }
}