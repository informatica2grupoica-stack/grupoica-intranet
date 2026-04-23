// components/rrhh/RegistroAsistencia.tsx
'use client';
import { useState, useEffect } from 'react';
import { X, Clock, Calendar, Save, Loader2 } from 'lucide-react';

interface RegistroAsistenciaProps {
  empleadoId: string;
  empleadoNombre: string;
  fecha: string;
  asistenciaExistente?: any;
  onSave: (data: any) => Promise<any>;
  onClose: () => void;
}

export default function RegistroAsistencia({
  empleadoId,
  empleadoNombre,
  fecha,
  asistenciaExistente,
  onSave,
  onClose,
}: RegistroAsistenciaProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    hora_entrada: '',
    hora_salida: '',
    hora_entrada_tarde: '',
    hora_salida_tarde: '',
    estado: 'presente',
    justificacion: '',
  });

  useEffect(() => {
    if (asistenciaExistente) {
      setForm({
        hora_entrada: asistenciaExistente.hora_entrada || '',
        hora_salida: asistenciaExistente.hora_salida || '',
        hora_entrada_tarde: asistenciaExistente.hora_entrada_tarde || '',
        hora_salida_tarde: asistenciaExistente.hora_salida_tarde || '',
        estado: asistenciaExistente.estado || 'presente',
        justificacion: asistenciaExistente.justificacion || '',
      });
    }
  }, [asistenciaExistente]);

  const calcularHoras = () => {
    let horas = 0;
    if (form.hora_entrada && form.hora_salida) {
      const entrada = new Date(`2000-01-01T${form.hora_entrada}`);
      const salida = new Date(`2000-01-01T${form.hora_salida}`);
      horas = (salida.getTime() - entrada.getTime()) / (1000 * 60 * 60);
    }
    return horas;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const horasTrabajadas = calcularHoras();
    const horasExtras = horasTrabajadas > 8 ? horasTrabajadas - 8 : 0;

    const result = await onSave({
      empleado_id: empleadoId,
      fecha,
      ...form,
      horas_trabajadas: horasTrabajadas,
      horas_extras: horasExtras,
      horas_extras_25: Math.min(horasExtras, 2),
      horas_extras_50: Math.max(horasExtras - 2, 0),
    });

    setLoading(false);
    if (result.success) {
      onClose();
    }
  };

  const estados = [
    { value: 'presente', label: 'Presente', color: 'text-emerald-600 bg-emerald-50' },
    { value: 'ausente', label: 'Ausente', color: 'text-red-600 bg-red-50' },
    { value: 'tarde', label: 'Tarde', color: 'text-amber-600 bg-amber-50' },
    { value: 'justificado', label: 'Justificado', color: 'text-blue-600 bg-blue-50' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Registro de Asistencia</h2>
            <p className="text-xs text-slate-500">{empleadoNombre}</p>
            <p className="text-[10px] text-slate-400">{new Date(fecha).toLocaleDateString('es-CL')}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Estado */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-2">Estado</label>
            <div className="grid grid-cols-2 gap-2">
              {estados.map((est) => (
                <button
                  key={est.value}
                  type="button"
                  onClick={() => setForm({ ...form, estado: est.value })}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    form.estado === est.value
                      ? est.color + ' ring-2 ring-offset-2 ring-blue-500'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {est.label}
                </button>
              ))}
            </div>
          </div>

          {/* Horarios (solo si no es ausente) */}
          {form.estado !== 'ausente' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                    <Clock size={12} className="inline mr-1" />
                    Hora Entrada
                  </label>
                  <input
                    type="time"
                    value={form.hora_entrada}
                    onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })}
                    className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                    <Clock size={12} className="inline mr-1" />
                    Hora Salida
                  </label>
                  <input
                    type="time"
                    value={form.hora_salida}
                    onChange={(e) => setForm({ ...form, hora_salida: e.target.value })}
                    className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200"
                  />
                </div>
              </div>

              {form.hora_entrada && form.hora_salida && (
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-600">
                    Horas trabajadas: <strong>{calcularHoras()} hrs</strong>
                  </p>
                </div>
              )}
            </>
          )}

          {/* Justificación */}
          {(form.estado === 'ausente' || form.estado === 'justificado' || form.estado === 'tarde') && (
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                Justificación
              </label>
              <textarea
                value={form.justificacion}
                onChange={(e) => setForm({ ...form, justificacion: e.target.value })}
                className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200 resize-none"
                rows={3}
                placeholder="Motivo de la ausencia/atraso..."
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-5 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <Save size={16} />
              Guardar Asistencia
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}