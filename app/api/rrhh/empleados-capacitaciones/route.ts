// app/api/rrhh/empleados-capacitaciones/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Listar asignaciones de capacitaciones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const empleadoId = searchParams.get('empleadoId') || '';
    const capacitacionId = searchParams.get('capacitacionId') || '';

    let query = supabase
      .from('empleados_capacitaciones')
      .select(`
        *,
        empleado:empleados(
          id,
          nombre_completo,
          rut,
          cargo
        ),
        capacitacion:capacitaciones(
          id,
          nombre,
          proveedor,
          horas_total,
          modalidad
        )
      `);

    if (empleadoId) {
      query = query.eq('empleado_id', empleadoId);
    }
    if (capacitacionId) {
      query = query.eq('capacitacion_id', capacitacionId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/empleados-capacitaciones:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener asignaciones' },
      { status: 500 }
    );
  }
}

// POST: Asignar capacitación a empleado
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.empleado_id) {
      return NextResponse.json({ error: 'El empleado es obligatorio' }, { status: 400 });
    }
    if (!body.capacitacion_id) {
      return NextResponse.json({ error: 'La capacitación es obligatoria' }, { status: 400 });
    }

    // Verificar si ya existe la asignación
    const { data: existente } = await supabase
      .from('empleados_capacitaciones')
      .select('id')
      .eq('empleado_id', body.empleado_id)
      .eq('capacitacion_id', body.capacitacion_id)
      .single();

    if (existente) {
      return NextResponse.json({ error: 'El empleado ya está asignado a esta capacitación' }, { status: 400 });
    }

    const nuevaAsignacion = {
      empleado_id: body.empleado_id,
      capacitacion_id: body.capacitacion_id,
      fecha_realizacion: body.fecha_realizacion,
      puntaje: body.puntaje,
      certificado_url: body.certificado_url,
      notas: body.notas,
      completado: body.completado || false,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('empleados_capacitaciones')
      .insert([nuevaAsignacion])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en POST /api/rrhh/empleados-capacitaciones:', error);
    return NextResponse.json(
      { error: error.message || 'Error al asignar capacitación' },
      { status: 500 }
    );
  }
}