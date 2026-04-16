import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// IMPORTANTE: Definimos un tiempo de espera extendido para evitar el corte de Vercel
export const maxDuration = 30; 

export async function POST(req: Request) {
  try {
    const { resultados, producto } = await req.json();

    // 1. Validación de entrada: Si no hay resultados del buscador, ni molestamos a la IA
    if (!resultados || resultados.length === 0) {
      return NextResponse.json({ filtrados: [] });
    }

    // 2. Verificación de API KEY
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error("Falta DEEPSEEK_API_KEY en variables de entorno");
      return NextResponse.json({ error: "Error de configuración en el servidor" }, { status: 500 });
    }

    // 3. COMPRESIÓN EXTREMA: Acortamos nombres y limitamos a 20 resultados. 
    // Esto hace que la IA lea menos y responda mucho más rápido.
    const datosReducidos = resultados.slice(0, 20).map((r: any) => ({
      t: r.tienda,
      n: r.nombre?.substring(0, 60), // Cortamos el nombre si es muy largo
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
            content: `Eres un experto en herramientas y construcción en Chile. Tu tarea es filtrar JSON.
            Producto buscado: "${producto}".
            Reglas:
            1. Selecciona máximo 12 resultados que realmente coincidan con el producto.
            2. Prioriza tiendas oficiales (Sodimac, Easy, Hela, Trentini, Imperial, Construmart).
            3. Responde estrictamente con este formato JSON: {"filtrados": [{"tienda": "", "nombre": "", "precio_valor": 0, "link": ""}]}`
          },
          { 
            role: "user", 
            content: `Filtra estos datos: ${JSON.stringify(datosReducidos)}` 
          }
        ],
        temperature: 0.1, 
        response_format: { type: 'json_object' }
      })
    });

    // 4. Manejo de errores de la API de DeepSeek
    if (!aiResponse.ok) {
      const errorData = await aiResponse.text();
      console.error("DeepSeek API Error:", errorData);
      return NextResponse.json({ error: "La IA no respondió a tiempo" }, { status: 503 });
    }

    const data = await aiResponse.json();
    
    // 5. PARSEO SEGURO: A veces la IA devuelve el JSON dentro de bloques de código
    let contenido = data.choices[0].message.content;
    
    try {
      // Intentamos parsear directamente
      const finalJson = JSON.parse(contenido);
      return NextResponse.json(finalJson);
    } catch (parseError) {
      // Si falla, intentamos limpiar la respuesta por si la IA agregó texto extra
      console.error("Error parseando JSON de la IA, intentando limpiar...", contenido);
      const jsonMatch = contenido.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json(JSON.parse(jsonMatch[0]));
      }
      throw new Error("La IA no devolvió un formato válido.");
    }

  } catch (error: any) {
    console.error("Error crítico en analizar-con-ia:", error.message);
    return NextResponse.json({ 
      error: "Error interno en el análisis", 
      details: error.message 
    }, { status: 500 });
  }
}