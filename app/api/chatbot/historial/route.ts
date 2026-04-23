// app/api/chatbot/historial/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ✅ Usar las variables de entorno correctas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // ✅ Cambiar a NEXT_PUBLIC_SUPABASE_ANON_KEY

// ✅ Verificar que las variables existen antes de crear el cliente
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno de Supabase');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export async function GET() {
  try {
    // Verificar que el cliente está configurado
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Configuración de Supabase no disponible' },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from('chatbot_historial')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Error en GET /api/chatbot/historial:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener historial' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Configuración de Supabase no disponible' },
        { status: 500 }
      );
    }

    const body = await request.json();

    const { data, error } = await supabase
      .from('chatbot_historial')
      .insert([{
        usuario_id: body.usuario_id,
        usuario_nombre: body.usuario_nombre,
        pregunta: body.pregunta,
        respuesta: body.respuesta,
        productos_encontrados: body.productos_encontrados || 0,
        fuente: body.fuente || 'supabase',
        feedback: body.feedback || null,
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en POST /api/chatbot/historial:', error);
    return NextResponse.json(
      { error: error.message || 'Error al guardar historial' },
      { status: 500 }
    );
  }
}