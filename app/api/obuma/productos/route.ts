import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. LÓGICA DE IMPUESTOS (Basada en el análisis de la intranet antigua)
    const precioVentaBruto = Number(body.precio_venta) || 0;
    const precioCostoBruto = Number(body.precio_costo) || 0;

    // Cálculo de NETOS si el checkbox de IVA está marcado
    const precioVentaNeto = body.incluye_iva_venta 
      ? Math.round(precioVentaBruto / 1.19) 
      : precioVentaBruto;

    const precioCostoNeto = body.incluye_iva_costo 
      ? Math.round(precioCostoBruto / 1.19) 
      : precioCostoBruto;

    const ivaVenta = precioVentaBruto - precioVentaNeto;

    // 2. CONSTRUCCIÓN DEL PAYLOAD (Mapeo Profesional)
    const obumaPayload: any = {
      producto_nombre: body.nombre.toUpperCase().trim(),
      producto_tipo: "0", // "0" para producto físico
      producto_activo: "1",
      producto_id: "", 
      
      // Clasificación
      id_categoria: body.categoria_id.toString(),
      id_subcategoria: body.subcategoria_id.toString(),
      producto_categoria: body.categoria_id.toString(),
      producto_subcategoria: body.subcategoria_id.toString(),
      
      // Precios y Costos Desglosados
      producto_costo_clp_neto: precioCostoNeto.toString(),
      producto_costo_clp_neto_estandar: precioCostoNeto.toString(),
      
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: precioVentaBruto.toString(),
      
      // Flags de Estado (Sincronización con la UI)
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      
      // Campos de compatibilidad (Los "temp" que usa Obuma internamente)
      temp_can_sell: body.se_puede_vender,
      temp_can_buy: body.se_puede_comprar,
      temp_can_keep_stock: body.se_mantiene_stock,
      temp_cost_price: precioCostoBruto,
      temp_selling_price: precioVentaBruto,
      temp_selling_taxes: body.incluye_iva_venta,
      temp_cost_taxes: body.incluye_iva_costo,
      
      // Sucursal por defecto (asegura visibilidad)
      sucursal_id: "1" 
    };

    // 3. Código Comercial (SKU)
    if (body.sku && body.sku.toString().trim() !== "") {
      obumaPayload.producto_codigo_comercial = body.sku.toString().trim();
    }

    // 4. Envío a la API de Obuma
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
      console.error("Error Obuma:", result);
      return NextResponse.json({ 
        error: result.message || 'Error al crear en Obuma',
        details: result 
      }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error Crítico:", error);
    return NextResponse.json(
      { error: 'Fallo en la comunicación con el servidor' }, 
      { status: 500 }
    );
  }
}