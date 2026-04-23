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
    
    // Limpiar campos vacíos
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

// DELETE: Soft delete - solo cambiar estado
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`🗑️ Eliminando (soft delete) empleado: ${id}`);
    
    // Verificar si el empleado existe
    const { data: empleado, error: findError } = await supabase
      .from('empleados')
      .select('id, activo, estado')
      .eq('id', id)
      .single();
    
    if (findError || !empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }
    
    // Soft delete - solo cambiar estado y activo
    const { data, error } = await supabase
      .from('empleados')
      .update({
        activo: false,
        estado: 'despedido',
        fecha_termino: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('❌ Error en soft delete:', error);
      throw error;
    }
    
    console.log('✅ Empleado desactivado:', data);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Empleado desactivado correctamente',
      data: data 
    });
  } catch (error: any) {
    console.error('❌ Error en DELETE /api/rrhh/empleados/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar empleado' },
      { status: 500 }
    );
  }
}