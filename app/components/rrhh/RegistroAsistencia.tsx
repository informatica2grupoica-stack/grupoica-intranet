// components/rrhh/RegistroAsistencia.tsx
'use client';
import { useState, useEffect } from 'react';
import { X, Clock, Save, Loader2 } from 'lucide-react';

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
    estado: 'presente',
    justificacion: '',
  });

  // Función para obtener jornada esperada según el día
  const getJornadaEsperada = (fechaStr: string): number => {
    const dia = new Date(fechaStr).getDay();
    switch (dia) {
      case 1: case 2: case 3: case 4: // Lunes a Jueves
        return 8.5;
      case 5: // Viernes
        return 7.5;
      default:
        return 0;
    }
  };

  const HORA_COLACION = 1;
  const jornadaEsperada = getJornadaEsperada(fecha);

  useEffect(() => {
    if (asistenciaExistente) {
      setForm({
        hora_entrada: asistenciaExistente.hora_entrada || '',
        hora_salida: asistenciaExistente.hora_salida || '',
        estado: asistenciaExistente.estado || 'presente',
        justificacion: asistenciaExistente.justificacion || '',
      });
    } else {
      setForm({
        hora_entrada: '',
        hora_salida: '',
        estado: 'presente',
        justificacion: '',
      });
    }
  }, [asistenciaExistente, fecha]);

  const calcularHorasTrabajadas = (entrada: string, salida: string): number => {
    if (!entrada || !salida) return 0;
    
    const [entradaH, entradaM] = entrada.split(':').map(Number);
    const [salidaH, salidaM] = salida.split(':').map(Number);
    
    let horas = salidaH - entradaH;
    let minutos = salidaM - entradaM;
    
    if (minutos < 0) {
      horas--;
      minutos += 60;
    }
    
    let totalHoras = horas + (minutos / 60);
    totalHoras = totalHoras - HORA_COLACION;
    
    return Math.round(totalHoras * 10) / 10;
  };

  const horasTrabajadas = calcularHorasTrabajadas(form.hora_entrada, form.hora_salida);
  const horasExtras = jornadaEsperada > 0 && horasTrabajadas > jornadaEsperada 
    ? Math.round((horasTrabajadas - jornadaEsperada) * 10) / 10 
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const datosEnviar: any = {
      empleado_id: empleadoId,
      fecha: fecha,
      estado: form.estado,
    };

    if (form.hora_entrada) datosEnviar.hora_entrada = form.hora_entrada;
    if (form.hora_salida) datosEnviar.hora_salida = form.hora_salida;
    if (form.justificacion) datosEnviar.justificacion = form.justificacion;
    
    if (form.estado === 'presente' && form.hora_entrada && form.hora_salida) {
      datosEnviar.horas_trabajadas = horasTrabajadas;
      datosEnviar.horas_extras = horasExtras;
    }

    const result = await onSave(datosEnviar);
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

  const fechaFormateada = new Date(fecha + 'T12:00:00').toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const obtenerNombreDia = (fechaStr: string) => {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[new Date(fechaStr).getDay()];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Registro de Asistencia</h2>
            <p className="text-xs text-slate-500">{empleadoNombre}</p>
            <p className="text-[10px] text-slate-400">{fechaFormateada} - {obtenerNombreDia(fecha)}</p>
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

          {/* Horarios */}
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

              {/* Resumen de horas */}
              {form.hora_entrada && form.hora_salida && (
                <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Horas en oficina:</span>
                    <span className="font-medium text-slate-700">
                      {(() => {
                        const [eH, eM] = form.hora_entrada.split(':').map(Number);
                        const [sH, sM] = form.hora_salida.split(':').map(Number);
                        let horas = sH - eH;
                        let minutos = sM - eM;
                        if (minutos < 0) { horas--; minutos += 60; }
                        return `${horas}:${minutos.toString().padStart(2, '0')} hrs`;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Hora de colación:</span>
                    <span className="font-medium text-amber-600">- 1 hora</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                    <span className="font-bold text-slate-600">
                      Horas trabajadas ({jornadaEsperada}h esperadas):
                    </span>
                    <span className={`font-bold ${horasTrabajadas > jornadaEsperada ? 'text-amber-600' : 'text-blue-600'}`}>
                      {horasTrabajadas} hrs
                    </span>
                  </div>
                  {horasExtras > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-red-500">Horas extras:</span>
                      <span className="font-bold text-red-500">{horasExtras} hrs</span>
                    </div>
                  )}
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