'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react';

interface TareaGantt {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies?: string;
  asignado_a?: string;
  prioridad?: string;
}

interface VistaGanttProps {
  tareas: any[];
  onTaskClick?: (tarea: any) => void;
}

export default function VistaGantt({ tareas, onTaskClick }: VistaGanttProps) {
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('week');
  const containerRef = useRef<HTMLDivElement>(null);

  const tareasConFechas = tareas.filter(t => t.fecha_inicio && t.fecha_limite);
  const diasMinimos = Math.min(...tareasConFechas.map(t => new Date(t.fecha_inicio).getTime()));
  const diasMaximos = Math.max(...tareasConFechas.map(t => new Date(t.fecha_limite).getTime()));
  const rangoDias = Math.ceil((diasMaximos - diasMinimos) / (1000 * 60 * 60 * 24));
  
  const getColorPrioridad = (prioridad: string) => {
    switch (prioridad) {
      case 'alta': return 'bg-red-500';
      case 'media': return 'bg-amber-500';
      default: return 'bg-emerald-500';
    }
  };

  const getProgreso = (tarea: any) => {
    if (tarea.estado === 'completada') return 100;
    if (tarea.estado === 'en_proceso') return 50;
    if (tarea.progreso) return tarea.progreso;
    return 0;
  };

  useEffect(() => {
    if (containerRef.current) {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 flex justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (tareasConFechas.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
        <p className="text-slate-400 text-sm">No hay tareas con fechas definidas</p>
        <p className="text-[10px] text-slate-300 mt-1">Agrega fechas de inicio y límite para ver el diagrama Gantt</p>
      </div>
    );
  }

  const anchoBarra = zoom === 'day' ? 60 : zoom === 'week' ? 120 : 200;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header del Gantt */}
      <div className="flex justify-between items-center p-4 border-b border-slate-100">
        <h3 className="text-sm font-black uppercase text-slate-600">📊 Diagrama Gantt</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setZoom('day')}
            className={`p-1.5 rounded-lg text-[9px] font-bold ${zoom === 'day' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
          >
            Día
          </button>
          <button
            onClick={() => setZoom('week')}
            className={`p-1.5 rounded-lg text-[9px] font-bold ${zoom === 'week' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
          >
            Semana
          </button>
          <button
            onClick={() => setZoom('month')}
            className={`p-1.5 rounded-lg text-[9px] font-bold ${zoom === 'month' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
          >
            Mes
          </button>
        </div>
      </div>

      {/* Cuerpo del Gantt */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Cabecera de fechas */}
          <div className="flex border-b border-slate-100 bg-slate-50/50">
            <div className="w-64 flex-shrink-0 p-3 text-[10px] font-black uppercase text-slate-400">Tarea</div>
            <div className="flex-1 flex">
              {Array.from({ length: Math.min(rangoDias + 1, 60) }).map((_, i) => {
                const fecha = new Date(diasMinimos + (i * 24 * 60 * 60 * 1000));
                return (
                  <div
                    key={i}
                    className="text-[8px] font-bold text-slate-400 text-center border-r border-slate-100 py-2"
                    style={{ width: anchoBarra }}
                  >
                    {fecha.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filas de tareas */}
          {tareasConFechas.map((tarea) => {
            const inicio = new Date(tarea.fecha_inicio);
            const fin = new Date(tarea.fecha_limite);
            const inicioOffset = Math.max(0, Math.floor((inicio.getTime() - diasMinimos) / (1000 * 60 * 60 * 24)));
            const duracion = Math.max(1, Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1);
            const progreso = getProgreso(tarea);

            return (
              <div
                key={tarea.id}
                className="flex border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                onClick={() => onTaskClick?.(tarea)}
              >
                <div className="w-64 flex-shrink-0 p-3">
                  <p className="text-xs font-bold text-slate-700 truncate">{tarea.titulo}</p>
                  <p className="text-[8px] text-slate-400 mt-0.5">
                    {tarea.responsable?.nombre} • {tarea.prioridad}
                  </p>
                </div>
                <div className="flex-1 relative py-2">
                  <div
                    className="absolute h-8 rounded-lg flex items-center justify-center text-[8px] font-bold text-white shadow-sm"
                    style={{
                      left: inicioOffset * anchoBarra,
                      width: duracion * anchoBarra,
                      backgroundColor: tarea.estado === 'completada' ? '#10b981' : 
                                      tarea.estado === 'en_proceso' ? '#f59e0b' : '#3b82f6'
                    }}
                  >
                    <div
                      className="absolute left-0 top-0 h-full bg-white/20 rounded-l-lg"
                      style={{ width: `${progreso}%` }}
                    />
                    <span className="relative z-10">{tarea.titulo.substring(0, 20)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}