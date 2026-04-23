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

// ✅ DELETE: Eliminación física completa
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
      .select('id, nombre_completo')
      .eq('id', id)
      .single();
    
    if (findError || !empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }
    
    console.log(`📝 Eliminando a: ${empleado.nombre_completo}`);
    
    // 2. Eliminar registros relacionados en orden (primero los que tienen foreign keys)
    
    // Asistencias
    const { error: errorAsistencias } = await supabase
      .from('asistencias')
      .delete()
      .eq('empleado_id', id);
    if (errorAsistencias) console.warn('Error eliminando asistencias:', errorAsistencias);
    
    // Permisos
    const { error: errorPermisos } = await supabase
      .from('permisos_empleados')
      .delete()
      .eq('empleado_id', id);
    if (errorPermisos) console.warn('Error eliminando permisos:', errorPermisos);
    
    // Contratos
    const { error: errorContratos } = await supabase
      .from('contratos_empleados')
      .delete()
      .eq('empleado_id', id);
    if (errorContratos) console.warn('Error eliminando contratos:', errorContratos);
    
    // Capacitaciones asignadas
    const { error: errorCapacitaciones } = await supabase
      .from('empleados_capacitaciones')
      .delete()
      .eq('empleado_id', id);
    if (errorCapacitaciones) console.warn('Error eliminando capacitaciones:', errorCapacitaciones);
    
    // Evaluaciones
    const { error: errorEvaluaciones } = await supabase
      .from('evaluaciones_desempeno')
      .delete()
      .eq('empleado_id', id);
    if (errorEvaluaciones) console.warn('Error eliminando evaluaciones:', errorEvaluaciones);
    
    // Documentos RRHH
    const { error: errorDocumentos } = await supabase
      .from('documentos_rrhh')
      .delete()
      .eq('empleado_id', id);
    if (errorDocumentos) console.warn('Error eliminando documentos:', errorDocumentos);
    
    // Historial
    const { error: errorHistorial } = await supabase
      .from('historial_empleados')
      .delete()
      .eq('empleado_id', id);
    if (errorHistorial) console.warn('Error eliminando historial:', errorHistorial);
    
    // 3. Actualizar perfiles que tengan este empleado como jefe (poner null)
    const { error: errorPerfiles } = await supabase
      .from('perfiles')
      .update({ empleado_id: null })
      .eq('empleado_id', id);
    if (errorPerfiles) console.warn('Error actualizando perfiles:', errorPerfiles);
    
    // 4. Finalmente eliminar el empleado
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