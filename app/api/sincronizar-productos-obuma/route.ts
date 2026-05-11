// app/api/sincronizar-productos-obuma/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface OrdenCompra {
  compra_oc_id: string;
  compra_oc_folio: string;
  rel_proveedor_id: string;
  proveedor_razon_social?: string;
  proveedor_rut?: string;
  compra_oc_fecha_ingreso?: string;
  [key: string]: any;
}

interface ItemCompra {
  compra_oc_id: string;
  producto_nombre?: string;
  precio?: string;
  codigo_comercial?: string;
  [key: string]: any;
}

export async function POST(request: Request) {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 SINCRONIZACIÓN DE PRODUCTOS DESDE OBUMA (CON DATOS COMPLETOS)');
  console.log('='.repeat(60));
  
  const OBUMA_API_URL = process.env.OBUMA_API_URL;
  const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

  if (!OBUMA_API_TOKEN) {
    return NextResponse.json({ error: 'API token no configurado' }, { status: 500 });
  }

  try {
    // =============================================
    // 1. Obtener órdenes de compra
    // =============================================
    console.log('📡 Obteniendo órdenes de compra...');
    const ocResponse = await fetch(`${OBUMA_API_URL}/comprasOc.list.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN },
    });
    const ocData = await ocResponse.json();
    console.log(`✅ ${ocData.data?.length || 0} órdenes encontradas`);

    // =============================================
    // 2. Obtener items
    // =============================================
    console.log('📡 Obteniendo items...');
    const itemsResponse = await fetch(`${OBUMA_API_URL}/comprasOc.listItems.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN },
    });
    const itemsData = await itemsResponse.json();
    console.log(`✅ ${itemsData.data?.length || 0} items encontrados`);

    // =============================================
    // 3. Mapear OC a proveedor
    // =============================================
    const ocToProveedor = new Map<string, string>();
    for (const oc of ocData.data) {
      if (oc.rel_proveedor_id) {
        ocToProveedor.set(oc.compra_oc_id, oc.rel_proveedor_id);
      }
    }
    console.log(`📦 Mapeo: ${ocToProveedor.size} órdenes con proveedor`);

    // =============================================
    // 4. Agrupar productos por proveedor
    // =============================================
    const productosPorProveedor = new Map<string, Array<{nombre: string, precio: number, sku: string, fecha: string}>>();
    
    for (const item of itemsData.data.slice(0, 1000)) {
      const ocId = item.compra_oc_id;
      const proveedorIdObuma = ocToProveedor.get(ocId);
      if (!proveedorIdObuma) continue;
      
      const nombreProducto = item.producto_nombre;
      if (!nombreProducto) continue;
      
      if (!productosPorProveedor.has(proveedorIdObuma)) {
        productosPorProveedor.set(proveedorIdObuma, []);
      }
      
      const precio = parseFloat(item.precio || '0');
      const ocEncontrada = ocData.data.find((oc: OrdenCompra) => oc.compra_oc_id === ocId);
      const fecha = ocEncontrada?.compra_oc_fecha_ingreso?.split('T')[0] || new Date().toISOString().split('T')[0];
      
      productosPorProveedor.get(proveedorIdObuma)!.push({
        nombre: nombreProducto,
        precio: Math.round(precio),
        sku: item.codigo_comercial || '',
        fecha: fecha
      });
    }
    
    console.log(`📦 ${productosPorProveedor.size} proveedores con productos`);

    // =============================================
    // 5. Obtener datos COMPLETOS de cada proveedor usando nuestra API
    // =============================================
    let totalProveedoresActualizados = 0;
    let totalProductosGuardados = 0;
    
    for (const [proveedorIdObuma, productos] of productosPorProveedor) {
      console.log(`\n📋 Procesando proveedor ID: ${proveedorIdObuma} (${productos.length} productos)`);
      
      // Obtener datos completos del proveedor desde nuestra API
      let proveedorData = null;
      try {
        const proveedorResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/obuma/proveedores/${proveedorIdObuma}`);
        proveedorData = await proveedorResponse.json();
        
        if (proveedorData && proveedorData.proveedor_razon_social) {
          console.log(`   ✅ Datos obtenidos: ${proveedorData.proveedor_razon_social}`);
        } else {
          console.log(`   ⚠️ No se pudieron obtener datos completos`);
        }
      } catch (err) {
        console.log(`   ⚠️ Error obteniendo datos del proveedor: ${err}`);
      }
      
      // Buscar o actualizar proveedor en Supabase
      let proveedorId = null;
      
      const { data: existente } = await supabase
        .from('proveedores')
        .select('id')
        .eq('obuma_id', proveedorIdObuma)
        .maybeSingle();

      const nombreProveedor = proveedorData?.proveedor_razon_social || `Proveedor ${proveedorIdObuma}`;
      const rutProveedor = proveedorData?.proveedor_rut || `ID_${proveedorIdObuma}`;
      
      if (existente) {
        // Actualizar proveedor existente con datos completos
        const { error: updateError } = await supabase
          .from('proveedores')
          .update({
            nombre_empresa: nombreProveedor,
            rut_empresa: rutProveedor,
            telefono: proveedorData?.proveedor_telefono || '',
            email_contacto: proveedorData?.proveedor_email || '',
            direccion: proveedorData?.proveedor_direccion || '',
            comuna: proveedorData?.proveedor_comuna || '',
            ciudad: proveedorData?.proveedor_ciudad || '',
            sitio_web: proveedorData?.proveedor_website || '',
            nombre_contacto: proveedorData?.proveedor_contacto || '',
            proveedor_giro_comercial: proveedorData?.proveedor_giro_comercial || '',
            observaciones: proveedorData?.proveedor_observacion || '',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existente.id);
        
        if (!updateError) {
          proveedorId = existente.id;
          totalProveedoresActualizados++;
          console.log(`   ✅ Proveedor actualizado: ${nombreProveedor}`);
        } else {
          console.error(`   ❌ Error actualizando proveedor: ${updateError.message}`);
          continue;
        }
      } else {
        // Crear nuevo proveedor
        const { data: nuevo, error: createError } = await supabase
          .from('proveedores')
          .insert({
            obuma_id: proveedorIdObuma,
            nombre_empresa: nombreProveedor,
            rut_empresa: rutProveedor,
            telefono: proveedorData?.proveedor_telefono || '',
            email_contacto: proveedorData?.proveedor_email || '',
            direccion: proveedorData?.proveedor_direccion || '',
            comuna: proveedorData?.proveedor_comuna || '',
            ciudad: proveedorData?.proveedor_ciudad || '',
            sitio_web: proveedorData?.proveedor_website || '',
            nombre_contacto: proveedorData?.proveedor_contacto || '',
            proveedor_giro_comercial: proveedorData?.proveedor_giro_comercial || '',
            observaciones: proveedorData?.proveedor_observacion || '',
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
          console.log(`   ✅ Nuevo proveedor creado: ${nombreProveedor}`);
        }
      }
      
      if (!proveedorId) continue;
      
      // Guardar productos
      for (const prod of productos) {
        const { error: insertError } = await supabase
          .from('proveedor_productos')
          .upsert({
            proveedor_id: proveedorId,
            producto_nombre: prod.nombre,
            producto_sku: prod.sku,
            ultimo_precio: prod.precio,
            fecha_ultima_compra: prod.fecha,
          }, {
            onConflict: 'proveedor_id, producto_nombre',
          });
        
        if (!insertError) {
          totalProductosGuardados++;
          if (totalProductosGuardados <= 30) {
            console.log(`      📦 "${prod.nombre.substring(0, 45)}" - $${prod.precio}`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADOS FINALES');
    console.log('='.repeat(60));
    console.log(`   ✅ Proveedores actualizados: ${totalProveedoresActualizados}`);
    console.log(`   ✅ Productos sincronizados: ${totalProductosGuardados}`);
    console.log('='.repeat(60));

    return NextResponse.json({
      success: true,
      estadisticas: {
        proveedores_actualizados: totalProveedoresActualizados,
        productos_sincronizados: totalProductosGuardados,
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