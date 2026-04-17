'use client';
import { CheckCircle2, Clock, AlertCircle, TrendingUp, Calendar } from 'lucide-react';

interface MetricasProps {
  estadisticas: {
    total: number;
    completadas: number;
    en_proceso: number;
    pendientes: number;
    atrasadas: number;
    progreso_general: number;
  };
}

export default function MetricasTareas({ estadisticas }: MetricasProps) {
  const cards = [
    {
      titulo: 'Total Tareas',
      valor: estadisticas.total,
      icono: Calendar,
      color: 'bg-blue-500',
      descripcion: 'tareas registradas'
    },
    {
      titulo: 'Completadas',
      valor: estadisticas.completadas,
      icono: CheckCircle2,
      color: 'bg-emerald-500',
      descripcion: `${estadisticas.progreso_general}% del total`
    },
    {
      titulo: 'En Proceso',
      valor: estadisticas.en_proceso,
      icono: TrendingUp,
      color: 'bg-amber-500',
      descripcion: 'en ejecución'
    },
    {
      titulo: 'Pendientes',
      valor: estadisticas.pendientes,
      icono: Clock,
      color: 'bg-slate-500',
      descripcion: `${estadisticas.atrasadas} atrasadas`
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400">{card.titulo}</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{card.valor}</p>
              <p className="text-[8px] text-slate-400 mt-1">{card.descripcion}</p>
            </div>
            <div className={`${card.color} p-2 rounded-xl text-white`}>
              <card.icono size={16} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}