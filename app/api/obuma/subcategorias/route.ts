// ARCHIVO: subcategorias/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // CORRECCIÓN: URL exacta según manual de Obuma
  const url = `${process.env.OBUMA_API_URL}/productosSubCategorias.list.json`;

  try {
    const response = await fetch(url, {
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      },
    });
    
    const data = await response.json();
    
    // Obuma entrega la lista dentro de data.data
    return NextResponse.json(data.data || []); 
  } catch (error) {
    return NextResponse.json({ error: 'Error al conectar con Obuma' }, { status: 500 });
  }
}