import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // 1. CAPTURA DE PARÁMETROS
  const page = searchParams.get('page') || '1';
  const filter = searchParams.get('filter') || searchParams.get('search') || '';

  // 2. CONSTRUCCIÓN DE URL
  const obumaUrl = new URL(`${process.env.OBUMA_API_URL}/productos.list.json`);
  obumaUrl.searchParams.append('page', page);
  
  // Agregamos f_search que es el estándar más estable en Obuma para búsquedas globales
  if (filter) {
    obumaUrl.searchParams.append('f_search', filter.trim());
  }

  try {
    const response = await fetch(obumaUrl.toString(), {
      method: 'GET',
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      },
      next: { revalidate: 10 } 
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json({ 
        success: false, 
        error: `Error de Obuma: ${response.status}`,
        details: errorData 
      }, { status: response.status });
    }

    const data = await response.json();

    // 3. NORMALIZACIÓN Y TRATAMIENTO DE IMÁGENES
    // Obuma a veces devuelve los productos en data.data o directamente en data.productos
    let productosRaw = data.data || data.productos || [];
    
    // Aseguramos que sea un array
    if (!Array.isArray(productosRaw)) {
        productosRaw = [];
    }

    // Mapeo para asegurar que los campos críticos existan y limpiar URLs
    const productosFinales = productosRaw.map((p: any) => ({
      ...p,
      // Nos aseguramos de que la URL de la imagen sea absoluta
      // Si Obuma envía una ruta relativa (raro, pero pasa), aquí se podría corregir
      producto_imagen_url: p.producto_imagen_url || p.url_imagen || null,
      // Forzamos numéricos para evitar errores de renderizado en el front
      stock_actual: parseFloat(p.stock_actual || 0),
      producto_precio_clp_total: parseFloat(p.producto_precio_clp_total || 0)
    }));

    return NextResponse.json({
      success: true,
      data: productosFinales,
      pagination: data.pagination || {
        current_page: parseInt(page),
        last_page: data.last_page || 1,
        total: data.total || productosFinales.length
      }
    });

  } catch (error: any) {
    console.error("🔥 Error en Listado Obuma Backend:", error.message);
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