// app/api/sincronizar-productos-obuma/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 INICIANDO SINCRONIZACIÓN DE PRODUCTOS DESDE OBUMA');
  console.log('='.repeat(60));
  console.log(`📅 Fecha/hora: ${new Date().toLocaleString()}`);
  
  const OBUMA_API_URL = process.env.OBUMA_API_URL;
  const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

  if (!OBUMA_API_TOKEN) {
    console.error('❌ Error: API token de Obuma no configurado');
    return NextResponse.json(
      { error: 'API token de Obuma no configurado' },
      { status: 500 }
    );
  }

  try {
    // =============================================
    // 1. Obtener TODOS los items de las órdenes de compra
    // =============================================
    console.log('\n📡 PASO 1: Obteniendo items de órdenes de compra...');
    
    const itemsResponse = await fetch(`${OBUMA_API_URL}/comprasOc.listItems.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN },
    });

    const itemsData = await itemsResponse.json();
    
    if (!itemsData.data || !Array.isArray(itemsData.data)) {
      throw new Error('No se pudieron obtener los items');
    }

    console.log(`   ✅ ${itemsData.data.length} items encontrados`);

    let totalProductos = 0;
    let totalProveedores = 0;
    let sinProveedor = 0;
    const cacheProveedores = new Map();
    const limite = Math.min(itemsData.data.length, 100); // Reducimos a 100 para pruebas

    // =============================================
    // 2. Procesar items
    // =============================================
    for (let i = 0; i < limite; i++) {
      const item = itemsData.data[i];
      const nombreProducto = item.producto_nombre || item.producto_descripcion;
      if (!nombreProducto) continue;

      // Obtener OC
      const ocId = item.compra_oc_id;
      
      // Obtener detalle de la OC
      const ocResponse = await fetch(`${OBUMA_API_URL}/comprasOc.findById.json/${ocId}`, {
        method: 'GET',
        headers: { 'access-token': OBUMA_API_TOKEN },
      });
      const ocData = await ocResponse.json();
      
      // DEBUG: Mostrar todos los campos de la primera OC
      if (i === 0) {
        console.log('\n📋 DEBUG - Campos de la primera OC:');
        console.log(Object.keys(ocData).join(', '));
        console.log('\n📋 Valores importantes:');
        console.log(`   rel_proveedor_id: ${ocData.rel_proveedor_id}`);
        console.log(`   proveedor_id: ${ocData.proveedor_id}`);
        console.log(`   proveedor_rut: ${ocData.proveedor_rut}`);
        console.log(`   proveedor_razon_social: ${ocData.proveedor_razon_social}`);
      }

      // Intentar diferentes formas de obtener el proveedor_id
      let proveedorIdObuma = ocData.rel_proveedor_id || 
                            ocData.proveedor_id || 
                            ocData.rel_proveedor_id_obuma;
      
      if (!proveedorIdObuma) {
        sinProveedor++;
        if (sinProveedor <= 5) {
          console.log(`⚠️ OC ${ocId} no tiene proveedor asociado`);
        }
        continue;
      }

      // Buscar o crear proveedor
      let proveedorId = cacheProveedores.get(proveedorIdObuma);
      
      if (!proveedorId) {
        const { data: existente } = await supabase
          .from('proveedores')
          .select('id')
          .eq('obuma_id', proveedorIdObuma)
          .maybeSingle();

        if (existente) {
          proveedorId = existente.id;
        } else {
          // Crear proveedor
          const { data: nuevo } = await supabase
            .from('proveedores')
            .insert({
              obuma_id: proveedorIdObuma,
              nombre_empresa: ocData.proveedor_razon_social || `Proveedor ${proveedorIdObuma}`,
              rut_empresa: ocData.proveedor_rut || `ID_${proveedorIdObuma}`,
              categoria: 'General',
              activo: true,
            })
            .select()
            .single();
          
          if (nuevo) {
            proveedorId = nuevo.id;
            totalProveedores++;
            console.log(`✅ Nuevo proveedor: ${nuevo.nombre_empresa} (ID Obuma: ${proveedorIdObuma})`);
          }
        }
        
        if (proveedorId) {
          cacheProveedores.set(proveedorIdObuma, proveedorId);
        }
      }

      if (!proveedorId) continue;

      // Guardar producto
      const fechaCompra = ocData.compra_oc_fecha_ingreso?.split('T')[0] || new Date().toISOString().split('T')[0];
      const precio = parseFloat(item.precio) || parseFloat(item.subtotal) || 0;

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
        if (totalProductos <= 10) {
          console.log(`   📦 Producto: "${nombreProducto.substring(0, 40)}" - $${Math.round(precio)}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADOS');
    console.log('='.repeat(60));
    console.log(`   Items procesados: ${limite}`);
    console.log(`   Proveedores nuevos: ${totalProveedores}`);
    console.log(`   Productos sincronizados: ${totalProductos}`);
    console.log(`   Items sin proveedor: ${sinProveedor}`);
    console.log('='.repeat(60));

    return NextResponse.json({
      success: true,
      estadisticas: {
        items_procesados: limite,
        proveedores_nuevos: totalProveedores,
        productos_sincronizados: totalProductos,
        items_sin_proveedor: sinProveedor,
      },
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de sincronización de productos Obuma',
    usage: 'POST /api/sincronizar-productos-obuma',
  });
}