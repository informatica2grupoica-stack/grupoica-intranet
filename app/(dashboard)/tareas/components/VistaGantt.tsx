'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2, Link, Clock, AlertCircle } from 'lucide-react';

interface VistaGanttProps {
  tareas: any[];
  onTaskClick?: (tarea: any) => void;
}

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';

export default function VistaGantt({ tareas, onTaskClick }: VistaGanttProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [scrollLeft, setScrollLeft] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [mostrarDependencias, setMostrarDependencias] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<HTMLDivElement>(null);

  // Filtrar tareas con fechas
  const tareasConFechas = useMemo(() => {
    return tareas.filter(t => t.fecha_inicio && t.fecha_limite);
  }, [tareas]);

  // Calcular rango de fechas del proyecto
  const { fechaInicio, fechaFin, totalDias } = useMemo(() => {
    if (tareasConFechas.length === 0) {
      const hoy = new Date();
      const fin = new Date(hoy);
      fin.setMonth(fin.getMonth() + 3);
      return { fechaInicio: hoy, fechaFin: fin, totalDias: 90 };
    }
    
    const inicio = new Date(Math.min(...tareasConFechas.map(t => new Date(t.fecha_inicio).getTime())));
    const fin = new Date(Math.max(...tareasConFechas.map(t => new Date(t.fecha_limite).getTime())));
    
    // Agregar margen del 20%
    const margenDias = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) * 0.2;
    inicio.setDate(inicio.getDate() - margenDias);
    fin.setDate(fin.getDate() + margenDias);
    
    const dias = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    
    return { fechaInicio: inicio, fechaFin: fin, totalDias: Math.max(dias, 30) };
  }, [tareasConFechas]);

  // Generar columnas de tiempo
  const columnasTiempo = useMemo(() => {
    const columnas: { fecha: Date; label: string; ancho: number }[] = [];
    const current = new Date(fechaInicio);
    
    let intervalo: number;
    let formato: Intl.DateTimeFormatOptions;
    
    switch (zoom) {
      case 'day':
        intervalo = 1;
        formato = { day: '2-digit', month: '2-digit' };
        break;
      case 'week':
        intervalo = 7;
        formato = { day: '2-digit', month: '2-digit' };
        break;
      case 'month':
        intervalo = 30;
        formato = { month: 'short', year: 'numeric' };
        break;
      case 'quarter':
        intervalo = 90;
        formato = { month: 'short', year: 'numeric' };
        break;
    }
    
    while (current <= fechaFin) {
      let label = '';
      if (zoom === 'week') {
        const semana = Math.ceil((current.getDate() + 6) / 7);
        label = `S${semana} ${current.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })}`;
      } else if (zoom === 'day') {
        label = current.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
      } else {
        label = current.toLocaleDateString('es-CL', formato);
      }
      
      columnas.push({
        fecha: new Date(current),
        label,
        ancho: zoom === 'day' ? 80 : zoom === 'week' ? 100 : zoom === 'month' ? 120 : 150
      });
      
      current.setDate(current.getDate() + intervalo);
    }
    
    return columnas;
  }, [fechaInicio, fechaFin, zoom]);

  // Calcular posición y ancho de cada tarea
  const calcularEstiloTarea = (tarea: any) => {
    const inicio = new Date(tarea.fecha_inicio);
    const fin = new Date(tarea.fecha_limite);
    
    const inicioOffset = (inicio.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24);
    const duracion = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
    
    const porcentajeInicio = (inicioOffset / totalDias) * 100;
    const porcentajeDuracion = (duracion / totalDias) * 100;
    
    return {
      left: `${Math.max(0, Math.min(100, porcentajeInicio))}%`,
      width: `${Math.max(0.5, Math.min(100 - porcentajeInicio, porcentajeDuracion))}%`
    };
  };

  const getColorTarea = (tarea: any) => {
    if (tarea.estado === 'completada') return 'bg-emerald-500';
    if (tarea.estado === 'en_proceso') return 'bg-amber-500';
    if (tarea.prioridad === 'alta') return 'bg-red-500';
    if (tarea.prioridad === 'media') return 'bg-orange-400';
    return 'bg-blue-500';
  };

  const getProgreso = (tarea: any) => {
    if (tarea.estado === 'completada') return 100;
    if (tarea.estado === 'en_proceso') return 50;
    if (tarea.progreso) return tarea.progreso;
    return 0;
  };

  const formatearFecha = (fecha: string) => {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const hoy = new Date();
  const posicionHoy = ((hoy.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24) / totalDias) * 100;

  const handleZoomIn = () => {
    const zooms: ZoomLevel[] = ['day', 'week', 'month', 'quarter'];
    const currentIndex = zooms.indexOf(zoom);
    if (currentIndex > 0) setZoom(zooms[currentIndex - 1]);
  };

  const handleZoomOut = () => {
    const zooms: ZoomLevel[] = ['day', 'week', 'month', 'quarter'];
    const currentIndex = zooms.indexOf(zoom);
    if (currentIndex < zooms.length - 1) setZoom(zooms[currentIndex + 1]);
  };

  if (tareasConFechas.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-16 text-center border border-slate-100 shadow-sm">
        <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Calendar size={40} className="text-slate-300" />
        </div>
        <p className="text-slate-500 font-bold text-lg">No hay tareas con fechas definidas</p>
        <p className="text-slate-400 text-sm mt-1">
          Para ver el diagrama Gantt, asigna fechas de inicio y límite a tus tareas
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden ${fullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}>
      
      {/* Header Profesional */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold tracking-tight">📊 Carta Gantt</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {tareasConFechas.length} tareas • {formatearFecha(fechaInicio.toISOString())} → {formatearFecha(fechaFin.toISOString())}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
            title="Alejar"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-xs font-mono bg-white/20 px-3 py-1 rounded-lg">
            {zoom === 'day' ? 'Día' : zoom === 'week' ? 'Semana' : zoom === 'month' ? 'Mes' : 'Trimestre'}
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
            title="Acercar"
          >
            <ZoomIn size={18} />
          </button>
          <div className="w-px h-6 bg-white/20 mx-2" />
          <button
            onClick={() => setMostrarDependencias(!mostrarDependencias)}
            className={`p-2 rounded-lg transition-all ${mostrarDependencias ? 'bg-white/20' : 'hover:bg-white/10'}`}
            title="Mostrar dependencias"
          >
            <Link size={16} />
          </button>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Cuerpo del Gantt */}
      <div className="overflow-x-auto" ref={containerRef}>
        <div className="min-w-[1200px]" ref={ganttRef}>
          
          {/* Cabecera de tiempo */}
          <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
            <div className="w-80 flex-shrink-0 p-4 text-xs font-bold uppercase text-slate-500 border-r border-slate-200 bg-slate-50">
              Tarea / Responsable
            </div>
            <div className="flex-1 flex">
              {columnasTiempo.map((col, idx) => (
                <div
                  key={idx}
                  className="text-[10px] font-bold text-slate-500 text-center border-r border-slate-100 py-4 px-2 flex-shrink-0 bg-slate-50"
                  style={{ minWidth: col.ancho }}
                >
                  {col.label}
                </div>
              ))}
            </div>
          </div>

          {/* Línea del tiempo */}
          <div className="relative">
            {/* Línea del día actual */}
            {posicionHoy > 0 && posicionHoy < 100 && (
              <div
                className="absolute top-0 bottom-0 w-px bg-red-500 z-20"
                style={{ left: `${posicionHoy}%` }}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  Hoy
                </div>
              </div>
            )}

            {/* Filas de tareas */}
            {tareasConFechas.map((tarea, idx) => {
              const estilo = calcularEstiloTarea(tarea);
              const color = getColorTarea(tarea);
              const progreso = getProgreso(tarea);
              
              return (
                <div
                  key={tarea.id}
                  className="flex border-b border-slate-100 hover:bg-slate-50/50 transition-colors group cursor-pointer"
                  onClick={() => onTaskClick?.(tarea)}
                >
                  {/* Info tarea */}
                  <div className="w-80 flex-shrink-0 p-3 border-r border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${color.replace('bg-', 'bg-')}`} />
                      <p className="text-sm font-semibold text-slate-700 truncate group-hover:text-blue-600 transition-colors">
                        {tarea.titulo}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[9px] font-bold text-slate-600">
                        {tarea.responsable?.nombre?.[0]}{tarea.responsable?.apellido?.[0]}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {tarea.responsable?.nombre} {tarea.responsable?.apellido}
                      </span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                        tarea.prioridad === 'alta' ? 'bg-red-100 text-red-600' :
                        tarea.prioridad === 'media' ? 'bg-amber-100 text-amber-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {tarea.prioridad}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-[9px] text-slate-400">
                      <Clock size={10} />
                      <span>{formatearFecha(tarea.fecha_inicio)} → {formatearFecha(tarea.fecha_limite)}</span>
                      {tarea.horas_estimadas > 0 && (
                        <span className="ml-2">⏱️ {tarea.horas_estimadas}h</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Barra Gantt */}
                  <div className="flex-1 relative py-3">
                    {/* Grid de fondo */}
                    <div className="absolute inset-0 flex">
                      {columnasTiempo.map((_, idx) => (
                        <div
                          key={idx}
                          className="border-r border-slate-100"
                          style={{ width: `${100 / columnasTiempo.length}%` }}
                        />
                      ))}
                    </div>
                    
                    {/* Barra de la tarea */}
                    <div
                      className={`absolute h-8 rounded-lg flex items-center justify-between px-3 text-white text-xs font-medium shadow-md group-hover:shadow-lg transition-all cursor-pointer ${color}`}
                      style={{ left: estilo.left, width: estilo.width, top: '50%', transform: 'translateY(-50%)' }}
                    >
                      <span className="truncate">{tarea.titulo}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-mono bg-white/20 px-1.5 py-0.5 rounded">
                          {Math.ceil((new Date(tarea.fecha_limite).getTime() - new Date(tarea.fecha_inicio).getTime()) / (1000 * 60 * 60 * 24))}d
                        </span>
                        <span className="text-[9px] font-bold">{progreso}%</span>
                      </div>
                      
                      {/* Barra de progreso */}
                      <div
                        className="absolute left-0 top-0 h-full bg-white/20 rounded-l-lg transition-all"
                        style={{ width: `${progreso}%` }}
                      />
                    </div>
                    
                    {/* Dependencia (si existe) */}
                    {mostrarDependencias && tarea.depende_de && tarea.depende_de.length > 0 && (
                      <div className="absolute -top-2 left-0 text-[8px] text-amber-500 flex items-center gap-0.5">
                        <Link size={8} />
                        <span>dep: {tarea.depende_de.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leyenda y controles */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 border-t border-slate-200">
        <div className="flex flex-wrap gap-4 text-[10px] font-medium">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-slate-600">Normal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span className="text-slate-600">En Proceso</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-slate-600">Completada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-slate-600">Alta Prioridad</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-px h-4 bg-slate-300" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-1.5 bg-white/30 border border-slate-300 rounded" />
            <span className="text-slate-500">Progreso</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-px h-4 bg-red-400" />
            <span className="text-red-500">Hoy</span>
          </div>
          {mostrarDependencias && (
            <div className="flex items-center gap-1.5">
              <Link size={10} className="text-amber-500" />
              <span className="text-amber-600">Dependencias</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-[9px] text-slate-400">
          <span>📅 {formatearFecha(fechaInicio.toISOString())}</span>
          <span>→</span>
          <span>{formatearFecha(fechaFin.toISOString())}</span>
          <span className="ml-2 px-2 py-0.5 bg-slate-200 rounded-full">
            {totalDias} días
          </span>
        </div>
      </div>
    </div>
  );
}