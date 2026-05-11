// app/api/buscar-proveedores-por-producto/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  console.log('='.repeat(60));
  console.log('🚀 INICIO DE BÚSQUEDA DE PROVEEDORES');
  console.log('='.repeat(60));
  
  const { searchParams } = new URL(request.url);
  const producto = searchParams.get('producto');
  const incluirObuma = searchParams.get('incluirObuma') !== 'false';

  console.log(`📝 Parámetros recibidos:`);
  console.log(`   - producto: "${producto}"`);
  console.log(`   - incluirObuma: ${incluirObuma}`);

  if (!producto || producto.trim().length < 2) {
    console.log(`❌ Error: Producto muy corto (${producto?.length || 0} caracteres)`);
    return NextResponse.json(
      { error: 'Ingrese al menos 2 caracteres para buscar' },
      { status: 400 }
    );
  }

  const productoLower = producto.toLowerCase().trim();
  const resultados = [];

  // =============================================
  // 1. BUSCAR EN SUPABASE
  // =============================================
  console.log('\n📋 PASO 1: Buscando en Supabase...');
  
  try {
    console.log(`   🔍 Query: ilike 'producto_nombre', '%${productoLower}%'`);
    
    const { data: productosData, error: productosError } = await supabase
      .from('proveedor_productos')
      .select('*')
      .ilike('producto_nombre', `%${productoLower}%`);

    if (productosError) {
      console.error(`   ❌ Error en Supabase:`, productosError);
    } else {
      console.log(`   ✅ Encontrados ${productosData?.length || 0} productos en Supabase`);
      
      if (productosData && productosData.length > 0) {
        console.log(`   📦 Productos encontrados:`);
        productosData.forEach((p, i) => {
          console.log(`      ${i+1}. ${p.producto_nombre} (proveedor_id: ${p.proveedor_id})`);
        });
        
        const proveedorIds = [...new Set(productosData.map(p => p.proveedor_id))];
        console.log(`   🏢 Proveedores únicos: ${proveedorIds.length}`);
        
        const { data: proveedoresData, error: proveedoresError } = await supabase
          .from('proveedores')
          .select('*')
          .in('id', proveedorIds);

        if (proveedoresError) {
          console.error(`   ❌ Error obteniendo proveedores:`, proveedoresError);
        } else if (proveedoresData) {
          console.log(`   ✅ Proveedores encontrados: ${proveedoresData.length}`);
          
          const proveedoresMap = new Map();
          for (const proveedor of proveedoresData) {
            console.log(`      - ${proveedor.nombre_empresa} (${proveedor.rut_empresa})`);
            proveedoresMap.set(proveedor.id, {
              fuente: '📋 Nuestra Base de Datos',
              id: proveedor.id,
              nombre: proveedor.nombre_empresa,
              rut: proveedor.rut_empresa,
              telefono: proveedor.telefono,
              email: proveedor.email_contacto,
              sitio_web: proveedor.sitio_web,
              direccion: proveedor.direccion,
              comuna: proveedor.comuna,
              ciudad: proveedor.ciudad,
              calificacion: proveedor.calificacion,
              productos: []
            });
          }
          
          for (const productoItem of productosData) {
            const proveedor = proveedoresMap.get(productoItem.proveedor_id);
            if (proveedor) {
              proveedor.productos.push({
                nombre: productoItem.producto_nombre,
                sku: productoItem.producto_sku,
                ultimo_precio: productoItem.ultimo_precio,
                fecha_compra: productoItem.fecha_ultima_compra,
                fuente_dato: 'Manual / Histórico Supabase'
              });
            }
          }
          
          resultados.push(...Array.from(proveedoresMap.values()));
          console.log(`   ✅ ${resultados.length} proveedores agregados desde Supabase`);
        }
      }
    }
  } catch (error) {
    console.error('   ❌ Excepción en búsqueda Supabase:', error);
  }

  // =============================================
  // 2. BUSCAR EN OBUMA
  // =============================================
  if (incluirObuma) {
    console.log('\n🏢 PASO 2: Buscando en Obuma...');
    
    const OBUMA_API_URL = process.env.OBUMA_API_URL;
    const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

    console.log(`   🔑 OBUMA_API_TOKEN configurado: ${OBUMA_API_TOKEN ? 'SÍ' : 'NO'}`);
    console.log(`   🌐 OBUMA_API_URL: ${OBUMA_API_URL}`);

    if (OBUMA_API_TOKEN) {
      try {
        console.log(`   📡 Llamando a: ${OBUMA_API_URL}/comprasOc.list.json`);
        
        const ocResponse = await fetch(`${OBUMA_API_URL}/comprasOc.list.json`, {
          method: 'GET',
          headers: {
            'access-token': OBUMA_API_TOKEN,
            'Content-Type': 'application/json',
          },
        });

        console.log(`   📊 Response status: ${ocResponse.status}`);
        
        const ocData = await ocResponse.json();
        console.log(`   📦 Órdenes de compra encontradas: ${ocData.data?.length || 0}`);
        
        if (ocData.data && Array.isArray(ocData.data)) {
          const proveedoresObuma = new Map();
          const limite = Math.min(ocData.data.length, 10);
          console.log(`   🔄 Procesando primeras ${limite} órdenes...`);
          
          for (let i = 0; i < limite; i++) {
            const oc = ocData.data[i];
            console.log(`\n   --- OC ${i+1}/${limite} ---`);
            console.log(`   ID: ${oc.compra_oc_id}, Folio: ${oc.compra_oc_folio}`);
            
            try {
              const detalleResponse = await fetch(`${OBUMA_API_URL}/comprasOc.findById.json/${oc.compra_oc_id}`, {
                method: 'GET',
                headers: {
                  'access-token': OBUMA_API_TOKEN,
                  'Content-Type': 'application/json',
                },
              });
              
              const detalle = await detalleResponse.json();
              
              if (!detalle.compra_detalle) {
                console.log(`   ⚠️ No tiene detalle de productos`);
                continue;
              }
              
              console.log(`   📦 Productos en OC: ${detalle.compra_detalle.length}`);
              
              const productosCoincidentes = detalle.compra_detalle.filter((item: any) =>
                item.producto_nombre?.toLowerCase().includes(productoLower)
              );
              
              console.log(`   🔍 Productos coincidentes con "${productoLower}": ${productosCoincidentes.length}`);
              
              if (productosCoincidentes.length > 0) {
                const rutProveedor = detalle.proveedor_rut;
                console.log(`   ✅ Proveedor encontrado: ${detalle.proveedor_razon_social} (${rutProveedor})`);
                
                if (!proveedoresObuma.has(rutProveedor)) {
                  proveedoresObuma.set(rutProveedor, {
                    fuente: '🏢 Obuma (Histórico de Compras)',
                    id: detalle.proveedor_id,
                    nombre: detalle.proveedor_razon_social,
                    rut: detalle.proveedor_rut,
                    direccion: detalle.proveedor_direccion,
                    telefono: detalle.proveedor_telefono,
                    email: detalle.proveedor_email,
                    productos: []
                  });
                }
                
                for (const item of productosCoincidentes) {
                  console.log(`      📦 Producto: ${item.producto_nombre}, Precio: ${item.precio}`);
                  proveedoresObuma.get(rutProveedor).productos.push({
                    nombre: item.producto_nombre,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio,
                    subtotal: item.subtotal,
                    fecha_compra: detalle.compra_oc_fecha_ingreso?.split('T')[0],
                    folio_oc: detalle.compra_oc_folio,
                    fuente_dato: 'Orden de Compra Obuma'
                  });
                }
              }
            } catch (ocError) {
              console.error(`   ❌ Error procesando OC ${oc.compra_oc_id}:`, ocError);
            }
          }
          
          const obumaResults = Array.from(proveedoresObuma.values());
          console.log(`\n   🏢 Total proveedores Obuma encontrados: ${obumaResults.length}`);
          resultados.push(...obumaResults);
        }
      } catch (error) {
        console.error('   ❌ Error en búsqueda Obuma:', error);
      }
    } else {
      console.warn('   ⚠️ OBUMA_API_TOKEN no configurado');
    }
  }

  // =============================================
  // 3. ELIMINAR DUPLICADOS
  // =============================================
  console.log('\n🔄 PASO 3: Eliminando duplicados...');
  
  const resultadosUnicos = [];
  const rutsVistos = new Set();
  
  for (const resultado of resultados) {
    if (!rutsVistos.has(resultado.rut)) {
      resultadosUnicos.push(resultado);
      rutsVistos.add(resultado.rut);
      console.log(`   ✅ Manteniendo: ${resultado.nombre} (${resultado.rut})`);
    } else {
      console.log(`   ❌ Duplicado eliminado: ${resultado.nombre} (${resultado.rut})`);
    }
  }

  // =============================================
  // 4. RESPUESTA FINAL
  // =============================================
  console.log('\n📊 PASO 4: Estadísticas finales');
  console.log(`   🔍 Producto buscado: "${producto}"`);
  console.log(`   🏢 Total proveedores únicos: ${resultadosUnicos.length}`);
  console.log(`   📋 Fuente Supabase: ${resultados.filter(r => r.fuente.includes('Supabase')).length}`);
  console.log(`   🏢 Fuente Obuma: ${resultados.filter(r => r.fuente.includes('Obuma')).length}`);
  console.log('='.repeat(60));
  console.log('🏁 FIN DE BÚSQUEDA\n');

  return NextResponse.json({
    success: true,
    producto_buscado: producto,
    total_proveedores: resultadosUnicos.length,
    proveedores: resultadosUnicos,
    fuentes: {
      supabase: resultados.filter(r => r.fuente.includes('Supabase')).length,
      obuma: resultados.filter(r => r.fuente.includes('Obuma')).length
    }
  });
}