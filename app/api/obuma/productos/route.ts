import { NextResponse } from 'next/server';

// Aumentamos el límite para permitir imágenes de alta resolución
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

    // 1. BLINDAJE Y LIMPIEZA DE DATOS
    const nombreLimpio = String(body.nombre_completo || "").toUpperCase().trim();
    const skuLimpio = String(body.sku || "").toUpperCase().trim();

    if (!nombreLimpio || !skuLimpio) {
      return NextResponse.json(
        { error: "El Nombre y el SKU son obligatorios." },
        { status: 400 }
      );
    }

    // 2. LÓGICA DE IMPUESTOS (IVA 19% CHILE)
    const precioVentaBruto = Number(body.precio_venta) || 0;
    
    // Cálculo de Neto y 19% para Obuma
    const precioVentaNeto = Math.round(precioVentaBruto / 1.19);
    const ivaVenta = precioVentaBruto - precioVentaNeto;

    // 3. CONSTRUCCIÓN DEL PAYLOAD PARA OBUMA
    const obumaPayload: any = {
      // Identificación
      producto_nombre: nombreLimpio,
      producto_codigo_comercial: skuLimpio,
      producto_tipo: "0", 
      producto_activo: "1",
      
      // Clasificación
      id_categoria: String(body.categoria_id || ""),
      id_subcategoria: String(body.subcategoria_id || ""),
      producto_categoria: String(body.categoria_id || ""),
      producto_subcategoria: String(body.subcategoria_id || ""),
      
      // Precios (Obuma requiere strings en muchos casos)
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: precioVentaBruto.toString(),
      
      // Flags de inventario y venta
      producto_para_venta: "1",
      producto_para_compra: "1",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      sucursal_id: "1" 
    };

    // 4. PROCESAMIENTO DE IMAGEN (LA CLAVE)
    if (body.imagen_data) {
      // Eliminamos cualquier prefijo de Data-URL para dejar solo el Base64 puro
      const base64Limpio = body.imagen_data.replace(/^data:image\/\w+;base64,/, "");
      
      // Obuma usa estos campos específicos para recibir la foto en el create
      obumaPayload.base64_foto = base64Limpio; 
      
      // Sanitizamos el nombre: minúsculas, sin espacios, sin caracteres raros
      const nombreFotoLimpio = (body.imagen_nombre || `${skuLimpio}.jpg`)
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9._-]/g, '');
        
      obumaPayload.nombre_foto = nombreFotoLimpio;
    }

    // 5. ENVÍO A LA API DE OBUMA
    const response = await fetch(`${process.env.OBUMA_API_URL}/productos.create.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(obumaPayload),
    });

    const result = await response.json();

    // 6. MANEJO DE RESPUESTA DE OBUMA
    // Obuma a veces responde success: false o status: 'error'
    if (result.success === false || result.status === "error" || !result.id) {
      console.error("❌ Obuma rechazó el producto:", result);
      return NextResponse.json({ 
        error: result.message || 'Obuma rechazó los datos',
        details: result 
      }, { status: 400 });
    }

    // Éxito total
    console.log(`✅ Producto [${skuLimpio}] creado con ID: ${result.id}`);
    
    // Devolvemos el objeto completo de Obuma al frontend
    return NextResponse.json({
      success: true,
      id: result.id,
      sku: skuLimpio,
      message: "Sincronizado correctamente con imagen"
    });

  } catch (error: any) {
    console.error("🔥 Error crítico en API Route:", error);
    return NextResponse.json(
      { error: 'Error interno en el servidor', details: error.message }, 
      { status: 500 }
    );
  }
}