import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { mensaje, datosParaFiltrar, modo } = await req.json();

    // Filtro técnico para el buscador (aseguramos compatibilidad con "buscador_web")
    if (modo === "buscador" || modo === "buscador_web") {
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
              content: `Eres un Inspector Técnico de Suministros Industriales. 
              Tu misión es filtrar una lista de productos y eliminar todo lo que no coincida al 100% con la búsqueda del usuario.

              REGLAS DE ORO:
              1. EXACTITUD DE MEDIDAS: Si el usuario busca "22oz", ELIMINA cualquier producto que diga "20oz", "16oz" o "24oz". No aceptes "cercanos".
              2. UNIDADES DE MEDIDA: Sé estricto con pulgadas ("), mm, oz y lbs. Un martillo de 20oz NO es lo mismo que uno de 22oz.
              3. RELEVANCIA: Si buscan "Martillo", elimina accesorios como "funda para martillo" o "repuesto de mango".
              4. PRECIO COHERENTE: Si un producto tiene un precio absurdamente bajo (ej: $100) que no corresponde a la herramienta, descártalo.
              5. FORMATO: Responde ÚNICAMENTE con el array JSON de los objetos filtrados. 
              Si ningún producto cumple, responde con un array vacío: [].
              Prohibido escribir texto fuera del JSON.`
            },
            { 
              role: "user", 
              content: `Búsqueda del cliente: ${mensaje}. 
              Lista a filtrar: ${JSON.stringify(datosParaFiltrar)}` 
            }
          ],
          // Forzamos a DeepSeek a que su salida sea JSON válido
          response_format: { type: 'json_object' }
        })
      });

      const data = await response.json();
      const content = data.choices[0].message.content;

      // DeepSeek a veces devuelve el JSON dentro de un objeto con una llave (ej: {"productos": [...]})
      // Esta lógica extrae el array sea como sea que venga
      const parsedData = JSON.parse(content);
      const finalArray = Array.isArray(parsedData) ? parsedData : (parsedData.productos || Object.values(parsedData)[0]);

      return NextResponse.json(Array.isArray(finalArray) ? finalArray : []);
    }

    // Lógica de chat normal (opcional)
    return NextResponse.json({ message: "Modo no reconocido" });

  } catch (error) {
    console.error("Error en API Route:", error);
    return NextResponse.json({ error: "Error en el filtrado inteligente" }, { status: 500 });
  }
}