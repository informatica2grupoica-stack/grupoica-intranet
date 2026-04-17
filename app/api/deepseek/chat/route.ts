// app/api/deepseek/chat/route.ts
import { NextResponse } from 'next/server';
import { callDeepSeek } from '@/app/lib/deepseek/client';

export async function POST(req: Request) {
  try {
    const { pregunta, historial, contexto } = await req.json();
    
    if (!pregunta || pregunta.trim() === "") {
      return NextResponse.json({ error: "La pregunta no puede estar vacía" }, { status: 400 });
    }

    let systemPrompt = `Eres un asistente experto en productos de una empresa.
Ayudas a encontrar información sobre productos, SKUs, precios y stock.
RESPONDE SIEMPRE EN ESPAÑOL.
SOLO usa los productos que te voy a proporcionar. NO inventes productos.
Si no encuentras información, di "No tengo información sobre eso en mi base de datos".

Cuando te pregunten "¿Cuántos productos tenemos?" o similar, responde con el número EXACTO de productos que se te proporcionan.

FORMATO DE RESPUESTA:
- Sé conciso pero informativo
- Usa listas cuando muestres múltiples productos
- Los precios en CLP con formato de miles (ej: $1.234.567)`;

    if (contexto?.productos && Array.isArray(contexto.productos) && contexto.productos.length > 0) {
      systemPrompt += `\n\nPRODUCTOS REALES (${contexto.productos.length} productos en total):
${JSON.stringify(contexto.productos.slice(0, 100), null, 2)}`;

      if (contexto.productos.length > 100) {
        systemPrompt += `\n... y ${contexto.productos.length - 100} productos más.`;
      }

      const totalStock = contexto.productos.reduce((sum: number, p: any) => sum + (p.stock || 0), 0);
      const totalValor = contexto.productos.reduce((sum: number, p: any) => sum + ((p.precio || 0) * (p.stock || 0)), 0);
      
      systemPrompt += `\n\nESTADÍSTICAS GENERALES:
- Total de productos: ${contexto.productos.length}
- Stock total: ${totalStock} unidades
- Valor total del inventario: $${totalValor.toLocaleString('es-CL')} CLP

Usa estas estadísticas para responder preguntas de resumen.`;
    } else {
      systemPrompt += `\n\nNo hay productos cargados aún. Informa al usuario que debe actualizar la página.`;
    }

    const result = await callDeepSeek([
      { role: "system", content: systemPrompt },
      { role: "user", content: pregunta }
    ], 0.3, 1000);

    if (result.error) {
      return NextResponse.json({ 
        respuesta: "Lo siento, tuve un problema técnico. Intenta nuevamente.",
        error: result.error 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      respuesta: result.content,
      timestamp: new Date().toISOString(),
      productos_en_contexto: contexto?.productos?.length || 0
    });
    
  } catch (error: any) {
    console.error("Error en chat:", error);
    return NextResponse.json(
      { respuesta: "Error procesando la pregunta. Intenta nuevamente." },
      { status: 500 }
    );
  }
}