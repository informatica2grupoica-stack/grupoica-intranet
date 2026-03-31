import { NextResponse } from 'next/server';

export async function GET() {
  const API_URL = process.env.OBUMA_API_URL;
  const API_TOKEN = process.env.OBUMA_API_TOKEN;

  try {
    const response = await fetch(`${API_URL}/comprasOc.list.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': API_TOKEN || '',
      },
      next: { revalidate: 0 } 
    });

    const result = await response.json();

    // Validamos la estructura del JSON { ok: true, data: [...] }
    // Si 'data' existe, enviamos eso, si no, intentamos con el objeto raíz
    const dataFinal = result.data || result;

    return NextResponse.json(dataFinal);
    
  } catch (error) {
    return NextResponse.json({ error: 'Error de conexión' }, { status: 500 });
  }
}