import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Forzamos a que la ruta sea dinámica para que Vercel no intente 
// ejecutarla durante el build sin las variables de entorno.
export const dynamic = 'force-dynamic';

export async function GET() {
  // Inicializamos dentro del GET para asegurar que las variables existan al ejecutar
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Faltan las credenciales de Supabase en las variables de entorno." },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Obtenemos los registros para comparar
    const { data, error } = await supabase
      .from('registros_precios')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json([]);
    }

    // Lógica para agrupar por producto y tienda y ver la tendencia
    const analisis = data.reduce((acc: any, curr: any) => {
      const key = `${curr.termino_busqueda}-${curr.tienda}`;
      if (!acc[key]) {
        acc[key] = {
          producto: curr.termino_busqueda,
          tienda: curr.tienda,
          link: curr.link, // <--- SE AGREGÓ EL LINK AQUÍ
          precio_actual: curr.precio_valor,
          precios_historial: [curr.precio_valor],
          ultima_fecha: curr.fecha
        };
      } else {
        acc[key].precios_historial.push(curr.precio_valor);
      }
      return acc;
    }, {});

    // Calculamos la tendencia
    const resultadosFinales = Object.values(analisis).map((item: any) => {
      const actual = item.precio_actual;
      // El anterior es el último del historial (el más viejo registrado)
      const anterior = item.precios_historial[item.precios_historial.length - 1];
      const diferencia = actual - anterior;
      
      return {
        ...item,
        precio_anterior: anterior,
        diferencia,
        tendencia: diferencia > 0 ? 'SUBE' : diferencia < 0 ? 'BAJA' : 'MANTIENE'
      };
    });

    return NextResponse.json(resultadosFinales);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}