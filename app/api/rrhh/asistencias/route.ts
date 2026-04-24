// app/api/rrhh/asistencias/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Parámetros específicos GRUPO ICA
const HORA_COLACION = 1;  // 1 hora de colación

// Horas diarias por día de la semana
const getJornadaDiaria = (fecha: string): number => {
  const dia = new Date(fecha).getDay();
  switch (dia) {
    case 1: // Lunes
    case 2: // Martes
    case 3: // Miércoles
    case 4: // Jueves
      return 8.5;  // 8.5 horas trabajadas
    case 5: // Viernes
      return 7.5;  // 7.5 horas trabajadas
    default: // Sábado, Domingo
      return 0;
  }
};

// Calcular horas trabajadas (restar hora de colación)
const calcularHorasTrabajadas = (horaEntrada: string, horaSalida: string, fecha: string): number | null => {
  if (!horaEntrada || !horaSalida) return null;
  
  const [entradaH, entradaM] = horaEntrada.split(':').map(Number);
  const [salidaH, salidaM] = horaSalida.split(':').map(Number);
  
  let horas = salidaH - entradaH;
  let minutos = salidaM - entradaM;
  
  if (minutos < 0) {
    horas--;
    minutos += 60;
  }
  
  let totalHoras = horas + (minutos / 60);
  totalHoras = totalHoras - HORA_COLACION;
  
  return Math.round(totalHoras * 10) / 10;
};

// Calcular horas extras (sobre la jornada diaria)
const calcularHorasExtras = (horasTrabajadas: number, fecha: string): number => {
  const jornadaDiaria = getJornadaDiaria(fecha);
  if (jornadaDiaria === 0) return 0;
  if (horasTrabajadas <= jornadaDiaria) return 0;
  return Math.round((horasTrabajadas - jornadaDiaria) * 10) / 10;
};

const limpiarHora = (hora: string | null | undefined): string | null => {
  if (!hora || hora === '' || hora === 'null') return null;
  return hora;
};

// GET: Listar asistencias
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const empleadoId = searchParams.get('empleadoId') || '';
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

    if (empleadoId) {
      query = query.eq('empleado_id', empleadoId);
    }

    if (mes && anio) {
      const startDate = `${anio}-${mes.padStart(2, '0')}-01`;
      const endDate = new Date(parseInt(anio), parseInt(mes), 0).toISOString().split('T')[0];
      query = query.gte('fecha', startDate).lte('fecha', endDate);
    }

    const from = (page - 1) * limit;
    const { data, error, count } = await query
      .order('fecha', { ascending: false })
      .range(from, from + limit - 1);

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

// POST: Registrar asistencia
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.empleado_id) {
      return NextResponse.json({ error: 'El empleado es obligatorio' }, { status: 400 });
    }
    if (!body.fecha) {
      return NextResponse.json({ error: 'La fecha es obligatoria' }, { status: 400 });
    }

    const horaEntrada = limpiarHora(body.hora_entrada);
    const horaSalida = limpiarHora(body.hora_salida);

    let horasTrabajadas = null;
    let horasExtras = null;

    if (body.estado === 'presente' && horaEntrada && horaSalida) {
      horasTrabajadas = calcularHorasTrabajadas(horaEntrada, horaSalida, body.fecha);
      if (horasTrabajadas !== null) {
        horasExtras = calcularHorasExtras(horasTrabajadas, body.fecha);
      }
    }

    const nuevaAsistencia = {
      empleado_id: body.empleado_id,
      fecha: body.fecha,
      hora_entrada: horaEntrada,
      hora_salida: horaSalida,
      horas_trabajadas: horasTrabajadas,
      horas_extras: horasExtras,
      tipo_dia: body.tipo_dia || 'normal',
      estado: body.estado || 'presente',
      justificacion: body.justificacion || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: existente } = await supabase
      .from('asistencias')
      .select('id')
      .eq('empleado_id', body.empleado_id)
      .eq('fecha', body.fecha)
      .maybeSingle();

    let result;

    if (existente) {
      const { data, error } = await supabase
        .from('asistencias')
        .update(nuevaAsistencia)
        .eq('id', existente.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
      console.log('✅ Asistencia actualizada:', result);
    } else {
      const { data, error } = await supabase
        .from('asistencias')
        .insert([nuevaAsistencia])
        .select()
        .single();
      if (error) throw error;
      result = data;
      console.log('✅ Asistencia registrada:', result);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ Error en POST /api/rrhh/asistencias:', error);
    return NextResponse.json(
      { error: error.message || 'Error al registrar asistencia' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar asistencia
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID de asistencia requerido' }, { status: 400 });
    }

    const horaEntrada = limpiarHora(body.hora_entrada);
    const horaSalida = limpiarHora(body.hora_salida);

    let horasTrabajadas = null;
    let horasExtras = null;

    if (body.estado === 'presente' && horaEntrada && horaSalida && body.fecha) {
      horasTrabajadas = calcularHorasTrabajadas(horaEntrada, horaSalida, body.fecha);
      if (horasTrabajadas !== null) {
        horasExtras = calcularHorasExtras(horasTrabajadas, body.fecha);
      }
    }

    const { data, error } = await supabase
      .from('asistencias')
      .update({
        hora_entrada: horaEntrada,
        hora_salida: horaSalida,
        horas_trabajadas: horasTrabajadas,
        horas_extras: horasExtras,
        estado: body.estado,
        justificacion: body.justificacion || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('❌ Error en PUT /api/rrhh/asistencias:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar asistencia' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar asistencia
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de asistencia requerido' }, { status: 400 });
    }

    const { error } = await supabase
      .from('asistencias')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Asistencia eliminada' });
  } catch (error: any) {
    console.error('❌ Error en DELETE /api/rrhh/asistencias:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar asistencia' },
      { status: 500 }
    );
  }
}