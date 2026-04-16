import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { resultados, producto } = await req.json();

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
            content: `Eres un experto en materiales de construcción en Chile. 
            Filtrarás una lista de precios para el producto: "${producto}".
            1. Selecciona los 15 mejores resultados (más baratos y que coincidan con la marca/modelo).
            2. Prioriza tiendas como Sodimac, Easy, Trentini, Hela, Imperial.
            3. Devuelve SOLO un JSON con este formato: {"filtrados": [{"tienda": "", "nombre": "", "precio_valor": 0, "link": ""}]}`
          },
          { role: "user", content: JSON.stringify(resultados.slice(0, 40)) } // Enviamos los top 40 para ahorrar créditos
        ],
        response_format: { type: 'json_object' }
      })
    });

    const data = await aiResponse.json();
    return NextResponse.json(JSON.parse(data.choices[0].message.content));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}