// app/api/rrhh/contratos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Obtener contrato por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('contratos_empleados')
      .select(`
        *,
        empleado:empleados(
          id,
          nombre_completo,
          rut,
          cargo,
          area,
          sueldo_base
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/contratos/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener contrato' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar contrato
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('contratos_empleados')
      .update({
        tipo_contrato: body.tipo_contrato,
        fecha_inicio: body.fecha_inicio,
        fecha_fin: body.fecha_fin,
        sueldo_base: body.sueldo_base,
        cargo: body.cargo,
        area: body.area,
        jornada: body.jornada,
        archivo_url: body.archivo_url,
        observaciones: body.observaciones,
        vigente: body.vigente,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Si el contrato es vigente, actualizar datos del empleado
    if (body.vigente && data) {
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
        .eq('id', data.empleado_id);
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en PUT /api/rrhh/contratos/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar contrato' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar contrato
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('contratos_empleados')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Contrato eliminado' });
  } catch (error: any) {
    console.error('Error en DELETE /api/rrhh/contratos/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar contrato' },
      { status: 500 }
    );
  }
}