// components/rrhh/EstadisticasRRHH.tsx
'use client';
import { Users, UserCheck, UserX, Calendar, TrendingUp, Briefcase } from 'lucide-react';

interface EstadisticasRRHHProps {
  stats: {
    total_empleados: number;
    empleados_activos: number;
    empleados_ausentes: number;
    empleados_baja: number;
    contrataciones_anio: number;
    antiguedad_promedio: number;
    mujeres: number;
    hombres: number;
    por_area: Array<{ area: string; cantidad: number }>;
    por_cargo: Array<{ cargo: string; cantidad: number }>;
    proximos_cumpleaños: Array<{
      id: string;
      nombre_completo: string;
      fecha_nacimiento: string;
      cargo: string | null;
    }>;
  };
}

export default function EstadisticasRRHH({ stats }: EstadisticasRRHHProps) {
  const cards = [
    {
      titulo: 'Total Empleados',
      valor: stats.total_empleados,
      icono: Users,
      color: 'bg-blue-500',
      descripcion: 'en toda la empresa'
    },
    {
      titulo: 'Activos',
      valor: stats.empleados_activos,
      icono: UserCheck,
      color: 'bg-emerald-500',
      descripcion: `${Math.round((stats.empleados_activos / stats.total_empleados) * 100)}% del total`
    },
    {
      titulo: 'Ausentes',
      valor: stats.empleados_ausentes,
      icono: Calendar,
      color: 'bg-amber-500',
      descripcion: 'vacaciones o licencia'
    },
    {
      titulo: 'Contrataciones',
      valor: stats.contrataciones_anio,
      icono: TrendingUp,
      color: 'bg-purple-500',
      descripcion: 'este año'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Tarjetas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-400">{card.titulo}</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{card.valor}</p>
                <p className="text-[8px] text-slate-400 mt-1">{card.descripcion}</p>
              </div>
              <div className={`${card.color} p-2 rounded-xl text-white`}>
                <card.icono size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Gráficos simples */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por género */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Users size={16} className="text-blue-500" />
            Distribución por Género
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                <span>Mujeres</span>
                <span>{stats.mujeres} ({Math.round((stats.mujeres / stats.total_empleados) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-pink-500 h-2 rounded-full" style={{ width: `${(stats.mujeres / stats.total_empleados) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                <span>Hombres</span>
                <span>{stats.hombres} ({Math.round((stats.hombres / stats.total_empleados) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(stats.hombres / stats.total_empleados) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Briefcase size={10} />
              Antigüedad promedio: {stats.antiguedad_promedio} años
            </p>
          </div>
        </div>

        {/* Próximos cumpleaños */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-amber-500" />
            Próximos Cumpleaños
          </h3>
          <div className="space-y-3">
            {stats.proximos_cumpleaños.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No hay cumpleaños próximos</p>
            ) : (
              stats.proximos_cumpleaños.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                      {emp.nombre_completo.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{emp.nombre_completo}</p>
                      <p className="text-[9px] text-slate-400">{emp.cargo || 'Sin cargo'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-amber-600">
                      {new Date(emp.fecha_nacimiento).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top áreas y cargos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4">Distribución por Área</h3>
          <div className="space-y-2">
            {stats.por_area.slice(0, 5).map((item) => (
              <div key={item.area}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{item.area}</span>
                  <span>{item.cantidad} empleados</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(item.cantidad / stats.total_empleados) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4">Principales Cargos</h3>
          <div className="space-y-2">
            {stats.por_cargo.slice(0, 5).map((item) => (
              <div key={item.cargo}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{item.cargo}</span>
                  <span>{item.cantidad} empleados</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(item.cantidad / stats.total_empleados) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}