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

  console.log(`🔑 OBUMA_API_TOKEN configurado: ${OBUMA_API_TOKEN ? 'SÍ' : 'NO'}`);
  console.log(`🌐 OBUMA_API_URL: ${OBUMA_API_URL}`);

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
    console.log(`   🔗 Endpoint: ${OBUMA_API_URL}/comprasOc.listItems.json`);
    
    const itemsResponse = await fetch(`${OBUMA_API_URL}/comprasOc.listItems.json`, {
      method: 'GET',
      headers: {
        'access-token': OBUMA_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    console.log(`   📊 Response status: ${itemsResponse.status}`);
    
    const itemsData = await itemsResponse.json();
    
    if (!itemsData.data || !Array.isArray(itemsData.data)) {
      console.error('❌ Error: No se pudieron obtener los items de las órdenes de compra');
      throw new Error('No se pudieron obtener los items de las órdenes de compra');
    }

    console.log(`   ✅ ${itemsData.data.length} items encontrados en órdenes de compra`);
    
    if (itemsData.data.length > 0) {
      console.log(`   📋 Ejemplo de item:`, JSON.stringify(itemsData.data[0], null, 2).substring(0, 400));
    }

    let totalProductosSincronizados = 0;
    let totalProveedoresCreados = 0;
    let totalProveedoresActualizados = 0;
    let totalItemsProcesados = 0;
    const errores = [];
    
    // Cache para no llamar a la misma OC varias veces
    const cacheOC = new Map();

    // =============================================
    // 2. Procesar cada item (máximo 500 para evitar timeout)
    // =============================================
    console.log('\n🔄 PASO 2: Procesando items...');
    const limite = Math.min(itemsData.data.length, 500);
    console.log(`   📦 Procesando primeros ${limite} items`);
    
    for (let i = 0; i < limite; i++) {
      const item = itemsData.data[i];
      
      try {
        totalItemsProcesados++;
        
        if (totalItemsProcesados % 50 === 0) {
          console.log(`   📊 Progreso: ${totalItemsProcesados}/${limite} items procesados...`);
        }
        
        // 2.1 Obtener el producto del item
        const nombreProducto = item.producto_nombre || item.producto_descripcion;
        if (!nombreProducto) {
          continue;
        }

        // 2.2 Obtener datos de la OC (usando caché)
        const ocId = item.compra_oc_id;
        let ocData = cacheOC.get(ocId);
        
        if (!ocData) {
          const detalleResponse = await fetch(`${OBUMA_API_URL}/comprasOc.findById.json/${ocId}`, {
            method: 'GET',
            headers: {
              'access-token': OBUMA_API_TOKEN,
              'Content-Type': 'application/json',
            },
          });
          ocData = await detalleResponse.json();
          cacheOC.set(ocId, ocData);
        }

        // 2.3 Obtener el RUT del proveedor
        const rutProveedor = ocData.proveedor_rut || 
                            (ocData.rel_proveedor_id ? `ID_${ocData.rel_proveedor_id}` : null);
        
        if (!rutProveedor) {
          continue;
        }

        const razonSocial = ocData.proveedor_razon_social || `Proveedor ${rutProveedor}`;
        
        // 2.4 Buscar o crear el proveedor en Supabase
        let proveedorId = null;
        
        const { data: proveedorExistente } = await supabase
          .from('proveedores')
          .select('id, nombre_empresa')
          .eq('rut_empresa', rutProveedor)
          .single();

        if (proveedorExistente) {
          proveedorId = proveedorExistente.id;
          totalProveedoresActualizados++;
        } else {
          const { data: nuevoProveedor, error: createError } = await supabase
            .from('proveedores')
            .insert({
              nombre_empresa: razonSocial,
              rut_empresa: rutProveedor,
              direccion: ocData.proveedor_direccion || '',
              telefono: ocData.proveedor_telefono || '',
              email_contacto: ocData.proveedor_email || '',
              categoria: 'General',
              activo: true,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();
          
          if (createError) {
            errores.push({
              proveedor: razonSocial,
              rut: rutProveedor,
              error: createError.message
            });
            continue;
          }
          
          if (nuevoProveedor) {
            proveedorId = nuevoProveedor.id;
            totalProveedoresCreados++;
          }
        }

        if (!proveedorId) continue;

        // =============================================
        // 3. Guardar el producto en proveedor_productos
        // =============================================
        const fechaCompra = ocData.compra_oc_fecha_ingreso?.split('T')[0] || new Date().toISOString().split('T')[0];
        const precioActual = item.precio || item.subtotal || 0;
        const sku = item.codigo_comercial || '';

        // Verificar si ya existe la relación
        const { data: existente } = await supabase
          .from('proveedor_productos')
          .select('id, ultimo_precio, fecha_ultima_compra')
          .eq('proveedor_id', proveedorId)
          .eq('producto_nombre', nombreProducto)
          .single();

        if (!existente) {
          const { error: insertError } = await supabase
            .from('proveedor_productos')
            .insert({
              proveedor_id: proveedorId,
              producto_nombre: nombreProducto,
              producto_sku: sku,
              ultimo_precio: precioActual,
              fecha_ultima_compra: fechaCompra,
              created_at: new Date().toISOString(),
            });
          
          if (!insertError) {
            totalProductosSincronizados++;
          }
        } else {
          const fechaExistente = existente.fecha_ultima_compra || '1900-01-01';
          if (precioActual !== existente.ultimo_precio || fechaCompra > fechaExistente) {
            const { error: updateError } = await supabase
              .from('proveedor_productos')
              .update({
                ultimo_precio: precioActual,
                fecha_ultima_compra: fechaCompra,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existente.id);
          }
        }
        
      } catch (itemError: any) {
        errores.push({
          item_id: item.compra_item_id,
          error: itemError.message
        });
      }
    }

    // =============================================
    // 4. Respuesta final
    // =============================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 ESTADÍSTICAS FINALES DE SINCRONIZACIÓN');
    console.log('='.repeat(60));
    console.log(`   📦 Items procesados: ${totalItemsProcesados}`);
    console.log(`   🏢 Proveedores nuevos: ${totalProveedoresCreados}`);
    console.log(`   🏢 Proveedores actualizados: ${totalProveedoresActualizados}`);
    console.log(`   📋 Productos sincronizados: ${totalProductosSincronizados}`);
    console.log(`   💾 OC en caché: ${cacheOC.size}`);
    console.log(`   ❌ Errores: ${errores.length}`);
    console.log('='.repeat(60));
    console.log('🏁 SINCRONIZACIÓN FINALIZADA\n');

    return NextResponse.json({
      success: true,
      estadisticas: {
        items_procesados: totalItemsProcesados,
        proveedores_nuevos: totalProveedoresCreados,
        proveedores_actualizados: totalProveedoresActualizados,
        productos_sincronizados: totalProductosSincronizados,
        oc_en_cache: cacheOC.size,
        errores: errores.length
      },
      errores: errores.slice(0, 10),
      mensaje: 'Sincronización completada exitosamente'
    });

  } catch (error: any) {
    console.error('❌ Error fatal en sincronización:', error.message);
    console.error(error.stack);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        mensaje: 'Error al sincronizar productos desde Obuma'
      },
      { status: 500 }
    );
  }
}

// Endpoint GET para verificar que el servicio está activo
export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de sincronización de productos Obuma',
    usage: 'POST /api/sincronizar-productos-obuma',
    description: 'Sincroniza productos desde los items de órdenes de compra de Obuma a Supabase'
  });
}