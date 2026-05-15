// app/api/analizar-con-ia/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// ── Cache con TTL ────────────────────────────────────────────────────────────
const cacheIA = new Map<string, { resultados: unknown; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

// ── Tipos ────────────────────────────────────────────────────────────────────

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
}

interface AnalisisProducto {
  nombre_original: string;
  nombre_normalizado: string;
  categoria: string;
  palabras_clave: string[];
  medidas: {
    tiene_medidas: boolean;
    detalle: Record<string, unknown>;
    texto_legible: string;
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

// ── Prompt para el analizador / reranker ────────────────────────────────────

function construirPromptReranker(
  producto: string,
  analisis: AnalisisProducto,
  minimoRequerido: number
): string {
  const tp = analisis.tipo_producto;
  const medidas = analisis.medidas;

  let prompt = `Eres RERANK-IA, un sistema de reordenamiento y filtrado de resultados de búsqueda de productos para ferretería y construcción en Chile.

Tu misión: dado un listado de productos encontrados, ordenarlos del MÁS al MENOS relevante para el producto buscado, y descartar los que claramente no corresponden.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCTO OBJETIVO: "${producto}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Categoría          : ${analisis.categoria}
Palabras clave     : ${analisis.palabras_clave.join(', ')}
Medidas críticas   : ${medidas.texto_legible} ${medidas.tiene_medidas ? '← OBLIGATORIO verificar' : '(no aplica)'}
Especificaciones   : ${analisis.especificaciones_tecnicas.join(', ') || 'ninguna'}
Marca buscada      : ${analisis.marca_detectada || 'cualquiera'}
Mínimo requerido   : ${minimoRequerido} resultados relevantes
`;

  // ── Restricciones según tipo ─────────────────────────────────────────────
  prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITERIOS DE FILTRADO (aplica en este orden)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  if (tp.maquinaria_pesada) {
    prompt += `
1. ELIMINA todo resultado que sea repuesto, accesorio, pieza o recambio de maquinaria.
2. Conserva SOLO máquinas/equipos completos.
3. Ordena por coincidencia de capacidad/potencia, luego por precio ascendente.
`;
  } else if (tp.herramienta_electrica) {
    prompt += `
1. ELIMINA discos, carbones, brocas sueltas, estuches, extensiones, accesorios.
2. Conserva SOLO herramientas completas con motor o mecanismo principal.
3. Si el buscado especifica voltaje/potencia, prioriza los que la mencionen.
`;
  } else if (tp.material_construccion) {
    prompt += `
1. Las MEDIDAS son el filtro principal. Productos con medidas distintas al buscado van al final.
2. Si un resultado tiene "conflicto_medidas: true" → moverlo al final del ranking.
3. Verifica que el tipo de material coincida (acero ≠ aluminio, pino ≠ MDF, etc.).
4. Ordena primero por coincidencia de medidas, luego por coincidencia de tipo, luego precio.
`;
  } else if (tp.articulo_pequeno) {
    prompt += `
1. La medida/calibre es obligatoria. Si difiere → al final.
2. Verifica forma del artículo (hexagonal, Phillips, Allen, cabeza plana, etc.).
3. Verifica material (acero inoxidable, latón, galvanizado, etc.) si está especificado.
`;
  } else if (tp.pintura_quimico) {
    prompt += `
1. Verifica que el TIPO coincida: látex ≠ esmalte ≠ anticorrosivo ≠ barniz ≠ impermeabilizante.
2. Verifica la presentación (litros/galones) — penaliza diferencias grandes (ej: 1lt vs 20lt).
3. Si la marca está especificada, prioriza esa marca.
`;
  } else if (tp.senaletica_vial) {
    prompt += `
1. Verifica que sea el mismo tipo de elemento vial (letrero ≠ tachas ≠ delineador ≠ paso cebra).
2. Si hay medidas, verifica que sean compatibles.
3. Prioriza tiendas especializadas en señalética sobre marketplaces genéricos.
`;
  } else {
    prompt += `
1. Prioriza resultados donde las palabras clave coincidan con el nombre del producto.
2. Penaliza resultados con palabras faltantes importantes (campo "palabras_faltantes").
3. Ordena por score_python descendente como criterio base.
`;
  }

  prompt += `
${medidas.tiene_medidas ? `
⚠️  REGLA CRÍTICA DE MEDIDAS:
  - Los resultados con "conflicto_medidas: true" deben quedar en el último tercio del ranking.
  - Los resultados que NO mencionan medidas cuando el buscado sí las tiene → penaliza su posición.
  - Los resultados con medidas exactas → priorizar en el top 3.
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPUESTA — SOLO JSON, SIN TEXTO ADICIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "ranking_ids": [2, 0, 5, 1, 3, 4],
  "ids_descartados": [7, 8],
  "razon_descarte": "Son accesorios/repuestos, no el producto principal",
  "calidad_general": "buena|media|baja",
  "observacion": "Texto breve (máx 100 chars) sobre la calidad de los resultados encontrados"
}

ranking_ids: IDs ordenados de mejor a peor. Incluye TODOS los no descartados.
ids_descartados: IDs que definitivamente no corresponden al producto buscado.
`;

  return prompt;
}

// ── Ordenamiento de respaldo (sin IA) ────────────────────────────────────────

function ordenarSinIA(resultados: ProductoResultado[]): ProductoResultado[] {
  return [...resultados].sort((a, b) => {
    // Primero los sin conflicto de medidas
    if (a.conflicto_medidas && !b.conflicto_medidas) return 1;
    if (!a.conflicto_medidas && b.conflicto_medidas) return -1;
    // Luego por score Python
    if (b.score !== a.score) return b.score - a.score;
    // Desempate por precio
    if (a.precio_valor > 0 && b.precio_valor > 0) return a.precio_valor - b.precio_valor;
    if (a.precio_valor === 0) return 1;
    if (b.precio_valor === 0) return -1;
    return 0;
  });
}

// ── Handler ──────────────────────────────────────────────────────────────────

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
      force_refresh = false,
    } = body;

    // ── Validación ──────────────────────────────────────────────────────────
    if (!producto?.trim()) {
      return NextResponse.json(
        {
          error: 'Se requiere nombre del producto',
          resultados: [],
          suficientes: false,
          deficit: minimo_requerido,
          numero_item,
        },
        { status: 400 }
      );
    }

    // ── Cache ────────────────────────────────────────────────────────────────
    const cacheKey = `${producto}_${minimo_requerido}`;
    if (!force_refresh && cacheIA.has(cacheKey)) {
      const cached = cacheIA.get(cacheKey)!;
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`✅ Cache hit: "${producto}"`);
        return NextResponse.json({ ...(cached.resultados as object), from_cache: true });
      }
      cacheIA.delete(cacheKey);
    }

    console.log(`🔍 [${numero_item}] "${producto}" — mínimo: ${minimo_requerido}, resultados recibidos: ${resultados_raw?.length || 0}`);

    // Usar los resultados que vienen del frontend
    let resultados: ProductoResultado[] = resultados_raw || [];
    const analisis: AnalisisProducto | null = analisis_producto;

    console.log(`📦 Frontend envió ${resultados.length} resultados para "${producto}"`);

    // ── Reranking con IA (si hay resultados y API Key) ───────────────────
    let resultadosFinales = resultados;
    let observacionIA = '';
    let calidad = 'media';

    if (resultados.length > 3 && process.env.DEEPSEEK_API_KEY) {
      try {
        // Crear un análisis por defecto si no vino del frontend
        const analisisDefault: AnalisisProducto = analisis || {
          nombre_original: producto,
          nombre_normalizado: producto.toLowerCase(),
          categoria: 'ferreteria_general',
          palabras_clave: producto.toLowerCase().split(' ').filter((p: string) => p.length > 2),
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
        };

        const promptReranker = construirPromptReranker(
          producto,
          analisisDefault,
          minimo_requerido
        );

        // Payload compacto con tipos explícitos
        const payloadParaIA = resultados.slice(0, 25).map((r: ProductoResultado, idx: number) => ({
          id: idx,
          nombre: (r.nombre || '').substring(0, 100),
          tienda: (r.tienda || '').substring(0, 25),
          precio: r.precio_valor || 0,
          score_python: r.score || 0,
          medidas: r.medidas_encontradas || 'no indicadas',
          specs: r.specs_encontradas || [],
          palabras_en_comun: r.palabras_comunes || [],
          palabras_faltantes: r.palabras_faltantes || [],
          conflicto_medidas: r.conflicto_medidas || false,
        }));

        const iaCtrl = new AbortController();
        const iaTimeout = setTimeout(() => iaCtrl.abort(), 10000);

        const iaRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          signal: iaCtrl.signal,
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: promptReranker },
              {
                role: 'user',
                content: `Reordena estos ${payloadParaIA.length} resultados:\n\n${JSON.stringify(payloadParaIA, null, 2)}`,
              },
            ],
            temperature: 0.05,
            max_tokens: 1000,
            response_format: { type: 'json_object' },
          }),
        });

        clearTimeout(iaTimeout);

        if (iaRes.ok) {
          const iaData = await iaRes.json();
          const contenido = iaData.choices?.[0]?.message?.content;
          const parsed = JSON.parse(contenido || '{}');

          const rankingIds: number[] = parsed.ranking_ids || [];
          const descartados: number[] = parsed.ids_descartados || [];
          observacionIA = parsed.observacion || '';
          calidad = parsed.calidad_general || 'media';

          if (rankingIds.length > 0) {
            // 🔥 CORREGIDO: Tipo explícito para el parámetro 'id'
            const reordenados = rankingIds
              .filter((id: number) => !descartados.includes(id) && id >= 0 && id < resultados.length)
              .map((id: number) => resultados[id]);

            resultadosFinales = reordenados;

            console.log(
              `✅ Reranking IA: ${reordenados.length} relevantes, ${descartados.length} descartados, calidad: ${calidad}`
            );
          }
        } else {
          console.warn(`⚠️ IA respondió con error: ${iaRes.status}`);
          resultadosFinales = ordenarSinIA(resultados);
        }
      } catch (iaErr) {
        const msg = iaErr instanceof Error ? iaErr.message : 'error';
        console.warn(`⚠️ Reranking IA falló (${msg}) — usando ordenamiento local`);
        resultadosFinales = ordenarSinIA(resultados);
      }
    } else {
      resultadosFinales = ordenarSinIA(resultados);
    }

    // ── Construir respuesta final ─────────────────────────────────────────
    const maxResultados = Math.max(minimo_requerido, 20);
    resultadosFinales = resultadosFinales.slice(0, maxResultados);

    const totalFinal = resultadosFinales.length;
    const suficientes = totalFinal >= minimo_requerido;

    const respuesta = {
      success: true,
      numero_item,
      producto,
      resultados: resultadosFinales,
      total_encontrados: totalFinal,
      suficientes,
      deficit: Math.max(0, minimo_requerido - totalFinal),
      minimo_requerido,
      calidad_resultados: calidad,
      observacion_ia: observacionIA,
      tiempo_ms: Date.now() - startTime,
      from_cache: false,
    };

    if (totalFinal > 0) {
      cacheIA.set(cacheKey, { resultados: respuesta, timestamp: Date.now() });
    }

    return NextResponse.json(respuesta);

  } catch (error: unknown) {
    console.error('❌ Error crítico en analizar-con-ia:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
        resultados: [],
        suficientes: false,
        total_encontrados: 0,
        deficit: 9,
        tiempo_ms: 0,
      },
      { status: 500 }
    );
  }
}

// ── DELETE: limpiar cache ─────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const { productKey } = await req.json().catch(() => ({}));
    if (productKey) {
      cacheIA.delete(productKey);
      return NextResponse.json({ message: `Cache eliminado para: ${productKey}` });
    }
    cacheIA.clear();
    return NextResponse.json({ message: 'Cache completamente limpiado', items: 0 });
  } catch {
    return NextResponse.json({ error: 'Error limpiando cache' }, { status: 500 });
  }
}