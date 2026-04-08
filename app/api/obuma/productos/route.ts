import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. BLINDAJE Y LIMPIEZA DE DATOS
    // Aseguramos que el nombre vaya en mayúsculas y el SKU esté limpio
    const nombreLimpio = String(body.nombre_completo || body.nombre || "").toUpperCase().trim();
    const skuLimpio = String(body.sku || "").toUpperCase().trim();

    if (!nombreLimpio || !skuLimpio) {
      return NextResponse.json(
        { error: "Faltan datos críticos: Nombre o SKU vacíos." },
        { status: 400 }
      );
    }

    // 2. LÓGICA DE IMPUESTOS (Basado en el 19% de Chile)
    // El objetivo es que Obuma reciba: Neto, IVA y Total por separado.
    const precioVentaBruto = Number(body.precio_venta) || 0;
    const precioCostoBruto = Number(body.precio_costo) || 0;

    // Cálculo para Venta
    const precioVentaNeto = body.venta_incluye_iva 
      ? Math.round(precioVentaBruto / 1.19) 
      : precioVentaBruto;
    
    // Si el usuario marcó que incluye IVA, el total es el ingresado. 
    // Si marcó que NO incluye IVA, el total es el ingresado * 1.19.
    const precioVentaTotal = body.venta_incluye_iva 
      ? precioVentaBruto 
      : Math.round(precioVentaBruto * 1.19);

    const ivaVenta = precioVentaTotal - precioVentaNeto;

    // Cálculo para Costo (Neto estándar)
    const precioCostoNeto = body.costo_incluye_iva 
      ? Math.round(precioCostoBruto / 1.19) 
      : precioCostoBruto;

    // 3. CONSTRUCCIÓN DEL PAYLOAD (Estructura espejo de tu objeto validado)
    const obumaPayload: any = {
      producto_nombre: nombreLimpio,
      producto_tipo: "0", 
      producto_activo: "1",
      producto_codigo_comercial: skuLimpio,
      
      // Clasificación
      id_categoria: String(body.categoria_id || ""),
      id_subcategoria: String(body.subcategoria_id || ""),
      producto_categoria: String(body.categoria_id || ""), // Duplicamos para asegurar compatibilidad
      producto_subcategoria: String(body.subcategoria_id || ""),
      
      // Precios y Costos (Enviados como String según requiere la API)
      producto_costo_clp_neto: precioCostoNeto.toString(),
      producto_costo_clp_neto_estandar: precioCostoNeto.toString(),
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: precioVentaTotal.toString(),
      
      // Flags de Estado (1 = Sí, 0 = No)
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      
      // Sucursal y Datos técnicos
      sucursal_id: "1",
      producto_id: "" // Vacío para creación
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
    // Obuma a veces responde success: false o simplemente no trae un ID
    if (result.success === false || result.status === "error" || !result.id) {
      console.error("❌ Error de Obuma:", result);
      return NextResponse.json({ 
        error: result.message || 'Obuma rechazó los datos',
        details: result 
      }, { status: 400 });
    }

    console.log("✅ Producto creado exitosamente:", skuLimpio, "ID:", result.id);
    return NextResponse.json({
      success: true,
      id: result.id,
      sku: skuLimpio
    });

  } catch (error: any) {
    console.error("🔥 Error Crítico en POST:", error);
    return NextResponse.json(
      { error: 'Error interno en el servidor', details: error.message }, 
      { status: 500 }
    );
  }
}