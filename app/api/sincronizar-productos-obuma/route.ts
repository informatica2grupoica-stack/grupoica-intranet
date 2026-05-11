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
    // 1. Obtener TODOS los proveedores de Obuma (lista completa)
    // =============================================
    console.log('📡 Obteniendo lista completa de proveedores desde Obuma...');
    const proveedoresResponse = await fetch(`${OBUMA_API_URL}/proveedores.list.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN, 'Content-Type': 'application/json' },
    });
    const proveedoresData = await proveedoresResponse.json();
    console.log(`✅ ${proveedoresData.data?.length || 0} proveedores encontrados en Obuma`);

    // Crear mapa de proveedores por ID con datos completos
    const proveedoresMap = new Map();
    for (const prov of proveedoresData.data || []) {
      proveedoresMap.set(prov.proveedor_id, {
        nombre_empresa: prov.proveedor_razon_social || prov.proveedor_nombre_fantasia || `Proveedor ${prov.proveedor_id}`,
        rut_empresa: prov.proveedor_rut || `ID_${prov.proveedor_id}`,
        telefono: prov.proveedor_telefono || '',
        email_contacto: prov.proveedor_email || '',
        direccion: prov.proveedor_direccion || '',
        comuna: prov.proveedor_comuna || '',
        ciudad: prov.proveedor_ciudad || '',
        region: prov.proveedor_region || '',
        pais: prov.proveedor_pais || 'Chile',
        sitio_web: prov.proveedor_website || '',
        nombre_contacto: prov.proveedor_contacto || '',
        proveedor_giro_comercial: prov.proveedor_giro_comercial || '',
        observaciones: prov.proveedor_observacion || '',
      });
    }

    // =============================================
    // 2. Actualizar/Crear proveedores en Supabase
    // =============================================
    let proveedoresActualizados = 0;
    let proveedoresCreados = 0;

    for (const [obumaId, datos] of proveedoresMap) {
      const { data: existente } = await supabase
        .from('proveedores')
        .select('id')
        .eq('obuma_id', obumaId)
        .maybeSingle();

      if (existente) {
        const { error: updateError } = await supabase
          .from('proveedores')
          .update({
            nombre_empresa: datos.nombre_empresa,
            rut_empresa: datos.rut_empresa,
            telefono: datos.telefono,
            email_contacto: datos.email_contacto,
            direccion: datos.direccion,
            comuna: datos.comuna,
            ciudad: datos.ciudad,
            region: datos.region,
            pais: datos.pais,
            sitio_web: datos.sitio_web,
            nombre_contacto: datos.nombre_contacto,
            proveedor_giro_comercial: datos.proveedor_giro_comercial,
            observaciones: datos.observaciones,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existente.id);
        
        if (!updateError) {
          proveedoresActualizados++;
        }
      } else {
        const { error: createError } = await supabase
          .from('proveedores')
          .insert({
            obuma_id: obumaId,
            nombre_empresa: datos.nombre_empresa,
            rut_empresa: datos.rut_empresa,
            telefono: datos.telefono,
            email_contacto: datos.email_contacto,
            direccion: datos.direccion,
            comuna: datos.comuna,
            ciudad: datos.ciudad,
            region: datos.region,
            pais: datos.pais,
            sitio_web: datos.sitio_web,
            nombre_contacto: datos.nombre_contacto,
            proveedor_giro_comercial: datos.proveedor_giro_comercial,
            observaciones: datos.observaciones,
            categoria: 'General',
            activo: true,
          });
        
        if (!createError) {
          proveedoresCreados++;
        }
      }
    }

    console.log(`📊 Proveedores procesados: Actualizados: ${proveedoresActualizados}, Creados: ${proveedoresCreados}`);

    // =============================================
    // 3. Obtener órdenes de compra
    // =============================================
    console.log('📡 Obteniendo órdenes de compra...');
    const ocResponse = await fetch(`${OBUMA_API_URL}/comprasOc.list.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN, 'Content-Type': 'application/json' },
    });
    const ocData = await ocResponse.json();
    console.log(`✅ ${ocData.data?.length || 0} órdenes encontradas`);

    // =============================================
    // 4. Obtener items
    // =============================================
    console.log('📡 Obteniendo items...');
    const itemsResponse = await fetch(`${OBUMA_API_URL}/comprasOc.listItems.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN, 'Content-Type': 'application/json' },
    });
    const itemsData = await itemsResponse.json();
    console.log(`✅ ${itemsData.data?.length || 0} items encontrados`);

    // =============================================
    // 5. Mapear OC a proveedor
    // =============================================
    const ocToProveedor = new Map<string, string>();
    for (const oc of ocData.data || []) {
      if (oc.rel_proveedor_id) {
        ocToProveedor.set(oc.compra_oc_id, oc.rel_proveedor_id);
      }
    }
    console.log(`📦 Mapeo: ${ocToProveedor.size} órdenes con proveedor`);

    // =============================================
    // 6. Guardar productos
    // =============================================
    let totalProductosGuardados = 0;

    for (const item of itemsData.data || []) {
      const proveedorIdObuma = ocToProveedor.get(item.compra_oc_id);
      if (!proveedorIdObuma) continue;
      
      const nombreProducto = item.producto_nombre;
      if (!nombreProducto) continue;
      
      const { data: proveedor } = await supabase
        .from('proveedores')
        .select('id')
        .eq('obuma_id', proveedorIdObuma)
        .maybeSingle();
      
      if (!proveedor) continue;
      
      const precio = parseFloat(item.precio || '0');
      const ocEncontrada = ocData.data.find((oc: OrdenCompra) => oc.compra_oc_id === item.compra_oc_id);
      const fecha = ocEncontrada?.compra_oc_fecha_ingreso?.split('T')[0] || new Date().toISOString().split('T')[0];
      
      const { error: insertError } = await supabase
        .from('proveedor_productos')
        .upsert({
          proveedor_id: proveedor.id,
          producto_nombre: nombreProducto,
          producto_sku: item.codigo_comercial || '',
          ultimo_precio: Math.round(precio),
          fecha_ultima_compra: fecha,
        }, {
          onConflict: 'proveedor_id, producto_nombre',
        });
      
      if (!insertError) {
        totalProductosGuardados++;
      }
    }

    console.log(`   ✅ Productos sincronizados: ${totalProductosGuardados}`);

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADOS FINALES');
    console.log('='.repeat(60));
    console.log(`   ✅ Proveedores actualizados: ${proveedoresActualizados}`);
    console.log(`   ✅ Proveedores creados: ${proveedoresCreados}`);
    console.log(`   ✅ Productos sincronizados: ${totalProductosGuardados}`);
    console.log('='.repeat(60));

    return NextResponse.json({
      success: true,
      estadisticas: {
        proveedores_actualizados: proveedoresActualizados,
        proveedores_creados: proveedoresCreados,
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
    description: 'Sincroniza proveedores y productos desde Obuma a Supabase',
  });
}