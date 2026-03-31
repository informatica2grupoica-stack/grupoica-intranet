import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Usamos la misma URL base y el mismo token que te funcionan en productos
    const baseUrl = process.env.OBUMA_API_URL || 'https://www.obuma.cl/api/v1';
    
    const response = await fetch(`${baseUrl}/compras/ordenes_de_compras.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Cambiamos a 'access-token' que es el que usa Obuma en tus otros archivos
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      next: { revalidate: 0 } // No guardar caché para ver órdenes nuevas al instante
    });

    if (!response.ok) {
      throw new Error(`Error Obuma: ${response.status}`);
    }

    const data = await response.json();
    
    // Obuma entrega un objeto con { success: true, data: [...] }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error crítico en OC:", error.message);
    return NextResponse.json(
      { success: false, error: 'Error al conectar con Obuma' }, 
      { status: 500 }
    );
  }
}