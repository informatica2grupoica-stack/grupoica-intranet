// app/(dashboard)/tareas/components/VistaGantt.tsx
'use client';
import { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface VistaGanttProps {
  tareas: any[];
  onTaskClick?: (tarea: any) => void;
}

type ZoomLevel = 'day' | 'week' | 'month';

export default function VistaGantt({ tareas, onTaskClick }: VistaGanttProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filtrar tareas con fechas
  const tareasConFechas = useMemo(() => {
    return tareas.filter(t => t.fecha_inicio && t.fecha_limite);
  }, [tareas]);

  // Calcular rango de fechas
  const { fechaInicio, fechaFin } = useMemo(() => {
    if (tareasConFechas.length === 0) {
      const hoy = new Date();
      return { fechaInicio: hoy, fechaFin: hoy };
    }
    
    const inicio = new Date(Math.min(...tareasConFechas.map(t => new Date(t.fecha_inicio).getTime())));
    const fin = new Date(Math.max(...tareasConFechas.map(t => new Date(t.fecha_limite).getTime())));
    
    // Agregar margen de 7 días
    inicio.setDate(inicio.getDate() - 7);
    fin.setDate(fin.getDate() + 7);
    
    return { fechaInicio: inicio, fechaFin: fin };
  }, [tareasConFechas]);

  // Generar lista de fechas para el eje X
  const fechasEje = useMemo(() => {
    const fechas: Date[] = [];
    const current = new Date(fechaInicio);
    
    while (current <= fechaFin) {
      fechas.push(new Date(current));
      if (zoom === 'day') current.setDate(current.getDate() + 1);
      else if (zoom === 'week') current.setDate(current.getDate() + 7);
      else current.setMonth(current.getMonth() + 1);
    }
    
    return fechas.slice(offset * 20, (offset + 1) * 20 + 1);
  }, [fechaInicio, fechaFin, zoom, offset]);

  const getColorTarea = (estado: string, prioridad: string) => {
    if (estado === 'completada') return 'bg-emerald-500';
    if (estado === 'en_proceso') return 'bg-amber-500';
    if (prioridad === 'alta') return 'bg-red-500';
    if (prioridad === 'media') return 'bg-orange-400';
    return 'bg-blue-500';
  };

  const getProgreso = (tarea: any) => {
    if (tarea.estado === 'completada') return 100;
    if (tarea.estado === 'en_proceso') return 50;
    if (tarea.progreso) return tarea.progreso;
    return 0;
  };

  // ✅ CORREGIDO: función para formatear fechas sin usar 'week'
  const formatFechaHeader = (fecha: Date) => {
    if (zoom === 'day') {
      return fecha.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    }
    if (zoom === 'week') {
      // Obtener el número de semana manualmente
      const firstJan = new Date(fecha.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((fecha.getTime() - firstJan.getTime()) / (1000 * 60 * 60 * 24));
      const weekNum = Math.ceil((dayOfYear + firstJan.getDay() + 1) / 7);
      return `S${weekNum}`;
    }
    // month
    return fecha.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
  };

  const calcularPosicion = (fecha: Date) => {
    const totalDias = (fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24);
    const diasDesdeInicio = (fecha.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24);
    return (diasDesdeInicio / totalDias) * 100;
  };

  const handlePrevious = () => {
    setOffset(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    const maxOffset = Math.floor(fechasEje.length / 20);
    setOffset(prev => Math.min(maxOffset, prev + 1));
  };

  if (tareasConFechas.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
        <Calendar size={48} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-400 font-bold">No hay tareas con fechas definidas</p>
        <p className="text-[10px] text-slate-300 mt-1">
          Agrega fechas de inicio y límite a tus tareas para ver el diagrama Gantt
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Toolbar */}
      <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/30">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black uppercase text-slate-600">📊 Diagrama Gantt</h3>
          <span className="text-[9px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
            {tareasConFechas.length} tareas
          </span>
        </div>
        
        <div className="flex gap-1">
          <button
            onClick={() => setZoom('day')}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
              zoom === 'day' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Día
          </button>
          <button
            onClick={() => setZoom('week')}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
              zoom === 'week' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setZoom('month')}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
              zoom === 'month' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Mes
          </button>
        </div>
        
        <div className="flex gap-1">
          <button
            onClick={handlePrevious}
            disabled={offset === 0}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-96">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Cabecera de fechas */}
            <div className="flex border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
              <div className="w-64 flex-shrink-0 p-3 text-[10px] font-black uppercase text-slate-400 bg-inherit border-r border-slate-100">
                Tarea
              </div>
              <div className="flex-1 flex">
                {fechasEje.map((fecha, idx) => (
                  <div
                    key={idx}
                    className="text-[8px] font-bold text-slate-400 text-center border-r border-slate-100 py-2 px-1 flex-shrink-0"
                    style={{ minWidth: zoom === 'day' ? 60 : zoom === 'week' ? 80 : 100 }}
                  >
                    {formatFechaHeader(fecha)}
                  </div>
                ))}
              </div>
            </div>

            {/* Filas de tareas */}
            {tareasConFechas.map((tarea) => {
              const inicio = new Date(tarea.fecha_inicio);
              const fin = new Date(tarea.fecha_limite);
              const progreso = getProgreso(tarea);
              const color = getColorTarea(tarea.estado, tarea.prioridad);
              
              let leftPos = calcularPosicion(inicio);
              let width = calcularPosicion(fin) - leftPos;
              
              // Validar valores
              leftPos = Math.max(0, Math.min(100, leftPos));
              width = Math.max(0, Math.min(100 - leftPos, width));
              
              return (
                <div
                  key={tarea.id}
                  className="flex border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer group"
                  onClick={() => onTaskClick?.(tarea)}
                >
                  {/* Columna de tarea */}
                  <div className="w-64 flex-shrink-0 p-3 border-r border-slate-100 bg-white">
                    <p className="text-xs font-bold text-slate-700 truncate group-hover:text-blue-600 transition-colors">
                      {tarea.titulo}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-[7px] font-black px-1.5 py-0.5 rounded ${
                        tarea.prioridad === 'alta' ? 'bg-red-100 text-red-600' :
                        tarea.prioridad === 'media' ? 'bg-amber-100 text-amber-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {tarea.prioridad}
                      </span>
                      <span className="text-[7px] text-slate-400">
                        {tarea.responsable?.nombre}
                      </span>
                    </div>
                  </div>
                  
                  {/* Barra Gantt */}
                  <div className="flex-1 relative py-3 bg-white">
                    {width > 0 && (
                      <div
                        className={`absolute h-8 rounded-lg flex items-center justify-center text-[8px] font-bold text-white shadow-sm group-hover:shadow-md transition-all overflow-hidden cursor-pointer ${color}`}
                        style={{
                          left: `${leftPos}%`,
                          width: `${width}%`,
                        }}
                      >
                        <div 
                          className="absolute left-0 top-0 h-full bg-white/20 rounded-l-lg transition-all" 
                          style={{ width: `${progreso}%` }} 
                        />
                        <span className="relative z-10 truncate px-2 text-[9px] font-bold">
                          {tarea.titulo.length > 25 ? tarea.titulo.substring(0, 25) + '...' : tarea.titulo}
                        </span>
                      </div>
                    )}
                    
                    {/* Hito de inicio */}
                    <div
                      className="absolute w-2 h-2 bg-green-500 rounded-full -translate-x-1/2 top-1/2 -translate-y-1/2"
                      style={{ left: `${leftPos}%` }}
                    />
                    
                    {/* Hito de fin */}
                    <div
                      className="absolute w-2 h-2 bg-red-500 rounded-full -translate-x-1/2 top-1/2 -translate-y-1/2"
                      style={{ left: `${Math.min(100, leftPos + width)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 p-4 border-t border-slate-100 bg-slate-50/30 text-[8px] font-bold">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span className="text-slate-500">Normal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <span className="text-slate-500">En Proceso</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          <span className="text-slate-500">Completada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span className="text-slate-500">Alta Prioridad</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-4 h-1.5 bg-slate-200 border border-slate-300 rounded" />
          <span className="text-slate-400">Progreso</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-slate-400">Inicio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-slate-400">Fin</span>
        </div>
      </div>
    </div>
  );
}