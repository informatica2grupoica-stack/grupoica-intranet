// app/(dashboard)/rrhh/capacitaciones/nueva/page.tsx - CORREGIDO
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCapacitaciones } from '@/app/hooks/useCapacitaciones';
import { Loader2, Save, X } from 'lucide-react';

export default function NuevaCapacitacionPage() {
  const router = useRouter();
  const { crearCapacitacion, loading } = useCapacitaciones();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    nombre: '',
    proveedor: '',
    fecha_inicio: '',
    fecha_fin: '',
    horas_total: '',  // string del input
    modalidad: 'presencial',
    costo: '',        // string del input
    descripcion: '',
    activo: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.nombre) {
      setError('El nombre de la capacitación es obligatorio');
      return;
    }

    // Convertir tipos al enviar
    const datosParaEnviar = {
      nombre: form.nombre,
      proveedor: form.proveedor || null,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      horas_total: form.horas_total ? parseInt(form.horas_total) : null,
      modalidad: form.modalidad as 'presencial' | 'online' | 'mixto',
      costo: form.costo ? parseInt(form.costo) : null,
      descripcion: form.descripcion || null,
      activo: form.activo,
    };

    const result = await crearCapacitacion(datosParaEnviar);
    if (result.success) {
      router.push('/rrhh/capacitaciones');
    } else {
      setError(result.error);
    }
  };

  const modalidades = [
    { value: 'presencial', label: 'Presencial' },
    { value: 'online', label: 'Online' },
    { value: 'mixto', label: 'Mixto' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase italic">
            Nueva <span className="text-blue-600">Capacitación</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Registrar curso o certificación
          </p>
        </div>
        <button onClick={() => router.back()} className="p-2 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Nombre *</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200"
              placeholder="Ej: Excel Avanzado"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Proveedor</label>
            <input
              value={form.proveedor}
              onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              className="w-full bg-slate-50 rounded-xl p-3 text-sm"
              placeholder="Ej: SENCE, Mutual de Seguridad"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Modalidad</label>
            <select
              value={form.modalidad}
              onChange={(e) => setForm({ ...form, modalidad: e.target.value })}
              className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200"
            >
              {modalidades.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={form.fecha_inicio}
              onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
              className="w-full bg-slate-50 rounded-xl p-3 text-sm"
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

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Horas Totales</label>
            <input
              type="number"
              value={form.horas_total}
              onChange={(e) => setForm({ ...form, horas_total: e.target.value })}
              className="w-full bg-slate-50 rounded-xl p-3 text-sm"
              placeholder="Ej: 40"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Costo</label>
            <input
              type="number"
              value={form.costo}
              onChange={(e) => setForm({ ...form, costo: e.target.value })}
              className="w-full bg-slate-50 rounded-xl p-3 text-sm"
              placeholder="$"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="w-full bg-slate-50 rounded-xl p-3 text-sm resize-none"
              rows={4}
              placeholder="Contenido, objetivos, requisitos..."
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              className="rounded border-slate-300 w-4 h-4"
            />
            <label className="text-[10px] font-bold uppercase text-slate-500">Capacitación Activa</label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <button type="button" onClick={() => router.back()} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 flex items-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            <Save size={16} />
            Guardar Capacitación
          </button>
        </div>
      </form>
    </div>
  );
}