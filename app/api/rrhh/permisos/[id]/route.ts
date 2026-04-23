// app/api/rrhh/permisos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Obtener permiso por ID
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
        empleado:empleados(
          id,
          nombre_completo,
          rut,
          cargo,
          area,
          dias_vacacion_disponibles
        ),
        aprobador:perfiles(
          id,
          nombre,
          apellido
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/permisos/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener permiso' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar permiso (aprobar/rechazar)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { data: permisoActual } = await supabase
      .from('permisos_empleados')
      .select('*')
      .eq('id', id)
      .single();

    if (!permisoActual) {
      return NextResponse.json({ error: 'Permiso no encontrado' }, { status: 404 });
    }

    // Si se está aprobando y es vacaciones, descontar días
    if (body.estado === 'aprobado' && permisoActual.tipo === 'vacaciones' && permisoActual.estado !== 'aprobado') {
      const { data: empleado } = await supabase
        .from('empleados')
        .select('dias_vacacion_disponibles')
        .eq('id', permisoActual.empleado_id)
        .single();

      if (empleado) {
        const nuevosDias = empleado.dias_vacacion_disponibles - permisoActual.dias_solicitados;
        await supabase
          .from('empleados')
          .update({ dias_vacacion_disponibles: nuevosDias })
          .eq('id', permisoActual.empleado_id);
      }
    }

    const { data, error } = await supabase
      .from('permisos_empleados')
      .update({
        estado: body.estado,
        aprobado_por: body.aprobado_por,
        fecha_aprobacion: new Date().toISOString(),
        comentarios_aprobador: body.comentarios_aprobador,
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

// DELETE: Eliminar permiso
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