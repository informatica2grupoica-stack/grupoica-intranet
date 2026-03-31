import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Parámetros opcionales según documentación (folio, fecha, etc.)
  const folio = searchParams.get('folio') || '';
  const proveedor = searchParams.get('proveedor') || '';

  // Construcción de URL usando la variable de entorno que ya tienes
  const obumaUrl = new URL(`${process.env.OBUMA_API_URL}/comprasOc.list.json`);
  
  if (folio) obumaUrl.searchParams.append('folio_dcto', folio);
  if (proveedor) obumaUrl.searchParams.append('proveedor', proveedor);

  try {
    const response = await fetch(obumaUrl.toString(), {
      method: 'GET',
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      },
      next: { revalidate: 0 } // Sin caché para ver las OCs nuevas de inmediato
    });

    if (!response.ok) {
      throw new Error(`Error Obuma: ${response.status}`);
    }

    const resData = await response.json();

    // NORMALIZACIÓN: Igual que en productos
    // Obuma entrega la lista en 'data' según tu JSON anterior
    return NextResponse.json({
      success: true,
      data: resData.data || resData.compras || [],
      pagination: resData.pagination || null
    });

  } catch (error: any) {
    console.error("Error en Listado OC:", error.message);
    return NextResponse.json(
      { success: false, error: 'Error al conectar con Obuma', details: error.message }, 
      { status: 500 }
    );
  }
}