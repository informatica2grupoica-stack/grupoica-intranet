import { NextResponse, NextRequest } from 'next/server';

export async function PUT(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 1. LÓGICA DE PRECIOS (Igual a tu POST)
    const pVentaBruto = Number(body.precio_venta) || 0;
    const pCostoBruto = Number(body.precio_costo) || 0;

    const pVentaNeto = body.venta_incluye_iva 
      ? Math.round(pVentaBruto / 1.19) 
      : pVentaBruto;

    const pCostoNeto = body.costo_incluye_iva 
      ? Math.round(pCostoBruto / 1.19) 
      : pCostoBruto;

    const ivaVenta = pVentaBruto - pVentaNeto;

    // 2. CONSTRUCCIÓN DEL PAYLOAD (Alineado con lo que Obuma espera en UPDATE)
    const obumaPayload: any = {
      producto_id: id,
      producto_nombre: body.nombre_completo.toUpperCase().trim(),
      
      // Clasificación (Usando los nombres que vienen de tu formulario de creación)
      producto_id_categoria: body.categoria_id?.toString(),
      producto_id_subcategoria: body.subcategoria_id?.toString(),
      
      // Precios
      producto_precio_costo: pCostoNeto.toString(),
      producto_precio_clp_neto: pVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: pVentaBruto.toString(),
      
      // Flags de Estado
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      
      // Tipo de Producto (1: Producto, 2: Servicio)
      producto_tipo: body.tipo === "Servicio" ? "2" : "1",
      
      // Sucursal para asegurar visibilidad
      sucursal_id: "1"
    };

    // 3. Envío a la API de Obuma (Endpoint de Update)
    const response = await fetch(`${process.env.OBUMA_API_URL}/productos.update.json`, {
      method: 'POST', // Obuma usa POST incluso para actualizar
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