// app/api/rrhh/asistencias/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Obtener asistencia por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('asistencias')
      .select(`
        *,
        empleado:empleados(
          id,
          nombre_completo,
          rut,
          cargo,
          area
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/asistencias/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener asistencia' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar asistencia
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('asistencias')
      .update({
        hora_entrada: body.hora_entrada,
        hora_salida: body.hora_salida,
        hora_entrada_tarde: body.hora_entrada_tarde,
        hora_salida_tarde: body.hora_salida_tarde,
        horas_trabajadas: body.horas_trabajadas,
        horas_extras: body.horas_extras,
        horas_extras_25: body.horas_extras_25,
        horas_extras_50: body.horas_extras_50,
        tipo_dia: body.tipo_dia,
        estado: body.estado,
        justificacion: body.justificacion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en PUT /api/rrhh/asistencias/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar asistencia' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar asistencia
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('asistencias')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Asistencia eliminada' });
  } catch (error: any) {
    console.error('Error en DELETE /api/rrhh/asistencias/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar asistencia' },
      { status: 500 }
    );
  }
}