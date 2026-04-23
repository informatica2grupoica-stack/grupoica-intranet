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

    // ✅ Función helper para convertir strings vacíos a null
    const limpiarHora = (hora: string) => {
      if (!hora || hora === '' || hora === 'null') return null;
      return hora;
    };

    // ✅ Limpiar horas
    const horaEntrada = limpiarHora(body.hora_entrada);
    const horaSalida = limpiarHora(body.hora_salida);
    const horaEntradaTarde = limpiarHora(body.hora_entrada_tarde);
    const horaSalidaTarde = limpiarHora(body.hora_salida_tarde);

    // Calcular horas trabajadas si hay entrada y salida
    let horasTrabajadas = null;
    if (horaEntrada && horaSalida) {
      const entrada = new Date(`2000-01-01T${horaEntrada}`);
      const salida = new Date(`2000-01-01T${horaSalida}`);
      horasTrabajadas = (salida.getTime() - entrada.getTime()) / (1000 * 60 * 60);
    }

    // Calcular horas extras (más de 8 horas)
    let horasExtras = null;
    if (horasTrabajadas && horasTrabajadas > 8) {
      horasExtras = horasTrabajadas - 8;
    }

    const nuevaAsistencia = {
      empleado_id: body.empleado_id,
      fecha: body.fecha,
      hora_entrada: horaEntrada,
      hora_salida: horaSalida,
      hora_entrada_tarde: horaEntradaTarde,
      hora_salida_tarde: horaSalidaTarde,
      horas_trabajadas: horasTrabajadas ? Math.round(horasTrabajadas * 10) / 10 : null,
      horas_extras: horasExtras ? Math.round(horasExtras * 10) / 10 : null,
      tipo_dia: body.tipo_dia || 'normal',
      estado: body.estado || 'presente',
      justificacion: body.justificacion || null,
      created_at: new Date().toISOString(),
    };

    console.log('📤 Datos a insertar:', nuevaAsistencia);

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
    } else {
      // Insertar
      const { data, error } = await supabase
        .from('asistencias')
        .insert([nuevaAsistencia])
        .select()
        .single();

      if (error) throw error;
      result = data;
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