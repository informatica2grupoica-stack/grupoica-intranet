import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://www.obuma.cl/api/v1/compras/ordenes_de_compras.json', {
      method: 'GET',
      headers: {
        // Usa las mismas variables que te funcionan en productos
        'Authorization': `Bearer ${process.env.OBUMA_TOKEN}`, 
        'api-key': process.env.OBUMA_API_KEY || '',
        'Content-Type': 'application/json'
      },
      cache: 'no-store' 
    });

    const data = await response.json();
    
    // IMPORTANTE: Obuma a veces devuelve los datos dentro de un objeto. 
    // Basado en tu JSON: { "success": true, "data": [...] }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error en el servidor' }, { status: 500 });
  }
}