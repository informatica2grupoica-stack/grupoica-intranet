// app/api/rrhh/dashboard-avanzado/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Obtener todos los empleados
    const { data: empleados } = await supabase
      .from('empleados')
      .select('*')
      .eq('activo', true);

    // Obtener asistencias del último mes
    const fechaInicio = new Date();
    fechaInicio.setMonth(fechaInicio.getMonth() - 1);
    const { data: asistencias } = await supabase
      .from('asistencias')
      .select('*')
      .gte('fecha', fechaInicio.toISOString().split('T')[0]);

    // Obtener contrataciones por mes
    const contratacionesPorMes = await supabase
      .from('empleados')
      .select('created_at')
      .gte('created_at', new Date(new Date().getFullYear(), 0, 1).toISOString());

    // Estadísticas por área
    const areas = empleados?.reduce((acc: any, emp) => {
      if (emp.area) {
        acc[emp.area] = (acc[emp.area] || 0) + 1;
      }
      return acc;
    }, {});

    // Estadísticas por cargo
    const cargos = empleados?.reduce((acc: any, emp) => {
      if (emp.cargo) {
        acc[emp.cargo] = (acc[emp.cargo] || 0) + 1;
      }
      return acc;
    }, {});

    // Antigüedad (empleados por años)
    const hoy = new Date();
    const antiguedad = {
      '0-1 año': 0,
      '1-3 años': 0,
      '3-5 años': 0,
      '5+ años': 0,
    };

    empleados?.forEach(emp => {
      if (emp.fecha_ingreso) {
        const años = (hoy.getTime() - new Date(emp.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24 * 365);
        if (años < 1) antiguedad['0-1 año']++;
        else if (años < 3) antiguedad['1-3 años']++;
        else if (años < 5) antiguedad['3-5 años']++;
        else antiguedad['5+ años']++;
      }
    });

    // Asistencia (porcentaje de presente)
    const totalAsistencias = asistencias?.length || 0;
    const presentes = asistencias?.filter(a => a.estado === 'presente').length || 0;
    const ausentes = asistencias?.filter(a => a.estado === 'ausente').length || 0;
    const tardes = asistencias?.filter(a => a.estado === 'tarde').length || 0;

    return NextResponse.json({
      success: true,
      data: {
        areas: Object.entries(areas || {}).map(([name, value]) => ({ name, value })),
        cargos: Object.entries(cargos || {}).map(([name, value]) => ({ name, value })),
        antiguedad: Object.entries(antiguedad).map(([name, value]) => ({ name, value })),
        asistencia: {
          presente: Math.round((presentes / totalAsistencias) * 100) || 0,
          ausente: Math.round((ausentes / totalAsistencias) * 100) || 0,
          tarde: Math.round((tardes / totalAsistencias) * 100) || 0,
        },
        totalEmpleados: empleados?.length || 0,
      }
    });
  } catch (error: any) {
    console.error('Error en dashboard avanzado:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener datos' },
      { status: 500 }
    );
  }
}