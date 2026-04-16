import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// El máximo en Vercel Free es 10s, pero intentamos forzar estabilidad
export const maxDuration = 10; 

export async function POST(req: Request) {
  // Guardamos los resultados originales para devolverlos en caso de emergencia
  let resultadosOriginales: any[] = [];

  try {
    const body = await req.json();
    resultadosOriginales = body.resultados || [];
    const producto = body.producto || "productos";

    // 1. Validación inicial rápida
    if (!resultadosOriginales || resultadosOriginales.length === 0) {
      return NextResponse.json({ filtrados: [] });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      console.error("Falta DEEPSEEK_API_KEY");
      return NextResponse.json({ filtrados: resultadosOriginales.slice(0, 15), error: "Config" });
    }

    // 2. COMPRESIÓN AGRESIVA: Solo 12 resultados para asegurar que responda en < 10 segundos
    const datosReducidos = resultadosOriginales.slice(0, 12).map((r: any) => ({
      t: r.tienda,
      n: r.nombre?.substring(0, 45), // Nombres ultra cortos
      p: r.precio_valor,
      l: r.link
    }));

    // Usamos AbortController para no quedar colgados si la IA se queda pegada
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8500); // Abortar a los 8.5 segundos

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
            content: `Eres un filtro rápido. Producto: "${producto}". Devuelve SOLO JSON: {"filtrados": []} con los mejores resultados.`
          },
          { 
            role: "user", 
            content: JSON.stringify(datosReducidos) 
          }
        ],
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: 'json_object' }
      })
    }).finally(() => clearTimeout(timeoutId));

    // 3. Si la respuesta no es OK (como el 504 de Vercel), enviamos los datos sin procesar
    if (!aiResponse.ok) {
      console.warn("IA no disponible, enviando datos originales");
      return NextResponse.json({ filtrados: resultadosOriginales.slice(0, 15) });
    }

    const data = await aiResponse.json();
    let contenido = data.choices[0].message.content;
    
    // 4. Parseo con red de seguridad
    try {
      const finalJson = JSON.parse(contenido);
      return NextResponse.json(finalJson);
    } catch {
      // Si el JSON falla, buscamos el objeto dentro del texto
      const jsonMatch = contenido.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      }
      return NextResponse.json({ filtrados: resultadosOriginales.slice(0, 15) });
    }

  } catch (error: any) {
    // ESTE BLOQUE ES VITAL: Si hay timeout o cualquier error, la web NO se rompe
    console.error("Error capturado para evitar caída:", error.message);
    return NextResponse.json({ 
      filtrados: resultadosOriginales.slice(0, 15), 
      error: "Timeout o Error capturado" 
    });
  }
}