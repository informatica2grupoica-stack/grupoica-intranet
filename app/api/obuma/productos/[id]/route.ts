import { NextResponse, NextRequest } from 'next/server';

export async function PUT(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> } // Cambio clave: ahora es una Promise
) {
  try {
    const { id } = await params; // Esperamos a que los params se resuelvan
    const body = await request.json();

    const precioVentaBruto = Number(body.precio_venta) || 0;
    const precioVentaNeto = body.incluye_iva_venta 
      ? Math.round(precioVentaBruto / 1.19) 
      : precioVentaBruto;
    const ivaVenta = precioVentaBruto - precioVentaNeto;

    const obumaPayload = {
      producto_id: id,
      producto_nombre: body.nombre.toUpperCase().trim(),
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: precioVentaBruto.toString(),
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
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
    console.error("Error en Update:", error);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}