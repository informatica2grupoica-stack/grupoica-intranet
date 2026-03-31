import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const API_URL = process.env.OBUMA_API_URL;
  const API_TOKEN = process.env.OBUMA_API_TOKEN;

  // Construimos la URL igual que en productos
  const obumaUrl = new URL(`${API_URL}/comprasOc.list.json`);

  try {
    const response = await fetch(obumaUrl.toString(), {
      method: 'GET',
      headers: {
        'access-token': API_TOKEN || '',
        'Content-Type': 'application/json'
      },
      next: { revalidate: 0 } 
    });

    if (!response.ok) {
      throw new Error(`Error de Obuma: ${response.status}`);
    }

    const data = await response.json();

    // AQUÍ ESTÁ EL TRUCO: 
    // Normalizamos igual que en productos. 
    // Obuma para OC suele mandar los datos en 'data'.
    return NextResponse.json({
      success: true,
      data: data.data || data.compras || data || []
    });

  } catch (error: any) {
    console.error("Error en Compras Obuma:", error.message);
    return NextResponse.json(
      { success: false, error: 'Error al conectar con la API', details: error.message }, 
      { status: 500 }
    );
  }
}