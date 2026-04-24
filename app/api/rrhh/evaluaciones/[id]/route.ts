// app/api/rrhh/evaluaciones/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Obtener evaluación por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('evaluaciones_desempeno')
      .select(`
        *,
        empleado:empleados(
          id,
          nombre_completo,
          rut,
          cargo,
          area
        ),
        evaluador:perfiles(
          id,
          nombre,
          apellido
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/evaluaciones/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener evaluación' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar evaluación
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Recalcular puntaje total
    const puntajes = [
      body.puntaje_calidad_trabajo || 0,
      body.puntaje_productividad || 0,
      body.puntaje_trabajo_equipo || 0,
      body.puntaje_comunicacion || 0,
      body.puntaje_iniciativa || 0,
      body.puntaje_cumplimiento || 0,
    ];
    const puntajeTotal = puntajes.reduce((a, b) => a + b, 0) / puntajes.length;

    let calificacion = 'deficiente';
    if (puntajeTotal >= 4.5) calificacion = 'excelente';
    else if (puntajeTotal >= 3.5) calificacion = 'bueno';
    else if (puntajeTotal >= 2.5) calificacion = 'regular';

    const { data, error } = await supabase
      .from('evaluaciones_desempeno')
      .update({
        fecha_evaluacion: body.fecha_evaluacion,
        periodo: body.periodo,
        puntaje_calidad_trabajo: body.puntaje_calidad_trabajo || null,
        puntaje_productividad: body.puntaje_productividad || null,
        puntaje_trabajo_equipo: body.puntaje_trabajo_equipo || null,
        puntaje_comunicacion: body.puntaje_comunicacion || null,
        puntaje_iniciativa: body.puntaje_iniciativa || null,
        puntaje_cumplimiento: body.puntaje_cumplimiento || null,
        puntaje_total: Math.round(puntajeTotal * 10) / 10,
        calificacion: calificacion,
        fortalezas: body.fortalezas || null,
        areas_mejora: body.areas_mejora || null,
        plan_accion: body.plan_accion || null,
        proxima_evaluacion: body.proxima_evaluacion || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en PUT /api/rrhh/evaluaciones/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar evaluación' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar evaluación
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('evaluaciones_desempeno')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Evaluación eliminada' });
  } catch (error: any) {
    console.error('Error en DELETE /api/rrhh/evaluaciones/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar evaluación' },
      { status: 500 }
    );
  }
}