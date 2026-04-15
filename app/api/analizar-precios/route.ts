import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Obtenemos los registros de los últimos 7 días para comparar
    const { data, error } = await supabase
      .from('registros_precios')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) throw error;

    // Lógica para agrupar por producto y tienda y ver la tendencia
    const analisis = data.reduce((acc: any, curr: any) => {
      const key = `${curr.termino_busqueda}-${curr.tienda}`;
      if (!acc[key]) {
        acc[key] = {
          producto: curr.termino_busqueda,
          tienda: curr.tienda,
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