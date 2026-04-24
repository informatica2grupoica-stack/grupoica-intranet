// app/api/rrhh/documentos/contrato/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { empleadoId, contratoId } = await request.json();

    if (!empleadoId) {
      return NextResponse.json({ error: 'Empleado ID es requerido' }, { status: 400 });
    }

    // Obtener datos del empleado
    const { data: empleado, error: empError } = await supabase
      .from('empleados')
      .select('*')
      .eq('id', empleadoId)
      .single();

    if (empError) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Obtener datos del contrato
    let contrato = null;
    if (contratoId) {
      const { data: c } = await supabase
        .from('contratos_empleados')
        .select('*')
        .eq('id', contratoId)
        .single();
      if (c) contrato = c;
    }

    const empresa = {
      nombre: 'Grupo ICA S.A.',
      rut: '76.123.456-7',
      direccion: 'Av. Providencia 1234, Oficina 501, Santiago'
    };

    return NextResponse.json({
      success: true,
      data: {
        empleado,
        contrato: contrato || empleado,
        empresa,
      },
    });
  } catch (error: any) {
    console.error('Error obteniendo datos:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener los datos' },
      { status: 500 }
    );
  }
}