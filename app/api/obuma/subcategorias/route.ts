import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Capturamos el ID de la categoría desde la URL (?categoria_id=...)
  const { searchParams } = new URL(request.url);
  const categoriaId = searchParams.get('categoria_id');

  // Si no hay ID, devolvemos vacío para evitar errores
  if (!categoriaId) return NextResponse.json({ data: [] });

  try {
    // Obuma permite filtrar agregando el ID a la URL del endpoint
    const url = `${process.env.OBUMA_API_URL}/productosSubCategorias.list.json?id_categoria=${categoriaId}`;

    const response = await fetch(url, {
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      },
    });
    
    const result = await response.json();
    
    // Igual que en categorías, devolvemos { data: ... }
    return NextResponse.json({ data: result.data || [] }); 
  } catch (error) {
    return NextResponse.json({ error: 'Error al conectar con Obuma' }, { status: 500 });
  }
}