import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 10; 

// Cache simple en memoria
const cacheIA = new Map<string, { resultados: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export async function POST(req: Request) {
  let resultadosOriginales: any[] = [];

  try {
    const body = await req.json();
    resultadosOriginales = body.resultados || [];
    const producto = body.producto || "productos";
    const query = body.query || "";

    if (!resultadosOriginales || resultadosOriginales.length === 0) {
      return NextResponse.json({ filtrados: [], ranking: [] });
    }

    // Si hay pocos productos, no vale la pena usar IA
    if (resultadosOriginales.length <= 5) {
      return NextResponse.json({ 
        filtrados: resultadosOriginales,
        ranking: resultadosOriginales.map((_, i) => i)
      });
    }

    // Verificar caché
    const cacheKey = `${producto}-${query}-${resultadosOriginales.length}`;
    const cached = cacheIA.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.resultados);
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      console.error("Falta DEEPSEEK_API_KEY");
      return NextResponse.json({ 
        filtrados: resultadosOriginales.slice(0, 15),
        ranking: Array.from({ length: Math.min(15, resultadosOriginales.length) }, (_, i) => i)
      });
    }

    // COMPRESIÓN: Solo información necesaria
    const datosReducidos = resultadosOriginales.slice(0, 20).map((r: any, idx: number) => ({
      id: idx,
      tienda: r.tienda?.substring(0, 20) || '',
      nombre: r.nombre?.substring(0, 60) || '',
      precio: r.precio_valor || 0,
    }));

    const IA_TIMEOUT = 4000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IA_TIMEOUT);

    try {
      const aiResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: `Eres un filtro de productos. Producto buscado: "${producto}". 
              
Reglas:
1. Prioriza productos que coincidan EXACTAMENTE con el nombre
2. Rechaza accesorios no relacionados
3. Ordena por precio ascendente

Responde SOLO JSON: {"ranking": [ids ordenados]}`
            },
            { 
              role: "user", 
              content: JSON.stringify(datosReducidos) 
            }
          ],
          temperature: 0.1,
          max_tokens: 300,
          response_format: { type: 'json_object' }
        })
      });
      
      clearTimeout(timeoutId);

      if (!aiResponse.ok) {
        throw new Error(`IA error: ${aiResponse.status}`);
      }

      const data = await aiResponse.json();
      const contenido = data.choices[0].message.content;
      
      // Parsear respuesta
      let ranking: number[] = [];
      try {
        const parsed = JSON.parse(contenido);
        ranking = parsed.ranking || [];
        
        if (ranking.length > 0) {
          const productosOrdenados = ranking
            .filter((id: number) => id >= 0 && id < resultadosOriginales.length)
            .map((id: number) => resultadosOriginales[id]);
          
          const resultado = { 
            filtrados: productosOrdenados.slice(0, 15),
            ranking: ranking 
          };
          
          cacheIA.set(cacheKey, { resultados: resultado, timestamp: Date.now() });
          return NextResponse.json(resultado);
        }
      } catch (e) {
        console.warn("Error parseando IA:", e);
      }
    } catch (iaError) {
      console.warn("IA timeout o error:", iaError);
    }

    // FALLBACK: Ordenamiento local
    const productosOrdenados = [...resultadosOriginales]
      .sort((a, b) => {
        const aMatch = a.nombre?.toLowerCase().includes(producto.toLowerCase()) ? 1 : 0;
        const bMatch = b.nombre?.toLowerCase().includes(producto.toLowerCase()) ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
        return (a.precio_valor || Infinity) - (b.precio_valor || Infinity);
      })
      .slice(0, 15);
    
    return NextResponse.json({
      filtrados: productosOrdenados,
      ranking: productosOrdenados.map(p => resultadosOriginales.indexOf(p))
    });

  } catch (error: any) {
    console.error("Error:", error?.message || "Error desconocido");
    // Fallback seguro
    const fallbackProductos = resultadosOriginales.slice(0, 15);
    return NextResponse.json({ 
      filtrados: fallbackProductos,
      ranking: fallbackProductos.map((_, i) => i)
    });
  }
}