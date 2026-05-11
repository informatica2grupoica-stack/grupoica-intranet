// app/api/sincronizar-productos-obuma/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 SINCRONIZACIÓN DE PRODUCTOS DESDE OBUMA - VERSIÓN CORREGIDA');
  console.log('='.repeat(60));
  
  const OBUMA_API_URL = process.env.OBUMA_API_URL;
  const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

  if (!OBUMA_API_TOKEN) {
    return NextResponse.json({ error: 'API token no configurado' }, { status: 500 });
  }

  try {
    // =============================================
    // 1. Obtener items directamente (esto funciona)
    // =============================================
    console.log('📡 Obteniendo items de órdenes de compra...');
    
    const itemsResponse = await fetch(`${OBUMA_API_URL}/comprasOc.listItems.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN },
    });
    const itemsData = await itemsResponse.json();
    
    console.log(`✅ ${itemsData.data.length} items encontrados`);

    let totalProductos = 0;
    let totalProveedores = 0;
    const proveedoresCache = new Map();

    // =============================================
    // 2. Procesar items agrupando por proveedor_id que viene directo en el item
    // =============================================
    console.log('\n🔄 Procesando items...');
    
    // Primero, agrupar items por proveedor_id (si viene en el item)
    const itemsPorProveedor = new Map();
    
    for (const item of itemsData.data.slice(0, 500)) {
      // Intentar obtener proveedor_id del item
      let proveedorIdObuma = item.rel_proveedor_id || item.proveedor_id;
      
      if (!proveedorIdObuma) {
        continue;
      }
      
      if (!itemsPorProveedor.has(proveedorIdObuma)) {
        itemsPorProveedor.set(proveedorIdObuma, []);
      }
      itemsPorProveedor.get(proveedorIdObuma).push(item);
    }
    
    console.log(`📦 ${itemsPorProveedor.size} proveedores encontrados en los items`);

    // =============================================
    // 3. Procesar cada proveedor y sus productos
    // =============================================
    for (const [proveedorIdObuma, items] of itemsPorProveedor) {
      console.log(`\n🏢 Procesando proveedor ID: ${proveedorIdObuma} (${items.length} productos)`);
      
      // Buscar o crear proveedor
      let proveedorId = proveedoresCache.get(proveedorIdObuma);
      
      if (!proveedorId) {
        const { data: existente } = await supabase
          .from('proveedores')
          .select('id')
          .eq('obuma_id', proveedorIdObuma)
          .maybeSingle();

        if (existente) {
          proveedorId = existente.id;
          console.log(`   ✅ Proveedor ya existe en Supabase`);
        } else {
          // Intentar obtener datos del proveedor
          let nombreProveedor = `Proveedor ${proveedorIdObuma}`;
          let rutProveedor = `ID_${proveedorIdObuma}`;
          
          try {
            const provResponse = await fetch(`${OBUMA_API_URL}/proveedores.findById.json/${proveedorIdObuma}`, {
              method: 'GET',
              headers: { 'access-token': OBUMA_API_TOKEN },
            });
            const provData = await provResponse.json();
            
            // Verificar si la respuesta tiene datos del proveedor
            if (provData.proveedor_razon_social) {
              nombreProveedor = provData.proveedor_razon_social;
              rutProveedor = provData.proveedor_rut || rutProveedor;
              console.log(`   📋 Datos obtenidos: ${nombreProveedor}`);
            } else {
              console.log(`   ⚠️ No se pudieron obtener datos del proveedor ${proveedorIdObuma}`);
            }
          } catch (err) {
            console.log(`   ⚠️ Error obteniendo datos del proveedor: ${err}`);
          }
          
          const { data: nuevo, error: createError } = await supabase
            .from('proveedores')
            .insert({
              obuma_id: proveedorIdObuma,
              nombre_empresa: nombreProveedor,
              rut_empresa: rutProveedor,
              categoria: 'General',
              activo: true,
            })
            .select()
            .single();
          
          if (createError) {
            console.error(`   ❌ Error creando proveedor: ${createError.message}`);
            continue;
          }
          
          if (nuevo) {
            proveedorId = nuevo.id;
            totalProveedores++;
            console.log(`   ✅ Nuevo proveedor creado: ${nombreProveedor}`);
          }
        }
        
        if (proveedorId) {
          proveedoresCache.set(proveedorIdObuma, proveedorId);
        }
      }
      
      if (!proveedorId) continue;
      
      // Procesar productos de este proveedor
      for (const item of items) {
        const nombreProducto = item.producto_nombre || item.producto_descripcion;
        if (!nombreProducto) continue;
        
        const precio = parseFloat(item.precio) || parseFloat(item.subtotal) || 0;
        const fechaCompra = new Date().toISOString().split('T')[0];
        
        const { error: insertError } = await supabase
          .from('proveedor_productos')
          .upsert({
            proveedor_id: proveedorId,
            producto_nombre: nombreProducto,
            producto_sku: item.codigo_comercial || '',
            ultimo_precio: Math.round(precio),
            fecha_ultima_compra: fechaCompra,
          }, {
            onConflict: 'proveedor_id, producto_nombre',
          });
        
        if (!insertError) {
          totalProductos++;
          if (totalProductos <= 30) {
            console.log(`   📦 Producto: "${nombreProducto.substring(0, 40)}" - $${Math.round(precio)}`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADOS FINALES');
    console.log('='.repeat(60));
    console.log(`   Proveedores nuevos: ${totalProveedores}`);
    console.log(`   Productos sincronizados: ${totalProductos}`);
    console.log('='.repeat(60));

    return NextResponse.json({
      success: true,
      estadisticas: {
        proveedores_nuevos: totalProveedores,
        productos_sincronizados: totalProductos,
      },
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}