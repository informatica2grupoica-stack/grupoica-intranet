import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. LIMPIEZA DE DATOS
    const nombreLimpio = String(body.nombre_completo || "").toUpperCase().trim();
    const skuLimpio = String(body.sku || "").toUpperCase().trim();
    
    // Mapeo de tipo de producto (Obuma suele usar "0" para productos físicos)
    // Si el front envía "Servicio", podrías cambiarlo a "1" según la API de Obuma
    const tipoProducto = body.tipo === "Servicio" ? "1" : "0";

    if (!nombreLimpio || !skuLimpio) {
      return NextResponse.json(
        { error: "Faltan datos críticos: Nombre o SKU vacíos." },
        { status: 400 }
      );
    }

    // 2. LÓGICA DE IMPUESTOS (IVA CHILE 19%)
    const precioVentaInput = Number(body.precio_venta) || 0;
    const precioCostoInput = Number(body.precio_costo) || 0;

    let precioVentaNeto: number;
    let precioVentaBruto: number;

    if (body.venta_incluye_iva) {
      // Si el precio ingresado en el front ya es el TOTAL (Bruto)
      precioVentaBruto = precioVentaInput;
      // Calculamos el neto: Total / 1.19
      precioVentaNeto = Math.round(precioVentaBruto / 1.19);
    } else {
      // Si el precio ingresado es NETO
      precioVentaNeto = precioVentaInput;
      // Calculamos el bruto: Neto * 1.19
      precioVentaBruto = Math.round(precioVentaNeto * 1.19);
    }

    // Cálculo del IVA para el payload
    const ivaVenta = precioVentaBruto - precioVentaNeto;

    // Costo (Obuma siempre pide el costo neto)
    const precioCostoNeto = body.costo_incluye_iva 
      ? Math.round(precioCostoInput / 1.19) 
      : precioCostoInput;

    // 3. CONSTRUCCIÓN DEL PAYLOAD PARA OBUMA
    const obumaPayload = {
      producto_nombre: nombreLimpio,
      producto_tipo: tipoProducto, 
      producto_activo: "1",
      producto_codigo_comercial: skuLimpio,
      
      // Clasificación
      id_categoria: String(body.categoria_id || ""),
      id_subcategoria: String(body.subcategoria_id || ""),
      
      // Precios y Costos (Strings para evitar problemas de precisión)
      producto_costo_clp_neto: precioCostoNeto.toString(),
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: precioVentaBruto.toString(),
      
      // Flags de Estado
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      
      // Configuración local
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
    if (result.success === false || result.status === false) {
      console.error("❌ Error devuelto por Obuma:", result);
      return NextResponse.json({ 
        error: result.message || 'Obuma rechazó los datos',
        details: result 
      }, { status: 400 });
    }

    console.log("✅ Producto creado exitosamente:", skuLimpio);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("🔥 Error Crítico en el Servidor:", error);
    return NextResponse.json(
      { error: 'Error interno en el servidor', details: error.message }, 
      { status: 500 }
    );
  }
}