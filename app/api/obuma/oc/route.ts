import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Usamos exactamente la misma estructura de URL y headers que te funciona en productos
    const response = await fetch(`${process.env.OBUMA_API_URL}/compras/ordenes_de_compras.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Usamos la misma variable de entorno y el mismo nombre de header que en productos
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      // Añadimos esto para asegurar que Vercel siempre traiga datos frescos
      cache: 'no-store' 
    });

    const result = await response.json();

    // Replicamos tu validación de error de productos.create
    if (result.success === false || result.status === false) {
      console.error("Error Obuma OC:", result);
      return NextResponse.json({ 
        error: result.message || 'Error al consultar OC en Obuma',
        details: result 
      }, { status: 400 });
    }

    // Retornamos el resultado completo (que contiene .data para tu page.tsx)
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Error Crítico OC:", error);
    return NextResponse.json(
      { error: 'Fallo en la comunicación con el servidor', details: error.message }, 
      { status: 500 }
    );
  }
}