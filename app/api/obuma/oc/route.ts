import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Usamos las mismas variables que usas en productos
  const urlBase = process.env.OBUMA_API_URL;
  const token = process.env.OBUMA_API_TOKEN;

  try {
    // Endpoint oficial según la documentación que enviaste
    const finalUrl = `${urlBase}/comprasOc.list.json`;

    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'access-token': token || '',
        'Content-Type': 'application/json'
      },
      next: { revalidate: 0 }
    });

    const res = await response.json();

    // Normalizamos igual que en tu código de productos para que sea consistente
    return NextResponse.json({
      success: true,
      data: res.data || res.compras || [],
      pagination: res.pagination || null
    });

  } catch (error: any) {
    console.error("Error Obuma OC:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}