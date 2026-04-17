// app/api/obuma/sync/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  const startTime = Date.now();
  console.log("🔄 Iniciando sincronización con Obuma...");

  try {
    // 1. Obtener todos los productos de Obuma (con paginación)
    let todosLosProductos: any[] = [];
    let pagina = 1;
    let hayMas = true;
    
    while (hayMas) {
      const url = `${process.env.OBUMA_API_URL}/productos.list.json?page=${pagina}&limit=200`;
      console.log(`📡 Consultando página ${pagina}...`);
      
      const response = await fetch(url, {
        headers: {
          'access-token': process.env.OBUMA_API_TOKEN || '',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error en Obuma: ${response.status}`);
      }
      
      const data = await response.json();
      const productos = data.data || data.productos || [];
      
      if (productos.length === 0) {
        hayMas = false;
      } else {
        todosLosProductos.push(...productos);
        console.log(`📦 Página ${pagina}: ${productos.length} productos (acumulado: ${todosLosProductos.length})`);
        pagina++;
      }
    }
    
    console.log(`✅ Obtenidos ${todosLosProductos.length} productos de Obuma`);

    // 2. Obtener stock para todos los productos
    console.log("📡 Obteniendo stock...");
    let stockMap = new Map();
    
    try {
      const stockResponse = await fetch(`${process.env.OBUMA_API_URL}/productosStock.list.json`, {
        headers: {
          'access-token': process.env.OBUMA_API_TOKEN || '',
          'Content-Type': 'application/json'
        }
      });
      
      if (stockResponse.ok) {
        const stockData = await stockResponse.json();
        const stocks = stockData.data || stockData.productos || [];
        console.log(`📦 Obtenidos ${stocks.length} registros de stock`);
        
        stocks.forEach((stock: any) => {
          const productoId = String(stock.producto_id || stock.id_producto);
          if (productoId) {
            stockMap.set(productoId, {
              stock_actual: stock.stock_actual || stock.cantidad || 0,
              stock_minimo: stock.stock_minimo || 0,
              stock_maximo: stock.stock_maximo || 0,
              bodega: stock.bodega_nombre || ''
            });
          }
        });
      }
    } catch (stockError) {
      console.error("Error obteniendo stock, continuando sin stock:", stockError);
    }
    
    console.log(`✅ Mapa de stock creado con ${stockMap.size} productos`);

    // 3. Transformar y guardar en Supabase (producto por producto para mejor control)
    let guardados = 0;
    let errores = 0;
    const erroresDetalle: any[] = [];
    
    for (let i = 0; i < todosLosProductos.length; i++) {
      const prod = todosLosProductos[i];
      
      try {
        const stockInfo = stockMap.get(String(prod.producto_id)) || {};
        const precioTotal = Number(prod.producto_precio_clp_total) || 0;
        const precioNeto = Math.round(precioTotal / 1.19);
        
        const productoParaBD = {
          id: String(prod.producto_id),
          sku: prod.producto_codigo_comercial || `SKU_${prod.producto_id}`,
          nombre: prod.producto_nombre || 'Sin nombre',
          descripcion: prod.producto_descripcion || '',
          descripcion_larga: prod.producto_descripcion_larga || '',
          tipo: prod.producto_tipo === '2' ? 'Servicio' : 'Producto',
          categoria_id: prod.producto_categoria || '',
          categoria_nombre: prod.categoria_nombre || '',
          subcategoria_id: prod.producto_subcategoria || '',
          subcategoria_nombre: prod.subcategoria_nombre || '',
          fabricante_id: prod.producto_fabricante || '',
          fabricante_nombre: prod.fabricante_nombre || '',
          precio_costo: Number(prod.producto_costo_clp_neto) || 0,
          precio_neto: precioNeto,
          precio_iva: precioTotal - precioNeto,
          precio_total: precioTotal,
          stock_actual: stockInfo.stock_actual || 0,
          stock_minimo: stockInfo.stock_minimo || 0,
          stock_maximo: stockInfo.stock_maximo || 0,
          bodega: stockInfo.bodega || '',
          inventariable: prod.producto_inventariable === '1',
          para_venta: prod.producto_para_venta === '1',
          para_compra: prod.producto_para_compra === '1',
          vender_en_web: prod.producto_vender_en_web === '1',
          codigo_barra: prod.producto_codigo_barra || '',
          url_imagen: prod.producto_imagen || '',
          activo: prod.producto_activo === '1',
          ultima_sincronizacion: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('productos_obuma')
          .upsert(productoParaBD, { onConflict: 'id' });
        
        if (error) {
          console.error(`❌ Error guardando producto ${prod.producto_id}:`, error.message);
          errores++;
          erroresDetalle.push({
            id: prod.producto_id,
            nombre: prod.producto_nombre,
            error: error.message
          });
        } else {
          guardados++;
        }
        
        // Log cada 100 productos
        if ((i + 1) % 100 === 0) {
          console.log(`📊 Progreso: ${i + 1}/${todosLosProductos.length} productos procesados (${guardados} guardados, ${errores} errores)`);
        }
        
      } catch (err) {
        console.error(`❌ Error procesando producto ${prod.producto_id}:`, err);
        errores++;
        erroresDetalle.push({
          id: prod.producto_id,
          nombre: prod.producto_nombre,
          error: String(err)
        });
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Sincronización completada en ${duration}ms: ${guardados} guardados, ${errores} errores`);
    
    if (erroresDetalle.length > 0) {
      console.log(`📋 Primeros 10 errores:`, erroresDetalle.slice(0, 10));
    }
    
    return NextResponse.json({
      success: true,
      sincronizados: guardados,
      errores: errores,
      total_productos: todosLosProductos.length,
      duracion_ms: duration,
      errores_detalle: erroresDetalle.slice(0, 20), // Máximo 20 detalles
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("❌ Error en sincronización:", error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Error al sincronizar con Obuma', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Endpoint GET para verificar estado de la tabla
export async function GET() {
  try {
    // Obtener cantidad de productos sincronizados
    const { count, error: countError } = await supabase
      .from('productos_obuma')
      .select('*', { count: 'exact', head: true });
    
    // Obtener última sincronización
    const { data: lastSync, error: syncError } = await supabase
      .from('productos_obuma')
      .select('ultima_sincronizacion')
      .order('ultima_sincronizacion', { ascending: false })
      .limit(1);
    
    return NextResponse.json({
      sincronizado: !countError,
      total_productos: count || 0,
      ultima_sincronizacion: lastSync?.[0]?.ultima_sincronizacion || null,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error al verificar estado', details: error.message },
      { status: 500 }
    );
  }
}