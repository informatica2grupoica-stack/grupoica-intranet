// app/api/sincronizar-productos-obuma/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Definir interfaces para los datos de Obuma
interface OrdenCompra {
  compra_oc_id: string;
  compra_oc_folio: string;
  rel_proveedor_id: string;
  proveedor_razon_social?: string;
  proveedor_rut?: string;
  compra_oc_fecha_ingreso?: string;
  compra_oc_total?: string;
  compra_oc_estado?: string;
  [key: string]: any;
}

interface ItemCompra {
  compra_oc_id: string;
  compra_item_id?: string;
  producto_nombre?: string;
  producto_descripcion?: string;
  precio?: string;
  subtotal?: string;
  codigo_comercial?: string;
  [key: string]: any;
}

interface ItemsResponse {
  data: ItemCompra[];
}

interface OrdenesResponse {
  data: OrdenCompra[];
}

export async function POST(request: Request) {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 SINCRONIZACIÓN DE PRODUCTOS DESDE OBUMA');
  console.log('='.repeat(60));
  
  const OBUMA_API_URL = process.env.OBUMA_API_URL;
  const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

  if (!OBUMA_API_TOKEN) {
    return NextResponse.json({ error: 'API token no configurado' }, { status: 500 });
  }

  try {
    // 1. Obtener órdenes de compra
    console.log('📡 Obteniendo órdenes de compra...');
    const ocResponse = await fetch(`${OBUMA_API_URL}/comprasOc.list.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN },
    });
    const ocData: OrdenesResponse = await ocResponse.json();
    console.log(`✅ ${ocData.data?.length || 0} órdenes encontradas`);

    // 2. Obtener items
    console.log('📡 Obteniendo items...');
    const itemsResponse = await fetch(`${OBUMA_API_URL}/comprasOc.listItems.json`, {
      method: 'GET',
      headers: { 'access-token': OBUMA_API_TOKEN },
    });
    const itemsData: ItemsResponse = await itemsResponse.json();
    console.log(`✅ ${itemsData.data?.length || 0} items encontrados`);

    // 3. Mapear OC a proveedor
    const ocToProveedor = new Map<string, string>();
    for (const oc of ocData.data) {
      if (oc.rel_proveedor_id) {
        ocToProveedor.set(oc.compra_oc_id, oc.rel_proveedor_id);
      }
    }
    console.log(`📦 Mapeo: ${ocToProveedor.size} órdenes con proveedor`);

    // 4. Agrupar productos por proveedor
    const productosPorProveedor = new Map<string, Array<{nombre: string, precio: number, sku: string, fecha: string}>>();
    
    for (const item of itemsData.data.slice(0, 500)) {
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

    // 5. Guardar en Supabase
    let totalProveedoresCreados = 0;
    let totalProductosGuardados = 0;
    let proveedoresExistentes = 0;
    
    for (const [proveedorIdObuma, productos] of productosPorProveedor) {
      let proveedorId: string | null = null;
      
      const { data: existente } = await supabase
        .from('proveedores')
        .select('id')
        .eq('obuma_id', proveedorIdObuma)
        .maybeSingle();

      if (existente) {
        proveedorId = existente.id;
        proveedoresExistentes++;
      } else {
        const ocConProveedor = ocData.data.find((oc: OrdenCompra) => oc.rel_proveedor_id === proveedorIdObuma);
        const nombreProveedor = ocConProveedor?.proveedor_razon_social || `Proveedor ${proveedorIdObuma}`;
        const rutProveedor = ocConProveedor?.proveedor_rut || `ID_${proveedorIdObuma}`;
        
        const { data: nuevo, error: createError } = await supabase
          .from('proveedores')
          .insert({
            obuma_id: proveedorIdObuma,
            nombre_empresa: nombreProveedor,
            rut_empresa: rutProveedor,
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
          console.log(`✅ Nuevo proveedor: ${nombreProveedor}`);
        }
      }
      
      if (!proveedorId) continue;
      
      // Guardar productos
      console.log(`   💾 Proveedor ${proveedorIdObuma}: ${productos.length} productos`);
      
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
        
        if (insertError) {
          console.error(`      ❌ Error: ${insertError.message}`);
        } else {
          totalProductosGuardados++;
          if (totalProductosGuardados <= 30) {
            console.log(`      ✅ "${prod.nombre.substring(0, 45)}" - $${prod.precio}`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADOS FINALES');
    console.log('='.repeat(60));
    console.log(`   Proveedores existentes: ${proveedoresExistentes}`);
    console.log(`   Proveedores nuevos creados: ${totalProveedoresCreados}`);
    console.log(`   Productos sincronizados: ${totalProductosGuardados}`);
    console.log('='.repeat(60));

    return NextResponse.json({
      success: true,
      estadisticas: {
        proveedores_existentes: proveedoresExistentes,
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