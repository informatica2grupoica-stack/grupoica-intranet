// app/api/buscar-proveedores-por-producto/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const producto = searchParams.get('producto');
  const incluirObuma = searchParams.get('incluirObuma') !== 'false';

  if (!producto || producto.trim().length < 2) {
    return NextResponse.json(
      { error: 'Ingrese al menos 2 caracteres para buscar' },
      { status: 400 }
    );
  }

  const productoLower = producto.toLowerCase().trim();
  const resultados = [];

  console.log(`🔍 Buscando proveedores para: "${productoLower}"`);

  // =============================================
  // 1. BUSCAR EN SUPABASE
  // =============================================
  try {
    // Primero obtenemos los productos que coinciden
    const { data: productosData, error: productosError } = await supabase
      .from('proveedor_productos')
      .select('*')
      .ilike('producto_nombre', `%${productoLower}%`);

    if (productosError) {
      console.error('Error buscando productos:', productosError);
    } else if (productosData && productosData.length > 0) {
      // Obtenemos los IDs de proveedores únicos
      const proveedorIds = [...new Set(productosData.map(p => p.proveedor_id))];
      
      // Obtenemos los datos de los proveedores
      const { data: proveedoresData, error: proveedoresError } = await supabase
        .from('proveedores')
        .select('*')
        .in('id', proveedorIds);

      if (proveedoresError) {
        console.error('Error buscando proveedores:', proveedoresError);
      } else if (proveedoresData) {
        // Crear un mapa de proveedores por ID
        const proveedoresMap = new Map();
        for (const proveedor of proveedoresData) {
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
        
        // Agregar productos a cada proveedor
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
      }
    }
  } catch (error) {
    console.error('Error en búsqueda Supabase:', error);
  }

  // =============================================
  // 2. BUSCAR EN OBUMA
  // =============================================
  if (incluirObuma) {
    const OBUMA_API_URL = process.env.OBUMA_API_URL;
    const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

    if (OBUMA_API_TOKEN) {
      try {
        console.log('📡 Buscando en Obuma...');
        
        const ocResponse = await fetch(`${OBUMA_API_URL}/comprasOc.list.json`, {
          method: 'GET',
          headers: {
            'access-token': OBUMA_API_TOKEN,
            'Content-Type': 'application/json',
          },
        });

        const ocData = await ocResponse.json();
        
        if (ocData.data && Array.isArray(ocData.data)) {
          const proveedoresObuma = new Map();
          
          for (const oc of ocData.data.slice(0, 50)) {
            try {
              const detalleResponse = await fetch(`${OBUMA_API_URL}/comprasOc.findById.json/${oc.compra_oc_id}`, {
                method: 'GET',
                headers: {
                  'access-token': OBUMA_API_TOKEN,
                  'Content-Type': 'application/json',
                },
              });
              
              const detalle = await detalleResponse.json();
              
              if (!detalle.compra_detalle) continue;
              
              const productosCoincidentes = detalle.compra_detalle.filter((item: any) =>
                item.producto_nombre?.toLowerCase().includes(productoLower)
              );
              
              if (productosCoincidentes.length > 0) {
                const rutProveedor = detalle.proveedor_rut;
                
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
              console.error(`Error procesando OC ${oc.compra_oc_id}:`, ocError);
            }
          }
          
          resultados.push(...Array.from(proveedoresObuma.values()));
        }
      } catch (error) {
        console.error('Error buscando en Obuma:', error);
      }
    }
  }

  // Eliminar duplicados por RUT
  const resultadosUnicos = [];
  const rutsVistos = new Set();
  
  for (const resultado of resultados) {
    if (!rutsVistos.has(resultado.rut)) {
      resultadosUnicos.push(resultado);
      rutsVistos.add(resultado.rut);
    }
  }

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