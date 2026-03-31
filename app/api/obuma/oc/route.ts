import { NextResponse } from 'next/server';

export async function GET() {
  // Usamos las mismas variables que ya tienes en Vercel para Productos
  const API_URL = process.env.OBUMA_API_URL;
  const API_TOKEN = process.env.OBUMA_API_TOKEN;

  try {
    const response = await fetch(`${API_URL}/comprasOc.list.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': API_TOKEN || '',
      },
      next: { revalidate: 0 } 
    });

    const result = await response.json();

    // Obuma a veces devuelve la data en result.docs o directamente en result
    // Dependiendo de la versión de su API. Validamos ambos:
    const dataFinal = result.docs || result;

    if (!Array.isArray(dataFinal)) {
       console.error("Respuesta inesperada de Obuma:", result);
       return NextResponse.json([]);
    }

    return NextResponse.json(dataFinal);
    
  } catch (error) {
    console.error("Error Crítico OC:", error);
    return NextResponse.json(
      { error: 'Fallo en la comunicación con el servidor' }, 
      { status: 500 }
    );
  }
}