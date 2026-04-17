import { NextResponse } from 'next/server';
import { callDeepSeek } from '@/app/lib/deepseek/client';

export async function POST(req: Request) {
  try {
    const { stats } = await req.json();
    
    const prompt = `Analiza los siguientes datos de inventario y genera insights útiles:

DATOS:
- Total productos: ${stats.total_productos}
- Stock total: ${stats.total_stock} unidades
- Valor inventario: $${stats.total_valor_inventario.toLocaleString('es-CL')}
- Productos con stock bajo: ${stats.productos_con_stock_bajo}
- Productos sin stock: ${stats.productos_sin_stock}
- Precio promedio: $${stats.precio_promedio.toLocaleString('es-CL')}

Genera 3 insights y 2 recomendaciones en formato JSON:
{
  "insights": ["insight1", "insight2", "insight3"],
  "recomendaciones": ["recomendacion1", "recomendacion2"]
}

Los insights deben ser análisis relevantes sobre el estado del inventario.
Las recomendaciones deben ser acciones prácticas.`;

    const result = await callDeepSeek([
      { role: "system", content: "Eres un analista de inventario experto. Responde SOLO con JSON válido." },
      { role: "user", content: prompt }
    ], 0.3, 500);

    if (result.error) {
      return NextResponse.json({ 
        insights: [
          `📊 Tienes ${stats.total_productos} productos en inventario`,
          `💰 Valor total: $${stats.total_valor_inventario.toLocaleString('es-CL')}`,
          `⚠️ ${stats.productos_sin_stock} productos sin stock`
        ],
        recomendaciones: [
          "Revisa productos con stock bajo",
          "Sincroniza datos regularmente"
        ]
      });
    }

    try {
      const parsed = JSON.parse(result.content);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ 
        insights: [
          `📊 Total: ${stats.total_productos} productos`,
          `💰 Valor: $${stats.total_valor_inventario.toLocaleString('es-CL')}`,
          `⚠️ Atención: ${stats.productos_sin_stock} sin stock`
        ],
        recomendaciones: [
          "Monitorear stock bajo",
          "Revisar productos sin movimiento"
        ]
      });
    }
    
  } catch (error) {
    console.error("Error en insights:", error);
    return NextResponse.json({ error: "Error generando insights" }, { status: 500 });
  }
}