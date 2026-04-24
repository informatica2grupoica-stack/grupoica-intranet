// app/api/rrhh/evaluaciones/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Listar evaluaciones con filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const empleadoId = searchParams.get('empleadoId') || '';
    const evaluadorId = searchParams.get('evaluadorId') || '';
    const periodo = searchParams.get('periodo') || '';

    let query = supabase
      .from('evaluaciones_desempeno')
      .select(`
        *,
        empleado:empleados!evaluaciones_desempeno_empleado_id_fkey(
          id,
          nombre_completo,
          rut,
          cargo,
          area
        ),
        evaluador:perfiles!evaluaciones_desempeno_evaluador_id_fkey(
          id,
          nombre,
          apellido
        )
      `, { count: 'exact' });

    if (empleadoId) {
      query = query.eq('empleado_id', empleadoId);
    }
    if (evaluadorId) {
      query = query.eq('evaluador_id', evaluadorId);
    }
    if (periodo) {
      query = query.eq('periodo', periodo);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order('fecha_evaluacion', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        current_page: page,
        per_page: limit,
        total: count || 0,
        last_page: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/evaluaciones:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener evaluaciones' },
      { status: 500 }
    );
  }
}

// POST: Crear nueva evaluación
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.empleado_id) {
      return NextResponse.json({ error: 'El empleado es obligatorio' }, { status: 400 });
    }
    if (!body.evaluador_id) {
      return NextResponse.json({ error: 'El evaluador es obligatorio' }, { status: 400 });
    }
    if (!body.fecha_evaluacion) {
      return NextResponse.json({ error: 'La fecha de evaluación es obligatoria' }, { status: 400 });
    }

    // Calcular puntaje total
    const puntajes = [
      body.puntaje_calidad_trabajo || 0,
      body.puntaje_productividad || 0,
      body.puntaje_trabajo_equipo || 0,
      body.puntaje_comunicacion || 0,
      body.puntaje_iniciativa || 0,
      body.puntaje_cumplimiento || 0,
    ];
    const puntajeTotal = puntajes.reduce((a, b) => a + b, 0) / puntajes.length;

    // Determinar calificación
    let calificacion = 'deficiente';
    if (puntajeTotal >= 4.5) calificacion = 'excelente';
    else if (puntajeTotal >= 3.5) calificacion = 'bueno';
    else if (puntajeTotal >= 2.5) calificacion = 'regular';

    const nuevaEvaluacion = {
      empleado_id: body.empleado_id,
      evaluador_id: body.evaluador_id,
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
      estado: 'completada',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('evaluaciones_desempeno')
      .insert([nuevaEvaluacion])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en POST /api/rrhh/evaluaciones:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear evaluación' },
      { status: 500 }
    );
  }
}