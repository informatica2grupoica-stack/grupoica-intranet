import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // MAPEADO EXACTO SEGÚN LA INTRANET ANTIGUA
    const obumaPayload: any = {
      // 1. Identificación y Tipo
      producto_nombre: body.nombre.toUpperCase().trim(),
      producto_tipo: "0", // CAMBIO: La intranet antigua usa "0" para productos físicos
      producto_activo: "1",
      producto_id: "", // Se envía vacío para creación
      
      // 2. Clasificación (Se envían ambos formatos por si acaso)
      id_categoria: body.categoria_id.toString(),
      id_subcategoria: body.subcategoria_id.toString(),
      producto_categoria: body.categoria_id.toString(),
      producto_subcategoria: body.subcategoria_id.toString(),
      
      // 3. Precios y Costos
      producto_costo_clp_neto: body.precio_costo.toString() || "0",
      producto_precio_clp_neto: body.precio_venta.toString() || "0",
      producto_precio_clp_iva: "0",
      producto_precio_clp_total: "0",
      producto_costo_clp_neto_estandar: "0",
      
      // 4. Flags de Estado (Nombres exactos de la captura)
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0", // Ojo: aquí se llama inventariable
      
      // 5. Los campos "temp" que vimos en tu captura
      temp_can_sell: body.se_puede_vender,
      temp_can_buy: body.se_puede_comprar,
      temp_can_keep_stock: body.se_mantiene_stock,
      temp_cost_price: Number(body.precio_costo),
      temp_selling_price: Number(body.precio_venta)
    };

    // 6. Código Comercial (SKU)
    if (body.sku && body.sku.toString().trim() !== "") {
      obumaPayload.producto_codigo_comercial = body.sku.toString().trim();
    }

    // Envío a Obuma
    const response = await fetch(`${process.env.OBUMA_API_URL}/productos.create.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(obumaPayload),
    });

    const result = await response.json();

    if (result.success === false || result.status === false) {
      console.log("Error detallado de Obuma:", result);
      return NextResponse.json({ 
        error: result.message || 'Error en Obuma',
        details: result 
      }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error crítico:", error);
    return NextResponse.json(
      { error: 'Error de comunicación' }, 
      { status: 500 }
    );
  }
}