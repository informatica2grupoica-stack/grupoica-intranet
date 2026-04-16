// app/api/deepseek/chat/route.ts
import { NextResponse } from 'next/server';
import { preguntarDeepSeek } from '@/app/lib/deepseek/client';

export async function POST(req: Request) {
  try {
    const { pregunta, historial } = await req.json();
    
    if (!pregunta || pregunta.trim() === "") {
      return NextResponse.json({ error: "La pregunta no puede estar vacía" }, { status: 400 });
    }

    const respuesta = await preguntarDeepSeek(pregunta);
    
    return NextResponse.json({ 
      respuesta,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("Error en chat:", error);
    return NextResponse.json(
      { error: "Error procesando la pregunta" },
      { status: 500 }
    );
  }
}