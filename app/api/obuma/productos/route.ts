import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // 2. VERIFICAR DUPLICADO ANTES DE CREAR
    try {
      const { data: existentes, error: searchError } = await supabase
        .from('productos_obuma')
        .select('nombre, sku')
        .ilike('nombre', `%${nombreLimpio}%`)
        .limit(3);

      if (!searchError && existentes && existentes.length > 0) {
        const duplicados = existentes.map(p => `${p.nombre} (SKU: ${p.sku})`).join(', ');
        return NextResponse.json(
          { 
            error: `⚠️ Posible producto duplicado. Ya existe: ${duplicados}. ¿Deseas continuar?`,
            duplicados: existentes,
            requiereConfirmacion: true
          },
          { status: 409 }
        );
      }
    } catch (dupError) {
      console.warn("Error verificando duplicados:", dupError);
      // Continuamos con la creación
    }

    // 3. LÓGICA DE IMPUESTOS (IVA CHILE 1.19)
    const precioVentaInput = Number(body.precio_venta) || 0;
    const precioCostoInput = Number(body.precio_costo) || 0;

    let precioVentaNeto: number;
    let precioVentaBruto: number;

    if (body.venta_incluye_iva) {
      precioVentaBruto = precioVentaInput;
      precioVentaNeto = Math.round(precioVentaBruto / 1.19);
    } else {
      precioVentaNeto = precioVentaInput;
      precioVentaBruto = Math.round(precioVentaNeto * 1.19);
    }

    const ivaVenta = precioVentaBruto - precioVentaNeto;

    const precioCostoNeto = body.costo_incluye_iva 
      ? Math.round(precioCostoInput / 1.19) 
      : precioCostoInput;

    // 4. CONSTRUCCIÓN DEL PAYLOAD PARA OBUMA
    const obumaPayload = {
      producto_nombre: nombreLimpio,
      producto_tipo: tipoProducto, 
      producto_activo: "1",
      producto_codigo_comercial: skuLimpio,
      
      producto_categoria: String(body.categoria_id || ""),
      producto_subcategoria: String(body.subcategoria_id || ""),
      
      producto_impuesto_id: "1", 
      
      producto_costo_clp_neto: precioCostoNeto.toString(),
      producto_costo_clp_neto_estandar: precioCostoNeto.toString(),
      
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: precioVentaBruto.toString(),
      
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      producto_vender_en_web: body.producto_vender_en_web ? "1" : "0",
      
      sucursal_id: "1" 
    };

    console.log("📤 Payload calculado para Obuma:", obumaPayload);

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
    if (!response.ok || result.success === false || result.status === false) {
      console.error("❌ Error Obuma:", result);
      return NextResponse.json({ 
        error: result.message || 'Obuma rechazó los datos',
        details: result 
      }, { status: 400 });
    }

    // 7. SINCRONIZAR AUTOMÁTICAMENTE EL NUEVO PRODUCTO A SUPABASE
    let nuevoProductoEnSupabase = null;
    try {
      // Obtener el producto recién creado desde Obuma
      const productoId = result.data?.producto_id || result.producto_id;
      if (productoId) {
        const fetchProducto = await fetch(`${process.env.OBUMA_API_URL}/productos.list.json?id=${productoId}`, {
          headers: {
            'access-token': process.env.OBUMA_API_TOKEN || '',
          }
        });
        const productoData = await fetchProducto.json();
        const productoObuma = (productoData.data || productoData.productos || [])[0];
        
        if (productoObuma) {
          // Calcular precios
          const precioTotal = Number(productoObuma.producto_precio_clp_total) || precioVentaBruto;
          const precioNeto = Math.round(precioTotal / 1.19);
          
          // Guardar en Supabase
          const { data: inserted, error: insertError } = await supabase
            .from('productos_obuma')
            .upsert({
              id: String(productoObuma.producto_id),
              sku: productoObuma.producto_codigo_comercial || skuLimpio,
              nombre: productoObuma.producto_nombre || nombreLimpio,
              tipo: productoObuma.producto_tipo === '2' ? 'Servicio' : 'Producto',
              categoria_nombre: productoObuma.categoria_nombre || '',
              subcategoria_nombre: productoObuma.subcategoria_nombre || '',
              precio_total: precioTotal,
              precio_neto: precioNeto,
              stock_actual: 0,
              activo: true,
              para_venta: productoObuma.producto_para_venta === '1',
              para_compra: productoObuma.producto_para_compra === '1',
              inventariable: productoObuma.producto_inventariable === '1',
              vender_en_web: productoObuma.producto_vender_en_web === '1',
              ultima_sincronizacion: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
          
          if (!insertError) {
            nuevoProductoEnSupabase = inserted;
            console.log("✅ Producto sincronizado a Supabase automáticamente");
          }
        }
      }
    } catch (syncError) {
      console.error("⚠️ Error sincronizando a Supabase:", syncError);
      // No fallamos la creación si falla la sincronización
    }

    console.log("✅ Producto creado en Obuma correctamente");
    
    return NextResponse.json({ 
      success: true,
      message: "Producto creado exitosamente",
      data: result.data || result,
      sincronizado_a_supabase: !!nuevoProductoEnSupabase,
      producto: nuevoProductoEnSupabase
    });

  } catch (error: any) {
    console.error("🔥 Error Crítico en Backend:", error);
    return NextResponse.json(
      { error: 'Error interno en el servidor', details: error.message }, 
      { status: 500 }
    );
  }
}