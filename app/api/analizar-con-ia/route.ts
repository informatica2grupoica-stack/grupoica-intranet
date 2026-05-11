import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// Aumentamos el tiempo de ejecución para permitir que la IA analice listas largas de ferretería
export const maxDuration = 45; 

/**
 * CACHÉ ESTRATÉGICO
 * Almacena resultados por 15 minutos para evitar gastos innecesarios de API 
 * y acelerar barridos masivos repetitivos.
 */
const cacheIA = new Map<string, { resultados: any, timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; 

export async function POST(req: Request) {
  let resultadosOriginales: any[] = [];
  let productoBuscado = "";

  try {
    const body = await req.json();
    resultadosOriginales = Array.isArray(body.resultados) ? body.resultados : [];
    productoBuscado = (body.producto || "productos").trim();

    // 1. VALIDACIÓN INICIAL Y LIMPIEZA
    if (resultadosOriginales.length === 0) {
      return NextResponse.json({ filtrados: [], ranking: [], status: 'no_data' });
    }

    // 2. CONSULTA DE CACHÉ
    const cacheKey = `v4_${productoBuscado.toLowerCase()}_${resultadosOriginales.length}`;
    const cached = cacheIA.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ ...cached.resultados, from_cache: true });
    }

    // 3. VERIFICACIÓN DE API KEY (SI NO HAY, VA AL FALLBACK ROBUSTO DIRECTO)
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error("ALERTA: Falta DEEPSEEK_API_KEY. Usando algoritmo local.");
      return NextResponse.json({ 
        filtrados: smartLocalSort(resultadosOriginales, productoBuscado),
        status: 'fallback_no_key' 
      });
    }

    /**
     * 4. COMPRESIÓN DE DATOS PARA LA IA (TOKEN OPTIMIZATION)
     * Enviamos solo los campos críticos. Si la lista es gigante (ej. +50 items),
     * pre-filtramos los 30 mejores localmente para que la IA no se confunda.
     */
    const preSeleccionados = smartLocalSort(resultadosOriginales, productoBuscado).slice(0, 35);
    const datosParaIA = preSeleccionados.map((r, idx) => ({
      id: idx,
      tienda: r.tienda?.substring(0, 15),
      nombre: r.nombre?.substring(0, 85), // Nombre largo para ver medidas (ej: 2 pulgadas)
      precio: r.precio_valor || 0
    }));

    // 5. LLAMADA ULTRA-ROBUSTA A DEEPSEEK
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos máximo

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
              content: `Eres un experto técnico en ferretería industrial y retail. Tu objetivo es filtrar resultados para el producto: "${productoBuscado}".
              
Reglas de Oro:
1. SI ES UNA MÁQUINA (ej. Taladro, Generador): Elimina accesorios, repuestos, carbones o estuches. Queremos la máquina.
2. SI ES UN CONSUMIBLE (ej. Clavos, Tornillos, Brocas): Verifica la MEDIDA/DIMENSIÓN en el nombre. Si el usuario pide "2 pulgadas", descarta las de "1 pulgada".
3. RELEVANCIA: El ranking debe ir de "Coincidencia Exacta" a "Coincidencia Parcial".
4. PRECIO: Entre productos iguales, el más barato DEBE ir primero.
5. EXCLUSIÓN: Elimina cualquier item que no sea lo que el usuario busca (ej. si busca 'Pala', descarta 'Cabo para pala').

Responde estrictamente en JSON: {"ranking_ids": [números de ID ordenados]}`
            },
            { role: "user", content: `Lista de productos: ${JSON.stringify(datosParaIA)}` }
          ],
          temperature: 0.1, // Precisión máxima, cero creatividad.
          response_format: { type: 'json_object' }
        })
      });

      clearTimeout(timeoutId);

      if (aiResponse.ok) {
        const data = await aiResponse.json();
        const { ranking_ids } = JSON.parse(data.choices[0].message.content);
        
        if (Array.isArray(ranking_ids) && ranking_ids.length > 0) {
          const filtrados = ranking_ids
            .map(id => preSeleccionados[id])
            .filter(p => p !== undefined);

          const resultadoFinal = { 
            filtrados: filtrados.slice(0, 20), 
            ranking: ranking_ids,
            status: 'ai_success'
          };
          
          cacheIA.set(cacheKey, { resultados: resultadoFinal, timestamp: Date.now() });
          return NextResponse.json(resultadoFinal);
        }
      }
    } catch (iaError) {
      console.warn("Error o Timeout en IA, ejecutando Smart Local Sort...");
    }

    // 6. FALLBACK LOCAL INTELIGENTE (Si la IA falla o no hay datos útiles)
    return NextResponse.json({
      filtrados: smartLocalSort(resultadosOriginales, productoBuscado).slice(0, 15),
      status: 'fallback_active'
    });

  } catch (error: any) {
    console.error("Error Crítico:", error);
    return NextResponse.json({ 
      filtrados: resultadosOriginales.slice(0, 10), 
      status: 'critical_error' 
    }, { status: 500 });
  }
}

/**
 * ALGORITMO LOCAL DE RESPALDO (SmartLocalSort)
 * Analiza por palabras clave para cuando la IA no está disponible.
 */
function smartLocalSort(data: any[], query: string) {
  const q = query.toLowerCase().trim();
  const palabras = q.split(/\s+/).filter(p => p.length > 2);

  return [...data].sort((a, b) => {
    const nombreA = (a.nombre || "").toLowerCase();
    const nombreB = (b.nombre || "").toLowerCase();

    // Score de coincidencia: cuantas más palabras del usuario estén en el nombre, mejor.
    const scoreA = palabras.reduce((acc, p) => acc + (nombreA.includes(p) ? 1 : 0), 0);
    const scoreB = palabras.reduce((acc, p) => acc + (nombreB.includes(p) ? 1 : 0), 0);

    // Prioridad por coincidencia de palabras
    if (scoreA !== scoreB) return scoreB - scoreA;

    // Si empatan en palabras, el más barato primero
    return (a.precio_valor || Infinity) - (b.precio_valor || Infinity);
  });
}

// --- ¿QUÉ HACE ESTE CÓDIGO? ---
// 1. Actúa como el "Cerebro" que recibe miles de datos sucios de ferreterías.
// 2. Normaliza y comprime la información para no gastar dinero excesivo en la API de DeepSeek.
// 3. Aplica un Prompt de Ingeniería que sabe distinguir entre máquinas (objetos principales) 
//    y accesorios (basura/repuestos), además de validar medidas para consumibles (clavos/tornillos).
// 4. Implementa un sistema de Caché para que las búsquedas repetidas en el dashboard sean instantáneas.
// 5. Incluye un Failsafe (SmartLocalSort) que asegura que el usuario NUNCA vea una pantalla vacía,
//    incluso si DeepSeek se cae o hay un error de red.