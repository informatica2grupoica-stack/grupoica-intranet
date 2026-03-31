import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(`${process.env.OBUMA_API_URL}/productosCategorias.list.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
    });

    const data = await response.json();
    // Retornamos solo el array de categorías para que el select se llene
    return NextResponse.json(data.data || []);
  } catch (error) {
    return NextResponse.json({ error: 'Error al conectar con Obuma' }, { status: 500 });
  }
}