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
    let sinRUT = 0;
    let sinProveedorEncontrado = 0;
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

        // 2.3 Obtener el RUT del proveedor (probar diferentes campos)
        let rutProveedor = ocData.proveedor_rut;
        
        if (!rutProveedor && ocData.rel_proveedor_id) {
          // Intentar obtener el proveedor por ID
          const proveedorResponse = await fetch(`${OBUMA_API_URL}/proveedores.findById.json/${ocData.rel_proveedor_id}`, {
            method: 'GET',
            headers: {
              'access-token': OBUMA_API_TOKEN,
              'Content-Type': 'application/json',
            },
          });
          const proveedorData = await proveedorResponse.json();
          rutProveedor = proveedorData.proveedor_rut;
          console.log(`   🔍 Buscando proveedor por ID ${ocData.rel_proveedor_id}: RUT encontrado = ${rutProveedor}`);
        }
        
        if (!rutProveedor) {
          sinRUT++;
          if (sinRUT <= 5) {
            console.log(`   ⚠️ Item ${totalItemsProcesados}: OC ${ocId} no tiene RUT de proveedor`);
            console.log(`      Campos disponibles en ocData:`, Object.keys(ocData).join(', '));
          }
          continue;
        }

        // Limpiar el RUT (eliminar espacios y convertir a mayúsculas)
        rutProveedor = rutProveedor.trim().toUpperCase();
        const razonSocial = ocData.proveedor_razon_social || `Proveedor ${rutProveedor}`;
        
        if (totalItemsProcesados <= 10) {
          console.log(`   🏢 Item ${totalItemsProcesados}: RUT="${rutProveedor}", Producto="${nombreProducto.substring(0, 40)}..."`);
        }
        
        // 2.4 Buscar el proveedor en Supabase por RUT
        let proveedorId = null;
        
        const { data: proveedorExistente, error: searchError } = await supabase
          .from('proveedores')
          .select('id, nombre_empresa, rut_empresa')
          .eq('rut_empresa', rutProveedor)
          .maybeSingle(); // Cambiar de .single() a .maybeSingle()

        if (searchError) {
          console.error(`   ❌ Error buscando proveedor: ${searchError.message}`);
        }

        if (proveedorExistente) {
          proveedorId = proveedorExistente.id;
          totalProveedoresActualizados++;
          if (totalItemsProcesados <= 10) {
            console.log(`      ✅ Proveedor encontrado: ${proveedorExistente.nombre_empresa} (${proveedorExistente.rut_empresa})`);
          }
        } else {
          // Intentar buscar por RUT formateado (sin puntos ni guión)
          const rutLimpio = rutProveedor.replace(/\./g, '').replace(/-/g, '');
          const { data: proveedorPorRutLimpio } = await supabase
            .from('proveedores')
            .select('id, nombre_empresa')
            .eq('rut_empresa', rutLimpio)
            .maybeSingle();
          
          if (proveedorPorRutLimpio) {
            proveedorId = proveedorPorRutLimpio.id;
            totalProveedoresActualizados++;
            console.log(`      ✅ Proveedor encontrado por RUT limpio: ${proveedorPorRutLimpio.nombre_empresa}`);
          } else {
            sinProveedorEncontrado++;
            if (sinProveedorEncontrado <= 10) {
              console.log(`      ❌ Proveedor NO encontrado para RUT: "${rutProveedor}"`);
              console.log(`         Razón social en Obuma: "${razonSocial}"`);
            }
            continue;
          }
        }

        if (!proveedorId) continue;

        // =============================================
        // 3. Guardar el producto en proveedor_productos
        // =============================================
        const fechaCompra = ocData.compra_oc_fecha_ingreso?.split('T')[0] || new Date().toISOString().split('T')[0];
        const precioActual = parseFloat(item.precio) || parseFloat(item.subtotal) || 0;
        const sku = item.codigo_comercial || '';

        // Verificar si ya existe la relación
        const { data: existente } = await supabase
          .from('proveedor_productos')
          .select('id')
          .eq('proveedor_id', proveedorId)
          .eq('producto_nombre', nombreProducto)
          .maybeSingle();

        if (!existente) {
          const { error: insertError } = await supabase
            .from('proveedor_productos')
            .insert({
              proveedor_id: proveedorId,
              producto_nombre: nombreProducto,
              producto_sku: sku,
              ultimo_precio: Math.round(precioActual),
              fecha_ultima_compra: fechaCompra,
              created_at: new Date().toISOString(),
            });
          
          if (!insertError) {
            totalProductosSincronizados++;
            if (totalProductosSincronizados <= 20) {
              console.log(`      ✅ Producto INSERTADO: "${nombreProducto.substring(0, 50)}" - $${Math.round(precioActual)}`);
            }
          } else {
            console.error(`      ❌ Error insertando producto: ${insertError.message}`);
            errores.push({
              producto: nombreProducto,
              error: insertError.message
            });
          }
        } else {
          // Producto ya existe, actualizar precio y fecha
          const { error: updateError } = await supabase
            .from('proveedor_productos')
            .update({
              ultimo_precio: Math.round(precioActual),
              fecha_ultima_compra: fechaCompra,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existente.id);
          
          if (!updateError && totalProductosSincronizados <= 20) {
            console.log(`      🔄 Producto ACTUALIZADO: "${nombreProducto.substring(0, 50)}" - $${Math.round(precioActual)}`);
          }
        }
        
      } catch (itemError: any) {
        console.error(`   ❌ Error procesando item: ${itemError.message}`);
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
    console.log(`   🏢 Proveedores actualizados: ${totalProveedoresActualizados}`);
    console.log(`   🏢 Proveedores nuevos creados: ${totalProveedoresCreados}`);
    console.log(`   📋 Productos sincronizados: ${totalProductosSincronizados}`);
    console.log(`   ⚠️ Items sin RUT de proveedor: ${sinRUT}`);
    console.log(`   ⚠️ Proveedores no encontrados en BD: ${sinProveedorEncontrado}`);
    console.log(`   💾 OC en caché: ${cacheOC.size}`);
    console.log(`   ❌ Errores: ${errores.length}`);
    console.log('='.repeat(60));
    console.log('🏁 SINCRONIZACIÓN FINALIZADA\n');

    return NextResponse.json({
      success: true,
      estadisticas: {
        items_procesados: totalItemsProcesados,
        proveedores_actualizados: totalProveedoresActualizados,
        proveedores_nuevos: totalProveedoresCreados,
        productos_sincronizados: totalProductosSincronizados,
        items_sin_rut: sinRUT,
        proveedores_no_encontrados: sinProveedorEncontrado,
        oc_en_cache: cacheOC.size,
        errores: errores.length
      },
      errores: errores.slice(0, 10),
      mensaje: 'Sincronización completada'
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