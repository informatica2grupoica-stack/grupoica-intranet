// app/api/sincronizar-productos-obuma/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseAdmin';

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
  const startTime = Date.now();
  
  console.log('\n' + '='.repeat(80));
  console.log('🔄 SINCRONIZACIÓN DE PRODUCTOS DESDE OBUMA - INICIO');
  console.log('='.repeat(80));
  console.log(`📅 Fecha/Hora: ${new Date().toISOString()}`);
  
  const OBUMA_API_URL = process.env.OBUMA_API_URL;
  const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

  if (!OBUMA_API_TOKEN) {
    console.error('❌ Error: OBUMA_API_TOKEN no configurado');
    return NextResponse.json({ error: 'API token no configurado' }, { status: 500 });
  }

  console.log(`🔐 Configuración:`);
  console.log(`   - OBUMA_API_URL: ${OBUMA_API_URL}`);
  console.log(`   - OBUMA_API_TOKEN: ${OBUMA_API_TOKEN ? '✅ Configurado' : '❌ No configurado'}`);

  try {
    // =============================================
    // 1. Obtener TODOS los proveedores de Obuma
    // =============================================
    console.log('\n📡 PASO 1: Obteniendo lista de proveedores desde Obuma...');
    const proveedoresStart = Date.now();
    
    const proveedoresResponse = await fetch(`${OBUMA_API_URL}/proveedores.list.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN, 'Content-Type': 'application/json' },
    });
    const proveedoresData = await proveedoresResponse.json();
    
    const totalProveedoresObuma = proveedoresData.data?.length || 0;
    console.log(`✅ ${totalProveedoresObuma} proveedores encontrados en Obuma`);
    console.log(`⏱️ Tiempo: ${Date.now() - proveedoresStart}ms`);

    // Crear mapa de proveedores por ID con datos completos
    const proveedoresMap = new Map();
    let proveedoresConRazonSocial = 0;
    let proveedoresConNombreFantasia = 0;
    let proveedoresSinNombre = 0;
    
    console.log(`\n📊 Procesando proveedores de Obuma:`);
    
    for (const prov of proveedoresData.data || []) {
      const tieneRazonSocial = !!(prov.proveedor_razon_social && prov.proveedor_razon_social.trim());
      const tieneNombreFantasia = !!(prov.proveedor_nombre_fantasia && prov.proveedor_nombre_fantasia.trim());
      
      if (tieneRazonSocial) proveedoresConRazonSocial++;
      if (tieneNombreFantasia) proveedoresConNombreFantasia++;
      if (!tieneRazonSocial && !tieneNombreFantasia) proveedoresSinNombre++;
      
      const nombreFinal = prov.proveedor_razon_social || prov.proveedor_nombre_fantasia || `Proveedor ${prov.proveedor_id}`;
      const tieneNombre = prov.proveedor_razon_social || prov.proveedor_nombre_fantasia;
      
      proveedoresMap.set(prov.proveedor_id, {
        nombre_empresa: nombreFinal,
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
        categoria: prov.proveedor_categoria || 'General',
        tiene_nombre_original: !!tieneNombre
      });
    }
    
    console.log(`\n   📊 Estadísticas de proveedores:`);
    console.log(`      - Con razón social: ${proveedoresConRazonSocial}`);
    console.log(`      - Con nombre fantasía: ${proveedoresConNombreFantasia}`);
    console.log(`      - Sin nombre real: ${proveedoresSinNombre}`);

    // =============================================
    // 2. Actualizar/Crear proveedores en Supabase
    // =============================================
    console.log('\n📡 PASO 2: Sincronizando proveedores en Supabase...');
    const proveedoresSyncStart = Date.now();
    
    let proveedoresActualizados = 0;
    let proveedoresCreados = 0;
    let proveedoresConNombreVacioLocal = 0;
    
    for (const [obumaId, datos] of proveedoresMap) {
      const { data: existente } = await supabase
        .from('proveedores')
        .select('id, nombre_empresa, rut_empresa')
        .eq('obuma_id', obumaId)
        .maybeSingle();

      if (existente) {
        // Verificar si necesita actualización
        const nombreActual = existente.nombre_empresa || '';
        const rutActual = existente.rut_empresa || '';
        const necesitaActualizacion = !nombreActual || 
                                      nombreActual === '' || 
                                      nombreActual.startsWith('Proveedor ') ||
                                      rutActual.startsWith('ID_');
        
        if (necesitaActualizacion) {
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
              categoria: datos.categoria,
            })
            .eq('id', existente.id);
          
          if (!updateError) {
            proveedoresActualizados++;
            console.log(`   ✅ Actualizado: ${obumaId} -> "${datos.nombre_empresa}" (${datos.tiene_nombre_original ? 'nombre original' : 'nombre genérico'})`);
          }
        } else {
          console.log(`   ⏭️ Sin cambios: ${obumaId} -> "${nombreActual}"`);
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
            categoria: datos.categoria,
            activo: true,
          });
        
        if (!createError) {
          proveedoresCreados++;
          console.log(`   ✨ Creado: ${obumaId} -> "${datos.nombre_empresa}"`);
        }
      }
    }
    
    // Verificar proveedores locales con nombre vacío
    const { data: proveedoresLocalesVacios } = await supabase
      .from('proveedores')
      .select('id, nombre_empresa, obuma_id')
      .or('nombre_empresa.is.null,nombre_empresa.eq.') // BUG: CORREGIDO
      .not('obuma_id', 'is', null);
    
    // Corrección: consultar por separado
    const { data: proveedoresNull } = await supabase
      .from('proveedores')
      .select('id, nombre_empresa, obuma_id')
      .is('nombre_empresa', null);
      
    const { data: proveedoresVacio } = await supabase
      .from('proveedores')
      .select('id, nombre_empresa, obuma_id')
      .eq('nombre_empresa', '');
    
    const proveedoresLocalesSinNombre = [...(proveedoresNull || []), ...(proveedoresVacio || [])];
    
    proveedoresConNombreVacioLocal = proveedoresLocalesSinNombre.length;
    
    if (proveedoresConNombreVacioLocal > 0) {
      console.log(`\n   ⚠️ Aún hay ${proveedoresConNombreVacioLocal} proveedores con nombre vacío en la BD local:`);
      for (const prov of proveedoresLocalesSinNombre) {
        if (prov.obuma_id) {
          const datosOriginales = proveedoresMap.get(prov.obuma_id);
          if (datosOriginales && datosOriginales.tiene_nombre_original) {
            const { error: updateError } = await supabase
              .from('proveedores')
              .update({ nombre_empresa: datosOriginales.nombre_empresa })
              .eq('id', prov.id);
            
            if (!updateError) {
              console.log(`      🔧 Fijo: ${prov.obuma_id} -> "${datosOriginales.nombre_empresa}"`);
              proveedoresActualizados++;
            }
          }
        }
      }
    }
    
    console.log(`\n   📊 Resumen proveedores:`);
    console.log(`      - Actualizados: ${proveedoresActualizados}`);
    console.log(`      - Creados: ${proveedoresCreados}`);
    console.log(`      - Quedan sin nombre: ${proveedoresConNombreVacioLocal}`);
    console.log(`   ⏱️ Tiempo: ${Date.now() - proveedoresSyncStart}ms`);

    // =============================================
    // 3. Obtener órdenes de compra
    // =============================================
    console.log('\n📡 PASO 3: Obteniendo órdenes de compra...');
    const ocStart = Date.now();
    
    const ocResponse = await fetch(`${OBUMA_API_URL}/comprasOc.list.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN, 'Content-Type': 'application/json' },
    });
    const ocData = await ocResponse.json();
    const totalOC = ocData.data?.length || 0;
    console.log(`✅ ${totalOC} órdenes encontradas`);
    console.log(`⏱️ Tiempo: ${Date.now() - ocStart}ms`);

    // =============================================
    // 4. Obtener items
    // =============================================
    console.log('\n📡 PASO 4: Obteniendo items de órdenes...');
    const itemsStart = Date.now();
    
    const itemsResponse = await fetch(`${OBUMA_API_URL}/comprasOc.listItems.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN, 'Content-Type': 'application/json' },
    });
    const itemsData = await itemsResponse.json();
    const totalItems = itemsData.data?.length || 0;
    console.log(`✅ ${totalItems} items encontrados`);
    console.log(`⏱️ Tiempo: ${Date.now() - itemsStart}ms`);

    // =============================================
    // 5. Mapear OC a proveedor
    // =============================================
    console.log('\n📡 PASO 5: Mapeando órdenes a proveedores...');
    
    const ocToProveedor = new Map<string, string>();
    for (const oc of ocData.data || []) {
      if (oc.rel_proveedor_id) {
        ocToProveedor.set(oc.compra_oc_id, oc.rel_proveedor_id);
      }
    }
    console.log(`📦 ${ocToProveedor.size} órdenes con proveedor asociado`);

    // =============================================
    // 6. Guardar productos
    // =============================================
    console.log('\n📡 PASO 6: Guardando productos en Supabase...');
    const productosStart = Date.now();
    
    let totalProductosGuardados = 0;
    let productosDuplicados = 0;
    let itemsSinProveedor = 0;
    let itemsSinProducto = 0;
    
    for (const item of itemsData.data || []) {
      const proveedorIdObuma = ocToProveedor.get(item.compra_oc_id);
      if (!proveedorIdObuma) {
        itemsSinProveedor++;
        continue;
      }
      
      const nombreProducto = item.producto_nombre;
      if (!nombreProducto) {
        itemsSinProducto++;
        continue;
      }
      
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
      } else {
        productosDuplicados++;
      }
    }
    
    console.log(`   📊 Resumen productos:`);
    console.log(`      - Guardados/Actualizados: ${totalProductosGuardados}`);
    console.log(`      - Duplicados omitidos: ${productosDuplicados}`);
    console.log(`      - Items sin proveedor: ${itemsSinProveedor}`);
    console.log(`      - Items sin nombre: ${itemsSinProducto}`);
    console.log(`   ⏱️ Tiempo: ${Date.now() - productosStart}ms`);

    // =============================================
    // 7. Resumen final
    // =============================================
    const totalTime = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESULTADOS FINALES DE SINCRONIZACIÓN');
    console.log('='.repeat(80));
    console.log(`   ✅ Proveedores actualizados: ${proveedoresActualizados}`);
    console.log(`   ✅ Proveedores creados: ${proveedoresCreados}`);
    console.log(`   ⚠️ Proveedores sin nombre real en OBUMA: ${proveedoresSinNombre}`);
    console.log(`   ⚠️ Proveedores con nombre vacío en BD local: ${proveedoresConNombreVacioLocal}`);
    console.log(`   ✅ Productos sincronizados: ${totalProductosGuardados}`);
    console.log(`   ⏱️ Tiempo total de sincronización: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    console.log('='.repeat(80));

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tiempo_total_ms: totalTime,
      estadisticas: {
        proveedores_actualizados: proveedoresActualizados,
        proveedores_creados: proveedoresCreados,
        proveedores_sin_nombre_real: proveedoresSinNombre,
        proveedores_nombre_vacio_local: proveedoresConNombreVacioLocal,
        productos_sincronizados: totalProductosGuardados,
        productos_duplicados: productosDuplicados,
        items_sin_proveedor: itemsSinProveedor,
        items_sin_producto: itemsSinProducto,
        ordenes_procesadas: totalOC,
        items_procesados: totalItems
      },
    });

  } catch (error: any) {
    console.error('❌ Error fatal:', error.message);
    console.error(error.stack);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de sincronización de productos Obuma',
    usage: 'POST /api/sincronizar-productos-obuma',
    description: 'Sincroniza proveedores y productos desde Obuma a Supabase',
    features: [
      'Obtiene lista completa de proveedores desde OBUMA',
      'Sincroniza proveedores existentes (solo actualiza si hay cambios)',
      'Crea nuevos proveedores automáticamente',
      'Sincroniza productos históricos de compras',
      'Evita duplicados usando upsert con conflicto (proveedor_id, producto_nombre)',
      'Registra estadísticas detalladas de la sincronización'
    ]
  });
}