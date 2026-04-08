import { NextResponse } from 'next/server';

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

    // 1. LIMPIEZA DE IDENTIDAD (Garantizamos Mayúsculas y sin espacios extra)
    const nombreLimpio = String(body.nombre_completo || "").toUpperCase().trim();
    const skuLimpio = String(body.sku || "").toUpperCase().trim();

    if (!nombreLimpio || !skuLimpio) {
      return NextResponse.json(
        { error: "El Nombre y el SKU son obligatorios." },
        { status: 400 }
      );
    }

    // 2. LÓGICA DE IMPUESTOS DINÁMICA (IVA 19% CHILE)
    const pVentaBruto = Number(body.precio_venta) || 0;
    const pCostoBruto = Number(body.precio_costo) || 0;

    // Si el usuario marcó que incluye IVA, calculamos el neto. Si no, el valor ingresado es el neto.
    const precioVentaNeto = body.venta_incluye_iva ? Math.round(pVentaBruto / 1.19) : pVentaBruto;
    const precioCostoNeto = body.costo_incluye_iva ? Math.round(pCostoBruto / 1.19) : pCostoBruto;
    
    // Obuma necesita el monto del IVA por separado para sus reportes
    const ivaVenta = pVentaBruto - precioVentaNeto;

    // 3. CONSTRUCCIÓN DEL PAYLOAD PARA OBUMA
    const obumaPayload: any = {
      producto_nombre: nombreLimpio,
      producto_codigo_comercial: skuLimpio,
      producto_tipo: "0", 
      producto_activo: "1",
      
      // Clasificación
      id_categoria: String(body.categoria_id || ""),
      id_subcategoria: String(body.subcategoria_id || ""),
      producto_categoria: String(body.categoria_id || ""),
      producto_subcategoria: String(body.subcategoria_id || ""),
      
      // Valores Monetarios (Convertidos a String para evitar errores de tipo en la API)
      producto_costo_clp_neto: precioCostoNeto.toString(),
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: pVentaBruto.toString(),
      
      // Flags de Estado (1 = Si, 0 = No)
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      sucursal_id: "1" 
    };

    // 4. PROCESAMIENTO QUIRÚRGICO DE IMAGEN
    if (body.imagen_data) {
      // A. Eliminamos el prefijo (data:image/jpeg;base64,) si existe
      const base64Limpio = body.imagen_data.includes('base64,') 
        ? body.imagen_data.split('base64,')[1] 
        : body.imagen_data;
      
      obumaPayload.base64_foto = base64Limpio; 
      
      // B. Sanitizamos el nombre: minúsculas, sin espacios, sin paréntesis
      // Esto arregla tu error de "Modern X letter Logo (7).jpg"
      const nombreFotoLimpio = (body.imagen_nombre || `${skuLimpio}.jpg`)
        .toLowerCase()
        .replace(/\s+/g, '_')           // Espacios -> guiones bajos
        .replace(/[^a-z0-9._-]/g, '')   // Elimina ( ) y caracteres raros
        .replace(/_{2,}/g, '_');        // Evita guiones bajos dobles
        
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

    // 6. MANEJO DE RESPUESTA
    if (result.success === false || result.status === "error" || !result.id) {
      console.error("❌ Obuma rechazó los datos:", result);
      return NextResponse.json({ 
        error: result.message || 'Error de validación en Obuma',
        details: result 
      }, { status: 400 });
    }

    console.log(`✅ ¡Éxito! Producto ${skuLimpio} creado con ID: ${result.id}`);
    
    return NextResponse.json({
      success: true,
      id: result.id,
      sku: skuLimpio,
      message: "Producto y fotografía sincronizados correctamente"
    });

  } catch (error: any) {
    console.error("🔥 Error Crítico:", error);
    return NextResponse.json(
      { error: 'Error interno en el servidor', details: error.message }, 
      { status: 500 }
    );
  }
}