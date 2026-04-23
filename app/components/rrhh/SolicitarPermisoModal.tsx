// components/rrhh/SolicitarPermisoModal.tsx
'use client';
import { useState } from 'react';
import { X, Calendar, FileText, Loader2, Send } from 'lucide-react';

interface SolicitarPermisoModalProps {
  empleadoId: string;
  empleadoNombre: string;
  diasVacacionDisponibles?: number;
  onSave: (data: any) => Promise<any>;
  onClose: () => void;
}

export default function SolicitarPermisoModal({
  empleadoId,
  empleadoNombre,
  diasVacacionDisponibles,
  onSave,
  onClose,
}: SolicitarPermisoModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tipo: 'permiso_administrativo',
    fecha_inicio: '',
    fecha_fin: '',
    motivo: '',
  });

  const tiposPermiso = [
    { value: 'vacaciones', label: 'Vacaciones', icon: '🏖️' },
    { value: 'licencia_medica', label: 'Licencia Médica', icon: '🏥' },
    { value: 'permiso_administrativo', label: 'Permiso Administrativo', icon: '📋' },
    { value: 'estudio', label: 'Permiso de Estudio', icon: '📚' },
    { value: 'personal', label: 'Permiso Personal', icon: '🏠' },
    { value: 'matrimonio', label: 'Matrimonio', icon: '💒' },
    { value: 'luto', label: 'Luto', icon: '⚫' },
    { value: 'otro', label: 'Otro', icon: '📝' },
  ];

  const calcularDias = () => {
    if (form.fecha_inicio && form.fecha_fin) {
      const inicio = new Date(form.fecha_inicio);
      const fin = new Date(form.fecha_fin);
      const dias = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return dias;
    }
    return 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await onSave({
      empleado_id: empleadoId,
      ...form,
    });

    setLoading(false);
    if (result.success) {
      onClose();
    }
  };

  const diasSolicitados = calcularDias();
  const esVacaciones = form.tipo === 'vacaciones';
  const excedeDias = esVacaciones && diasVacacionDisponibles !== undefined && diasSolicitados > diasVacacionDisponibles;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Solicitar Permiso</h2>
            <p className="text-xs text-slate-500">{empleadoNombre}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Tipo de permiso */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-2">
              Tipo de Permiso *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {tiposPermiso.map((tipo) => (
                <button
                  key={tipo.value}
                  type="button"
                  onClick={() => setForm({ ...form, tipo: tipo.value })}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    form.tipo === tipo.value
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{tipo.icon}</span>
                  {tipo.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                <Calendar size={12} className="inline mr-1" />
                Fecha Inicio *
              </label>
              <input
                type="date"
                value={form.fecha_inicio}
                onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                <Calendar size={12} className="inline mr-1" />
                Fecha Fin *
              </label>
              <input
                type="date"
                value={form.fecha_fin}
                onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
                className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200"
                required
              />
            </div>
          </div>

          {/* Resumen de días */}
          {diasSolicitados > 0 && (
            <div className={`rounded-xl p-3 text-center ${
              excedeDias ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'
            }`}>
              <p className="text-sm font-medium">
                Días solicitados: <strong>{diasSolicitados}</strong>
              </p>
              {esVacaciones && diasVacacionDisponibles !== undefined && (
                <p className="text-xs mt-1">
                  Días disponibles: {diasVacacionDisponibles}
                </p>
              )}
              {excedeDias && (
                <p className="text-xs text-red-500 mt-1">
                  ⚠️ Superas los días disponibles
                </p>
              )}
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
              <FileText size={12} className="inline mr-1" />
              Motivo / Descripción
            </label>
            <textarea
              value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200 resize-none"
              rows={4}
              placeholder="Detalla el motivo de la solicitud..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || excedeDias}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <Send size={16} />
              Enviar Solicitud
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}