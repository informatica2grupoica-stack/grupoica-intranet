import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { mensajes, datosObuma } = await req.json();

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat", // El modelo rápido y económico
      messages: [
        { 
          role: "system", 
          content: "Eres un asistente técnico de la intranet. Tienes acceso a datos de Obuma ERP. Ayuda al usuario a analizar facturas, stock y transportes en Chile." 
        },
        { 
          role: "user", 
          content: `Analiza lo siguiente: ${mensajes}. Datos actuales: ${JSON.stringify(datosObuma)}` 
        }
      ],
      stream: false
    })
  });

  const data = await response.json();
  return NextResponse.json(data.choices[0].message.content);
}