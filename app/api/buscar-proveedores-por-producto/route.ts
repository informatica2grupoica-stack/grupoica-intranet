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
      console.error(`❌ Error en productos:`, productosError);
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
          // 🔥 LÓGICA CORREGIDA para mostrar el nombre
          let nombreMostrar = '';
          
          if (proveedor.nombre_empresa && proveedor.nombre_empresa.trim() !== '') {
            // Tiene nombre real en la base de datos
            nombreMostrar = proveedor.nombre_empresa;
          } else if (proveedor.obuma_id) {
            // No tiene nombre, pero tiene obuma_id
            nombreMostrar = `Proveedor ${proveedor.obuma_id}`;
          } else {
            // No tiene nada, usar ID parcial
            nombreMostrar = `Proveedor ${proveedor.id.substring(0, 8)}`;
          }
          
          console.log(`📌 Proveedor: ${proveedor.id.substring(0, 8)} - Nombre: "${nombreMostrar}"`);
          
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
        console.log(`✅ ${resultados.length} proveedores agregados con ${resultados.reduce((acc, p) => acc + p.productos.length, 0)} productos`);
      }
    } else {
      console.log(`⚠️ No se encontraron productos con "${producto}"`);
    }
  } catch (error) {
    console.error('❌ Excepción en Supabase:', error);
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