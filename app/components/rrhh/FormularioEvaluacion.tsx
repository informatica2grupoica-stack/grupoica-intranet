// components/rrhh/FormularioEvaluacion.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, X, Star } from 'lucide-react';

interface FormularioEvaluacionProps {
  evaluacion?: any;
  empleados?: any[];
  perfilUsuario?: any;
  onSubmit: (data: any) => Promise<any>;
  loading: boolean;
}

export default function FormularioEvaluacion({ evaluacion, empleados, perfilUsuario, onSubmit, loading }: FormularioEvaluacionProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    empleado_id: evaluacion?.empleado_id || '',
    evaluador_id: evaluacion?.evaluador_id || perfilUsuario?.id || '',
    fecha_evaluacion: evaluacion?.fecha_evaluacion?.split('T')[0] || new Date().toISOString().split('T')[0],
    periodo: evaluacion?.periodo || 'semestral',
    puntaje_calidad_trabajo: evaluacion?.puntaje_calidad_trabajo || 3,
    puntaje_productividad: evaluacion?.puntaje_productividad || 3,
    puntaje_trabajo_equipo: evaluacion?.puntaje_trabajo_equipo || 3,
    puntaje_comunicacion: evaluacion?.puntaje_comunicacion || 3,
    puntaje_iniciativa: evaluacion?.puntaje_iniciativa || 3,
    puntaje_cumplimiento: evaluacion?.puntaje_cumplimiento || 3,
    fortalezas: evaluacion?.fortalezas || '',
    areas_mejora: evaluacion?.areas_mejora || '',
    plan_accion: evaluacion?.plan_accion || '',
    proxima_evaluacion: evaluacion?.proxima_evaluacion?.split('T')[0] || '',
  });

  const periodos = [
    { value: 'Q1', label: 'Primer Trimestre (Ene-Mar)' },
    { value: 'Q2', label: 'Segundo Trimestre (Abr-Jun)' },
    { value: 'Q3', label: 'Tercer Trimestre (Jul-Sep)' },
    { value: 'Q4', label: 'Cuarto Trimestre (Oct-Dic)' },
    { value: 'semestral', label: 'Semestral' },
    { value: 'anual', label: 'Anual' },
  ];

  const competencias = [
    { key: 'puntaje_calidad_trabajo', label: 'Calidad del Trabajo', description: 'Precisión, atención al detalle, cumplimiento de estándares' },
    { key: 'puntaje_productividad', label: 'Productividad', description: 'Cantidad de trabajo, eficiencia, cumplimiento de plazos' },
    { key: 'puntaje_trabajo_equipo', label: 'Trabajo en Equipo', description: 'Colaboración, apoyo a compañeros, resolución de conflictos' },
    { key: 'puntaje_comunicacion', label: 'Comunicación', description: 'Claridad, escucha activa, comunicación efectiva' },
    { key: 'puntaje_iniciativa', label: 'Iniciativa', description: 'Proactividad, propuesta de mejoras, autonomía' },
    { key: 'puntaje_cumplimiento', label: 'Cumplimiento', description: 'Cumplimiento de normas, puntualidad, responsabilidad' },
  ];

  const calcularPromedio = () => {
    const valores = competencias.map(c => Number(form[c.key as keyof typeof form]) || 0);
    const suma = valores.reduce((a, b) => a + b, 0);
    return (suma / valores.length).toFixed(1);
  };

  const getCalificacionTexto = () => {
    const promedio = parseFloat(calcularPromedio());
    if (promedio >= 4.5) return 'Excelente';
    if (promedio >= 3.5) return 'Bueno';
    if (promedio >= 2.5) return 'Regular';
    return 'Necesita Mejorar';
  };

  const getCalificacionColor = () => {
    const promedio = parseFloat(calcularPromedio());
    if (promedio >= 4.5) return 'text-emerald-600';
    if (promedio >= 3.5) return 'text-blue-600';
    if (promedio >= 2.5) return 'text-amber-600';
    return 'text-red-600';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.empleado_id) {
      setError('Debes seleccionar un empleado');
      return;
    }

    const result = await onSubmit(form);
    if (result.success) {
      router.push('/rrhh/evaluaciones');
    } else {
      setError(result.error);
    }
  };

  const renderStars = (value: number, onChange: (val: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`p-1 transition-all ${star <= value ? 'text-amber-400' : 'text-slate-200'}`}
          >
            <Star size={20} fill={star <= value ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-black text-slate-800">
          {evaluacion ? '✏️ Editar Evaluación' : '⭐ Nueva Evaluación de Desempeño'}
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
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Empleado Evaluado *</label>
          <select
            value={form.empleado_id}
            onChange={(e) => setForm({ ...form, empleado_id: e.target.value })}
            className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200"
            required
          >
            <option value="">Seleccionar empleado...</option>
            {empleados?.filter(e => e.activo).map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.nombre_completo} - {emp.cargo || 'Sin cargo'}</option>
            ))}
          </select>
        </div>

        {/* Fecha Evaluación */}
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Fecha Evaluación *</label>
          <input
            type="date"
            value={form.fecha_evaluacion}
            onChange={(e) => setForm({ ...form, fecha_evaluacion: e.target.value })}
            className="w-full bg-slate-50 rounded-xl p-3 text-sm"
            required
          />
        </div>

        {/* Período */}
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Período *</label>
          <select
            value={form.periodo}
            onChange={(e) => setForm({ ...form, periodo: e.target.value })}
            className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200"
          >
            {periodos.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Próxima Evaluación */}
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Próxima Evaluación</label>
          <input
            type="date"
            value={form.proxima_evaluacion}
            onChange={(e) => setForm({ ...form, proxima_evaluacion: e.target.value })}
            className="w-full bg-slate-50 rounded-xl p-3 text-sm"
          />
        </div>
      </div>

      {/* Competencias */}
      <div className="mt-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
          <span>📊 Competencias Evaluadas</span>
          <span className={`text-sm font-bold ${getCalificacionColor()}`}>
            Promedio: {calcularPromedio()} - {getCalificacionTexto()}
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {competencias.map((comp) => (
            <div key={comp.key} className="bg-slate-50 rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-slate-800 text-sm">{comp.label}</p>
                  <p className="text-[10px] text-slate-400">{comp.description}</p>
                </div>
                <span className="text-xs font-bold text-blue-600">{form[comp.key as keyof typeof form] || 0}/5</span>
              </div>
              {renderStars(form[comp.key as keyof typeof form] as number || 0, (val) => setForm({ ...form, [comp.key]: val }))}
            </div>
          ))}
        </div>
      </div>

      {/* Fortalezas y Áreas de Mejora */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
            💪 Fortalezas
          </label>
          <textarea
            value={form.fortalezas}
            onChange={(e) => setForm({ ...form, fortalezas: e.target.value })}
            className="w-full bg-slate-50 rounded-xl p-3 text-sm resize-none"
            rows={4}
            placeholder="¿Qué habilidades destacan? ¿En qué aspectos sobresale?"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
            📈 Áreas de Mejora
          </label>
          <textarea
            value={form.areas_mejora}
            onChange={(e) => setForm({ ...form, areas_mejora: e.target.value })}
            className="w-full bg-slate-50 rounded-xl p-3 text-sm resize-none"
            rows={4}
            placeholder="¿Qué aspectos puede mejorar? ¿Qué habilidades necesita desarrollar?"
          />
        </div>
      </div>

      {/* Plan de Acción */}
      <div className="mt-5">
        <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
          📋 Plan de Acción
        </label>
        <textarea
          value={form.plan_accion}
          onChange={(e) => setForm({ ...form, plan_accion: e.target.value })}
          className="w-full bg-slate-50 rounded-xl p-3 text-sm resize-none"
          rows={3}
          placeholder="Propuestas concretas para el desarrollo profesional..."
        />
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
        <button type="button" onClick={() => router.back()} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 flex items-center gap-2">
          {loading && <Loader2 size={16} className="animate-spin" />}
          <Save size={16} />
          {evaluacion ? 'Actualizar Evaluación' : 'Guardar Evaluación'}
        </button>
      </div>
    </form>
  );
}