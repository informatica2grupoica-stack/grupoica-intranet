import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  console.log('='.repeat(60));
  console.log('🔍 BÚSQUEDA DE PROVEEDORES POR PRODUCTO');
  console.log('='.repeat(60));
  
  const { searchParams } = new URL(request.url);
  const producto = searchParams.get('producto');
  const incluirObuma = searchParams.get('incluirObuma') !== 'false';

  console.log(`📝 Parámetros: producto="${producto}", incluirObuma=${incluirObuma}`);

  if (!producto || producto.trim().length < 2) {
    return NextResponse.json({ error: 'Ingrese al menos 2 caracteres' }, { status: 400 });
  }

  const productoLower = producto.toLowerCase().trim();
  const resultados = [];

  // =============================================
  // BUSCAR EN proveedor_productos (productos sincronizados)
  // =============================================
  console.log('\n📋 BUSCANDO EN proveedor_productos...');
  
  try {
    // Buscar productos que coincidan (insensible a mayúsculas)
    const { data: productosData, error: productosError } = await supabase
      .from('proveedor_productos')
      .select('*')
      .ilike('producto_nombre', `%${productoLower}%`);

    console.log(`📦 Productos encontrados: ${productosData?.length || 0}`);

    if (productosError) {
      console.error(`❌ Error en productos:`, productosError);
    } else if (productosData && productosData.length > 0) {
      
      // Obtener IDs únicos de proveedores
      const proveedorIds = [...new Set(productosData.map(p => p.proveedor_id))];
      console.log(`🏢 IDs de proveedores únicos: ${proveedorIds.length}`);
      
      // Obtener datos completos de los proveedores
      const { data: proveedoresData, error: proveedoresError } = await supabase
        .from('proveedores')
        .select('*')
        .in('id', proveedorIds);

      console.log(`🏢 Proveedores encontrados en BD: ${proveedoresData?.length || 0}`);

      if (!proveedoresError && proveedoresData && proveedoresData.length > 0) {
        
        // Crear mapa de proveedores
        const proveedoresMap = new Map();
        for (const proveedor of proveedoresData) {
          // Determinar nombre a mostrar - PRIORIDAD: nombre real primero
          let nombreMostrar = '';
          
          // Si tiene nombre real y no es genérico
          if (proveedor.nombre_empresa && 
              proveedor.nombre_empresa.trim() !== '' && 
              !proveedor.nombre_empresa.startsWith('Proveedor ')) {
            nombreMostrar = proveedor.nombre_empresa;
          } 
          // Si tiene obuma_id, mostrar "Proveedor {id}"
          else if (proveedor.obuma_id) {
            nombreMostrar = `Proveedor ${proveedor.obuma_id}`;
          } 
          // Fallback: usar ID parcial
          else {
            nombreMostrar = `Proveedor ${proveedor.id.substring(0, 8)}`;
          }
          
          console.log(`   📌 Proveedor: ${nombreMostrar} (ID: ${proveedor.id.substring(0, 8)})`);
          
          proveedoresMap.set(proveedor.id, {
            fuente: '📋 Nuestra Base de Datos',
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
            productos: []
          });
        }
        
        // Agrupar productos por proveedor
        for (const productoItem of productosData) {
          const proveedor = proveedoresMap.get(productoItem.proveedor_id);
          if (proveedor) {
            proveedor.productos.push({
              nombre: productoItem.producto_nombre,
              sku: productoItem.producto_sku || '',
              ultimo_precio: productoItem.ultimo_precio || 0,
              fecha_compra: productoItem.fecha_ultima_compra || '',
              fuente_dato: 'Histórico de compras Obuma'
            });
          }
        }
        
        // Agregar a resultados
        for (const proveedor of proveedoresMap.values()) {
          resultados.push(proveedor);
        }
        
        console.log(`✅ ${resultados.length} proveedores agregados con ${resultados.reduce((acc, p) => acc + p.productos.length, 0)} productos`);
      } else {
        console.log(`⚠️ No se encontraron proveedores en la tabla proveedores para esos IDs`);
        if (proveedoresError) {
          console.error(`   Error:`, proveedoresError);
        }
      }
    } else {
      console.log(`⚠️ No hay productos en proveedor_productos para "${producto}"`);
      console.log(`   💡 Sugerencia: Ejecuta POST /api/sincronizar-productos-obuma para sincronizar datos`);
    }
  } catch (error) {
    console.error('❌ Excepción en Supabase:', error);
  }

  // =============================================
  // RESPUESTA FINAL
  // =============================================
  const supabaseCount = resultados.length;
  const totalProductos = resultados.reduce((acc, p) => acc + p.productos.length, 0);
  
  console.log(`\n📊 RESULTADOS FINALES:`);
  console.log(`   - Proveedores encontrados: ${supabaseCount}`);
  console.log(`   - Total de productos: ${totalProductos}`);
  console.log('='.repeat(60));

  // Mostrar resumen de proveedores encontrados
  if (resultados.length > 0) {
    console.log(`\n📋 LISTA DE PROVEEDORES ENCONTRADOS:`);
    resultados.forEach((prov, idx) => {
      console.log(`   ${idx + 1}. ${prov.nombre} (${prov.productos.length} productos)`);
    });
  }

  return NextResponse.json({
    success: true,
    producto_buscado: producto,
    total_proveedores: resultados.length,
    proveedores: resultados,
    fuentes: { 
      supabase: supabaseCount, 
      obuma: 0  // Por ahora solo datos sincronizados
    }
  });
}