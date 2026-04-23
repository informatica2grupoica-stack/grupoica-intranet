// app/api/rrhh/empleados/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Obtener empleado por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const { data, error } = await supabase
      .from('empleados')
      .select(`
        *,
        jefe_directo:empleados!empleados_jefe_directo_id_fkey(
          id,
          nombre_completo,
          cargo
        ),
        contratos:contratos_empleados(
          *,
          empleado:empleados(nombre_completo)
        ),
        permisos:permisos_empleados(*),
        perfil:perfiles(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/empleados/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener empleado' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar empleado
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // No permitir cambiar RUT si ya existe otro
    if (body.rut) {
      const { data: existente } = await supabase
        .from('empleados')
        .select('id')
        .eq('rut', body.rut)
        .neq('id', id)
        .single();
      
      if (existente) {
        return NextResponse.json({ error: 'Ya existe otro empleado con este RUT' }, { status: 400 });
      }
    }
    
    const { data, error } = await supabase
      .from('empleados')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Actualizar perfil asociado si existe
    if (data.perfil_id) {
      await supabase
        .from('perfiles')
        .update({
          nombre: body.nombre_completo?.split(' ')[0],
          apellido: body.nombre_completo?.split(' ').slice(1).join(' '),
          telefono: body.telefono,
          rut: body.rut,
          cargo: body.cargo,
        })
        .eq('id', data.perfil_id);
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en PUT /api/rrhh/empleados/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar empleado' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar empleado (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Soft delete - solo cambiar estado
    const { error } = await supabase
      .from('empleados')
      .update({
        activo: false,
        estado: 'despedido',
        fecha_termino: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, message: 'Empleado desactivado' });
  } catch (error: any) {
    console.error('Error en DELETE /api/rrhh/empleados/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar empleado' },
      { status: 500 }
    );
  }
}