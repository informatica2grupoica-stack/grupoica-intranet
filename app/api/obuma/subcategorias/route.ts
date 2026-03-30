import { NextResponse } from 'next/server';

export async function GET() {
  const url = `${process.env.OBUMA_API_URL}/productos.subcategorias.list.json`;

  try {
    const response = await fetch(url, {
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      },
    });
    const data = await response.json();
    
    // Obuma suele devolver un objeto donde las subcategorías están en data.data
    return NextResponse.json(data.data || []);
  } catch (error) {
    return NextResponse.json({ error: 'Error al conectar con Obuma' }, { status: 500 });
  }
}