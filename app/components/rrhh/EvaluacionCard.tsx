// components/rrhh/EvaluacionCard.tsx
'use client';
import { useState } from 'react';
import { Calendar, User, Star, TrendingUp, Eye, Edit3, Trash2 } from 'lucide-react';
import Link from 'next/link';
import ModalDetalleEvaluacion from './ModalDetalleEvaluacion';

interface EvaluacionCardProps {
  evaluacion: any;
  onDelete?: (id: string) => void;
}

export default function EvaluacionCard({ evaluacion, onDelete }: EvaluacionCardProps) {
  const [mostrarModal, setMostrarModal] = useState(false);

  const getCalificacionColor = (calificacion: string) => {
    switch (calificacion) {
      case 'excelente': return 'bg-emerald-100 text-emerald-600';
      case 'bueno': return 'bg-blue-100 text-blue-600';
      case 'regular': return 'bg-amber-100 text-amber-600';
      default: return 'bg-red-100 text-red-600';
    }
  };

  const getCalificacionIcon = (calificacion: string) => {
    switch (calificacion) {
      case 'excelente': return '🏆';
      case 'bueno': return '👍';
      case 'regular': return '😐';
      default: return '⚠️';
    }
  };

  const formatFecha = (fecha: string) => {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-CL');
  };

  const getPeriodoLabel = (periodo: string) => {
    const periodos: Record<string, string> = {
      Q1: '1er Trimestre', Q2: '2do Trimestre', Q3: '3er Trimestre', Q4: '4to Trimestre',
      semestral: 'Semestral', anual: 'Anual',
    };
    return periodos[periodo] || periodo;
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 hover:shadow-lg transition-all overflow-hidden cursor-pointer group" onClick={() => setMostrarModal(true)}>
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center text-white text-lg">
                {getCalificacionIcon(evaluacion.calificacion)}
              </div>
              <div>
                <h3 className="font-bold text-slate-800">{evaluacion.empleado?.nombre_completo}</h3>
                <p className="text-[10px] text-slate-400">{evaluacion.empleado?.cargo || 'Sin cargo'}</p>
              </div>
            </div>
            <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${getCalificacionColor(evaluacion.calificacion)}`}>
              {evaluacion.calificacion?.toUpperCase()}
            </span>
          </div>

          {/* Detalles */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar size={14} className="text-slate-400" />
              <span>{getPeriodoLabel(evaluacion.periodo)} • {formatFecha(evaluacion.fecha_evaluacion)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <User size={14} className="text-slate-400" />
              <span>Evaluador: {evaluacion.evaluador?.nombre} {evaluacion.evaluador?.apellido}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Star size={14} className="text-amber-400" />
              <span className="font-bold">{evaluacion.puntaje_total}/5.0</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
            <Link
              href={`/rrhh/evaluaciones/${evaluacion.id}/editar`}
              className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <Edit3 size={14} />
            </Link>
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(evaluacion.id); }}
                className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded-lg"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de detalles */}
      {mostrarModal && (
        <ModalDetalleEvaluacion
          evaluacion={evaluacion}
          onClose={() => setMostrarModal(false)}
        />
      )}
    </>
  );
}