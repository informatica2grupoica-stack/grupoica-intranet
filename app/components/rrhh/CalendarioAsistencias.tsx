// components/rrhh/CalendarioAsistencias.tsx
'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

interface CalendarioAsistenciasProps {
  asistencias: any[];
  onDayClick: (fecha: string) => void;
  mesActual: number;
  anioActual: number;
  onChangeMes: (mes: number, anio: number) => void;
}

export default function CalendarioAsistencias({
  asistencias,
  onDayClick,
  mesActual,
  anioActual,
  onChangeMes,
}: CalendarioAsistenciasProps) {
  const [loading, setLoading] = useState(false);

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'presente': return 'bg-emerald-500 text-white';
      case 'ausente': return 'bg-red-500 text-white';
      case 'tarde': return 'bg-amber-500 text-white';
      case 'justificado': return 'bg-blue-500 text-white';
      default: return 'bg-slate-200 text-slate-600';
    }
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'presente': return '✓';
      case 'ausente': return '✗';
      case 'tarde': return '!';
      case 'justificado': return 'ℹ';
      default: return '?';
    }
  };

  const obtenerAsistenciaPorFecha = (fecha: string) => {
    return asistencias.find(a => a.fecha === fecha);
  };

  const diasEnMes = new Date(anioActual, mesActual, 0).getDate();
  const primerDiaSemana = new Date(anioActual, mesActual - 1, 1).getDay();
  const dias = [];

  // Días vacíos al inicio
  for (let i = 0; i < primerDiaSemana; i++) {
    dias.push(null);
  }

  // Días del mes
  for (let i = 1; i <= diasEnMes; i++) {
    const fecha = `${anioActual}-${mesActual.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
    const asistencia = obtenerAsistenciaPorFecha(fecha);
    dias.push({ dia: i, fecha, asistencia });
  }

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const mesAnterior = () => {
    let nuevoMes = mesActual - 1;
    let nuevoAnio = anioActual;
    if (nuevoMes < 1) {
      nuevoMes = 12;
      nuevoAnio--;
    }
    onChangeMes(nuevoMes, nuevoAnio);
  };

  const mesSiguiente = () => {
    let nuevoMes = mesActual + 1;
    let nuevoAnio = anioActual;
    if (nuevoMes > 12) {
      nuevoMes = 1;
      nuevoAnio++;
    }
    onChangeMes(nuevoMes, nuevoAnio);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <CalendarDays size={18} className="text-blue-500" />
          Calendario de Asistencias
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={mesAnterior}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} className="text-slate-500" />
          </button>
          <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center">
            {meses[mesActual - 1]} {anioActual}
          </span>
          <button
            onClick={mesSiguiente}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight size={18} className="text-slate-500" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((dia, idx) => (
          <div key={idx} className="text-center text-[10px] font-bold text-slate-400 py-1">
            {dia}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dias.map((item, idx) => (
          <div key={idx} className="aspect-square">
            {item ? (
              <button
                onClick={() => onDayClick(item.fecha)}
                className={`w-full h-full rounded-xl flex items-center justify-center text-xs font-medium transition-all hover:scale-105 ${
                  item.asistencia
                    ? getEstadoColor(item.asistencia.estado)
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex flex-col items-center">
                  <span>{item.dia}</span>
                  {item.asistencia && (
                    <span className="text-[8px] font-bold">
                      {getEstadoIcon(item.asistencia.estado)}
                    </span>
                  )}
                </div>
              </button>
            ) : (
              <div className="w-full h-full rounded-xl bg-slate-50/50" />
            )}
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-[9px] text-slate-500">Presente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-[9px] text-slate-500">Ausente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-[9px] text-slate-500">Tarde</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-[9px] text-slate-500">Justificado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-slate-200" />
          <span className="text-[9px] text-slate-500">Sin registro</span>
        </div>
      </div>
    </div>
  );
}