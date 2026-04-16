// app/api/deepseek/chat/route.ts
import { NextResponse } from 'next/server';
import { callDeepSeek } from '@/app/lib/deepseek/client';

export async function POST(req: Request) {
  try {
    // ✅ Recibir contexto también
    const { pregunta, historial, contexto } = await req.json();
    
    if (!pregunta || pregunta.trim() === "") {
      return NextResponse.json({ error: "La pregunta no puede estar vacía" }, { status: 400 });
    }

    // ✅ Construir system prompt con productos reales
    let systemPrompt = `Eres un asistente experto en productos de una empresa.
Ayudas a encontrar información sobre productos, SKUs, precios y stock.
RESPONDE SIEMPRE EN ESPAÑOL.
SOLO usa los productos que te voy a proporcionar. NO inventes productos.
Si no encuentras información, di "No tengo información sobre eso en mi base de datos".`;

    // ✅ Agregar productos reales si existen
    if (contexto?.productos && Array.isArray(contexto.productos) && contexto.productos.length > 0) {
      systemPrompt += `\n\nPRODUCTOS REALES (${contexto.productos.length} productos):
${JSON.stringify(contexto.productos, null, 2)}

Usa SOLO estos productos para responder. NO inventes productos.`;

      // Agregar estadísticas
      const totalStock = contexto.productos.reduce((sum: number, p: any) => sum + (p.stock || 0), 0);
      systemPrompt += `\n\nEstadísticas: ${contexto.productos.length} productos, ${totalStock} unidades en stock.`;
    } else {
      systemPrompt += `\n\nNo hay productos cargados aún. Informa al usuario que debe actualizar la página.`;
    }

    // ✅ Llamar a DeepSeek con el prompt completo
    const result = await callDeepSeek([
      { role: "system", content: systemPrompt },
      { role: "user", content: pregunta }
    ], 0.3, 800);

    if (result.error) {
      return NextResponse.json({ 
        respuesta: "Lo siento, tuve un problema técnico. Intenta nuevamente.",
        error: result.error 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      respuesta: result.content,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("Error en chat:", error);
    return NextResponse.json(
      { error: "Error procesando la pregunta" },
      { status: 500 }
    );
  }
}