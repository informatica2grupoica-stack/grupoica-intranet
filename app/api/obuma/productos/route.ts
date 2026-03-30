import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Mapeo EXACTO basado en la estructura que ya te funciona
    const obumaPayload: any = {
      producto_nombre: body.nombre.toUpperCase().trim(),
      producto_tipo: body.tipo || "Producto",
      
      // Clasificación (IDs numéricos)
      rel_producto_categoria_id: Number(body.categoria_id),
      rel_producto_subcategoria_id: Number(body.subcategoria_id),
      
      // Costos y Precios (Convertidos a número para evitar rechazo)
      producto_costo_clp_neto: Number(body.precio_costo) || 0,
      producto_precio_clp_neto: Number(body.precio_venta) || 0,
      
      // Estados (1 para activo, 0 para inactivo)
      producto_se_puede_vender: body.se_puede_vender ? 1 : 0,
      producto_se_puede_comprar: body.se_puede_comprar ? 1 : 0,
      producto_se_mantiene_stock: body.se_mantiene_stock ? 1 : 0,
    };

    // 2. Lógica de SKU Automático:
    // Si el SKU viene vacío desde la intranet, ELIMINAMOS la propiedad del envío.
    // Esto obliga a Obuma a usar su propio contador interno.
    if (body.sku && body.sku.toString().trim() !== "") {
      obumaPayload.producto_codigo_comercial = body.sku.toString().trim();
    }

    // 3. Envío a la API
    const response = await fetch(`${process.env.OBUMA_API_URL}/productos.create.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(obumaPayload),
    });

    const result = await response.json();

    // 4. Validación de respuesta de Obuma
    // Importante: Revisamos si 'success' es false aunque el servidor responda 200 OK
    if (result.success === false || result.status === false) {
      console.log("Error detallado de Obuma:", result);
      return NextResponse.json({ 
        error: result.message || 'Obuma no pudo crear el producto',
        details: result 
      }, { status: 400 });
    }

    // Retornamos el éxito (incluye el nuevo SKU generado por Obuma)
    return NextResponse.json(result);

  } catch (error) {
    console.error("Error crítico en la ruta de productos:", error);
    return NextResponse.json(
      { error: 'Error de comunicación con el servidor de Obuma' }, 
      { status: 500 }
    );
  }
}