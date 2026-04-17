'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Loader2, Calendar, Clock, Briefcase, User, AlertCircle } from 'lucide-react';

interface FormularioTareaProps {
  usuarios: any[];
  perfilUsuario: any;
  onClose: () => void;
  onSuccess: () => void;
  tareaEdit?: any;
}

export default function FormularioTarea({ usuarios, perfilUsuario, onClose, onSuccess, tareaEdit }: FormularioTareaProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    titulo: tareaEdit?.titulo || '',
    descripcion: tareaEdit?.descripcion || '',
    prioridad: tareaEdit?.prioridad || 'media',
    asignado_a: tareaEdit?.asignado_a || '',
    proyecto: tareaEdit?.proyecto || '',
    fecha_inicio: tareaEdit?.fecha_inicio || '',
    fecha_limite: tareaEdit?.fecha_limite || '',
    horas_estimadas: tareaEdit?.horas_estimadas || 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.titulo.trim()) {
      setError("El título es requerido");
      return;
    }
    
    if (!form.asignado_a) {
      setError("Debes asignar un responsable");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (tareaEdit) {
        const { error } = await supabase
          .from('tareas')
          .update({
            titulo: form.titulo,
            descripcion: form.descripcion,
            prioridad: form.prioridad,
            asignado_a: form.asignado_a,
            proyecto: form.proyecto,
            fecha_inicio: form.fecha_inicio || null,
            fecha_limite: form.fecha_limite || null,
            horas_estimadas: form.horas_estimadas
          })
          .eq('id', tareaEdit.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tareas')
          .insert([{
            titulo: form.titulo,
            descripcion: form.descripcion,
            prioridad: form.prioridad,
            estado: 'pendiente',
            asignado_a: form.asignado_a,
            creado_por: perfilUsuario.id,
            proyecto: form.proyecto,
            fecha_inicio: form.fecha_inicio || null,
            fecha_limite: form.fecha_limite || null,
            horas_estimadas: form.horas_estimadas
          }]);
        
        if (error) throw error;
      }
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error al guardar la tarea");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase italic">
              {tareaEdit ? '✏️ Editar Tarea' : '➕ Nueva Tarea'}
            </h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {tareaEdit ? 'Modifica los campos necesarios' : 'Completa el formulario para asignar'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-2xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-500" />
              <p className="text-[10px] font-bold text-rose-600">{error}</p>
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">
              Título de la tarea *
            </label>
            <input
              type="text"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
              placeholder="Ej: Revisar documentación del proyecto"
              value={form.titulo}
              onChange={(e) => setForm({...form, titulo: e.target.value})}
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">
              Descripción
            </label>
            <textarea
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all resize-none"
              placeholder="Detalla las actividades a realizar..."
              rows={3}
              value={form.descripcion}
              onChange={(e) => setForm({...form, descripcion: e.target.value})}
            />
          </div>

          {/* Grid 2 columnas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Prioridad */}
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">
                Prioridad
              </label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
                value={form.prioridad}
                onChange={(e) => setForm({...form, prioridad: e.target.value})}
              >
                <option value="baja">🟢 Baja</option>
                <option value="media">🟡 Media</option>
                <option value="alta">🔴 Alta</option>
              </select>
            </div>

            {/* Responsable */}
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">
                Responsable *
              </label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
                  value={form.asignado_a}
                  onChange={(e) => setForm({...form, asignado_a: e.target.value})}
                  required
                >
                  <option value="">Seleccionar responsable...</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} {u.apellido}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Proyecto */}
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">
                Proyecto
              </label>
              <div className="relative">
                <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
                  placeholder="Nombre del proyecto"
                  value={form.proyecto}
                  onChange={(e) => setForm({...form, proyecto: e.target.value})}
                />
              </div>
            </div>

            {/* Horas estimadas */}
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">
                Horas estimadas
              </label>
              <input
                type="number"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
                placeholder="Ej: 8"
                min="0"
                step="0.5"
                value={form.horas_estimadas}
                onChange={(e) => setForm({...form, horas_estimadas: parseFloat(e.target.value) || 0})}
              />
            </div>

            {/* Fecha inicio */}
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">
                Fecha inicio
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
                  value={form.fecha_inicio}
                  onChange={(e) => setForm({...form, fecha_inicio: e.target.value})}
                />
              </div>
            </div>

            {/* Fecha límite */}
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">
                Fecha límite
              </label>
              <div className="relative">
                <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
                  value={form.fecha_limite}
                  onChange={(e) => setForm({...form, fecha_limite: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-xs font-black uppercase text-slate-400 hover:bg-slate-100 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {tareaEdit ? 'Actualizar Tarea' : 'Crear Tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}