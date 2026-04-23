// app/api/rrhh/asistencias/reporte/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const empleadoId = searchParams.get('empleadoId') || '';
    
    // Obtener mes y anio como números, con valores por defecto
    const mesParam = searchParams.get('mes');
    const anioParam = searchParams.get('anio');
    
    const mesActual = new Date().getMonth() + 1;
    const anioActual = new Date().getFullYear();
    
    const mes = mesParam ? parseInt(mesParam) : mesActual;
    const anio = anioParam ? parseInt(anioParam) : anioActual;
    
    // Convertir a string para padStart (corregido)
    const mesStr = mes.toString().padStart(2, '0');
    const startDate = `${anio}-${mesStr}-01`;
    const endDate = new Date(anio, mes, 0).toISOString().split('T')[0];

    console.log(`📊 Generando reporte: ${anio}-${mesStr} (${startDate} al ${endDate})`);

    let query = supabase
      .from('asistencias')
      .select('*')
      .gte('fecha', startDate)
      .lte('fecha', endDate);

    if (empleadoId) {
      query = query.eq('empleado_id', empleadoId);
    }

    const { data, error } = await query.order('fecha', { ascending: true });

    if (error) throw error;

    // Calcular estadísticas del mes
    const asistencias = data || [];
    const totalDias = asistencias.length;
    const diasPresente = asistencias.filter(a => a.estado === 'presente').length;
    const diasAusente = asistencias.filter(a => a.estado === 'ausente').length;
    const diasTarde = asistencias.filter(a => a.estado === 'tarde').length;
    const diasJustificado = asistencias.filter(a => a.estado === 'justificado').length;
    const totalHoras = asistencias.reduce((sum, a) => sum + (a.horas_trabajadas || 0), 0);
    const totalHorasExtras = asistencias.reduce((sum, a) => sum + (a.horas_extras || 0), 0);
    const totalHorasExtras25 = asistencias.reduce((sum, a) => sum + (a.horas_extras_25 || 0), 0);
    const totalHorasExtras50 = asistencias.reduce((sum, a) => sum + (a.horas_extras_50 || 0), 0);

    // Calcular porcentaje de asistencia
    const porcentajeAsistencia = totalDias > 0 ? Math.round((diasPresente / totalDias) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: asistencias,
      resumen: {
        total_dias: totalDias,
        dias_presente: diasPresente,
        dias_ausente: diasAusente,
        dias_tarde: diasTarde,
        dias_justificado: diasJustificado,
        porcentaje_asistencia: porcentajeAsistencia,
        total_horas: Math.round(totalHoras * 10) / 10,
        total_horas_extras: Math.round(totalHorasExtras * 10) / 10,
        total_horas_extras_25: Math.round(totalHorasExtras25 * 10) / 10,
        total_horas_extras_50: Math.round(totalHorasExtras50 * 10) / 10,
      },
    });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/asistencias/reporte:', error);
    return NextResponse.json(
      { error: error.message || 'Error al generar reporte' },
      { status: 500 }
    );
  }
}