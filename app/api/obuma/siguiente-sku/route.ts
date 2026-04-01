import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // --- PROTECCIÓN ANTI-CRASH ---
    // Si body.nombre_completo es undefined, esto fallaría. 
    // Usamos String(...) y || "" para asegurar que siempre haya un texto.
    const nombreLimpio = String(body.nombre_completo || "").toUpperCase().trim();
    const skuLimpio = String(body.sku || "").toUpperCase().trim();
    
    // Validamos que existan los datos mínimos antes de seguir
    if (!nombreLimpio || !skuLimpio) {
      return NextResponse.json(
        { error: "El nombre y el SKU son obligatorios." },
        { status: 400 }
      );
    }

    const headers = {
      'access-token': process.env.OBUMA_API_TOKEN || '',
      'Content-Type': 'application/json'
    };

    // Mapeo de datos para la API de Obuma
    // Nota: Revisa que los nombres de los campos (items_nombre, etc) 
    // sean los que tu documentación de Obuma requiere.
    const datosParaObuma = {
      "item_nombre": nombreLimpio,
      "item_codigo": skuLimpio,
      "item_id_categoria": body.categoria_id,
      "item_id_subcategoria": body.subcategoria_id,
      "item_precio_costo": body.precio_costo || 0,
      "item_precio_venta": body.precio_venta || 0,
      "item_impuesto": body.venta_incluye_iva ? 1 : 0, // Ajustar según Obuma
      "item_stock_control": body.se_mantiene_stock ? 1 : 0,
      "item_vendible": body.se_puede_vender ? 1 : 0,
      "item_comprable": body.se_puede_comprar ? 1 : 0
    };

    // Llamada real a la API de Obuma
    const res = await fetch(`${process.env.OBUMA_API_URL}/productos.add.json`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(datosParaObuma),
    });

    const result = await res.json();

    if (!res.ok || result.status === false) {
      return NextResponse.json({ 
        error: result.message || "Obuma rechazó la creación" 
      }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });

  } catch (error: any) {
    // Aquí es donde capturamos el error para que no salga el 500 genérico
    console.error("Error Crítico en POST Productos:", error.message);
    return NextResponse.json({ 
      error: "Error en el servidor", 
      details: error.message 
    }, { status: 500 });
  }
}