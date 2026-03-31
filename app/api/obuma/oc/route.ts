import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Usamos la URL que me pasaste: https://www.obuma.cl/api/v1.0
    const baseUrl = process.env.OBUMA_API_URL || 'https://www.obuma.cl/api/v1.0';
    
    // IMPORTANTE: Verifica si en el de productos usas productos.list.json 
    // Aquí concatenamos la ruta de compras
    const response = await fetch(`${baseUrl}/compras/ordenes_de_compras.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      cache: 'no-store'
    });

    const result = await response.json();

    // Validación igual a tu archivo de productos
    if (result.success === false || result.status === false) {
      console.error("Error Obuma OC:", result);
      return NextResponse.json({ 
        error: result.message || 'Error en parámetros de Obuma',
        details: result 
      }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Error Crítico OC:", error);
    return NextResponse.json(
      { error: 'Fallo en la comunicación con el servidor', details: error.message }, 
      { status: 500 }
    );
  }
}