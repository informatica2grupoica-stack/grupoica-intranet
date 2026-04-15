import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { mensaje, datosParaFiltrar, modo } = await req.json();

    if (modo === "buscador" || modo === "buscador_web") {
      
      // OPTIMIZACIÓN 1: Pre-filtrado para reducir latencia
      // Enviamos máximo 25 candidatos (priorizando variedad) para que la IA procese en < 2 segundos
      const candidatosReducidos = datosParaFiltrar
        ?.filter((item: any) => item.precio_valor > 0)
        .slice(0, 25);

      if (!candidatosReducidos || candidatosReducidos.length === 0) {
        return NextResponse.json([]);
      }

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
              content: `Eres un Filtro Técnico de Hardware. Tu objetivo es limpiar el ruido de Google Shopping y entregar precisión quirúrgica.

              REGLAS DE FILTRADO:
              1. EXACTITUD TOTAL: Si el usuario busca "22oz", descarta "20oz", "16oz" y "24oz". No aceptes aproximaciones.
              2. PRIORIDAD WEB: Si hay productos con el mismo nombre, prefiere los de tiendas con dominio propio (ej. sodimac.cl, imperial.cl) sobre "Google Shopping".
              3. LIMPIEZA: Elimina kits de accesorios, pernos sueltos o fundas si el usuario busca la herramienta principal.
              4. PRECIOS: Ignora productos con precios que claramente son errores de sistema (ej. $1, $10, $100).

              FORMATO OBLIGATORIO:
              - Responde ÚNICAMENTE con un array JSON de los objetos que pasaron el filtro.
              - Si nada coincide al 100%, devuelve un array vacío [].
              - No incluyas explicaciones ni texto adicional.`
            },
            { 
              role: "user", 
              content: `Búsqueda: ${mensaje}. Candidatos: ${JSON.stringify(candidatosReducidos)}` 
            }
          ],
          // OPTIMIZACIÓN 2: Parámetros de respuesta rápida
          temperature: 0,
          max_tokens: 1500,
          response_format: { type: 'json_object' }
        })
      });

      // Manejo de respuesta de la API externa
      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // OPTIMIZACIÓN 3: Extracción robusta del JSON
      try {
        const parsedData = JSON.parse(content);
        // Manejamos si la IA envuelve el array en una propiedad (común en modo json_object)
        const finalArray = Array.isArray(parsedData) 
          ? parsedData 
          : (parsedData.productos || parsedData.items || Object.values(parsedData)[0]);

        return NextResponse.json(Array.isArray(finalArray) ? finalArray : []);
      } catch (parseError) {
        console.error("Error parseando contenido de IA:", content);
        return NextResponse.json([]);
      }
    }

    return NextResponse.json({ message: "Modo no soportado" }, { status: 400 });

  } catch (error: any) {
    console.error("Error crítico en API Route:", error);
    return NextResponse.json(
      { error: "Error en el filtrado inteligente", details: error.message }, 
      { status: 500 }
    );
  }
}