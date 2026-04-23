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

  const puedeCrear = perfilUsuario?.rol === 'admin' || 
                     perfilUsuario?.rol === 'superuser' || 
                     perfilUsuario?.permisos?.can_create_tasks === true;

  const [form, setForm] = useState({
    titulo: tareaEdit?.titulo || '',
    descripcion: tareaEdit?.descripcion || '',
    prioridad: tareaEdit?.prioridad || 'media',
    asignado_a: tareaEdit?.asignado_a || '',
    proyecto: tareaEdit?.proyecto || '',
    fecha_inicio: tareaEdit?.fecha_inicio || '',
    fecha_limite: tareaEdit?.fecha_limite || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!puedeCrear && !tareaEdit) {
      setError("No tienes permisos para crear tareas");
      return;
    }
    
    if (!perfilUsuario?.id) {
      setError("No se pudo identificar al usuario. Recarga la página.");
      return;
    }
    
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
      // SOLO columnas que existen en la tabla tareas
      const tareaData: any = {
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        prioridad: form.prioridad,
        estado: 'pendiente',
        asignado_a: form.asignado_a,
        creado_por: perfilUsuario.id,
        proyecto: form.proyecto || null,
      };
      
      if (form.fecha_inicio) tareaData.fecha_inicio = form.fecha_inicio;
      if (form.fecha_limite) tareaData.fecha_limite = form.fecha_limite;
      
      console.log("Enviando tarea:", tareaData);
      
      const { error } = await supabase
        .from('tareas')
        .insert([tareaData]);
      
      if (error) {
        console.error("Error Supabase:", error);
        throw error;
      }
      
      onSuccess();
    } catch (err: any) {
      console.error("Error:", err);
      setError(err.message || "Error al guardar la tarea");
    } finally {
      setLoading(false);
    }
  };

  if (!puedeCrear && !tareaEdit) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Sin Permisos</h3>
          <p className="text-sm text-slate-500 mt-2">No tienes permisos para crear tareas</p>
          <button onClick={onClose} className="mt-6 px-6 py-2 bg-slate-200 rounded-xl text-sm font-bold">Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
        
        <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase italic">
              {tareaEdit ? '✏️ Editar Tarea' : '➕ Nueva Tarea'}
            </h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {tareaEdit ? 'Modifica los campos necesarios' : 'Completa el formulario'}
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-2xl transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-500" />
              <p className="text-[10px] font-bold text-rose-600">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Título de la tarea *</label>
            <input
              type="text"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500"
              placeholder="Ej: Revisar documentación del proyecto"
              value={form.titulo}
              onChange={(e) => setForm({...form, titulo: e.target.value})}
              required
            />
          </div>

          <div>
            <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Descripción</label>
            <textarea
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 resize-none"
              placeholder="Detalla las actividades a realizar..."
              rows={3}
              value={form.descripcion}
              onChange={(e) => setForm({...form, descripcion: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Prioridad</label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none"
                value={form.prioridad}
                onChange={(e) => setForm({...form, prioridad: e.target.value})}
              >
                <option value="baja">🟢 Baja</option>
                <option value="media">🟡 Media</option>
                <option value="alta">🔴 Alta</option>
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Responsable *</label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold outline-none"
                  value={form.asignado_a}
                  onChange={(e) => setForm({...form, asignado_a: e.target.value})}
                  required
                >
                  <option value="">Seleccionar responsable...</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Proyecto</label>
              <div className="relative">
                <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold outline-none"
                  placeholder="Nombre del proyecto"
                  value={form.proyecto}
                  onChange={(e) => setForm({...form, proyecto: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Fecha inicio</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold outline-none"
                  value={form.fecha_inicio}
                  onChange={(e) => setForm({...form, fecha_inicio: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Fecha límite</label>
              <div className="relative">
                <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold outline-none"
                  value={form.fecha_limite}
                  onChange={(e) => setForm({...form, fecha_limite: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl text-xs font-black uppercase text-slate-400 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase shadow-lg flex items-center gap-2 disabled:opacity-50"
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