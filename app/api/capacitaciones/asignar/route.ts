// app/api/capacitaciones/asignar/route.ts
// Gestión de asignaciones de capacitaciones a perfiles.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

// GET: perfiles asignados a una capacitación + todos los perfiles disponibles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const capacitacionId = searchParams.get('capacitacion_id');

    if (!capacitacionId) {
      return NextResponse.json({ error: 'capacitacion_id requerido' }, { status: 400 });
    }

    const [asignados, todosPerfiles] = await Promise.all([
      supabase
        .from('capacitaciones_perfiles')
        .select('perfil_id, completado, fecha_completado, created_at')
        .eq('capacitacion_id', capacitacionId),
      supabase
        .from('perfiles')
        .select('id, nombre, apellido, cargo, rol, foto_url')
        .eq('activo', true)
        .order('nombre'),
    ]);

    if (asignados.error) throw asignados.error;
    if (todosPerfiles.error) throw todosPerfiles.error;

    const asignadosSet = new Set((asignados.data || []).map((a: any) => a.perfil_id));

    return NextResponse.json({
      success: true,
      asignados: asignados.data || [],
      perfiles: (todosPerfiles.data || []).map((p: any) => ({
        ...p,
        asignado: asignadosSet.has(p.id),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: asignar uno o varios perfiles a una capacitación
export async function POST(request: NextRequest) {
  try {
    const { capacitacion_id, perfil_ids, asignado_por } = await request.json();

    if (!capacitacion_id || !Array.isArray(perfil_ids) || perfil_ids.length === 0) {
      return NextResponse.json({ error: 'capacitacion_id y perfil_ids requeridos' }, { status: 400 });
    }

    const rows = perfil_ids.map((pid: string) => ({
      capacitacion_id,
      perfil_id: pid,
      asignado_por: asignado_por || null,
    }));

    const { error } = await supabase
      .from('capacitaciones_perfiles')
      .upsert(rows, { onConflict: 'capacitacion_id,perfil_id', ignoreDuplicates: true });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: desasignar perfiles
export async function DELETE(request: NextRequest) {
  try {
    const { capacitacion_id, perfil_ids } = await request.json();

    if (!capacitacion_id || !Array.isArray(perfil_ids) || perfil_ids.length === 0) {
      return NextResponse.json({ error: 'capacitacion_id y perfil_ids requeridos' }, { status: 400 });
    }

    const { error } = await supabase
      .from('capacitaciones_perfiles')
      .delete()
      .eq('capacitacion_id', capacitacion_id)
      .in('perfil_id', perfil_ids);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
