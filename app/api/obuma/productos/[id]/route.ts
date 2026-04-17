// app/api/obuma/productos/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    console.log(`📤 Actualizando producto ${id}:`, body);

    // Validaciones básicas
    if (!id) {
      return NextResponse.json({ error: 'ID de producto no proporcionado' }, { status: 400 });
    }

    if (!body.nombre_completo || !body.sku) {
      return NextResponse.json({ error: 'Faltan datos requeridos: nombre o SKU' }, { status: 400 });
    }

    // 1. LÓGICA DE IMPUESTOS (IVA Chile 19%)
    const precioVentaBruto = Number(body.precio_venta) || 0;
    const precioCostoBruto = Number(body.precio_costo) || 0;

    const precioVentaNeto = body.venta_incluye_iva 
      ? Math.round(precioVentaBruto / 1.19) 
      : precioVentaBruto;

    const precioCostoNeto = body.costo_incluye_iva 
      ? Math.round(precioCostoBruto / 1.19) 
      : precioCostoBruto;

    const ivaVenta = precioVentaBruto - precioVentaNeto;

    // 2. CONSTRUCCIÓN DEL PAYLOAD PARA UPDATE EN OBUMA
    const obumaPayload: any = {
      producto_id: id,
      producto_nombre: body.nombre_completo.toUpperCase().trim(),
      producto_tipo: body.tipo === "Servicio" ? "2" : "1",
      producto_codigo_comercial: body.sku,
      
      // Clasificación
      producto_categoria: body.categoria_id?.toString() || "",
      producto_subcategoria: body.subcategoria_id?.toString() || "",
      
      // Precios y Costos
      producto_costo_clp_neto: precioCostoNeto.toString(),
      producto_costo_clp_neto_estandar: precioCostoNeto.toString(),
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: precioVentaBruto.toString(),
      
      // Flags de Estado
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      producto_activo: "1",
      
      sucursal_id: "1"
    };

    // Agregar campos opcionales si existen
    if (body.codigo_barra) obumaPayload.producto_codigo_barra = body.codigo_barra;
    if (body.descripcion) obumaPayload.producto_descripcion = body.descripcion;
    if (body.descripcion_larga) obumaPayload.producto_descripcion_larga = body.descripcion_larga;

    console.log("📤 Payload para Obuma:", obumaPayload);

    // 3. ENVÍO A OBUMA
    const response = await fetch(`${process.env.OBUMA_API_URL}/productos.update.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(obumaPayload),
    });

    const result = await response.json();

    if (result.success === false || result.status === false) {
      console.error("❌ Error Obuma:", result);
      return NextResponse.json({ 
        error: result.message || 'Error al actualizar en Obuma',
        details: result 
      }, { status: 400 });
    }

    console.log("✅ Producto actualizado en Obuma correctamente");

    // 4. SINCRONIZAR CON SUPABASE
    let supabaseError = null;
    try {
      // Obtener el producto actualizado desde Obuma
      const fetchRes = await fetch(`${process.env.OBUMA_API_URL}/productos.list.json?id=${id}`, {
        headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
      });
      const fetchData = await fetchRes.json();
      const productoActualizado = (fetchData.data || fetchData.productos || [])[0];

      if (productoActualizado) {
        const { error } = await supabase
          .from('productos_obuma')
          .upsert({
            id: String(productoActualizado.producto_id),
            sku: productoActualizado.producto_codigo_comercial || body.sku,
            nombre: productoActualizado.producto_nombre || body.nombre_completo,
            tipo: productoActualizado.producto_tipo === '2' ? 'Servicio' : 'Producto',
            categoria_nombre: productoActualizado.categoria_nombre || '',
            subcategoria_nombre: productoActualizado.subcategoria_nombre || '',
            precio_total: Number(productoActualizado.producto_precio_clp_total) || precioVentaBruto,
            precio_neto: Number(productoActualizado.producto_precio_clp_neto) || precioVentaNeto,
            activo: true,
            para_venta: productoActualizado.producto_para_venta === '1',
            para_compra: productoActualizado.producto_para_compra === '1',
            inventariable: productoActualizado.producto_inventariable === '1',
            ultima_sincronizacion: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        
        if (error) {
          supabaseError = error.message;
          console.error("⚠️ Error sincronizando con Supabase:", error);
        } else {
          console.log("✅ Producto sincronizado con Supabase");
        }
      }
    } catch (syncError) {
      console.error("⚠️ Error en sincronización:", syncError);
      supabaseError = String(syncError);
    }

    // 5. RESPUESTA FINAL
    return NextResponse.json({ 
      success: true,
      message: "Producto actualizado exitosamente",
      data: result.data || result,
      supabase_sync: !supabaseError,
      supabase_error: supabaseError
    });

  } catch (error: any) {
    console.error("🔥 Error crítico en Update:", error);
    return NextResponse.json(
      { 
        error: 'Error crítico de servidor', 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}

// Método GET para obtener un producto específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const response = await fetch(`${process.env.OBUMA_API_URL}/productos.list.json?id=${id}`, {
      method: 'GET',
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    const producto = (data.data || data.productos || [])[0];
    
    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }
    
    // Obtener stock actual
    let stockActual = 0;
    try {
      const stockRes = await fetch(`${process.env.OBUMA_API_URL}/productosStock.findById.json/${id}`, {
        headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
      });
      const stockData = await stockRes.json();
      stockActual = stockData.stock_actual || stockData.cantidad || 0;
    } catch (stockError) {
      console.warn("No se pudo obtener stock:", stockError);
    }
    
    const precioTotal = Number(producto.producto_precio_clp_total) || 0;
    const precioNeto = Math.round(precioTotal / 1.19);
    
    return NextResponse.json({
      success: true,
      producto: {
        id: producto.producto_id,
        sku: producto.producto_codigo_comercial,
        nombre: producto.producto_nombre,
        tipo: producto.producto_tipo === '2' ? 'Servicio' : 'Producto',
        categoria_id: producto.producto_categoria,
        categoria_nombre: producto.categoria_nombre,
        subcategoria_id: producto.producto_subcategoria,
        subcategoria_nombre: producto.subcategoria_nombre,
        precio_costo: Number(producto.producto_costo_clp_neto) || 0,
        precio_neto: precioNeto,
        precio_total: precioTotal,
        stock_actual: stockActual,
        para_venta: producto.producto_para_venta === '1',
        para_compra: producto.producto_para_compra === '1',
        inventariable: producto.producto_inventariable === '1'
      }
    });
    
  } catch (error: any) {
    console.error("Error obteniendo producto:", error);
    return NextResponse.json(
      { error: 'Error al obtener producto', details: error.message },
      { status: 500 }
    );
  }
}