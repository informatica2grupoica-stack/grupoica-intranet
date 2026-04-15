import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  try {
    const { resultados, termino } = await req.json();

    if (!resultados || resultados.length === 0) return NextResponse.json({ ok: true });

    const { error } = await supabase
      .from('registros_precios')
      .insert(resultados.map((r: any) => ({
        termino_busqueda: termino,
        nombre_producto: r.nombre,
        tienda: r.tienda,
        precio_valor: r.precio_valor,
        link: r.link,
        canal: r.canal
      })));

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error en Supabase:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}