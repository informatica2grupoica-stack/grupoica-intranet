// components/rrhh/AsignacionCapacitacionCard.tsx - CORREGIDO
'use client';
import { useState } from 'react';
import { CheckCircle, XCircle, Calendar, Award, FileText, Upload, Clock } from 'lucide-react';  // ← Agregar Clock

interface AsignacionCapacitacionCardProps {
  asignacion: any;
  onCompletar?: (id: string, datos: any) => Promise<any>;
}

export default function AsignacionCapacitacionCard({ asignacion, onCompletar }: AsignacionCapacitacionCardProps) {
  const [mostrarModal, setMostrarModal] = useState(false);
  const [fechaRealizacion, setFechaRealizacion] = useState(asignacion.fecha_realizacion?.split('T')[0] || '');
  const [puntaje, setPuntaje] = useState(asignacion.puntaje || '');
  const [notas, setNotas] = useState(asignacion.notas || '');
  const [completando, setCompletando] = useState(false);

  const handleCompletar = async () => {
    if (!fechaRealizacion) return;
    setCompletando(true);
    await onCompletar?.(asignacion.id, {
      fecha_realizacion: fechaRealizacion,
      puntaje: puntaje ? Number(puntaje) : null,
      notas,
    });
    setCompletando(false);
    setMostrarModal(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-bold text-slate-800">{asignacion.capacitacion?.nombre}</h4>
            {asignacion.completado ? (
              <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 flex items-center gap-1">
                <CheckCircle size={10} /> Completado
              </span>
            ) : (
              <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 flex items-center gap-1">
                <Clock size={10} /> Pendiente
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">{asignacion.capacitacion?.proveedor}</p>
          {asignacion.fecha_realizacion && (
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <Calendar size={12} />
              Realizada: {new Date(asignacion.fecha_realizacion).toLocaleDateString()}
            </p>
          )}
          {asignacion.puntaje && (
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <Award size={12} />
              Puntaje: {asignacion.puntaje}/100
            </p>
          )}
          {asignacion.notas && (
            <p className="text-xs text-slate-400 mt-2 italic">{asignacion.notas}</p>
          )}
        </div>

        {!asignacion.completado && onCompletar && (
          <button
            onClick={() => setMostrarModal(true)}
            className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
            title="Marcar como completada"
          >
            <CheckCircle size={18} />
          </button>
        )}
      </div>

      {/* Modal para completar */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5">
            <h3 className="text-lg font-bold mb-4">Completar Capacitación</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Fecha Realización *</label>
                <input
                  type="date"
                  value={fechaRealizacion}
                  onChange={(e) => setFechaRealizacion(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl p-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Puntaje</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={puntaje}
                  onChange={(e) => setPuntaje(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl p-3 text-sm"
                  placeholder="0-100"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Notas</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl p-3 text-sm resize-none"
                  rows={3}
                  placeholder="Observaciones sobre la capacitación..."
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button onClick={() => setMostrarModal(false)} className="px-4 py-2 text-sm text-slate-500">Cancelar</button>
                <button onClick={handleCompletar} disabled={completando || !fechaRealizacion} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                  {completando ? 'Guardando...' : 'Completar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}