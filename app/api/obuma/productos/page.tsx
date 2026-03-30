import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();

  // Aquí armamos el JSON tal cual lo pide la documentación de Obuma que me pasaste
  const obumaPayload = {
    producto_nombre: body.nombre,
    producto_tipo: body.tipo,
    producto_codigo_comercial: body.sku, // Si viene vacío, Obuma genera el SKU
    producto_categoria: body.categoria_id,
    producto_costo_clp_neto: body.precio_costo,
    producto_precio_clp_neto: body.precio_venta,
  };

  try {
    const response = await fetch(`${process.env.OBUMA_API_URL}/productos.create.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(obumaPayload),
    });

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 });
  }
}