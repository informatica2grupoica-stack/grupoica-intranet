import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // 1. CAPTURA DE PARÁMETROS (Tu lógica original)
  const page = searchParams.get('page') || '1';
  const filter = searchParams.get('filter') || searchParams.get('search') || '';

  // 2. CONSTRUCCIÓN DE URL (Blindada con URLSearchParams)
  const obumaUrl = new URL(`${process.env.OBUMA_API_URL}/productos.list.json`);
  obumaUrl.searchParams.append('page', page);
  
  if (filter) {
    // Usamos f_search además de filter por si tu versión de API de Obuma es la más reciente
    obumaUrl.searchParams.append('filter', filter.trim());
    // obumaUrl.searchParams.append('f_search', filter.trim()); // Descomenta si el filtro no funciona
  }

  try {
    const response = await fetch(obumaUrl.toString(), {
      method: 'GET',
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      },
      // Mantenemos tu revalidate de 10s para frescura de datos
      next: { revalidate: 10 } 
    });

    // MITIGACIÓN: Si la respuesta no es 200 OK
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json({ 
        success: false, 
        error: `Error de Obuma: ${response.status}`,
        details: errorData 
      }, { status: response.status });
    }

    const data = await response.json();

    // 3. NORMALIZACIÓN DE RESPUESTA (Asegura que 'data' sea siempre un Array)
    // Esto evita que el .map() en el frontend falle
    const productosFinales = data.data || data.productos || [];

    return NextResponse.json({
      success: true,
      data: Array.isArray(productosFinales) ? productosFinales : [],
      pagination: data.pagination || {
        current_page: parseInt(page),
        last_page: 1,
        total: Array.isArray(productosFinales) ? productosFinales.length : 0
      }
    });

  } catch (error: any) {
    console.error("🔥 Error en Listado Obuma:", error.message);
    return NextResponse.json(
      { 
        success: false,
        error: 'Error al conectar con la API de Obuma', 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}