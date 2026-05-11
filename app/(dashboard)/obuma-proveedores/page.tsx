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
    // 1. Obtener todas las órdenes de compra de Obuma
    // =============================================
    console.log('\n📡 PASO 1: Obteniendo órdenes de compra...');
    
    const ocResponse = await fetch(`${OBUMA_API_URL}/comprasOc.list.json`, {
      method: 'GET',
      headers: {
        'access-token': OBUMA_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    console.log(`   📊 Response status: ${ocResponse.status}`);
    
    const ocData = await ocResponse.json();
    
    if (!ocData.data || !Array.isArray(ocData.data)) {
      console.error('❌ Error: No se pudieron obtener las órdenes de compra');
      throw new Error('No se pudieron obtener las órdenes de compra');
    }

    console.log(`   ✅ ${ocData.data.length} órdenes de compra encontradas en Obuma`);

    let totalProductosSincronizados = 0;
    let totalProveedoresCreados = 0;
    let totalProveedoresActualizados = 0;
    let totalOCsProcesadas = 0;
    const errores = [];

    // =============================================
    // 2. Procesar cada orden de compra (máximo 20 para evitar timeout)
    // =============================================
    console.log('\n🔄 PASO 2: Procesando órdenes de compra...');
    const limite = Math.min(ocData.data.length, 20);
    console.log(`   📦 Procesando primeras ${limite} órdenes (para evitar timeout)`);
    
    for (let i = 0; i < limite; i++) {
      const oc = ocData.data[i];
      console.log(`\n   --- OC ${i+1}/${limite} ---`);
      console.log(`   ID: ${oc.compra_oc_id}, Folio: ${oc.compra_oc_folio}, Estado: ${oc.compra_oc_estado}`);
      
      try {
        // 2.1 Obtener detalle de la OC (productos)
        console.log(`   📡 Obteniendo detalle de OC ${oc.compra_oc_id}...`);
        
        const detalleResponse = await fetch(`${OBUMA_API_URL}/comprasOc.findById.json/${oc.compra_oc_id}`, {
          method: 'GET',
          headers: {
            'access-token': OBUMA_API_TOKEN,
            'Content-Type': 'application/json',
          },
        });

        const detalle = await detalleResponse.json();
        
        if (!detalle.compra_detalle || detalle.compra_detalle.length === 0) {
          console.log(`   ⚠️ No tiene productos asociados`);
          continue;
        }

        console.log(`   📦 Productos en esta OC: ${detalle.compra_detalle.length}`);
        totalOCsProcesadas++;

        // 2.2 Buscar o crear el proveedor en Supabase por RUT
        console.log(`   🏢 Buscando proveedor con RUT: ${detalle.proveedor_rut}`);
        
        let proveedorId = null;
        
        const { data: proveedorExistente, error: searchError } = await supabase
          .from('proveedores')
          .select('id, nombre_empresa')
          .eq('rut_empresa', detalle.proveedor_rut)
          .single();

        if (proveedorExistente) {
          proveedorId = proveedorExistente.id;
          totalProveedoresActualizados++;
          console.log(`   ✅ Proveedor existente: ${proveedorExistente.nombre_empresa}`);
        } else {
          // Crear nuevo proveedor en Supabase
          console.log(`   🆕 Creando nuevo proveedor: ${detalle.proveedor_razon_social}`);
          
          const { data: nuevoProveedor, error: createError } = await supabase
            .from('proveedores')
            .insert({
              nombre_empresa: detalle.proveedor_razon_social || 'Sin nombre',
              rut_empresa: detalle.proveedor_rut || '',
              direccion: detalle.proveedor_direccion || '',
              telefono: detalle.proveedor_telefono || '',
              email_contacto: detalle.proveedor_email || '',
              categoria: 'General',
              activo: true,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();
          
          if (createError) {
            console.error(`   ❌ Error creando proveedor: ${createError.message}`);
            errores.push({
              proveedor: detalle.proveedor_razon_social,
              rut: detalle.proveedor_rut,
              error: createError.message
            });
            continue;
          }
          
          if (nuevoProveedor) {
            proveedorId = nuevoProveedor.id;
            totalProveedoresCreados++;
            console.log(`   ✅ Proveedor creado: ${nuevoProveedor.nombre_empresa} (ID: ${proveedorId})`);
          }
        }

        if (!proveedorId) {
          console.log(`   ❌ No se pudo obtener/crear el proveedor`);
          continue;
        }

        // =============================================
        // 3. Guardar cada producto en proveedor_productos
        // =============================================
        const fechaCompra = detalle.compra_oc_fecha_ingreso?.split('T')[0] || new Date().toISOString().split('T')[0];
        console.log(`   📅 Fecha de compra: ${fechaCompra}`);
        console.log(`   📦 Procesando ${detalle.compra_detalle.length} productos...`);

        for (const item of detalle.compra_detalle) {
          const nombreProducto = item.producto_nombre || item.producto_descripcion;
          if (!nombreProducto) {
            console.log(`   ⚠️ Producto sin nombre, omitiendo`);
            continue;
          }

          console.log(`      🔍 Producto: "${nombreProducto}"`);

          // Verificar si ya existe la relación
          const { data: existente } = await supabase
            .from('proveedor_productos')
            .select('id, ultimo_precio, fecha_ultima_compra')
            .eq('proveedor_id', proveedorId)
            .eq('producto_nombre', nombreProducto)
            .single();

          const precioActual = item.precio || 0;

          if (!existente) {
            // Insertar nueva relación
            console.log(`      📝 Insertando nuevo producto...`);
            const { error: insertError } = await supabase
              .from('proveedor_productos')
              .insert({
                proveedor_id: proveedorId,
                producto_nombre: nombreProducto,
                producto_sku: item.codigo_comercial || null,
                ultimo_precio: precioActual,
                fecha_ultima_compra: fechaCompra,
                created_at: new Date().toISOString(),
              });
            
            if (!insertError) {
              totalProductosSincronizados++;
              console.log(`      ✅ Producto insertado: ${nombreProducto} - $${precioActual}`);
            } else {
              console.error(`      ❌ Error insertando producto: ${insertError.message}`);
            }
          } else {
            // Actualizar solo si el precio cambió
            const fechaExistente = existente.fecha_ultima_compra || '1900-01-01';
            if (precioActual !== existente.ultimo_precio || fechaCompra > fechaExistente) {
              console.log(`      📝 Actualizando producto existente...`);
              const { error: updateError } = await supabase
                .from('proveedor_productos')
                .update({
                  ultimo_precio: precioActual,
                  fecha_ultima_compra: fechaCompra,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existente.id);
              
              if (updateError) {
                console.error(`      ❌ Error actualizando producto: ${updateError.message}`);
              } else {
                console.log(`      ✅ Producto actualizado: ${nombreProducto} - $${precioActual}`);
              }
            } else {
              console.log(`      ⏭️ Producto sin cambios, omitiendo`);
            }
          }
        }
        
      } catch (ocError: any) {
        console.error(`   ❌ Error procesando OC ${oc.compra_oc_id}:`, ocError.message);
        errores.push({
          oc_id: oc.compra_oc_id,
          error: ocError.message
        });
      }
    }

    // =============================================
    // 4. Respuesta final
    // =============================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 ESTADÍSTICAS FINALES DE SINCRONIZACIÓN');
    console.log('='.repeat(60));
    console.log(`   📦 Órdenes procesadas: ${totalOCsProcesadas}`);
    console.log(`   🏢 Proveedores nuevos: ${totalProveedoresCreados}`);
    console.log(`   🏢 Proveedores actualizados: ${totalProveedoresActualizados}`);
    console.log(`   📋 Productos sincronizados: ${totalProductosSincronizados}`);
    console.log(`   ❌ Errores: ${errores.length}`);
    console.log('='.repeat(60));
    console.log('🏁 SINCRONIZACIÓN FINALIZADA\n');

    return NextResponse.json({
      success: true,
      estadisticas: {
        ordenes_procesadas: totalOCsProcesadas,
        proveedores_nuevos: totalProveedoresCreados,
        proveedores_actualizados: totalProveedoresActualizados,
        productos_sincronizados: totalProductosSincronizados,
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
    description: 'Sincroniza productos desde las órdenes de compra de Obuma a Supabase'
  });
}