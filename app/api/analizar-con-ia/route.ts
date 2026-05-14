// app/api/analizar-con-ia/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 15; // Aumentado para búsquedas robustas

// Cache con TTL de 10 minutos para respuestas exitosas
const cacheIA = new Map<string, { resultados: any, timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000;

interface ProductoResultado {
  tienda: string;
  nombre: string;
  precio_valor: number;
  precio_formateado: string;
  link: string;
  canal: string;
  busqueda_original: string;
}

interface RespuestaRobusta {
  numero_item: string;
  producto: string;
  resultados: ProductoResultado[];
  total_encontrados: number;
  suficientes: boolean;
  deficit: number;
  tipo_producto?: {
    maquinaria_pesada: boolean;
    herramienta_electrica: boolean;
    material_construccion: boolean;
    articulo_pequeno: boolean;
  };
}

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { 
      producto, 
      numero_item = "", 
      minimo_requerido = 9,
      force_refresh = false 
    } = body;

    if (!producto || producto.trim() === "") {
      return NextResponse.json({
        error: "Se requiere nombre del producto",
        resultados: [],
        suficientes: false,
        deficit: minimo_requerido,
        numero_item
      }, { status: 400 });
    }

    // Verificar caché (a menos que se fuerce refresh)
    const cacheKey = `${producto}_${minimo_requerido}`;
    if (!force_refresh && cacheIA.has(cacheKey)) {
      const cached = cacheIA.get(cacheKey)!;
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`✅ Cache hit para: ${producto}`);
        return NextResponse.json({
          ...cached.resultados,
          from_cache: true
        });
      } else {
        cacheIA.delete(cacheKey);
      }
    }

    console.log(`🔍 Buscando: [${numero_item}] ${producto} (mínimo: ${minimo_requerido} resultados)`);

    // ==========================================
    // 1. LLAMADA AL BACKEND PYTHON MEJORADO
    // ==========================================
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:5000';
    const url = `${pythonBackendUrl}/python/busqueda-robusta?producto=${encodeURIComponent(producto)}&numero=${encodeURIComponent(numero_item)}&minimo=${minimo_requerido}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 segundos timeout
    
    let pythonResponse: Response;
    try {
      pythonResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error(`❌ Error conectando a backend Python: ${fetchError}`);
      throw new Error(`No se pudo conectar al servicio de búsqueda. Verifica que el servidor Python esté corriendo en ${pythonBackendUrl}`);
    }

    if (!pythonResponse.ok) {
      throw new Error(`Backend Python respondió con error: ${pythonResponse.status}`);
    }

    const datosPython: RespuestaRobusta = await pythonResponse.json();
    
    let resultados = datosPython.resultados || [];
    const totalEncontrados = resultados.length;
    const suficientes = totalEncontrados >= minimo_requerido;
    const deficit = Math.max(0, minimo_requerido - totalEncontrados);

    console.log(`📊 Resultados para [${numero_item}] ${producto}: ${totalEncontrados}/${minimo_requerido} - ${suficientes ? '✅ Suficiente' : `❌ Faltan ${deficit}`}`);

    // ==========================================
    // 2. REFINAMIENTO CON IA (si hay suficientes resultados para filtrar)
    // ==========================================
    let resultadosFinales = resultados;
    
    if (resultados.length > 3 && process.env.DEEPSEEK_API_KEY) {
      try {
        console.log(`🤖 Refinando con IA: ${resultados.length} resultados para [${numero_item}] ${producto}`);
        
        // Preparar datos para IA (máximo 25 para no saturar)
        const datosParaIA = resultados.slice(0, 25).map((r, idx) => ({
          id: idx,
          tienda: r.tienda?.substring(0, 20) || '',
          nombre: r.nombre?.substring(0, 80) || '',
          precio: r.precio_valor || 0,
        }));

        const iaTimeout = 5000;
        const iaController = new AbortController();
        const iaTimeoutId = setTimeout(() => iaController.abort(), iaTimeout);

        // Prompt mejorado según tipo de producto
        let sistemaPrompt = `Eres un filtro experto para productos de ferretería, construcción y maquinaria. Producto buscado: "${producto}" (Item #${numero_item})`;
        
        if (datosPython.tipo_producto?.maquinaria_pesada) {
          sistemaPrompt += `\n⚠️ Es MAQUINARIA PESADA/AGRÍCOLA: Prioriza la máquina completa, NO repuestos o accesorios.`;
        } else if (datosPython.tipo_producto?.herramienta_electrica) {
          sistemaPrompt += `\n⚠️ Es HERRAMIENTA ELÉCTRICA: Prioriza la herramienta principal, NO accesorios como discos, carbones o estuches.`;
        } else if (datosPython.tipo_producto?.material_construccion) {
          sistemaPrompt += `\n⚠️ Es MATERIAL DE CONSTRUCCIÓN: Verifica medidas/dimensiones en el nombre del producto.`;
        } else if (datosPython.tipo_producto?.articulo_pequeno) {
          sistemaPrompt += `\n⚠️ Es ARTÍCULO DE FERRETERÍA: Prioriza coincidencia exacta en nombre y medida.`;
        }
        
        sistemaPrompt += `\n\nReglas:
1. Coincidencia EXACTA con "${producto}" tiene máxima prioridad
2. Rechaza accesorios no relacionados (repuestos, estuches, carbones, discos sueltos)
3. Para materiales: verifica que la MEDIDA/DIMENSIÓN coincida
4. Ordena por PRECIO ascendente (más barato primero)
5. Si hay menos de ${minimo_requerido} resultados relevantes, incluye los mejores disponibles

Responde SOLO JSON: {"ranking_ids": [ids ordenados por relevancia]}`;

        const iaResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            "Content-Type": "application/json"
          },
          signal: iaController.signal,
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: sistemaPrompt },
              { role: "user", content: JSON.stringify(datosParaIA) }
            ],
            temperature: 0.1,
            max_tokens: 500,
            response_format: { type: 'json_object' }
          })
        });
        
        clearTimeout(iaTimeoutId);

        if (iaResponse.ok) {
          const iaData = await iaResponse.json();
          const contenido = iaData.choices[0].message.content;
          const parsed = JSON.parse(contenido);
          const ranking_ids = parsed.ranking_ids || [];
          
          if (ranking_ids.length > 0) {
            // Reordenar según ranking de IA
            resultadosFinales = ranking_ids
              .filter((id: number) => id >= 0 && id < resultados.length)
              .map((id: number) => resultados[id]);
            
            console.log(`✅ IA aplicada: ${resultadosFinales.length} resultados ordenados`);
          }
        } else {
          console.warn(`⚠️ IA respondió con error: ${iaResponse.status}`);
        }
      } catch (iaError: any) {
        console.warn(`⚠️ Error en IA para [${numero_item}] ${producto}: ${iaError.message || 'timeout'}`);
        // Continuamos con resultados originales ordenados localmente
      }
    }

    // ==========================================
    // 3. ORDENAMIENTO LOCAL DE RESPALDO
    // ==========================================
    if (resultadosFinales.length === 0 || resultadosFinales.length !== resultados.length) {
      // Ordenar por precio (priorizar los que tienen precio)
      resultadosFinales = [...resultados].sort((a, b) => {
        // Primero los que tienen precio real (no 0)
        if (a.precio_valor === 0 && b.precio_valor > 0) return 1;
        if (a.precio_valor > 0 && b.precio_valor === 0) return -1;
        // Luego por precio ascendente
        return (a.precio_valor || Infinity) - (b.precio_valor || Infinity);
      });
    }

    // Limitar a máximo 20 resultados (pero mostrar al menos lo encontrado)
    const maxResultados = Math.max(minimo_requerido, 20);
    resultadosFinales = resultadosFinales.slice(0, maxResultados);

    // ==========================================
    // 4. CONSTRUIR RESPUESTA FINAL
    // ==========================================
    const respuesta = {
      success: true,
      numero_item,
      producto,
      resultados: resultadosFinales,
      total_encontrados: resultadosFinales.length,
      suficientes,
      deficit,
      minimo_requerido,
      tiempo_ms: Date.now() - startTime,
      tipo_producto: datosPython.tipo_producto,
      from_cache: false
    };

    // Guardar en caché solo si es exitoso
    if (suficientes || resultadosFinales.length > 0) {
      cacheIA.set(cacheKey, { resultados: respuesta, timestamp: Date.now() });
    }

    return NextResponse.json(respuesta);

  } catch (error: any) {
    console.error("❌ Error crítico en API:", error);
    
    return NextResponse.json({
      success: false,
      error: error.message || "Error interno del servidor",
      resultados: [],
      suficientes: false,
      total_encontrados: 0,
      deficit: 9,
      tiempo_ms: Date.now() - startTime
    }, { status: 500 });
  }
}

// Endpoint para limpiar caché (útil para debugging)
export async function DELETE(req: Request) {
  try {
    const { productKey } = await req.json();
    if (productKey) {
      cacheIA.delete(productKey);
      return NextResponse.json({ message: `Cache eliminado para: ${productKey}` });
    } else {
      cacheIA.clear();
      return NextResponse.json({ message: "Cache completamente limpiado" });
    }
  } catch (error) {
    return NextResponse.json({ error: "Error limpiando cache" }, { status: 500 });
  }
}