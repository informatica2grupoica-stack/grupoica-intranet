// app/api/rrhh/capacitaciones/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Obtener capacitación por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('capacitaciones')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/capacitaciones/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener capacitación' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar capacitación
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('capacitaciones')
      .update({
        nombre: body.nombre,
        proveedor: body.proveedor,
        fecha_inicio: body.fecha_inicio,
        fecha_fin: body.fecha_fin,
        horas_total: body.horas_total,
        modalidad: body.modalidad,
        costo: body.costo,
        descripcion: body.descripcion,
        activo: body.activo,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en PUT /api/rrhh/capacitaciones/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar capacitación' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar capacitación
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('capacitaciones')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Capacitación eliminada' });
  } catch (error: any) {
    console.error('Error en DELETE /api/rrhh/capacitaciones/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar capacitación' },
      { status: 500 }
    );
  }
}