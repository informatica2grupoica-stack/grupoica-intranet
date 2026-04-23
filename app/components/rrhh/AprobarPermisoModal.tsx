// components/rrhh/AprobarPermisoModal.tsx
'use client';
import { useState } from 'react';
import { X, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface AprobarPermisoModalProps {
  permiso: any;
  onAprobar: (id: string, comentarios: string) => Promise<any>;
  onRechazar: (id: string, comentarios: string) => Promise<any>;
  onClose: () => void;
}

export default function AprobarPermisoModal({
  permiso,
  onAprobar,
  onRechazar,
  onClose,
}: AprobarPermisoModalProps) {
  const [loading, setLoading] = useState(false);
  const [comentarios, setComentarios] = useState('');

  const tiposLabels: Record<string, string> = {
    vacaciones: 'Vacaciones',
    licencia_medica: 'Licencia Médica',
    permiso_administrativo: 'Permiso Administrativo',
    estudio: 'Permiso de Estudio',
    personal: 'Permiso Personal',
    matrimonio: 'Matrimonio',
    luto: 'Luto',
    otro: 'Otro',
  };

  const handleAprobar = async () => {
    setLoading(true);
    const result = await onAprobar(permiso.id, comentarios);
    setLoading(false);
    if (result.success) {
      onClose();
    }
  };

  const handleRechazar = async () => {
    setLoading(true);
    const result = await onRechazar(permiso.id, comentarios);
    setLoading(false);
    if (result.success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Revisar Solicitud</h2>
            <p className="text-xs text-slate-500">{permiso.empleado?.nombre_completo}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Detalles del permiso */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-[10px] font-bold text-slate-500">Tipo:</span>
              <span className="text-sm font-medium text-slate-700">
                {tiposLabels[permiso.tipo] || permiso.tipo}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-bold text-slate-500">Período:</span>
              <span className="text-sm text-slate-700">
                {new Date(permiso.fecha_inicio).toLocaleDateString()} → {new Date(permiso.fecha_fin).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-bold text-slate-500">Días:</span>
              <span className="text-sm font-bold text-blue-600">{permiso.dias_solicitados} días</span>
            </div>
            {permiso.motivo && (
              <div>
                <span className="text-[10px] font-bold text-slate-500 block mb-1">Motivo:</span>
                <p className="text-sm text-slate-600">{permiso.motivo}</p>
              </div>
            )}
          </div>

          {/* Comentarios del aprobador */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
              Comentarios (opcional)
            </label>
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200 resize-none"
              rows={3}
              placeholder="Agrega un comentario sobre la decisión..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={handleRechazar}
              disabled={loading}
              className="flex-1 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              Rechazar
            </button>
            <button
              onClick={handleAprobar}
              disabled={loading}
              className="flex-1 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Aprobar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}