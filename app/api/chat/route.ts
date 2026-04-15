import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // 1. Extraemos los datos del cuerpo de la petición
    const body = await req.json();
    const { mensaje, datosObuma } = body;

    // 2. Verificamos que la API KEY exista en el entorno (Vercel Settings)
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error("Error: DEEPSEEK_API_KEY no configurada en Vercel");
      return NextResponse.json(
        { respuesta: "Error de configuración: Falta la API Key en el servidor." },
        { status: 500 }
      );
    }

    // 3. Llamada a DeepSeek
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
            content: "Eres un asistente técnico experto para la intranet de Alexis. Tienes conocimientos en Obuma ERP, gestión de facturas DTE, stock y logística en Chile. Responde de forma concisa y profesional." 
          },
          { 
            role: "user", 
            content: `Consulta: ${mensaje}. Contexto Obuma: ${JSON.stringify(datosObuma || "Sin datos adicionales")}` 
          }
        ],
        temperature: 0.7,
        stream: false
      })
    });

    // 4. Validamos la respuesta de la IA
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error de DeepSeek:", errorData);
      return NextResponse.json(
        { respuesta: "DeepSeek devolvió un error. Revisa el saldo de la cuenta." },
        { status: response.status }
      );
    }

    const data = await response.json();

    // 5. Retornamos el formato exacto que el componente ChatBot.tsx necesita
    return NextResponse.json({ 
      respuesta: data.choices[0].message.content 
    });

  } catch (error) {
    console.error("Error crítico en la ruta de chat:", error);
    return NextResponse.json(
      { respuesta: "Hubo un problema interno al procesar tu mensaje." },
      { status: 500 }
    );
  }
}