// app/api/obuma/subcategorias/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(`${process.env.OBUMA_API_URL}/productosSubCategorias.list.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
    });

    const data = await response.json();
    
    // Retornamos el array de subcategorías
    return NextResponse.json(data.data || []);
  } catch (error) {
    console.error("Error cargando subcategorías:", error);
    return NextResponse.json({ error: 'Error al conectar con Obuma' }, { status: 500 });
  }
}