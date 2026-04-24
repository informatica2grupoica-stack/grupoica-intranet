// app/api/rrhh/reportes/asistencias/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mesParam = searchParams.get('mes');
    const anioParam = searchParams.get('anio');
    
    const mesActual = new Date().getMonth() + 1;
    const anioActual = new Date().getFullYear();
    
    const mes = mesParam ? parseInt(mesParam) : mesActual;
    const anio = anioParam ? parseInt(anioParam) : anioActual;
    const empleadoId = searchParams.get('empleadoId') || '';

    // ✅ Convertir a string para padStart
    const mesStr = mes.toString().padStart(2, '0');
    const startDate = `${anio}-${mesStr}-01`;
    
    // ✅ Calcular último día del mes correctamente
    const lastDay = new Date(anio, mes, 0).getDate();
    const endDate = `${anio}-${mesStr}-${lastDay.toString().padStart(2, '0')}`;

    let query = supabase
      .from('asistencias')
      .select(`
        *,
        empleado:empleados(
          id,
          nombre_completo,
          rut,
          cargo,
          area
        )
      `)
      .gte('fecha', startDate)
      .lte('fecha', endDate);

    if (empleadoId) {
      query = query.eq('empleado_id', empleadoId);
    }

    const { data, error } = await query.order('fecha', { ascending: true });

    if (error) throw error;

    const asistencias = data || [];

    // Calcular resumen
    const resumen = {
      total_dias: asistencias.length,
      dias_presente: asistencias.filter(a => a.estado === 'presente').length,
      dias_ausente: asistencias.filter(a => a.estado === 'ausente').length,
      dias_tarde: asistencias.filter(a => a.estado === 'tarde').length,
      dias_justificado: asistencias.filter(a => a.estado === 'justificado').length,
      total_horas: asistencias.reduce((sum, a) => sum + (a.horas_trabajadas || 0), 0),
      total_horas_extras: asistencias.reduce((sum, a) => sum + (a.horas_extras || 0), 0),
    };

    // Datos por empleado (agrupados)
    const porEmpleado = asistencias.reduce((acc: any[], a) => {
      const existente = acc.find(e => e.empleado_id === a.empleado_id);
      if (existente) {
        existente.dias_presente++;
        existente.total_horas += a.horas_trabajadas || 0;
      } else {
        acc.push({
          empleado_id: a.empleado_id,
          empleado_nombre: a.empleado?.nombre_completo,
          empleado_rut: a.empleado?.rut,
          cargo: a.empleado?.cargo,
          area: a.empleado?.area,
          dias_presente: a.estado === 'presente' ? 1 : 0,
          dias_ausente: a.estado === 'ausente' ? 1 : 0,
          dias_tarde: a.estado === 'tarde' ? 1 : 0,
          total_horas: a.horas_travajadas || 0,
        });
      }
      return acc;
    }, []);

    return NextResponse.json({
      success: true,
      data: asistencias,
      resumen,
      porEmpleado,
      filtros: { mes, anio, empleadoId },
    });
  } catch (error: any) {
    console.error('Error en reporte de asistencias:', error);
    return NextResponse.json(
      { error: error.message || 'Error al generar reporte' },
      { status: 500 }
    );
  }
}