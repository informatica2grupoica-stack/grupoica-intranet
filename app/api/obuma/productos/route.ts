import { NextResponse } from 'next/server';

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const nombreLimpio = String(body.nombre_completo || "").toUpperCase().trim();
    const skuLimpio = String(body.sku || "").toUpperCase().trim();

    // 1. CÁLCULO DE PRECIOS (Asegurando que Obuma reciba lo que necesita)
    const pVentaBruto = Number(body.precio_venta) || 0;
    const pCostoBruto = Number(body.precio_costo) || 0;

    const precioVentaNeto = body.venta_incluye_iva ? Math.round(pVentaBruto / 1.19) : pVentaBruto;
    const precioCostoNeto = body.costo_incluye_iva ? Math.round(pCostoBruto / 1.19) : pCostoBruto;
    const ivaVenta = pVentaBruto - precioVentaNeto;

    // 2. PAYLOAD ESTRUCTURADO SEGÚN DOCUMENTACIÓN RECIENTE
    // Nota: Obuma a veces ignora id_categoria si no se envía también como producto_categoria
    const obumaPayload: any = {
      producto_nombre: nombreLimpio,
      producto_codigo_comercial: skuLimpio,
      producto_tipo: "0",
      producto_activo: "1",
      
      // IDs de clasificación (Duplicamos para asegurar compatibilidad)
      id_categoria: String(body.categoria_id),
      id_subcategoria: String(body.subcategoria_id),
      producto_categoria: String(body.categoria_id),
      producto_subcategoria: String(body.subcategoria_id),
      
      // Precios (Obuma prefiere strings con punto decimal)
      producto_costo_clp_neto: precioCostoNeto.toString(),
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: pVentaBruto.toString(),
      
      // Flags (Convertimos booleano del front a "1" o "0")
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      sucursal_id: "1"
    };

    // 3. TRATAMIENTO DE IMAGEN (El punto de fallo más común)
    if (body.imagen_data && body.imagen_data.includes('base64,')) {
      // Obuma NO acepta el prefijo "data:image/jpeg;base64,"
      const base64Puro = body.imagen_data.split('base64,')[1];
      
      // Sanitizamos el nombre de la foto (sin espacios, sin paréntesis)
      const nombreFotoLimpio = (body.imagen_nombre || `${skuLimpio}.jpg`)
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9._-]/g, '');

      obumaPayload.base64_foto = base64Puro;
      obumaPayload.nombre_foto = nombreFotoLimpio;
    }

    // 4. LLAMADA A OBUMA
    const response = await fetch(`${process.env.OBUMA_API_URL}/productos.create.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(obumaPayload),
    });

    const result = await response.json();

    // 5. MANEJO DE ERRORES DETALLADO
    if (!result.id || result.status === "error") {
      console.error("❌ Detalle error Obuma:", JSON.stringify(result));
      return NextResponse.json({ 
        error: result.message || "Error de validación en Obuma",
        details: result 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      id: result.id, 
      sku: skuLimpio,
      message: "Sincronizado exitosamente" 
    });

  } catch (error: any) {
    console.error("🔥 Error en el servidor:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}