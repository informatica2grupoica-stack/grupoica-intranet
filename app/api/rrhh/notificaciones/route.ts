// app/api/rrhh/notificaciones/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Obtener notificaciones del usuario
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const usuarioId = searchParams.get('usuarioId');
    const soloNoLeidas = searchParams.get('soloNoLeidas') === 'true';

    if (!usuarioId) {
      return NextResponse.json({ error: 'Usuario ID requerido' }, { status: 400 });
    }

    let query = supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false });

    if (soloNoLeidas) {
      query = query.eq('leida', false);
    }

    const { data, error } = await query.limit(50);

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/notificaciones:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener notificaciones' },
      { status: 500 }
    );
  }
}

// POST: Marcar como leída
export async function POST(request: NextRequest) {
  try {
    const { notificacionId, usuarioId } = await request.json();

    if (!notificacionId) {
      return NextResponse.json({ error: 'Notificación ID requerida' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('notificaciones')
      .update({ leida: true, updated_at: new Date().toISOString() })
      .eq('id', notificacionId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en POST /api/rrhh/notificaciones:', error);
    return NextResponse.json(
      { error: error.message || 'Error al marcar notificación' },
      { status: 500 }
    );
  }
}