// app/api/obuma/productos/list/route.ts
import { NextResponse, NextRequest } from 'next/server';

// Interfaz para el producto enriquecido
interface ProductoEnriquecido {
  id: string;
  sku: string;
  nombre: string;
  stock_actual: number;
  stock_minimo: number;
  precio_total: number;
  inventariable: boolean;
  precio_neto: number;
  precio_iva: number;
  precio_costo: number;
  categoria_nombre: string;
  subcategoria_nombre: string;
  fabricante_nombre: string;
  tipo: string;
  activo: boolean;
  para_venta: boolean;
  para_compra: boolean;
  vender_en_web: boolean;
  codigo_barra: string;
  url_imagen: string;
  created_at?: string;
  updated_at?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const page = searchParams.get('page') || '1';
  const filter = searchParams.get('filter') || searchParams.get('search') || '';
  const limit = searchParams.get('limit') || '100';
  const incluirStock = searchParams.get('incluirStock') !== 'false';

  const obumaUrl = new URL(`${process.env.OBUMA_API_URL}/productos.list.json`);
  obumaUrl.searchParams.append('page', page);
  obumaUrl.searchParams.append('limit', limit);
  
  if (filter) {
    obumaUrl.searchParams.append('filter', filter.trim());
  }

  try {
    // 1. Obtener productos
    const response = await fetch(obumaUrl.toString(), {
      method: 'GET',
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      },
      next: { revalidate: 60 }
    });

    if (!response.ok) {
      throw new Error(`Error de Obuma: ${response.status}`);
    }

    const data = await response.json();
    const productos = data.data || data.productos || [];

    if (productos.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        stats: {
          total_productos: 0,
          total_stock: 0,
          total_valor_inventario: 0,
          productos_con_stock_bajo: 0,
          productos_sin_stock: 0
        },
        pagination: data.pagination || { current_page: 1, last_page: 1, total: 0 }
      });
    }

    // 2. Obtener stock si se solicita
    let stockMap = new Map();
    
    if (incluirStock) {
      try {
        const stockUrl = new URL(`${process.env.OBUMA_API_URL}/productosStock.list.json`);
        const stockResponse = await fetch(stockUrl.toString(), {
          method: 'GET',
          headers: {
            'access-token': process.env.OBUMA_API_TOKEN || '',
            'Content-Type': 'application/json'
          },
          next: { revalidate: 60 }
        });
        
        if (stockResponse.ok) {
          const stockResult = await stockResponse.json();
          const stocks = stockResult.data || stockResult.productos || [];
          
          stocks.forEach((stock: any) => {
            const productoId = stock.producto_id || stock.id_producto;
            if (productoId) {
              stockMap.set(String(productoId), {
                stock_actual: stock.stock_actual || stock.cantidad || 0,
                stock_minimo: stock.stock_minimo || 0,
                stock_maximo: stock.stock_maximo || 0,
                bodega_nombre: stock.bodega_nombre || '',
                ultima_actualizacion: stock.updated_at || stock.fecha_actualizacion
              });
            }
          });
        }
      } catch (stockError) {
        console.error("Error obteniendo stock:", stockError);
      }
    }

    // 3. Enriquecer productos con información adicional
    const productosEnriquecidos: ProductoEnriquecido[] = productos.map((producto: any) => {
      const stockInfo = stockMap.get(String(producto.producto_id)) || {};
      
      const precioTotal = Number(producto.producto_precio_clp_total) || 0;
      const precioNeto = Math.round(precioTotal / 1.19);
      const iva = precioTotal - precioNeto;
      
      return {
        id: producto.producto_id,
        sku: producto.producto_codigo_comercial || '',
        nombre: producto.producto_nombre || '',
        tipo: producto.producto_tipo === '2' ? 'Servicio' : 'Producto',
        categoria_nombre: producto.categoria_nombre || '',
        subcategoria_nombre: producto.subcategoria_nombre || '',
        fabricante_nombre: producto.fabricante_nombre || '',
        precio_costo: Number(producto.producto_costo_clp_neto) || 0,
        precio_neto: precioNeto,
        precio_iva: iva,
        precio_total: precioTotal,
        stock_actual: stockInfo.stock_actual || 0,
        stock_minimo: stockInfo.stock_minimo || 0,
        inventariable: producto.producto_inventariable === '1',
        activo: producto.producto_activo === '1',
        para_venta: producto.producto_para_venta === '1',
        para_compra: producto.producto_para_compra === '1',
        vender_en_web: producto.producto_vender_en_web === '1',
        codigo_barra: producto.producto_codigo_barra || '',
        url_imagen: producto.producto_imagen || '',
        created_at: producto.created_at,
        updated_at: producto.updated_at
      };
    });

    // 4. Calcular estadísticas (con tipos correctos)
    const stats = {
      total_productos: productosEnriquecidos.length,
      total_stock: productosEnriquecidos.reduce((sum: number, p: ProductoEnriquecido) => sum + (p.stock_actual || 0), 0),
      total_valor_inventario: productosEnriquecidos.reduce((sum: number, p: ProductoEnriquecido) => sum + ((p.precio_total || 0) * (p.stock_actual || 0)), 0),
      productos_con_stock_bajo: productosEnriquecidos.filter((p: ProductoEnriquecido) => p.stock_actual > 0 && p.stock_actual <= (p.stock_minimo || 5)).length,
      productos_sin_stock: productosEnriquecidos.filter((p: ProductoEnriquecido) => p.stock_actual === 0 && p.inventariable).length
    };

    return NextResponse.json({
      success: true,
      data: productosEnriquecidos,
      stats: stats,
      pagination: {
        current_page: data.pagination?.current_page || parseInt(page),
        last_page: data.pagination?.last_page || 1,
        per_page: data.pagination?.per_page || parseInt(limit),
        total: data.pagination?.total || productosEnriquecidos.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Error en Listado Obuma:", error.message);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al conectar con la API de Obuma', 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}