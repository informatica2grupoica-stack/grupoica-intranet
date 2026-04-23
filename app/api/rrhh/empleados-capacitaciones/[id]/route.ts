// app/api/rrhh/empleados-capacitaciones/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PUT: Actualizar asignación (completar, agregar certificado)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('empleados_capacitaciones')
      .update({
        fecha_realizacion: body.fecha_realizacion,
        puntaje: body.puntaje,
        certificado_url: body.certificado_url,
        notas: body.notas,
        completado: body.completado,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en PUT /api/rrhh/empleados-capacitaciones/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar asignación' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar asignación
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('empleados_capacitaciones')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Asignación eliminada' });
  } catch (error: any) {
    console.error('Error en DELETE /api/rrhh/empleados-capacitaciones/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar asignación' },
      { status: 500 }
    );
  }
}