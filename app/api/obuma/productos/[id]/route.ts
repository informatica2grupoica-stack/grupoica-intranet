import { NextResponse, NextRequest } from 'next/server';

export async function PUT(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 1. LÓGICA DE IMPUESTOS (Igual a tu creación)
    const precioVentaBruto = Number(body.precio_venta) || 0;
    const precioCostoBruto = Number(body.precio_costo) || 0;

    const precioVentaNeto = body.venta_incluye_iva 
      ? Math.round(precioVentaBruto / 1.19) 
      : precioVentaBruto;

    const precioCostoNeto = body.costo_incluye_iva 
      ? Math.round(precioCostoBruto / 1.19) 
      : precioCostoBruto;

    const ivaVenta = precioVentaBruto - precioVentaNeto;

    // 2. CONSTRUCCIÓN DEL PAYLOAD PARA UPDATE
    // Nota: Obuma para actualizar usa producto_categoria y producto_subcategoria
    const obumaPayload: any = {
      producto_id: id,
      producto_nombre: body.nombre_completo.toUpperCase().trim(),
      producto_tipo: body.tipo === "Servicio" ? "2" : "1",
      
      // Clasificación
      producto_categoria: body.categoria_id.toString(),
      producto_subcategoria: body.subcategoria_id.toString(),
      
      // Precios y Costos
      producto_costo_clp_neto: precioCostoNeto.toString(),
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: precioVentaBruto.toString(),
      
      // Flags de Estado
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      
      producto_codigo_comercial: body.sku,
      sucursal_id: "1"
    };

    const response = await fetch(`${process.env.OBUMA_API_URL}/productos.update.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(obumaPayload),
    });

    const result = await response.json();

    if (result.success === false || result.status === false) {
      return NextResponse.json({ 
        error: result.message || 'Error al actualizar en Obuma',
        details: result 
      }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error en Update:", error);
    return NextResponse.json({ error: 'Error crítico de servidor' }, { status: 500 });
  }
}