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

    if (!nombreLimpio || !skuLimpio) {
      return NextResponse.json({ error: "Nombre y SKU requeridos" }, { status: 400 });
    }

    // Lógica de Precios con salvaguarda para el "0"
    const pVentaBruto = Number(body.precio_venta) || 0;
    const pCostoBruto = Number(body.precio_costo) || 0;

    const precioVentaNeto = body.venta_incluye_iva ? Math.round(pVentaBruto / 1.19) : pVentaBruto;
    const precioCostoNeto = body.costo_incluye_iva ? Math.round(pCostoBruto / 1.19) : pCostoBruto;
    const ivaVenta = pVentaBruto - precioVentaNeto;

    // Construcción del Payload con nombres de campos alternativos (Doble validación)
    const obumaPayload: any = {
      producto_nombre: nombreLimpio,
      producto_codigo_comercial: skuLimpio,
      producto_tipo: "0",
      producto_activo: "1",
      
      // Clasificación (Enviamos ambos formatos por si tu versión de API prefiere uno)
      id_categoria: String(body.categoria_id),
      id_subcategoria: String(body.subcategoria_id),
      producto_categoria: String(body.categoria_id),
      producto_subcategoria: String(body.subcategoria_id),
      
      // Precios - Usamos .toFixed(2) para asegurar formato decimal que Obuma ama
      producto_costo_clp_neto: precioCostoNeto.toFixed(2),
      producto_precio_clp_neto: precioVentaNeto.toFixed(2),
      producto_precio_clp_iva: ivaVenta.toFixed(2),
      producto_precio_clp_total: pVentaBruto.toFixed(2),
      
      // Flags
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      sucursal_id: "1"
    };

    // Procesamiento de Imagen mejorado
    if (body.imagen_data && body.imagen_data.length > 100) {
      // Extraer solo el contenido base64 puro
      const base64Parts = body.imagen_data.split('base64,');
      const base64Limpio = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];

      const nombreFotoLimpio = (body.imagen_nombre || `${skuLimpio}.jpg`)
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9._-]/g, '')
        .replace(/_{2,}/g, '_');

      obumaPayload.base64_foto = base64Limpio;
      obumaPayload.nombre_foto = nombreFotoLimpio;
    }

    const response = await fetch(`${process.env.OBUMA_API_URL}/productos.create.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(obumaPayload),
    });

    const result = await response.json();

    if (result.success === false || result.status === "error" || !result.id) {
      // Log detallado en tu terminal para que veas qué campo exacto rebota
      console.log("--- ERROR DE VALIDACIÓN DETECTADO ---");
      console.log("Payload enviado:", JSON.stringify(obumaPayload).substring(0, 500) + "...");
      console.log("Respuesta Obuma:", result);

      return NextResponse.json({ 
        error: result.message || "Obuma rechazó los datos (Verifica categorías o precios)",
        details: result 
      }, { status: 400 });
    }

    return NextResponse.json({ success: true, id: result.id, sku: skuLimpio });

  } catch (error: any) {
    console.error("🔥 Error Crítico:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}