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

    const result = await response.json();
    // IMPORTANTE: Envolvemos en { data: ... } para que el front lo lea bien
    return NextResponse.json({ data: result.data || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Error al conectar con Obuma' }, { status: 500 });
  }
}