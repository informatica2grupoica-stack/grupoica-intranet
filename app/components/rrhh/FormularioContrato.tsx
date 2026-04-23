// components/rrhh/FormularioContrato.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, X } from 'lucide-react';

interface FormularioContratoProps {
  contrato?: any;
  empleadoId?: string;
  empleados?: any[];
  onSubmit: (data: any) => Promise<any>;
  loading: boolean;
}

export default function FormularioContrato({ contrato, empleadoId, empleados, onSubmit, loading }: FormularioContratoProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    empleado_id: contrato?.empleado_id || empleadoId || '',
    tipo_contrato: contrato?.tipo_contrato || 'indefinido',
    fecha_inicio: contrato?.fecha_inicio?.split('T')[0] || '',
    fecha_fin: contrato?.fecha_fin?.split('T')[0] || '',
    sueldo_base: contrato?.sueldo_base || '',
    cargo: contrato?.cargo || '',
    area: contrato?.area || '',
    jornada: contrato?.jornada || 'completa',
    observaciones: contrato?.observaciones || '',
    vigente: contrato?.vigente ?? true,
  });

  const tiposContrato = [
    { value: 'indefinido', label: 'Indefinido' },
    { value: 'plazo_fijo', label: 'Plazo Fijo' },
    { value: 'honorarios', label: 'Honorarios' },
    { value: 'practica', label: 'Práctica' },
    { value: 'temporal', label: 'Temporal' },
  ];

  const jornadas = [
    { value: 'completa', label: 'Completa (45 hrs)' },
    { value: 'parcial', label: 'Parcial' },
    { value: 'turnos', label: 'Turnos' },
    { value: 'por_horas', label: 'Por Horas' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.empleado_id) {
      setError('Debes seleccionar un empleado');
      return;
    }
    if (!form.fecha_inicio) {
      setError('La fecha de inicio es obligatoria');
      return;
    }

    const result = await onSubmit(form);
    if (result.success) {
      router.push('/rrhh/contratos');
    } else {
      setError(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-black text-slate-800">
          {contrato ? '✏️ Editar Contrato' : '➕ Nuevo Contrato'}
        </h2>
        <button type="button" onClick={() => router.back()} className="p-2 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Empleado */}
        {empleados && (
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Empleado *</label>
            <select
              value={form.empleado_id}
              onChange={(e) => setForm({ ...form, empleado_id: e.target.value })}
              className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200"
              disabled={!!empleadoId}
              required
            >
              <option value="">Seleccionar empleado...</option>
              {empleados.filter(e => e.activo).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.nombre_completo} - {emp.rut}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tipo Contrato */}
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Tipo Contrato *</label>
          <select
            value={form.tipo_contrato}
            onChange={(e) => setForm({ ...form, tipo_contrato: e.target.value })}
            className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200"
          >
            {tiposContrato.map(tipo => (
              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
            ))}
          </select>
        </div>

        {/* Fechas */}
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Fecha Inicio *</label>
          <input
            type="date"
            value={form.fecha_inicio}
            onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
            className="w-full bg-slate-50 rounded-xl p-3 text-sm"
            required
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Fecha Fin</label>
          <input
            type="date"
            value={form.fecha_fin}
            onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
            className="w-full bg-slate-50 rounded-xl p-3 text-sm"
          />
        </div>

        {/* Cargo y Área */}
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Cargo</label>
          <input
            value={form.cargo}
            onChange={(e) => setForm({ ...form, cargo: e.target.value })}
            className="w-full bg-slate-50 rounded-xl p-3 text-sm"
            placeholder="Ej: Ingeniero de Software"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Área</label>
          <input
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
            className="w-full bg-slate-50 rounded-xl p-3 text-sm"
            placeholder="Ej: Tecnología"
          />
        </div>

        {/* Sueldo y Jornada */}
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Sueldo Base</label>
          <input
            type="number"
            value={form.sueldo_base}
            onChange={(e) => setForm({ ...form, sueldo_base: e.target.value })}
            className="w-full bg-slate-50 rounded-xl p-3 text-sm"
            placeholder="$"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Jornada</label>
          <select
            value={form.jornada}
            onChange={(e) => setForm({ ...form, jornada: e.target.value })}
            className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200"
          >
            {jornadas.map(jor => (
              <option key={jor.value} value={jor.value}>{jor.label}</option>
            ))}
          </select>
        </div>

        {/* Vigente */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.vigente}
            onChange={(e) => setForm({ ...form, vigente: e.target.checked })}
            className="rounded border-slate-300 w-4 h-4"
          />
          <label className="text-[10px] font-bold uppercase text-slate-500">Contrato Vigente</label>
        </div>

        {/* Observaciones */}
        <div className="md:col-span-2">
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Observaciones</label>
          <textarea
            value={form.observaciones}
            onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
            className="w-full bg-slate-50 rounded-xl p-3 text-sm resize-none"
            rows={3}
            placeholder="Cláusulas especiales, notas adicionales..."
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
        <button type="button" onClick={() => router.back()} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 flex items-center gap-2">
          {loading && <Loader2 size={16} className="animate-spin" />}
          <Save size={16} />
          {contrato ? 'Actualizar Contrato' : 'Guardar Contrato'}
        </button>
      </div>
    </form>
  );
}