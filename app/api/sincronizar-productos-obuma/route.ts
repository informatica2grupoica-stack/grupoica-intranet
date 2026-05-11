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
    // 1. Obtener lista COMPLETA de proveedores de Obuma
    // =============================================
    console.log('📡 Obteniendo lista completa de proveedores desde Obuma...');
    const proveedoresResponse = await fetch(`${OBUMA_API_URL}/proveedores.list.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN },
    });
    const proveedoresData = await proveedoresResponse.json();
    
    // Crear mapa de datos completos de proveedores por ID
    const datosProveedoresMap = new Map();
    for (const prov of proveedoresData.data || []) {
      datosProveedoresMap.set(prov.proveedor_id, {
        nombre_empresa: prov.proveedor_razon_social || '',
        rut_empresa: prov.proveedor_rut || '',
        telefono: prov.proveedor_telefono || '',
        email_contacto: prov.proveedor_email || '',
        direccion: prov.proveedor_direccion || '',
        comuna: prov.proveedor_comuna || '',
        ciudad: prov.proveedor_ciudad || '',
        region: prov.proveedor_region || '',
        pais: prov.proveedor_pais || 'Chile',
        sitio_web: prov.proveedor_website || '',
        nombre_contacto: prov.proveedor_contacto || '',
        giro_comercial: prov.proveedor_giro_comercial || '',
        observacion: prov.proveedor_observacion || '',
      });
    }
    console.log(`✅ ${datosProveedoresMap.size} proveedores con datos completos`);

    // =============================================
    // 2. Obtener órdenes de compra
    // =============================================
    console.log('📡 Obteniendo órdenes de compra...');
    const ocResponse = await fetch(`${OBUMA_API_URL}/comprasOc.list.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN },
    });
    const ocData = await ocResponse.json();
    console.log(`✅ ${ocData.data?.length || 0} órdenes encontradas`);

    // =============================================
    // 3. Obtener items
    // =============================================
    console.log('📡 Obteniendo items...');
    const itemsResponse = await fetch(`${OBUMA_API_URL}/comprasOc.listItems.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN },
    });
    const itemsData = await itemsResponse.json();
    console.log(`✅ ${itemsData.data?.length || 0} items encontrados`);

    // =============================================
    // 4. Mapear OC a proveedor
    // =============================================
    const ocToProveedor = new Map<string, string>();
    for (const oc of ocData.data) {
      if (oc.rel_proveedor_id) {
        ocToProveedor.set(oc.compra_oc_id, oc.rel_proveedor_id);
      }
    }
    console.log(`📦 Mapeo: ${ocToProveedor.size} órdenes con proveedor`);

    // =============================================
    // 5. Agrupar productos por proveedor
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
    // 6. Guardar en Supabase con DATOS COMPLETOS
    // =============================================
    let totalProveedoresActualizados = 0;
    let totalProveedoresCreados = 0;
    let totalProductosGuardados = 0;
    
    for (const [proveedorIdObuma, productos] of productosPorProveedor) {
      // Obtener datos completos del proveedor desde el mapa
      const datosCompletos = datosProveedoresMap.get(proveedorIdObuma);
      
      let proveedorId: string | null = null;
      
      const { data: existente } = await supabase
        .from('proveedores')
        .select('id')
        .eq('obuma_id', proveedorIdObuma)
        .maybeSingle();

      if (existente) {
        proveedorId = existente.id;
        totalProveedoresActualizados++;
        
        // Actualizar datos del proveedor si es necesario
        if (datosCompletos && datosCompletos.nombre_empresa) {
          await supabase
            .from('proveedores')
            .update({
              nombre_empresa: datosCompletos.nombre_empresa,
              rut_empresa: datosCompletos.rut_empresa,
              telefono: datosCompletos.telefono,
              email_contacto: datosCompletos.email_contacto,
              direccion: datosCompletos.direccion,
              comuna: datosCompletos.comuna,
              ciudad: datosCompletos.ciudad,
              sitio_web: datosCompletos.sitio_web,
              nombre_contacto: datosCompletos.nombre_contacto,
              proveedor_giro_comercial: datosCompletos.giro_comercial,
              observaciones: datosCompletos.observacion,
              categoria: datosCompletos.giro_comercial?.substring(0, 100) || 'General',
            })
            .eq('id', proveedorId);
        }
      } else if (datosCompletos) {
        // Crear nuevo proveedor con datos completos
        const { data: nuevo, error: createError } = await supabase
          .from('proveedores')
          .insert({
            obuma_id: proveedorIdObuma,
            nombre_empresa: datosCompletos.nombre_empresa || `Proveedor ${proveedorIdObuma}`,
            rut_empresa: datosCompletos.rut_empresa || `ID_${proveedorIdObuma}`,
            telefono: datosCompletos.telefono || '',
            email_contacto: datosCompletos.email_contacto || '',
            direccion: datosCompletos.direccion || '',
            comuna: datosCompletos.comuna || '',
            ciudad: datosCompletos.ciudad || '',
            sitio_web: datosCompletos.sitio_web || '',
            nombre_contacto: datosCompletos.nombre_contacto || '',
            proveedor_giro_comercial: datosCompletos.giro_comercial || '',
            observaciones: datosCompletos.observacion || '',
            categoria: datosCompletos.giro_comercial?.substring(0, 100) || 'General',
            activo: true,
          })
          .select()
          .single();
        
        if (createError) {
          console.error(`❌ Error creando proveedor ${proveedorIdObuma}: ${createError.message}`);
          continue;
        }
        
        if (nuevo) {
          proveedorId = nuevo.id;
          totalProveedoresCreados++;
          console.log(`✅ Nuevo proveedor: ${datosCompletos.nombre_empresa || proveedorIdObuma}`);
        }
      } else {
        // No hay datos completos, crear con datos mínimos
        const { data: nuevo, error: createError } = await supabase
          .from('proveedores')
          .insert({
            obuma_id: proveedorIdObuma,
            nombre_empresa: `Proveedor ${proveedorIdObuma}`,
            rut_empresa: `ID_${proveedorIdObuma}`,
            categoria: 'General',
            activo: true,
          })
          .select()
          .single();
        
        if (createError) {
          console.error(`❌ Error creando proveedor ${proveedorIdObuma}: ${createError.message}`);
          continue;
        }
        
        if (nuevo) {
          proveedorId = nuevo.id;
          totalProveedoresCreados++;
          console.log(`✅ Nuevo proveedor (mínimo): Proveedor ${proveedorIdObuma}`);
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
            console.log(`   📦 "${prod.nombre.substring(0, 45)}" - $${prod.precio}`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADOS FINALES');
    console.log('='.repeat(60));
    console.log(`   Proveedores actualizados: ${totalProveedoresActualizados}`);
    console.log(`   Proveedores nuevos creados: ${totalProveedoresCreados}`);
    console.log(`   Productos sincronizados: ${totalProductosGuardados}`);
    console.log('='.repeat(60));

    return NextResponse.json({
      success: true,
      estadisticas: {
        proveedores_actualizados: totalProveedoresActualizados,
        proveedores_nuevos: totalProveedoresCreados,
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