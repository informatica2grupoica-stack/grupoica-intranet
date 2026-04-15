import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { mensaje, datosParaFiltrar, modo } = await req.json();

    // Si el modo es "buscador", actuamos como filtro técnico
    if (modo === "buscador") {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { 
              role: "system", 
              content: "Eres un experto en ferretería industrial. Tu tarea es filtrar una lista de productos y devolver SOLO los que coincidan EXACTAMENTE con la medida y tipo solicitado. Si el usuario pide 2 pulgadas, descarta 2.5, descarta 20mm y descarta 2mm. Responde únicamente con el array de objetos JSON filtrado, sin texto adicional." 
            },
            { 
              role: "user", 
              content: `Busqueda: ${mensaje}. Lista de productos: ${JSON.stringify(datosParaFiltrar)}` 
            }
          ],
          response_format: { type: 'json_object' }
        })
      });

      const data = await response.json();
      // Devolvemos la lista filtrada
      return NextResponse.json(JSON.parse(data.choices[0].message.content));
    }

    // ... (Mantener aquí el resto de tu lógica normal de chat si la tienes)
  } catch (error) {
    return NextResponse.json({ error: "Error en el filtrado inteligente" }, { status: 500 });
  }
}