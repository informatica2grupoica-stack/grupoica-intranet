// app/api/rrhh/dashboard/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // ✅ CORREGIDO: Seleccionar todos los campos necesarios
    const { data: stats, error } = await supabase
      .from('empleados')
      .select(`
        id,
        nombre_completo,
        estado,
        genero,
        area,
        cargo,
        fecha_nacimiento,
        fecha_ingreso,
        created_at
      `);
    
    if (error) throw error;
    
    const empleados = stats || [];
    
    const totalEmpleados = empleados.length;
    const empleadosActivos = empleados.filter(e => e.estado === 'activo').length;
    const empleadosAusentes = empleados.filter(e => e.estado === 'vacaciones' || e.estado === 'licencia').length;
    const empleadosBaja = empleados.filter(e => e.estado === 'despedido' || e.estado === 'renuncio').length;
    
    // Contrataciones del año
    const fechaInicioAnio = new Date(new Date().getFullYear(), 0, 1);
    const contratacionesAnio = empleados.filter(e => {
      if (!e.created_at) return false;
      return new Date(e.created_at) >= fechaInicioAnio;
    }).length;
    
    // Antigüedad promedio
    let antiguedadTotal = 0;
    let empleadosConFecha = 0;
    empleados.forEach(e => {
      if (e.fecha_ingreso) {
        const años = (new Date().getTime() - new Date(e.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24 * 365);
        antiguedadTotal += años;
        empleadosConFecha++;
      }
    });
    const antiguedadPromedio = empleadosConFecha > 0 ? Math.round((antiguedadTotal / empleadosConFecha) * 10) / 10 : 0;
    
    // Por género
    const mujeres = empleados.filter(e => e.genero === 'femenino').length;
    const hombres = empleados.filter(e => e.genero === 'masculino').length;
    
    // Por área
    const areaMap = new Map<string, number>();
    empleados.forEach(e => {
      if (e.area) {
        areaMap.set(e.area, (areaMap.get(e.area) || 0) + 1);
      }
    });
    const porArea = Array.from(areaMap.entries()).map(([area, cantidad]) => ({ area, cantidad }));
    
    // Por cargo
    const cargoMap = new Map<string, number>();
    empleados.forEach(e => {
      if (e.cargo) {
        cargoMap.set(e.cargo, (cargoMap.get(e.cargo) || 0) + 1);
      }
    });
    const porCargo = Array.from(cargoMap.entries()).map(([cargo, cantidad]) => ({ cargo, cantidad }));
    
    // Próximos cumpleaños
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const proximosCumpleaños = empleados
      .filter(e => e.fecha_nacimiento)
      .map(e => {
        const fechaNac = new Date(e.fecha_nacimiento!);
        const proximoCumple = new Date(new Date().getFullYear(), fechaNac.getMonth(), fechaNac.getDate());
        
        // Si el cumpleaños ya pasó este año, calcular para el próximo año
        if (proximoCumple < hoy) {
          proximoCumple.setFullYear(proximoCumple.getFullYear() + 1);
        }
        
        return {
          id: e.id,
          nombre_completo: e.nombre_completo,
          fecha_nacimiento: e.fecha_nacimiento,
          cargo: e.cargo,
          proximo_cumple: proximoCumple
        };
      })
      .filter(e => e.proximo_cumple)
      .sort((a, b) => a.proximo_cumple.getTime() - b.proximo_cumple.getTime())
      .slice(0, 5);
    
    return NextResponse.json({
      success: true,
      stats: {
        total_empleados: totalEmpleados,
        empleados_activos: empleadosActivos,
        empleados_ausentes: empleadosAusentes,
        empleados_baja: empleadosBaja,
        contrataciones_anio: contratacionesAnio,
        antiguedad_promedio: antiguedadPromedio,
        mujeres,
        hombres,
        por_area: porArea,
        por_cargo: porCargo,
        proximos_cumpleaños: proximosCumpleaños.map(e => ({
          id: e.id,
          nombre_completo: e.nombre_completo,
          fecha_nacimiento: e.fecha_nacimiento,
          cargo: e.cargo,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error en GET /api/rrhh/dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}