import { NextResponse, NextRequest } from 'next/server';

export async function PUT(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Lógica de Precios (Costo y Venta)
    const pCostoBruto = Number(body.precio_costo) || 0;
    const pVentaBruto = Number(body.precio_venta) || 0;

    const pCostoNeto = body.costo_incluye_iva ? Math.round(pCostoBruto / 1.19) : pCostoBruto;
    const pVentaNeto = body.venta_incluye_iva ? Math.round(pVentaBruto / 1.19) : pVentaBruto;

    const obumaPayload = {
      producto_id: id,
      producto_nombre: body.nombre_completo.toUpperCase().trim(),
      producto_id_categoria: body.categoria,
      producto_id_subcategoria: body.subcategoria,
      producto_precio_costo: pCostoNeto.toString(),
      producto_precio_clp_neto: pVentaNeto.toString(),
      producto_precio_clp_total: pVentaBruto.toString(),
      // Flags de la captura
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      producto_tipo: body.tipo_producto === "Servicio" ? "2" : "1"
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
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}