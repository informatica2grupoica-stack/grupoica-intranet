import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { resultados, producto } = await req.json();

    // OPTIMIZACIÓN: Solo enviamos datos clave para reducir el tiempo de lectura de la IA
    const datosReducidos = resultados.slice(0, 25).map((r: any) => ({
      t: r.tienda,
      n: r.nombre,
      p: r.precio_valor,
      l: r.link
    }));

    const aiResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `Eres un filtro JSON rápido. Producto: "${producto}". 
            1. Retorna los 10 mejores resultados (más baratos y que coincidan con el producto).
            2. Prioriza: Sodimac, Easy, Hela, Trentini, Imperial.
            3. Responde SOLO el JSON: {"filtrados": []}`
          },
          { role: "user", content: JSON.stringify(datosReducidos) }
        ],
        temperature: 0.1, // Menor temperatura = Respuesta más rápida y precisa
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      })
    });

    const data = await aiResponse.json();
    return NextResponse.json(JSON.parse(data.choices[0].message.content));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}