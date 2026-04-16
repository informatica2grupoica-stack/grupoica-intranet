import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 10; 

// 1. Cliente de Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Cache simple en memoria
const cacheIA = new Map<string, { resultados: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; 

export async function POST(req: Request) {
  let resultadosOriginales: any[] = [];
  let resultadoFinal: any = null;

  try {
    const body = await req.json();
    resultadosOriginales = body.resultados || [];
    const producto = body.producto || "productos";
    const query = body.query || "";

    if (!resultadosOriginales || resultadosOriginales.length === 0) {
      return NextResponse.json({ filtrados: [], ranking: [] });
    }

    // --- LÓGICA DE CACHÉ ---
    const cacheKey = `${producto}-${query}-${resultadosOriginales.length}`;
    const cached = cacheIA.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      resultadoFinal = cached.resultados;
    } else {
      
      // --- LÓGICA DE IA (Tu versión funcional) ---
      if (resultadosOriginales.length <= 5) {
        resultadoFinal = { 
          filtrados: resultadosOriginales,
          ranking: resultadosOriginales.map((_, i) => i)
        };
      } else if (process.env.DEEPSEEK_API_KEY) {
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
                  content: `Eres un filtro de productos. Producto buscado: "${producto}". Reglas: 1. Prioriza coincidencia exacta 2. Rechaza accesorios 3. Orden precio ascendente. Responde SOLO JSON: {"ranking": [ids ordenados]}`
                },
                { role: "user", content: JSON.stringify(datosReducidos) }
              ],
              temperature: 0.1,
              max_tokens: 300,
              response_format: { type: 'json_object' }
            })
          });
          clearTimeout(timeoutId);

          if (aiResponse.ok) {
            const data = await aiResponse.json();
            const contenido = data.choices[0].message.content;
            const parsed = JSON.parse(contenido);
            const ranking = parsed.ranking || [];
            
            if (ranking.length > 0) {
              const productosOrdenados = ranking
                .filter((id: number) => id >= 0 && id < resultadosOriginales.length)
                .map((id: number) => resultadosOriginales[id]);
              
              resultadoFinal = { 
                filtrados: productosOrdenados.slice(0, 15),
                ranking: ranking 
              };
              cacheIA.set(cacheKey, { resultados: resultadoFinal, timestamp: Date.now() });
            }
          }
        } catch (iaError) {
          console.warn("IA timeout, usando fallback");
        }
      }
    }

    // --- FALLBACK (Si no hay IA) ---
    if (!resultadoFinal) {
      const productosOrdenados = [...resultadosOriginales]
        .sort((a, b) => {
          const aMatch = a.nombre?.toLowerCase().includes(producto.toLowerCase()) ? 1 : 0;
          const bMatch = b.nombre?.toLowerCase().includes(producto.toLowerCase()) ? 1 : 0;
          if (aMatch !== bMatch) return bMatch - aMatch;
          return (a.precio_valor || Infinity) - (b.precio_valor || Infinity);
        })
        .slice(0, 15);
      
      resultadoFinal = {
        filtrados: productosOrdenados,
        ranking: productosOrdenados.map(p => resultadosOriginales.indexOf(p))
      };
    }

    // --- GUARDADO EN SUPABASE (Mapeado a tus columnas) ---
    try {
      const datosBaseDatos = resultadoFinal.filtrados.map((p: any) => ({
        nombre: p.nombre,
        tienda: p.tienda,
        precio: p.precio_valor || 0,
        link: p.link,
        busqueda: producto,
        imagen: p.imagen || '', // Columna 'imagen' (text)
        sku: p.sku || '',       // Columna 'sku' (text)
        updated_at: new Date().toISOString()
      }));

      // Upsert basado en la columna 'link' para detectar cambios de precio
      await supabase
        .from('precios_historicos')
        .upsert(datosBaseDatos, { onConflict: 'link' });

    } catch (dbError) {
      console.error("Error BD:", dbError);
    }

    return NextResponse.json(resultadoFinal);

  } catch (error: any) {
    console.error("Error fatal:", error?.message);
    const fallback = resultadosOriginales.slice(0, 15);
    return NextResponse.json({ filtrados: fallback, ranking: [] });
  }
}