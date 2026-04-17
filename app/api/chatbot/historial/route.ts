import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { usuario_id, usuario_nombre, pregunta, respuesta, productos_encontrados, fuente } = await req.json();
    
    const { data, error } = await supabase
      .from('chatbot_historial')
      .insert({
        usuario_id,
        usuario_nombre,
        pregunta,
        respuesta,
        productos_encontrados: productos_encontrados || 0,
        fuente: fuente || 'supabase'
      });
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error guardando historial:", error);
    return NextResponse.json({ error: "Error guardando historial" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const usuario_id = searchParams.get('usuario_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    let query = supabase
      .from('chatbot_historial')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (usuario_id) {
      query = query.eq('usuario_id', usuario_id);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, historial: data });
  } catch (error) {
    console.error("Error obteniendo historial:", error);
    return NextResponse.json({ error: "Error obteniendo historial" }, { status: 500 });
  }
}