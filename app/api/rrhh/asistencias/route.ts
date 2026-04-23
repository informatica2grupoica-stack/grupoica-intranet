// app/api/rrhh/asistencias/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Listar asistencias con filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const empleadoId = searchParams.get('empleadoId') || '';
    const fechaInicio = searchParams.get('fechaInicio') || '';
    const fechaFin = searchParams.get('fechaFin') || '';
    const mes = searchParams.get('mes') || '';
    const anio = searchParams.get('anio') || '';

    let query = supabase
      .from('asistencias')
      .select(`
        *,
        empleado:empleados(
          id,
          nombre_completo,
          rut,
          cargo
        )
      `, { count: 'exact' });

    // Aplicar filtros
    if (empleadoId) {
      query = query.eq('empleado_id', empleadoId);
    }

    if (fechaInicio && fechaFin) {
      query = query.gte('fecha', fechaInicio).lte('fecha', fechaFin);
    }

    if (mes && anio) {
      const startDate = `${anio}-${mes.padStart(2, '0')}-01`;
      const endDate = new Date(parseInt(anio), parseInt(mes), 0).toISOString().split('T')[0];
      query = query.gte('fecha', startDate).lte('fecha', endDate);
    }

    // Paginación
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order('fecha', { ascending: false })
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
    console.error('Error en GET /api/rrhh/asistencias:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener asistencias' },
      { status: 500 }
    );
  }
}

// POST: Registrar asistencia (marcación)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.empleado_id) {
      return NextResponse.json({ error: 'El empleado es obligatorio' }, { status: 400 });
    }

    if (!body.fecha) {
      return NextResponse.json({ error: 'La fecha es obligatoria' }, { status: 400 });
    }

    // Verificar si ya existe asistencia para este empleado en esta fecha
    const { data: existente } = await supabase
      .from('asistencias')
      .select('id')
      .eq('empleado_id', body.empleado_id)
      .eq('fecha', body.fecha)
      .single();

    let result;

    if (existente) {
      // Actualizar asistencia existente
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
          tipo_dia: body.tipo_dia || 'normal',
          estado: body.estado || 'presente',
          justificacion: body.justificacion,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existente.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Crear nueva asistencia
      const { data, error } = await supabase
        .from('asistencias')
        .insert([{
          empleado_id: body.empleado_id,
          fecha: body.fecha,
          hora_entrada: body.hora_entrada,
          hora_salida: body.hora_salida,
          hora_entrada_tarde: body.hora_entrada_tarde,
          hora_salida_tarde: body.hora_salida_tarde,
          horas_trabajadas: body.horas_trabajadas,
          horas_extras: body.horas_extras,
          horas_extras_25: body.horas_extras_25,
          horas_extras_50: body.horas_extras_50,
          tipo_dia: body.tipo_dia || 'normal',
          estado: body.estado || 'presente',
          justificacion: body.justificacion,
          creado_por: body.creado_por,
        }])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error en POST /api/rrhh/asistencias:', error);
    return NextResponse.json(
      { error: error.message || 'Error al registrar asistencia' },
      { status: 500 }
    );
  }
}