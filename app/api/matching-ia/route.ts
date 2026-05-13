// app/api/matching-ia/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const body = await req.json();
    const { producto_buscado, resultados_raw } = body;

    if (!producto_buscado || !resultados_raw || resultados_raw.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Faltan datos para el matching",
        mejor_match: null,
        todos_resultados: []
      });
    }

    // Si no hay API Key, usar algoritmo básico
    if (!process.env.DEEPSEEK_API_KEY) {
      return usarAlgoritmoBasico(producto_buscado, resultados_raw);
    }

    // Preparar datos para la IA (máximo 30 resultados)
    const datosParaIA = resultados_raw.slice(0, 30).map((r: any, idx: number) => ({
      id: idx,
      tienda: r.tienda || 'WEB',
      nombre: (r.nombre || '').substring(0, 100),
      precio: r.precio_valor || 0
    }));

    const prompt = `Eres un experto en matching de productos de ferretería, construcción y materiales de construcción en Chile.

PRODUCTO BUSCADO: "${producto_buscado}"

Tu tarea: Comparar el producto buscado con cada uno de los ${datosParaIA.length} productos encontrados y determinar qué tan bien coincide.

REGLAS DE COINCIDENCIA:

1. EXACTO (90-100%): El producto es IDÉNTICO o prácticamente igual
   - Mismas características técnicas (medidas, material, capacidad)
   - Mismo tipo de producto (ej: "Martillo 16 oz" con "Martillo 16 oz")
   
2. PARCIAL (70-89%): Producto similar pero varía en algún aspecto
   - Misma categoría pero diferente marca
   - Medida similar pero no exacta (ej: 2" vs 2.5")
   - Presentación diferente (unidad vs caja)
   
3. BAJO (0-69%): Producto de la misma categoría general pero diferente
   - Producto relacionado pero no es lo que se busca
   - Accesorio o repuesto en lugar del producto principal

Para CADA producto, calcula:
- porcentaje: número del 0 al 100
- nivel: "exacto", "parcial" o "bajo"
- razon: explicación breve (máximo 50 caracteres)

Responde SOLAMENTE con este JSON, sin texto adicional:

{
  "resultados": [
    {"id": 0, "porcentaje": 95, "nivel": "exacto", "razon": "Coincide exactamente en nombre y medida"},
    {"id": 1, "porcentaje": 75, "nivel": "parcial", "razon": "Misma categoría pero diferente marca"},
    {"id": 2, "porcentaje": 45, "nivel": "bajo", "razon": "Producto relacionado pero diferente"}
  ],
  "mejor_match_id": 0
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const iaResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: JSON.stringify(datosParaIA) }
          ],
          temperature: 0.1,
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        })
      });

      clearTimeout(timeoutId);

      if (iaResponse.ok) {
        const iaData = await iaResponse.json();
        const contenido = iaData.choices[0].message.content;
        const parsed = JSON.parse(contenido);
        
        // Enriquecer resultados con datos originales
        const resultadosConMatch = parsed.resultados.map((match: any) => ({
          ...resultados_raw[match.id],
          matching: {
            porcentaje: match.porcentaje,
            nivel: match.nivel,
            razon: match.razon
          }
        }));

        const mejorMatch = resultadosConMatch.find((_: any, idx: number) => idx === parsed.mejor_match_id) || resultadosConMatch[0];

        console.log(`✅ Matching IA completado en ${Date.now() - startTime}ms`);

        return NextResponse.json({
          success: true,
          mejor_match: mejorMatch,
          todos_resultados: resultadosConMatch.sort((a: any, b: any) => b.matching.porcentaje - a.matching.porcentaje),
          usado_ia: true,
          tiempo_ms: Date.now() - startTime
        });
      }
    } catch (iaError) {
      console.warn("Error en IA, usando algoritmo básico:", iaError);
    }

    return usarAlgoritmoBasico(producto_buscado, resultados_raw);

  } catch (error: any) {
    console.error("Error en matching:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      mejor_match: null,
      todos_resultados: []
    }, { status: 500 });
  }
}

function usarAlgoritmoBasico(productoBuscado: string, resultadosRaw: any[]) {
  const buscarNormalizado = productoBuscado.toLowerCase().trim();
  const palabrasClave = buscarNormalizado.split(/\s+/).filter(p => p.length > 2);
  
  const resultadosConMatch = resultadosRaw.map((r, idx) => {
    const nombreNormalizado = (r.nombre || '').toLowerCase();
    
    // Calcular coincidencia de palabras
    let coincidencias = 0;
    for (const palabra of palabrasClave) {
      if (nombreNormalizado.includes(palabra)) {
        coincidencias++;
      }
    }
    
    let porcentaje = palabrasClave.length > 0 ? (coincidencias / palabrasClave.length) * 100 : 50;
    
    // Bonus por tener precio
    if (r.precio_valor > 0) porcentaje += 10;
    
    // Penalizar si es demasiado corto
    if (nombreNormalizado.length < 10) porcentaje -= 10;
    
    porcentaje = Math.min(100, Math.max(0, porcentaje));
    
    let nivel = "bajo";
    if (porcentaje >= 85) nivel = "exacto";
    else if (porcentaje >= 60) nivel = "parcial";
    
    let razon = "";
    if (nivel === "exacto") razon = "Alta coincidencia en nombre y características";
    else if (nivel === "parcial") razon = "Coincidencia parcial, puede variar en detalles";
    else razon = "Producto diferente pero de la misma categoría";
    
    return {
      ...r,
      matching: {
        porcentaje: Math.round(porcentaje),
        nivel,
        razon
      }
    };
  });
  
  // Ordenar por porcentaje descendente
  resultadosConMatch.sort((a, b) => b.matching.porcentaje - a.matching.porcentaje);
  
  return NextResponse.json({
    success: true,
    mejor_match: resultadosConMatch[0] || null,
    todos_resultados: resultadosConMatch,
    usado_ia: false,
    tiempo_ms: 0
  });
}