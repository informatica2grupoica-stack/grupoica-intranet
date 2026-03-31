import { NextResponse } from 'next/server';

export async function GET() {
  // Asegúrate de tener OBUMA_API_KEY en tu archivo .env.local
  const API_KEY = process.env.OBUMA_API_KEY;
  const URL = "https://www.obuma.cl/api/comprasOc.list.json";

  try {
    const response = await fetch(URL, {
      method: 'GET',
      headers: {
        'api_key': API_KEY || '',
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 } // No cachear para ver cambios en tiempo real
    });

    const data = await response.json();
    
    // Retornamos la lista de documentos (vienen en la propiedad 'docs')
    return NextResponse.json(data.docs || []);
    
  } catch (error) {
    return NextResponse.json({ error: 'Error al conectar con Obuma' }, { status: 500 });
  }
}