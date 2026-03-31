import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Usamos la URL base de tu .env (https://www.obuma.cl/api/v1.0)
    // Y concatenamos el endpoint exacto de la documentación: /comprasOc.list.json
    const response = await fetch(`${process.env.OBUMA_API_URL}/comprasOc.list.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      cache: 'no-store'
    });

    const result = await response.json();

    // Misma lógica de validación que usas en productos
    if (result.success === false || result.status === false) {
      console.error("Error Obuma OC:", result);
      return NextResponse.json({ 
        error: result.message || 'Error al consultar OC en Obuma',
        details: result 
      }, { status: 400 });
    }

    // Retornamos el JSON completo para que el frontend maneje el .data
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Error Crítico OC:", error);
    return NextResponse.json(
      { error: 'Fallo en la comunicación con el servidor', details: error.message }, 
      { status: 500 }
    );
  }
}