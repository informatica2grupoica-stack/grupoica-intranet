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
    
    // Si el JSON es { ok: true, data: [...] }, enviamos solo el array de data
    const dataFinal = result.data || result;

    return NextResponse.json(dataFinal);
    
  } catch (error) {
    return NextResponse.json({ error: 'Fallo de conexión' }, { status: 500 });
  }
}