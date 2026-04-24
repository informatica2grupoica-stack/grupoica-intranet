// app/api/rrhh/permisos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('permisos_empleados')
      .select(`
        *,
        empleado:empleados!permisos_empleados_empleado_id_fkey(
          id,
          nombre_completo,
          rut,
          cargo,
          area,
          dias_vacacion_disponibles
        ),
        aprobador:perfiles!permisos_empleados_aprobado_por_fkey(
          id,
          nombre,
          apellido
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Transformar datos
    const dataFormateada = {
      ...data,
      empleado: data.empleado?.[0] || null,
      aprobador: data.aprobador?.[0] || null,
    };

    return NextResponse.json({ success: true, data: dataFormateada });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/permisos/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener permiso' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar permiso
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('permisos_empleados')
      .update({
        estado: body.estado,
        aprobado_por: body.aprobado_por || null,
        fecha_aprobacion: new Date().toISOString(),
        comentarios_aprobador: body.comentarios_aprobador || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en PUT /api/rrhh/permisos/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar permiso' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await supabase
      .from('permisos_empleados')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Permiso eliminado' });
  } catch (error: any) {
    console.error('Error en DELETE /api/rrhh/permisos/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar permiso' },
      { status: 500 }
    );
  }
}