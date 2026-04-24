// app/api/rrhh/asistencias/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Parámetros Ley Chilena 21.561 (42 horas semanales a partir del 26/04/2026)
const JORNADA_DIARIA = 7;      // 7 horas diarias (42 horas semanales)
const HORA_COLACION = 1;       // 1 hora de colación (NO computa como trabajo)
const HORAS_SEMANALES = 42;    // 42 horas semanales máximas

// Función para calcular horas trabajadas según ley chilena
const calcularHorasTrabajadasChile = (horaEntrada: string, horaSalida: string): number | null => {
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
  
  // Restar hora de colación (1 hora NO trabajada)
  totalHoras = totalHoras - HORA_COLACION;
  
  // Redondear a 1 decimal
  return Math.round(totalHoras * 10) / 10;
};

// Función para calcular horas extras (sobre 7 horas diarias)
const calcularHorasExtras = (horasTrabajadas: number): number => {
  if (horasTrabajadas <= JORNADA_DIARIA) return 0;
  return Math.round((horasTrabajadas - JORNADA_DIARIA) * 10) / 10;
};

// Función helper para limpiar campos vacíos
const limpiarHora = (hora: string | null | undefined): string | null => {
  if (!hora || hora === '' || hora === 'null') return null;
  return hora;
};

// GET: Listar asistencias con filtros
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

// POST: Registrar asistencia
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('📥 Datos recibidos:', body);

    if (!body.empleado_id) {
      return NextResponse.json({ error: 'El empleado es obligatorio' }, { status: 400 });
    }

    if (!body.fecha) {
      return NextResponse.json({ error: 'La fecha es obligatoria' }, { status: 400 });
    }

    // Limpiar horas
    const horaEntrada = limpiarHora(body.hora_entrada);
    const horaSalida = limpiarHora(body.hora_salida);

    // Calcular horas según ley chilena
    let horasTrabajadas = null;
    let horasExtras = null;

    if (body.estado === 'presente' && horaEntrada && horaSalida) {
      horasTrabajadas = calcularHorasTrabajadasChile(horaEntrada, horaSalida);
      if (horasTrabajadas !== null) {
        horasExtras = calcularHorasExtras(horasTrabajadas);
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

    console.log('📤 Datos a insertar (42h Chile):', nuevaAsistencia);

    // Verificar si ya existe asistencia para este empleado en esta fecha
    const { data: existente } = await supabase
      .from('asistencias')
      .select('id')
      .eq('empleado_id', body.empleado_id)
      .eq('fecha', body.fecha)
      .maybeSingle();

    let result;

    if (existente) {
      // Actualizar
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
      // Insertar
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

// PUT: Actualizar asistencia (para ediciones posteriores)
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID de asistencia requerido' }, { status: 400 });
    }

    // Limpiar horas
    const horaEntrada = limpiarHora(body.hora_entrada);
    const horaSalida = limpiarHora(body.hora_salida);

    // Recalcular horas según ley chilena
    let horasTrabajadas = null;
    let horasExtras = null;

    if (body.estado === 'presente' && horaEntrada && horaSalida) {
      horasTrabajadas = calcularHorasTrabajadasChile(horaEntrada, horaSalida);
      if (horasTrabajadas !== null) {
        horasExtras = calcularHorasExtras(horasTrabajadas);
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