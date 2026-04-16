import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 1. Forzamos modo dinámico para que Vercel no lo ejecute en el build
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // 2. Inicializamos las variables dentro del POST
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Usamos la ANON_KEY que confirmamos que tienes activa
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Credenciales de Supabase no encontradas" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { resultados, termino } = await req.json();

    if (!resultados || resultados.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // 3. Insertamos los datos
    const { error } = await supabase
      .from('registros_precios')
      .insert(resultados.map((r: any) => ({
        termino_busqueda: termino,
        nombre_producto: r.nombre,
        tienda: r.tienda,
        precio_valor: r.precio_valor,
        link: r.link,
        canal: r.canal,
        fecha: new Date().toISOString() // Buena práctica: añadir la fecha aquí también
      })));

    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error en Supabase:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}