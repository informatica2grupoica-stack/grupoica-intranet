import { NextResponse } from 'next/server';

export async function GET() {
  // Usamos el token de tu variable, pero escribimos la URL a mano para mayor seguridad
  const API_TOKEN = process.env.OBUMA_API_TOKEN;
  const FULL_URL = "https://api.obuma.cl/v1.0/comprasOc.list.json";

  try {
    const response = await fetch(FULL_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': API_TOKEN || '',
      },
      // Esto obliga a Vercel a buscar datos frescos y no usar caché viejo
      cache: 'no-store' 
    });

    const result = await response.json();
    
    // Verificamos si la respuesta tiene la estructura { ok: true, data: [...] }
    if (result && result.data) {
      return NextResponse.json(result.data);
    }
    
    // Si por alguna razón devuelve el array directo
    if (Array.isArray(result)) {
      return NextResponse.json(result);
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error("Error capturado:", error);
    return NextResponse.json({ error: 'Error de conexión con Obuma' }, { status: 500 });
  }
}