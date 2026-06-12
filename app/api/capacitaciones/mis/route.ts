// app/api/capacitaciones/mis/route.ts
// Devuelve las capacitaciones asignadas al perfil del usuario autenticado.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const perfilId = searchParams.get('perfil_id');

    if (!perfilId) {
      return NextResponse.json({ error: 'perfil_id requerido' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('capacitaciones_perfiles')
      .select(`
        completado,
        fecha_completado,
        created_at,
        capacitacion:capacitaciones(
          id,
          nombre,
          proveedor,
          fecha_inicio,
          fecha_fin,
          horas_total,
          modalidad,
          descripcion,
          archivo_url,
          tipo_archivo,
          activo
        )
      `)
      .eq('perfil_id', perfilId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const resultado = (data || [])
      .filter((row: any) => row.capacitacion?.activo !== false)
      .map((row: any) => ({
        ...row.capacitacion,
        completado: row.completado,
        fecha_completado: row.fecha_completado,
        asignado_en: row.created_at,
      }));

    return NextResponse.json({ success: true, data: resultado });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
