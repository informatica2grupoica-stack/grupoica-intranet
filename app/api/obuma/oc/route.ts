import { NextResponse } from 'next/server';

export async function GET() {
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
    
    // DEBUG PARA VERCEL: Revisa esto en la pestaña "Logs" de tu despliegue
    console.log("Respuesta RAW de Obuma OC:", JSON.stringify(result).substring(0, 200));

    // Según tu doc, puede venir como array directo o dentro de una llave
    const dataFinal = Array.isArray(result) ? result : (result.docs || result.data || []);

    return NextResponse.json(dataFinal);
    
  } catch (error) {
    return NextResponse.json({ error: 'Fallo en comunicación' }, { status: 500 });
  }
}