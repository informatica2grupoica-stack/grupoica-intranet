import { NextResponse } from 'next/server';

// Mantenemos el límite de tamaño para que Next.js no bloquee fotos pesadas
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. BLINDAJE ANTI-CRASH (Tus originales)
    const nombreLimpio = String(body.nombre_completo || body.nombre || "").toUpperCase().trim();
    const skuLimpio = String(body.sku || "").toUpperCase().trim();

    if (!nombreLimpio || !skuLimpio) {
      return NextResponse.json(
        { error: "Faltan datos críticos: Nombre o SKU vacíos." },
        { status: 400 }
      );
    }

    // 2. LÓGICA DE IMPUESTOS (Tu lógica intacta)
    const precioVentaBruto = Number(body.precio_venta) || 0;
    const precioCostoBruto = Number(body.precio_costo) || 0;

    const precioVentaNeto = body.venta_incluye_iva 
      ? Math.round(precioVentaBruto / 1.19) 
      : precioVentaBruto;

    const precioCostoNeto = body.costo_incluye_iva 
      ? Math.round(precioCostoBruto / 1.19) 
      : precioCostoBruto;

    const ivaVenta = precioVentaBruto - precioVentaNeto;

    // 3. CONSTRUCCIÓN DEL PAYLOAD (Recuperamos todos tus campos)
    const obumaPayload: any = {
      producto_nombre: nombreLimpio,
      producto_tipo: "0", 
      producto_activo: "1",
      producto_codigo_comercial: skuLimpio,
      
      // Clasificación
      id_categoria: String(body.categoria_id || ""),
      id_subcategoria: String(body.subcategoria_id || ""),
      
      // Precios y Costos (Tus campos originales)
      producto_costo_clp_neto: precioCostoNeto.toString(),
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: precioVentaBruto.toString(),
      
      // Flags de Estado (Tus campos originales)
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      
      sucursal_id: "1" 
    };

    // --- PARCHE DE IMAGEN (Solo añade, no quita nada) ---
    if (body.imagen_data) {
      // Usamos ambos nombres de campo para asegurar compatibilidad con Obuma V1/V2
      obumaPayload.imagen_base64 = body.imagen_data; 
      obumaPayload.referencia_imagen = body.imagen_data; 
      obumaPayload.imagen_nombre = body.imagen_nombre || `${skuLimpio}.jpg`;
      obumaPayload.referencia_imagen_nombre = body.imagen_nombre || `${skuLimpio}.jpg`;
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

    // 5. Manejo de Respuesta (Tu lógica original)
    if (result.success === false || result.status === false) {
      console.error("❌ Error de Obuma:", result);
      return NextResponse.json({ 
        error: result.message || 'Obuma rechazó los datos',
        details: result 
      }, { status: 400 });
    }

    console.log("✅ Producto sincronizado exitosamente:", skuLimpio);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("🔥 Error Crítico en POST:", error);
    return NextResponse.json(
      { error: 'Error interno en el servidor', details: error.message }, 
      { status: 500 }
    );
  }
}