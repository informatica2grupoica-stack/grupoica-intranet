import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. LIMPIEZA DE DATOS
    const nombreLimpio = String(body.nombre_completo || "").toUpperCase().trim();
    const skuLimpio = String(body.sku || "").toUpperCase().trim();
    const tipoProducto = body.tipo === "Servicio" ? "1" : "0";

    if (!nombreLimpio || !skuLimpio) {
      return NextResponse.json(
        { error: "Faltan datos críticos: Nombre o SKU vacíos." },
        { status: 400 }
      );
    }

    // 2. LÓGICA DE IMPUESTOS (IVA CHILE 1.19)
    const precioVentaInput = Number(body.precio_venta) || 0;
    const precioCostoInput = Number(body.precio_costo) || 0;

    let precioVentaNeto: number;
    let precioVentaBruto: number;

    // Lógica espejo a la intranet vieja:
    if (body.venta_incluye_iva) {
      // Si el usuario ingresó el TOTAL (ej: 1190)
      precioVentaBruto = precioVentaInput;
      // Calculamos el neto dividiendo por 1.19
      precioVentaNeto = Math.round(precioVentaBruto / 1.19);
    } else {
      // Si el usuario ingresó el NETO (ej: 1000)
      precioVentaNeto = precioVentaInput;
      // Calculamos el bruto multiplicando por 1.19
      precioVentaBruto = Math.round(precioVentaNeto * 1.19);
    }

    // El IVA es siempre la diferencia entre el total y el neto
    const ivaVenta = precioVentaBruto - precioVentaNeto;

    // Costo Neto (Obuma siempre prefiere recibir el costo neto)
    const precioCostoNeto = body.costo_incluye_iva 
      ? Math.round(precioCostoInput / 1.19) 
      : precioCostoInput;

    // 3. CONSTRUCCIÓN DEL PAYLOAD PARA OBUMA
    const obumaPayload = {
      producto_nombre: nombreLimpio,
      producto_tipo: tipoProducto, 
      producto_activo: "1",
      producto_codigo_comercial: skuLimpio,
      
      // Clasificación técnica
      id_categoria: String(body.categoria_id || ""),
      id_subcategoria: String(body.subcategoria_id || ""),
      
      // ID 1 suele ser IVA 19% en cuentas de Chile
      producto_impuesto_id: "1", 
      
      // Precios y Costos (Enviamos todo desglosado como en la intranet vieja)
      producto_costo_clp_neto: precioCostoNeto.toString(),
      // AGREGADO: Costo Estándar (mismo que costo neto)
      producto_costo_clp_neto_estandar: precioCostoNeto.toString(),
      
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: precioVentaBruto.toString(),
      
      // Flags de Estado convertidos a String ("1" o "0")
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",

      // AGREGADO: Sincronización con Dime / Web
      // Obuma usa 'producto_web' o 'producto_vender_en_web' para activar e-commerce
      producto_web: body.enviar_a_dime ? "1" : "0",
      
      // Sucursal principal
      sucursal_id: "1" 
    };

    console.log("📤 Payload calculado para Obuma:", obumaPayload);

    // 4. ENVÍO A LA API
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
    if (!response.ok || result.success === false || result.status === false) {
      console.error("❌ Error Obuma:", result);
      return NextResponse.json({ 
        error: result.message || 'Obuma rechazó los datos',
        details: result 
      }, { status: 400 });
    }

    console.log("✅ Producto sincronizado correctamente");
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("🔥 Error Crítico en Backend:", error);
    return NextResponse.json(
      { error: 'Error interno en el servidor', details: error.message }, 
      { status: 500 }
    );
  }
}