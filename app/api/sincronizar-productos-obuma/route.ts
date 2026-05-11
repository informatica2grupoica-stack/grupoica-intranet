// app/api/sincronizar-productos-obuma/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  const OBUMA_API_URL = process.env.OBUMA_API_URL;
  const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

  if (!OBUMA_API_TOKEN) {
    return NextResponse.json(
      { error: 'API token de Obuma no configurado' },
      { status: 500 }
    );
  }

  try {
    console.log('🔄 Iniciando sincronización de productos desde Obuma...');
    
    // =============================================
    // 1. Obtener todas las órdenes de compra de Obuma
    // =============================================
    const ocResponse = await fetch(`${OBUMA_API_URL}/comprasOc.list.json`, {
      method: 'GET',
      headers: {
        'access-token': OBUMA_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const ocData = await ocResponse.json();
    
    if (!ocData.data || !Array.isArray(ocData.data)) {
      throw new Error('No se pudieron obtener las órdenes de compra');
    }

    console.log(`📦 ${ocData.data.length} órdenes de compra encontradas en Obuma`);

    let totalProductosSincronizados = 0;
    let totalProveedoresCreados = 0;
    let totalProveedoresActualizados = 0;
    let totalOCsProcesadas = 0;
    const errores = [];

    // =============================================
    // 2. Procesar cada orden de compra
    // =============================================
    for (const oc of ocData.data) {
      try {
        // 2.1 Obtener detalle de la OC (productos)
        const detalleResponse = await fetch(`${OBUMA_API_URL}/comprasOc.findById.json/${oc.compra_oc_id}`, {
          method: 'GET',
          headers: {
            'access-token': OBUMA_API_TOKEN,
            'Content-Type': 'application/json',
          },
        });

        const detalle = await detalleResponse.json();
        
        // Si no tiene productos, saltamos
        if (!detalle.compra_detalle || detalle.compra_detalle.length === 0) {
          continue;
        }

        totalOCsProcesadas++;

        // 2.2 Buscar o crear el proveedor en Supabase por RUT
        let proveedorId = null;
        
        const { data: proveedorExistente, error: searchError } = await supabase
          .from('proveedores')
          .select('id, nombre_empresa')
          .eq('rut_empresa', detalle.proveedor_rut)
          .single();

        if (proveedorExistente) {
          proveedorId = proveedorExistente.id;
          totalProveedoresActualizados++;
        } else {
          // Crear nuevo proveedor en Supabase
          console.log(`🆕 Creando proveedor: ${detalle.proveedor_razon_social} (RUT: ${detalle.proveedor_rut})`);
          
          const { data: nuevoProveedor, error: createError } = await supabase
            .from('proveedores')
            .insert({
              nombre_empresa: detalle.proveedor_razon_social || 'Sin nombre',
              rut_empresa: detalle.proveedor_rut || '',
              direccion: detalle.proveedor_direccion || '',
              telefono: detalle.proveedor_telefono || '',
              email_contacto: detalle.proveedor_email || '',
              activo: true,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();
          
          if (createError) {
            console.error(`Error creando proveedor ${detalle.proveedor_razon_social}:`, createError.message);
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
            console.log(`✅ Proveedor creado: ${nuevoProveedor.nombre_empresa}`);
          }
        }

        if (!proveedorId) continue;

        // =============================================
        // 3. Guardar cada producto en proveedor_productos
        // =============================================
        const fechaCompra = detalle.compra_oc_fecha_ingreso?.split('T')[0] || new Date().toISOString().split('T')[0];

        for (const item of detalle.compra_detalle) {
          const nombreProducto = item.producto_nombre || item.producto_descripcion;
          if (!nombreProducto) continue;

          // Verificar si ya existe la relación (proveedor + producto)
          const { data: existente } = await supabase
            .from('proveedor_productos')
            .select('id, ultimo_precio, fecha_ultima_compra')
            .eq('proveedor_id', proveedorId)
            .eq('producto_nombre', nombreProducto)
            .single();

          const precioActual = item.precio || 0;

          if (!existente) {
            // Insertar nueva relación
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
            } else {
              console.error(`Error insertando producto ${nombreProducto}:`, insertError.message);
            }
          } else {
            // Actualizar solo si el precio cambió o es más reciente
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
              
              if (updateError) {
                console.error(`Error actualizando producto ${nombreProducto}:`, updateError.message);
              }
            }
          }
        }
        
      } catch (ocError: any) {
        console.error(`Error procesando OC ${oc.compra_oc_id}:`, ocError.message);
        errores.push({
          oc_id: oc.compra_oc_id,
          error: ocError.message
        });
      }
    }

    // =============================================
    // 4. Respuesta final
    // =============================================
    console.log(`✅ Sincronización completada:`);
    console.log(`   - Órdenes procesadas: ${totalOCsProcesadas}`);
    console.log(`   - Proveedores nuevos: ${totalProveedoresCreados}`);
    console.log(`   - Proveedores actualizados: ${totalProveedoresActualizados}`);
    console.log(`   - Productos sincronizados: ${totalProductosSincronizados}`);
    console.log(`   - Errores: ${errores.length}`);

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