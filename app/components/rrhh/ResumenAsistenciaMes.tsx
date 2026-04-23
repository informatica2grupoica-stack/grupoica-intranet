// components/rrhh/ResumenAsistenciaMes.tsx
'use client';
import { TrendingUp, Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface ResumenAsistenciaMesProps {
  resumen: {
    total_dias: number;
    dias_presente: number;
    dias_ausente: number;
    dias_tarde: number;
    dias_justificado: number;
    porcentaje_asistencia: number;
    total_horas: number;
    total_horas_extras: number;
    total_horas_extras_25: number;
    total_horas_extras_50: number;
  } | null;
  empleadoNombre?: string;
}

export default function ResumenAsistenciaMes({ resumen, empleadoNombre }: ResumenAsistenciaMesProps) {
  if (!resumen) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
        <p className="text-slate-400 text-sm">No hay datos para mostrar</p>
      </div>
    );
  }

  const cards = [
    {
      titulo: 'Asistencia',
      valor: `${resumen.porcentaje_asistencia}%`,
      icono: TrendingUp,
      color: 'bg-blue-500',
      descripcion: `${resumen.dias_presente} de ${resumen.total_dias} días`
    },
    {
      titulo: 'Horas Trabajadas',
      valor: `${resumen.total_horas} hrs`,
      icono: Clock,
      color: 'bg-emerald-500',
      descripcion: `${resumen.total_horas_extras} hrs extras`
    },
    {
      titulo: 'Ausencias',
      valor: resumen.dias_ausente,
      icono: AlertCircle,
      color: 'bg-red-500',
      descripcion: `${resumen.dias_tarde} tardos, ${resumen.dias_justificado} justificados`
    },
    {
      titulo: 'Horas Extras',
      valor: `${resumen.total_horas_extras} hrs`,
      icono: CheckCircle,
      color: 'bg-amber-500',
      descripcion: `25%: ${resumen.total_horas_extras_25}hrs | 50%: ${resumen.total_horas_extras_50}hrs`
    },
  ];

  return (
    <div className="space-y-4">
      {empleadoNombre && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-600">
            Resumen del mes para: <span className="font-bold text-slate-800">{empleadoNombre}</span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[8px] font-black uppercase text-slate-400">{card.titulo}</p>
                <p className="text-xl font-black text-slate-800 mt-0.5">{card.valor}</p>
                <p className="text-[7px] text-slate-400 mt-0.5">{card.descripcion}</p>
              </div>
              <div className={`${card.color} p-1.5 rounded-lg text-white`}>
                <card.icono size={14} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}