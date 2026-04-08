import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. LIMPIEZA DE DATOS (Mantenemos tu lógica original)
    const nombreLimpio = String(body.nombre_completo || body.nombre || "").toUpperCase().trim();
    const skuLimpio = String(body.sku || "").toUpperCase().trim();

    if (!nombreLimpio || !skuLimpio) {
      return NextResponse.json(
        { error: "Faltan datos críticos: Nombre o SKU vacíos." },
        { status: 400 }
      );
    }

    // 2. LÓGICA DE IMPUESTOS (Ajustada a lo que me pediste)
    const precioVentaInput = Number(body.precio_venta) || 0;
    const precioCostoInput = Number(body.precio_costo) || 0;

    let precioVentaNeto: number;
    let precioVentaBruto: number;

    if (body.venta_incluye_iva) {
      // Si el precio ya incluye IVA, lo desglosamos
      precioVentaBruto = precioVentaInput;
      precioVentaNeto = Math.round(precioVentaBruto / 1.19);
    } else {
      // SI NO INCLUYE IVA: Lo tomamos como neto y calculamos el bruto (sumamos el 19%)
      precioVentaNeto = precioVentaInput;
      precioVentaBruto = Math.round(precioVentaNeto * 1.19);
    }

    // Costo (Lógica simple)
    const precioCostoNeto = body.costo_incluye_iva 
      ? Math.round(precioCostoInput / 1.19) 
      : precioCostoInput;

    const ivaVenta = precioVentaBruto - precioVentaNeto;

    // 3. CONSTRUCCIÓN DEL PAYLOAD (Estructura idéntica a la que te funcionaba)
    const obumaPayload: any = {
      producto_nombre: nombreLimpio,
      producto_tipo: "0", 
      producto_activo: "1",
      producto_codigo_comercial: skuLimpio,
      
      // Clasificación
      id_categoria: String(body.categoria_id || ""),
      id_subcategoria: String(body.subcategoria_id || ""),
      
      // Precios y Costos (Enviados exactamente como tu versión exitosa)
      producto_costo_clp_neto: precioCostoNeto.toString(),
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: precioVentaBruto.toString(),
      
      // Flags de Estado
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      
      // Sucursal por defecto
      sucursal_id: "1" 
    };

    // 4. ENVÍO A LA API DE OBUMA
    const response = await fetch(`${process.env.OBUMA_API_URL}/productos.create.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(obumaPayload),
    });

    const result = await response.json();

    // 5. MANEJO DE RESPUESTA
    // Mantenemos tu validación original que sabemos que funciona
    if (result.success === false || result.status === false) {
      console.error("❌ Error de Obuma:", result);
      return NextResponse.json({ 
        error: result.message || 'Obuma rechazó los datos',
        details: result 
      }, { status: 400 });
    }

    console.log("✅ Producto creado exitosamente:", skuLimpio);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("🔥 Error Crítico en POST:", error);
    return NextResponse.json(
      { error: 'Error interno en el servidor', details: error.message }, 
      { status: 500 }
    );
  }
}