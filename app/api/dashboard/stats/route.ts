import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Obtener productos desde Supabase (más rápido)
    const { data: productos, error } = await supabase
      .from('productos_obuma')
      .select('*')
      .eq('activo', true);
    
    if (error) throw error;
    
    const total_productos = productos?.length || 0;
    const total_stock = productos?.reduce((sum, p) => sum + (p.stock_actual || 0), 0) || 0;
    const total_valor_inventario = productos?.reduce((sum, p) => sum + ((p.precio_total || 0) * (p.stock_actual || 0)), 0) || 0;
    const productos_con_stock_bajo = productos?.filter(p => p.stock_actual > 0 && p.stock_actual <= (p.stock_minimo || 5)).length || 0;
    const productos_sin_stock = productos?.filter(p => p.stock_actual === 0 && p.inventariable).length || 0;
    
    // Categorías únicas
    const categoriasUnicas = new Set(productos?.map(p => p.categoria_nombre).filter(Boolean));
    
    // Precio promedio
    const precio_promedio = productos?.reduce((sum, p) => sum + (p.precio_total || 0), 0) / total_productos || 0;
    
    return NextResponse.json({
      success: true,
      stats: {
        total_productos,
        total_stock,
        total_valor_inventario,
        productos_con_stock_bajo,
        productos_sin_stock,
        categorias_count: categoriasUnicas.size,
        precio_promedio: Math.round(precio_promedio)
      },
      ultima_sincronizacion: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Error en dashboard stats:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener estadísticas" },
      { status: 500 }
    );
  }
}