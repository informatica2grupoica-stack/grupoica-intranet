import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // 1. Capturamos los parámetros
  const page = searchParams.get('page') || '1';
  // Obuma usa 'filter' para las búsquedas de texto en la lista de productos
  const filter = searchParams.get('filter') || searchParams.get('search') || '';

  // 2. Construimos la URL limpia
  // Importante: Usamos encodeURIComponent por si el usuario busca algo con espacios o '#'
  const obumaUrl = new URL(`${process.env.OBUMA_API_URL}/productos.list.json`);
  obumaUrl.searchParams.append('page', page);
  
  if (filter) {
    obumaUrl.searchParams.append('filter', filter.trim());
  }

  try {
    const response = await fetch(obumaUrl.toString(), {
      method: 'GET',
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      },
      // Añadimos un revalidate corto para que el stock se mantenga fresco
      next: { revalidate: 60 } 
    });

    if (!response.ok) {
      throw new Error(`Error de Obuma: ${response.status}`);
    }

    const data = await response.json();

    // 3. Normalización de respuesta
    // A veces Obuma devuelve los datos en 'data', a veces en 'productos' 
    // dependiendo de la versión del endpoint. Aseguramos la consistencia.
    return NextResponse.json({
      success: true,
      data: data.data || data.productos || [],
      pagination: data.pagination || null
    });

  } catch (error: any) {
    console.error("Error en Listado Obuma:", error.message);
    return NextResponse.json(
      { error: 'Error al conectar con la API de Obuma', details: error.message }, 
      { status: 500 }
    );
  }
}