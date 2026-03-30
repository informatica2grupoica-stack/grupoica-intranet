import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Mapeo completo según la documentación de Obuma
    const obumaPayload = {
      producto_nombre: body.nombre,
      producto_tipo: body.tipo,
      producto_codigo_comercial: body.sku, // Si viene vacío, Obuma genera el SKU automáticamente
      
      // Clasificación jerárquica
      rel_producto_categoria_id: body.categoria_id,
      rel_producto_subcategoria_id: body.subcategoria_id,
      
      // Precios y Costos
      producto_costo_clp_neto: body.precio_costo,
      producto_precio_clp_neto: body.precio_venta,
      
      // Configuración de inventario y comercial
      // Convertimos los booleanos del formulario (true/false) a (1/0) que es lo que recibe la API
      producto_se_puede_vender: body.se_puede_vender ? 1 : 0,
      producto_se_puede_comprar: body.se_puede_comprar ? 1 : 0,
      producto_se_mantiene_stock: body.se_mantiene_stock ? 1 : 0,
    };

    const response = await fetch(`${process.env.OBUMA_API_URL}/productos.create.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(obumaPayload),
    });

    const result = await response.json();

    // Si la API de Obuma devuelve un error, lo capturamos aquí
    if (!response.ok) {
      return NextResponse.json({ 
        error: 'Error en la respuesta de Obuma', 
        details: result 
      }, { status: response.status });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error crítico en API Route Productos:", error);
    return NextResponse.json(
      { error: 'Error interno al procesar la solicitud con Obuma' }, 
      { status: 500 }
    );
  }
}