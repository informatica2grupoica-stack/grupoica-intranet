// app/api/enriquecer-consulta/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function POST(req: Request) {
  let productoOriginal = ""; // Guardar para usar en caso de error
  
  try {
    const body = await req.json();
    const { producto, contexto } = body;
    
    // Guardar para el catch
    productoOriginal = producto || "";

    if (!producto || producto.trim() === "") {
      return NextResponse.json({ error: "Producto requerido" }, { status: 400 });
    }

    // Si no hay API key o no hay contexto, devolver el producto original
    if (!process.env.DEEPSEEK_API_KEY || !contexto || contexto.trim() === "") {
      return NextResponse.json({
        consulta_optimizada: producto,
        contexto_aplicado: null,
        usado_ia: false
      });
    }

    console.log(`🤖 Enriqueciendo consulta: "${producto}" con contexto: "${contexto}"`);

    const prompt = `Eres un experto en búsquedas para ferretería, construcción y materiales en Chile.

PRODUCTO: "${producto}"
CONTEXTO DEL USUARIO: "${contexto}"

Tu tarea: Generar una consulta de búsqueda optimizada que combine el producto con el contexto.
Reglas:
1. Mantén el nombre del producto como base
2. Añade palabras clave del contexto que ayuden a Google a entender mejor lo que se busca
3. Para Chile, añade "Chile" o "CL" al final
4. No cambies medidas o números importantes del producto
5. Responde SOLO con la consulta optimizada, sin texto adicional

Ejemplos:
- Producto: "Clavos 2 1/2", Contexto: "solo fierro y madera" → "Clavos 2 1/2 fierro madera construcción Chile"
- Producto: "Madera Pino", Contexto: "materiales de construcción" → "Madera Pino material construcción Chile precio"
`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

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
          { role: "user", content: `Producto: "${producto}"\nContexto: "${contexto}"` }
        ],
        temperature: 0.3,
        max_tokens: 150,
      })
    });

    clearTimeout(timeoutId);

    if (iaResponse.ok) {
      const iaData = await iaResponse.json();
      let consultaOptimizada = iaData.choices[0]?.message?.content?.trim() || producto;
      
      // Limpiar posibles comillas
      consultaOptimizada = consultaOptimizada.replace(/^["']|["']$/g, '');
      
      console.log(`✅ Consulta optimizada: "${consultaOptimizada}"`);
      
      return NextResponse.json({
        consulta_optimizada: consultaOptimizada,
        contexto_aplicado: contexto,
        usado_ia: true
      });
    }

    return NextResponse.json({
      consulta_optimizada: producto,
      contexto_aplicado: contexto,
      usado_ia: false
    });

  } catch (error: any) {
    console.error("Error en enriquecer-consulta:", error);
    return NextResponse.json({
      consulta_optimizada: productoOriginal || "error",
      contexto_aplicado: null,
      usado_ia: false,
      error: error.message
    });
  }
}