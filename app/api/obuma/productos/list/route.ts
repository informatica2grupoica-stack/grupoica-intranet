import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const search = searchParams.get('search') || '';

  const url = `${process.env.OBUMA_API_URL}/productos.list.json?page=${page}&search=${search}`;

  try {
    const response = await fetch(url, {
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      },
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Error al conectar con Obuma' }, { status: 500 });
  }
}