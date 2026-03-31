import { NextResponse, NextRequest } from 'next/server';

export async function PUT(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 1. LÓGICA DE PRECIOS
    const pVentaBruto = Number(body.precio_venta) || 0;
    const pCostoBruto = Number(body.precio_costo) || 0;

    const pVentaNeto = body.venta_incluye_iva 
      ? Math.round(pVentaBruto / 1.19) 
      : pVentaBruto;

    const pCostoNeto = body.costo_incluye_iva 
      ? Math.round(pCostoBruto / 1.19) 
      : pCostoBruto;

    const ivaVenta = pVentaBruto - pVentaNeto;

    // 2. CONSTRUCCIÓN DEL PAYLOAD PARA OBUMA
    const obumaPayload: any = {
      producto_id: id,
      producto_nombre: body.nombre_completo.toUpperCase().trim(),
      
      // Aseguramos que los IDs de categoría se envíen correctamente
      producto_id_categoria: body.categoria_id?.toString(),
      producto_id_subcategoria: body.subcategoria_id?.toString(),
      
      // Precios (Obuma suele preferir strings en su API JSON)
      producto_precio_costo: pCostoNeto.toString(),
      producto_precio_clp_neto: pVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: pVentaBruto.toString(),
      
      // Flags (1 o 0 como strings)
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      
      // Tipo (1: Producto, 2: Servicio)
      producto_tipo: body.tipo === "Servicio" ? "2" : "1",
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
    console.error("Error API Update:", error);
    return NextResponse.json({ error: 'Error crítico al actualizar' }, { status: 500 });
  }
}