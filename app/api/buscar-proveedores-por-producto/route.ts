// app/api/buscar-proveedores-por-producto/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const startTime = Date.now();
  
  console.log('\n' + '='.repeat(80));
  console.log('🔍 BÚSQUEDA DE PROVEEDORES POR PRODUCTO - INICIO');
  console.log('='.repeat(80));
  
  const { searchParams } = new URL(request.url);
  const producto = searchParams.get('producto');
  const incluirObuma = searchParams.get('incluirObuma') !== 'false';

  console.log(`📝 Parámetros de búsqueda:`);
  console.log(`   - producto: "${producto}"`);
  console.log(`   - incluirObuma: ${incluirObuma}`);
  console.log(`   - timestamp: ${new Date().toISOString()}`);

  if (!producto || producto.trim().length < 2) {
    console.log(`❌ Error: Producto demasiado corto (${producto?.length || 0} caracteres)`);
    return NextResponse.json({ 
      error: 'Ingrese al menos 2 caracteres para buscar',
      producto_buscado: producto 
    }, { status: 400 });
  }

  const productoLower = producto.toLowerCase().trim();
  const resultados = [];
  let estadisticas = {
    supabase: {
      productos_encontrados: 0,
      proveedores_unicos: 0,
      proveedores_con_nombre: 0,
      tiempo_ms: 0
    },
    total_proveedores: 0,
    total_productos: 0
  };

  // =============================================
  // BUSCAR EN SUPABASE (proveedor_productos)
  // =============================================
  console.log('\n📡 PASO 1: Consultando Supabase...');
  const supabaseStart = Date.now();
  
  try {
    // 1.1 Buscar productos por nombre
    console.log(`   🔍 Query: ILIKE '%${productoLower}%'`);
    
    const { data: productosData, error: productosError } = await supabase
      .from('proveedor_productos')
      .select('*')
      .ilike('producto_nombre', `%${productoLower}%`);

    if (productosError) {
      console.error(`   ❌ Error en consulta de productos:`, productosError);
    } else {
      estadisticas.supabase.productos_encontrados = productosData?.length || 0;
      console.log(`   ✅ Productos encontrados: ${estadisticas.supabase.productos_encontrados}`);
      
      if (productosData && productosData.length > 0) {
        // Mostrar primeros 5 productos como ejemplo
        console.log(`   📦 Ejemplo de productos encontrados:`);
        productosData.slice(0, 5).forEach((p, i) => {
          console.log(`      ${i+1}. "${p.producto_nombre}" (proveedor_id: ${p.proveedor_id?.substring(0, 8)})`);
        });
        
        // 1.2 Obtener IDs únicos de proveedores
        const proveedorIds = [...new Set(productosData.map(p => p.proveedor_id))];
        estadisticas.supabase.proveedores_unicos = proveedorIds.length;
        console.log(`   🏢 Proveedores únicos involucrados: ${proveedorIds.length}`);
        
        // 1.3 Obtener datos completos de los proveedores
        const { data: proveedoresData, error: proveedoresError } = await supabase
          .from('proveedores')
          .select('*')
          .in('id', proveedorIds);

        if (proveedoresError) {
          console.error(`   ❌ Error en consulta de proveedores:`, proveedoresError);
        } else if (proveedoresData && proveedoresData.length > 0) {
          console.log(`   ✅ Proveedores encontrados: ${proveedoresData.length}`);
          
          // 1.4 Crear mapa de proveedores
          const proveedoresMap = new Map();
          
          for (const proveedor of proveedoresData) {
            // Determinar nombre a mostrar con prioridad
            let nombreMostrar = '';
            let tieneNombreReal = false;
            
            if (proveedor.nombre_empresa && 
                proveedor.nombre_empresa.trim() !== '' && 
                !proveedor.nombre_empresa.startsWith('Proveedor ') &&
                proveedor.nombre_empresa !== 'Sin nombre') {
              nombreMostrar = proveedor.nombre_empresa;
              tieneNombreReal = true;
              estadisticas.supabase.proveedores_con_nombre++;
            } 
            else if (proveedor.obuma_id) {
              nombreMostrar = `Proveedor ${proveedor.obuma_id}`;
            } 
            else {
              nombreMostrar = `Proveedor ${proveedor.id.substring(0, 8)}`;
            }
            
            console.log(`      📌 ${tieneNombreReal ? '✅' : '⚠️'} ${nombreMostrar} (RUT: ${proveedor.rut_empresa || 'N/A'})`);
            
            proveedoresMap.set(proveedor.id, {
              fuente: '📋 Base de Datos',
              id: proveedor.id,
              nombre: nombreMostrar,
              rut: proveedor.rut_empresa || proveedor.obuma_id || 'Sin RUT',
              telefono: proveedor.telefono || '',
              email: proveedor.email_contacto || '',
              sitio_web: proveedor.sitio_web || '',
              direccion: proveedor.direccion || '',
              comuna: proveedor.comuna || '',
              ciudad: proveedor.ciudad || '',
              calificacion: proveedor.calificacion || 0,
              tiene_nombre_real: tieneNombreReal,
              productos: []
            });
          }
          
          // 1.5 Agrupar productos por proveedor
          for (const productoItem of productosData) {
            const proveedor = proveedoresMap.get(productoItem.proveedor_id);
            if (proveedor) {
              proveedor.productos.push({
                nombre: productoItem.producto_nombre,
                sku: productoItem.producto_sku || '',
                ultimo_precio: productoItem.ultimo_precio || 0,
                precio_formateado: `$${(productoItem.ultimo_precio || 0).toLocaleString('es-CL')}`,
                fecha_compra: productoItem.fecha_ultima_compra || '',
                fuente_dato: 'Histórico de compras Obuma'
              });
            }
          }
          
          // 1.6 Agregar a resultados
          for (const proveedor of proveedoresMap.values()) {
            resultados.push(proveedor);
          }
          
          estadisticas.total_proveedores = resultados.length;
          estadisticas.total_productos = resultados.reduce((acc, p) => acc + p.productos.length, 0);
          
          console.log(`\n   📊 Resumen de búsqueda Supabase:`);
          console.log(`      - Proveedores encontrados: ${estadisticas.total_proveedores}`);
          console.log(`      - Con nombre real: ${estadisticas.supabase.proveedores_con_nombre}`);
          console.log(`      - Productos totales: ${estadisticas.total_productos}`);
        }
      } else {
        console.log(`   ⚠️ No se encontraron productos en proveedor_productos para "${producto}"`);
        console.log(`   💡 Sugerencia: Ejecuta POST /api/sincronizar-productos-obuma primero`);
      }
    }
  } catch (error) {
    console.error('   ❌ Excepción en consulta Supabase:', error);
  }
  
  estadisticas.supabase.tiempo_ms = Date.now() - supabaseStart;
  console.log(`   ⏱️ Tiempo de consulta Supabase: ${estadisticas.supabase.tiempo_ms}ms`);

  // =============================================
  // SI SE INCLUYE OBUMA (búsqueda en tiempo real)
  // =============================================
  if (incluirObuma) {
    console.log('\n🏢 PASO 2: Búsqueda en tiempo real en Obuma...');
    const obumaStart = Date.now();
    
    const OBUMA_API_URL = process.env.OBUMA_API_URL;
    const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

    if (OBUMA_API_TOKEN) {
      try {
        console.log(`   📡 Consultando API: ${OBUMA_API_URL}/comprasOc.listItems.json`);
        
        const ocResponse = await fetch(`${OBUMA_API_URL}/comprasOc.listItems.json`, {
          method: 'GET',
          headers: { 'access-token': OBUMA_API_TOKEN },
        });
        
        const ocData = await ocResponse.json();
        console.log(`   ✅ Items obtenidos: ${ocData.data?.length || 0}`);
        
        // Filtrar items por producto
        const itemsFiltrados = (ocData.data || []).filter((item: any) => 
          item.producto_nombre?.toLowerCase().includes(productoLower)
        );
        
        console.log(`   🔍 Items coincidentes: ${itemsFiltrados.length}`);
        
        if (itemsFiltrados.length > 0) {
          console.log(`   📦 Ejemplo del primer item encontrado:`);
          const primerItem = itemsFiltrados[0];
          console.log(`      - OC ID: ${primerItem.compra_oc_id}`);
          console.log(`      - Producto: ${primerItem.producto_nombre}`);
          console.log(`      - Precio: ${primerItem.precio}`);
          
          // Aquí podrías agregar lógica adicional para procesar estos items
          // Por ahora solo mostramos estadísticas
        }
        
      } catch (error) {
        console.error('   ❌ Error en búsqueda Obuma:', error);
      }
    } else {
      console.log(`   ⚠️ OBUMA_API_TOKEN no configurado, omitiendo búsqueda en tiempo real`);
    }
    
    console.log(`   ⏱️ Tiempo de búsqueda Obuma: ${Date.now() - obumaStart}ms`);
  }

  // =============================================
  // RESPUESTA FINAL
  // =============================================
  const totalTime = Date.now() - startTime;
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTADOS FINALES DE BÚSQUEDA');
  console.log('='.repeat(80));
  console.log(`   🔍 Producto buscado: "${producto}"`);
  console.log(`   🏢 Proveedores encontrados: ${estadisticas.total_proveedores}`);
  console.log(`   📦 Productos totales: ${estadisticas.total_productos}`);
  console.log(`   ✅ Proveedores con nombre real: ${estadisticas.supabase.proveedores_con_nombre}`);
  console.log(`   ⏱️ Tiempo total de búsqueda: ${totalTime}ms`);
  console.log('='.repeat(80));
  
  // Mostrar resumen de proveedores si hay
  if (resultados.length > 0) {
    console.log(`\n📋 LISTA DE PROVEEDORES ENCONTRADOS:`);
    resultados.forEach((prov, idx) => {
      const productosLista = prov.productos.map((p: any) => p.nombre).join(', ');
      console.log(`   ${idx + 1}. ${prov.nombre} (${prov.tiene_nombre_real ? 'nombre real' : 'nombre genérico'})`);
      console.log(`      📦 Productos: ${prov.productos.length} item(s) - ${productosLista.substring(0, 80)}${productosLista.length > 80 ? '...' : ''}`);
    });
  } else {
    console.log(`\n⚠️ No se encontraron proveedores para "${producto}"`);
  }

  return NextResponse.json({
    success: true,
    producto_buscado: producto,
    timestamp: new Date().toISOString(),
    tiempo_ms: totalTime,
    total_proveedores: estadisticas.total_proveedores,
    proveedores: resultados,
    estadisticas: {
      proveedores_con_nombre_real: estadisticas.supabase.proveedores_con_nombre,
      proveedores_sin_nombre: estadisticas.total_proveedores - estadisticas.supabase.proveedores_con_nombre,
      total_productos: estadisticas.total_productos,
      tiempo_busqueda_ms: estadisticas.supabase.tiempo_ms
    },
    fuentes: { 
      supabase: resultados.length, 
      obuma_en_tiempo_real: 0
    }
  });
}