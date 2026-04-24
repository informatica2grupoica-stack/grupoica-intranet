// components/rrhh/ModalDetalleEvaluacion.tsx
'use client';
import { X, Calendar, User, Star, TrendingUp, FileText } from 'lucide-react';
import Link from 'next/link';

interface ModalDetalleEvaluacionProps {
  evaluacion: any;
  onClose: () => void;
}

export default function ModalDetalleEvaluacion({ evaluacion, onClose }: ModalDetalleEvaluacionProps) {
  if (!evaluacion) return null;

  const formatFecha = (fecha: string) => {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-CL');
  };

  const getCalificacionColor = (calificacion: string) => {
    switch (calificacion) {
      case 'excelente': return 'text-emerald-600 bg-emerald-50';
      case 'bueno': return 'text-blue-600 bg-blue-50';
      case 'regular': return 'text-amber-600 bg-amber-50';
      default: return 'text-red-600 bg-red-50';
    }
  };

  const competencias = [
    { key: 'puntaje_calidad_trabajo', label: 'Calidad del Trabajo' },
    { key: 'puntaje_productividad', label: 'Productividad' },
    { key: 'puntaje_trabajo_equipo', label: 'Trabajo en Equipo' },
    { key: 'puntaje_comunicacion', label: 'Comunicación' },
    { key: 'puntaje_iniciativa', label: 'Iniciativa' },
    { key: 'puntaje_cumplimiento', label: 'Cumplimiento' },
  ];

  const getPuntaje = (key: string) => {
    const valor = evaluacion[key];
    if (!valor) return '—';
    return `${valor}/5`;
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity" onClick={onClose} />
      
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white text-2xl">
              {evaluacion.calificacion === 'excelente' ? '🏆' : evaluacion.calificacion === 'bueno' ? '👍' : evaluacion.calificacion === 'regular' ? '😐' : '⚠️'}
            </div>
            <div className="text-white">
              <h2 className="text-xl font-bold">Evaluación de Desempeño</h2>
              <p className="text-sm text-purple-100">{evaluacion.empleado?.nombre_completo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Información general */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[9px] text-slate-400 uppercase">Período</p>
              <p className="font-medium text-slate-800">{evaluacion.periodo}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[9px] text-slate-400 uppercase">Fecha Evaluación</p>
              <p className="font-medium text-slate-800">{formatFecha(evaluacion.fecha_evaluacion)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[9px] text-slate-400 uppercase">Evaluador</p>
              <p className="font-medium text-slate-800">{evaluacion.evaluador?.nombre} {evaluacion.evaluador?.apellido}</p>
            </div>
            <div className={`rounded-xl p-3 ${getCalificacionColor(evaluacion.calificacion)}`}>
              <p className="text-[9px] uppercase opacity-70">Calificación</p>
              <p className="font-bold text-lg">{evaluacion.calificacion?.toUpperCase()}</p>
              <p className="text-sm font-bold">{evaluacion.puntaje_total}/5.0</p>
            </div>
          </div>

          {/* Competencias */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Star size={16} className="text-amber-500" />
              Competencias Evaluadas
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {competencias.map((comp) => (
                <div key={comp.key} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                  <span className="text-xs text-slate-600">{comp.label}</span>
                  <span className="text-sm font-bold text-blue-600">{getPuntaje(comp.key)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fortalezas */}
          {evaluacion.fortalezas && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <TrendingUp size={14} className="text-emerald-500" />
                💪 Fortalezas
              </h3>
              <p className="text-sm text-slate-600 bg-emerald-50 p-3 rounded-xl">{evaluacion.fortalezas}</p>
            </div>
          )}

          {/* Áreas de mejora */}
          {evaluacion.areas_mejora && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <TrendingUp size={14} className="text-amber-500" />
                📈 Áreas de Mejora
              </h3>
              <p className="text-sm text-slate-600 bg-amber-50 p-3 rounded-xl">{evaluacion.areas_mejora}</p>
            </div>
          )}

          {/* Plan de acción */}
          {evaluacion.plan_accion && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <FileText size={14} className="text-blue-500" />
                📋 Plan de Acción
              </h3>
              <p className="text-sm text-slate-600 bg-blue-50 p-3 rounded-xl">{evaluacion.plan_accion}</p>
            </div>
          )}

          {/* Próxima evaluación */}
          {evaluacion.proxima_evaluacion && (
            <div className="text-xs text-slate-400 pt-3 border-t border-slate-100">
              <p>Próxima evaluación: {formatFecha(evaluacion.proxima_evaluacion)}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <Link
            href={`/rrhh/evaluaciones/${evaluacion.id}/editar`}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Editar Evaluación
          </Link>
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </>
  );
}