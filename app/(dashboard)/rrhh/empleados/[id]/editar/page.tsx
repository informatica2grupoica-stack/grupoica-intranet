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
      .select('*')
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
    
    Object.keys(body).forEach(key => {
      if (body[key] === '' || body[key] === 'null') {
        body[key] = null;
      }
    });
    
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
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en PUT /api/rrhh/empleados/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar empleado' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminación física completa
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`🗑️ Eliminando físicamente empleado: ${id}`);
    
    // 1. Verificar si el empleado existe
    const { data: empleado, error: findError } = await supabase
      .from('empleados')
      .select('id, nombre_completo, perfil_id')
      .eq('id', id)
      .single();
    
    if (findError || !empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }
    
    console.log(`📝 Eliminando a: ${empleado.nombre_completo}`);
    
    // 2. Eliminar registros relacionados
    
    // Asistencias
    await supabase.from('asistencias').delete().eq('empleado_id', id);
    
    // Permisos
    await supabase.from('permisos_empleados').delete().eq('empleado_id', id);
    
    // Contratos
    await supabase.from('contratos_empleados').delete().eq('empleado_id', id);
    
    // Capacitaciones asignadas
    await supabase.from('empleados_capacitaciones').delete().eq('empleado_id', id);
    
    // Evaluaciones
    await supabase.from('evaluaciones_desempeno').delete().eq('empleado_id', id);
    
    // Documentos RRHH
    await supabase.from('documentos_rrhh').delete().eq('empleado_id', id);
    
    // Historial
    await supabase.from('historial_empleados').delete().eq('empleado_id', id);
    
    // 3. Actualizar perfiles que tengan este empleado como referencia
    await supabase.from('perfiles').update({ empleado_id: null }).eq('empleado_id', id);
    
    // 4. Si tiene perfil de usuario, eliminarlo de auth (opcional)
    if (empleado.perfil_id) {
      try {
        await supabase.auth.admin.deleteUser(empleado.perfil_id);
      } catch (authError) {
        console.warn('Error eliminando usuario auth:', authError);
      }
      await supabase.from('perfiles').delete().eq('id', empleado.perfil_id);
    }
    
    // 5. Finalmente eliminar el empleado
    const { error: errorEmpleado } = await supabase
      .from('empleados')
      .delete()
      .eq('id', id);
    
    if (errorEmpleado) {
      console.error('❌ Error eliminando empleado:', errorEmpleado);
      throw errorEmpleado;
    }
    
    console.log(`✅ Empleado ${empleado.nombre_completo} eliminado permanentemente`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Empleado ${empleado.nombre_completo} eliminado permanentemente`
    });
  } catch (error: any) {
    console.error('❌ Error en DELETE /api/rrhh/empleados/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar empleado' },
      { status: 500 }
    );
  }
}