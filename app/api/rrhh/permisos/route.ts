// app/api/rrhh/permisos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Listar permisos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const empleadoId = searchParams.get('empleadoId') || '';
    const estado = searchParams.get('estado') || '';
    const tipo = searchParams.get('tipo') || '';

    // ✅ Consulta CORREGIDA - SOLO con las relaciones que existen
    let query = supabase
      .from('permisos_empleados')
      .select(`
        *,
        empleado:empleados!permisos_empleados_empleado_id_fkey(
          id,
          nombre_completo,
          rut,
          cargo,
          area
        ),
        aprobador:perfiles!permisos_empleados_aprobado_por_fkey(
          id,
          nombre,
          apellido
        )
      `, { count: 'exact' });

    if (empleadoId) {
      query = query.eq('empleado_id', empleadoId);
    }
    if (estado) {
      query = query.eq('estado', estado);
    }
    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error en query:', error);
      throw error;
    }

    // Transformar los datos (Supabase devuelve arrays)
    const permisosFormateados = data?.map(permiso => ({
      ...permiso,
      empleado: permiso.empleado?.[0] || null,
      aprobador: permiso.aprobador?.[0] || null,
    }));

    return NextResponse.json({
      success: true,
      data: permisosFormateados || [],
      pagination: {
        current_page: page,
        per_page: limit,
        total: count || 0,
        last_page: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/permisos:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener permisos' },
      { status: 500 }
    );
  }
}

// POST: Crear solicitud de permiso
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('📥 Datos recibidos:', body);

    if (!body.empleado_id) {
      return NextResponse.json({ error: 'El empleado es obligatorio' }, { status: 400 });
    }
    if (!body.tipo) {
      return NextResponse.json({ error: 'El tipo de permiso es obligatorio' }, { status: 400 });
    }
    if (!body.fecha_inicio) {
      return NextResponse.json({ error: 'La fecha de inicio es obligatoria' }, { status: 400 });
    }
    if (!body.fecha_fin) {
      return NextResponse.json({ error: 'La fecha de fin es obligatoria' }, { status: 400 });
    }

    // Calcular días solicitados
    const inicio = new Date(body.fecha_inicio);
    const fin = new Date(body.fecha_fin);
    const diasSolicitados = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Si es vacaciones, verificar días disponibles
    if (body.tipo === 'vacaciones') {
      const { data: empleado } = await supabase
        .from('empleados')
        .select('dias_vacacion_disponibles')
        .eq('id', body.empleado_id)
        .single();

      if (empleado && empleado.dias_vacacion_disponibles < diasSolicitados) {
        return NextResponse.json({
          error: `No tienes suficientes días de vacaciones. Disponibles: ${empleado.dias_vacacion_disponibles}`,
        }, { status: 400 });
      }
    }

    const nuevoPermiso = {
      empleado_id: body.empleado_id,
      tipo: body.tipo,
      fecha_inicio: body.fecha_inicio,
      fecha_fin: body.fecha_fin,
      dias_solicitados: diasSolicitados,
      motivo: body.motivo || null,
      estado: 'pendiente',
      created_at: new Date().toISOString(),
    };

    console.log('📤 Datos a insertar:', nuevoPermiso);

    const { data, error } = await supabase
      .from('permisos_empleados')
      .insert([nuevoPermiso])
      .select()
      .single();

    if (error) {
      console.error('Error al insertar:', error);
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('❌ Error en POST /api/rrhh/permisos:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear solicitud' },
      { status: 500 }
    );
  }
}