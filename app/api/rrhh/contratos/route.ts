// app/api/rrhh/contratos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Listar contratos con filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const empleadoId = searchParams.get('empleadoId') || '';
    const vigente = searchParams.get('vigente') || '';

    let query = supabase
      .from('contratos_empleados')
      .select(`
        *,
        empleado:empleados(
          id,
          nombre_completo,
          rut,
          cargo,
          area
        )
      `, { count: 'exact' });

    if (empleadoId) {
      query = query.eq('empleado_id', empleadoId);
    }
    if (vigente !== '') {
      query = query.eq('vigente', vigente === 'true');
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order('fecha_inicio', { ascending: false })
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
    console.error('Error en GET /api/rrhh/contratos:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener contratos' },
      { status: 500 }
    );
  }
}

// POST: Crear nuevo contrato
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.empleado_id) {
      return NextResponse.json({ error: 'El empleado es obligatorio' }, { status: 400 });
    }
    if (!body.fecha_inicio) {
      return NextResponse.json({ error: 'La fecha de inicio es obligatoria' }, { status: 400 });
    }

    // Generar número de contrato automático
    const ano = new Date().getFullYear();
    const { count } = await supabase
      .from('contratos_empleados')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${ano}-01-01`);
    
    const numeroContrato = `${ano}-${(count || 0) + 1}`;

    // Si hay un contrato vigente anterior, marcarlo como no vigente
    if (body.vigente) {
      await supabase
        .from('contratos_empleados')
        .update({ vigente: false })
        .eq('empleado_id', body.empleado_id)
        .eq('vigente', true);
    }

    const nuevoContrato = {
      ...body,
      numero_contrato: numeroContrato,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('contratos_empleados')
      .insert([nuevoContrato])
      .select()
      .single();

    if (error) throw error;

    // Actualizar datos del empleado (cargo, área, sueldo, tipo_contrato, jornada)
    await supabase
      .from('empleados')
      .update({
        cargo: body.cargo,
        area: body.area,
        sueldo_base: body.sueldo_base,
        tipo_contrato: body.tipo_contrato,
        jornada: body.jornada,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.empleado_id);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en POST /api/rrhh/contratos:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear contrato' },
      { status: 500 }
    );
  }
}