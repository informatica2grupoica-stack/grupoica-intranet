// app/api/rrhh/capacitaciones/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Listar capacitaciones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const activo = searchParams.get('activo') || '';

    let query = supabase
      .from('capacitaciones')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`nombre.ilike.%${search}%,proveedor.ilike.%${search}%`);
    }
    if (activo !== '') {
      query = query.eq('activo', activo === 'true');
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
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
    console.error('Error en GET /api/rrhh/capacitaciones:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener capacitaciones' },
      { status: 500 }
    );
  }
}

// POST: Crear nueva capacitación
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.nombre) {
      return NextResponse.json({ error: 'El nombre de la capacitación es obligatorio' }, { status: 400 });
    }

    const nuevaCapacitacion = {
      ...body,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('capacitaciones')
      .insert([nuevaCapacitacion])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en POST /api/rrhh/capacitaciones:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear capacitación' },
      { status: 500 }
    );
  }
}