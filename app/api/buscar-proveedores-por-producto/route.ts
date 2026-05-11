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

  console.log(`📝 Parámetros: producto="${producto}", incluirObuma=${incluirObuma}`);

  if (!producto || producto.trim().length < 2) {
    return NextResponse.json({ error: 'Ingrese al menos 2 caracteres para buscar' }, { status: 400 });
  }

  const productoLower = producto.toLowerCase().trim();
  const resultados = [];

  // =============================================
  // BUSCAR EN SUPABASE
  // =============================================
  console.log('\n📋 BUSCANDO EN SUPABASE...');
  
  try {
    const { data: productosData, error: productosError } = await supabase
      .from('proveedor_productos')
      .select('*')
      .ilike('producto_nombre', `%${productoLower}%`);

    if (productosError) {
      console.error(`❌ Error:`, productosError);
    } else if (productosData && productosData.length > 0) {
      console.log(`✅ ${productosData.length} productos encontrados`);
      
      const proveedorIds = [...new Set(productosData.map(p => p.proveedor_id))];
      
      const { data: proveedoresData, error: proveedoresError } = await supabase
        .from('proveedores')
        .select('*')
        .in('id', proveedorIds);

      if (!proveedoresError && proveedoresData) {
        console.log(`✅ ${proveedoresData.length} proveedores encontrados`);
        
        const proveedoresMap = new Map();
        for (const proveedor of proveedoresData) {
          // Usar el nombre real si existe, si no, mostrar el ID
          const nombreMostrar = proveedor.nombre_empresa && !proveedor.nombre_empresa.startsWith('Proveedor ')
            ? proveedor.nombre_empresa 
            : `Proveedor ${proveedor.obuma_id || proveedor.id}`;
          
          proveedoresMap.set(proveedor.id, {
            fuente: '📋 Nuestra Base de Datos',
            id: proveedor.id,
            nombre: nombreMostrar,
            rut: proveedor.rut_empresa || '',
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
        
        for (const productoItem of productosData) {
          const proveedor = proveedoresMap.get(productoItem.proveedor_id);
          if (proveedor) {
            proveedor.productos.push({
              nombre: productoItem.producto_nombre,
              sku: productoItem.producto_sku || '',
              ultimo_precio: productoItem.ultimo_precio || 0,
              fecha_compra: productoItem.fecha_ultima_compra || '',
              fuente_dato: 'Histórico de compras'
            });
          }
        }
        
        resultados.push(...Array.from(proveedoresMap.values()));
        console.log(`✅ ${resultados.length} proveedores agregados`);
      }
    } else {
      console.log(`⚠️ No se encontraron productos con "${producto}"`);
    }
  } catch (error) {
    console.error('❌ Excepción:', error);
  }

  // =============================================
  // RESPUESTA FINAL
  // =============================================
  console.log(`\n📊 TOTAL PROVEEDORES: ${resultados.length}`);
  console.log('='.repeat(60));

  return NextResponse.json({
    success: true,
    producto_buscado: producto,
    total_proveedores: resultados.length,
    proveedores: resultados,
    fuentes: { supabase: resultados.length, obuma: 0 }
  });
}