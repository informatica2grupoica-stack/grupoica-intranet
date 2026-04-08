import { NextResponse } from 'next/server';

// 1. CONFIGURACIÓN DE TAMAÑO (Crucial para imágenes)
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

    // 2. BLINDAJE Y LIMPIEZA DE DATOS
    const nombreLimpio = String(body.nombre_completo || "").toUpperCase().trim();
    const skuLimpio = String(body.sku || "").toUpperCase().trim();

    if (!nombreLimpio || !skuLimpio) {
      return NextResponse.json(
        { error: "Faltan datos críticos: Nombre o SKU vacíos." },
        { status: 400 }
      );
    }

    // 3. LÓGICA DE IMPUESTOS (Cálculo de Neto/IVA)
    const precioVentaBruto = Number(body.precio_venta) || 0;
    const precioCostoBruto = Number(body.precio_costo) || 0;

    const precioVentaNeto = body.venta_incluye_iva 
      ? Math.round(precioVentaBruto / 1.19) 
      : precioVentaBruto;

    const precioCostoNeto = body.costo_incluye_iva 
      ? Math.round(precioCostoBruto / 1.19) 
      : precioCostoBruto;

    const ivaVenta = precioVentaBruto - precioVentaNeto;

    // 4. CONSTRUCCIÓN DEL PAYLOAD PARA OBUMA
    // Nota: Usamos campos que Obuma acepta según su documentación de integración
    const obumaPayload: any = {
      producto_nombre: nombreLimpio,
      producto_tipo: "1", // 1=Producto, 2=Servicio
      producto_activo: "1",
      producto_codigo_comercial: skuLimpio,
      
      // Clasificación
      id_categoria: String(body.categoria_id || ""),
      id_subcategoria: String(body.subcategoria_id || ""),
      
      // Precios y Costos
      producto_costo_clp_neto: precioCostoNeto.toString(),
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: precioVentaBruto.toString(),
      
      // Flags de Estado
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      
      sucursal_id: "1" 
    };

    // --- MANEJO DE IMAGEN (El campo correcto en Obuma suele ser base64_foto) ---
    if (body.imagen_data) {
      // Obuma recibe el base64 SIN el prefijo "data:image/jpeg;base64,"
      // El front ya lo limpia, pero aquí lo enviamos en los campos probables
      obumaPayload.base64_foto = body.imagen_data; 
      obumaPayload.nombre_foto = body.imagen_nombre || `${skuLimpio}.jpg`;
      
      // Compatibilidad adicional por si tu versión de API usa campos alternativos
      obumaPayload.imagen_base64 = body.imagen_data; 
      obumaPayload.imagen_nombre = body.imagen_nombre || `${skuLimpio}.jpg`;
    }

    // 5. ENVÍO A OBUMA (productos.add.json es el estándar para creación)
    // Probamos con productos.create.json o productos.add.json según tu endpoint
    const response = await fetch(`${process.env.OBUMA_API_URL}/productos.add.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(obumaPayload),
    });

    const result = await response.json();

    // 6. MANEJO DE RESPUESTA
    if (result.status === 'error' || result.success === false) {
      console.error("❌ Error de Obuma:", result);
      return NextResponse.json({ 
        error: result.message || 'Obuma rechazó los datos',
        details: result 
      }, { status: 400 });
    }

    console.log("✅ Producto sincronizado exitosamente:", skuLimpio);
    return NextResponse.json({ success: true, data: result });

  } catch (error: any) {
    console.error("🔥 Error Crítico en Backend:", error);
    return NextResponse.json(
      { error: 'Error interno en el servidor', details: error.message }, 
      { status: 500 }
    );
  }
}