'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  CheckCircle2, PlayCircle, Trash2, X, 
  MessageSquare, Edit3, Calendar, Clock, Briefcase, User, AlertCircle, Loader2
} from 'lucide-react';

interface VistaTablaProps {
  tareas: any[];
  usuarios: any[];
  perfilUsuario: any;
  onTaskClick: (tareaId: string) => void;
  onTaskUpdate: () => void;
}

export default function VistaTabla({ tareas, usuarios, perfilUsuario, onTaskClick, onTaskUpdate }: VistaTablaProps) {
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null);
  const [editandoTarea, setEditandoTarea] = useState<string | null>(null);
  const [formEdit, setFormEdit] = useState<any>({});
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [notificacion, setNotificacion] = useState<{msg: string, tipo: 'success' | 'error'} | null>(null);

  // ✅ Permisos
  const esAdmin = perfilUsuario?.rol === 'admin' || perfilUsuario?.rol === 'superuser';
  const puedeEditarCualquierTarea = esAdmin || perfilUsuario?.permisos?.can_edit_all_tasks === true;
  const puedeEliminarCualquierTarea = esAdmin || perfilUsuario?.permisos?.can_delete_all_tasks === true;

  const formatFecha = (fechaStr: string) => {
    if (!fechaStr) return '--/--';
    const date = new Date(fechaStr);
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getEstadoConfig = (tarea: any) => {
    const hoy = new Date();
    const limite = tarea.fecha_limite ? new Date(tarea.fecha_limite) : null;
    if (tarea.estado === 'completada') return { label: 'Completado', css: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (limite && limite < hoy && tarea.estado !== 'completada') return { label: 'Atrasado', css: 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse' };
    if (tarea.estado === 'en_proceso') return { label: 'En Proceso', css: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'Pendiente', css: 'bg-slate-100 text-slate-600 border-slate-200' };
  };

  const getPrioridadConfig = (prioridad: string) => {
    switch (prioridad) {
      case 'alta': return { label: 'Alta', css: 'bg-red-100 text-red-600 border-red-200' };
      case 'media': return { label: 'Media', css: 'bg-amber-100 text-amber-600 border-amber-200' };
      default: return { label: 'Baja', css: 'bg-emerald-100 text-emerald-600 border-emerald-200' };
    }
  };

  const puedeActualizarEstado = (tarea: any) => {
    // El admin puede siempre
    if (esAdmin) return true;
    // El asignado puede cambiar estado
    if (String(perfilUsuario?.id) === String(tarea.asignado_a)) return true;
    return false;
  };

  const puedeEditarTarea = (tarea: any) => {
    if (puedeEditarCualquierTarea) return true;
    if (esAdmin) return true;
    if (String(perfilUsuario?.id) === String(tarea.asignado_a)) return true;
    if (String(perfilUsuario?.id) === String(tarea.creado_por)) return true;
    return false;
  };

  const puedeEliminarTarea = (tarea: any) => {
    if (puedeEliminarCualquierTarea) return true;
    if (esAdmin) return true;
    if (String(perfilUsuario?.id) === String(tarea.creado_por)) return true;
    return false;
  };

  const actualizarEstado = async (id: string, nuevoEstado: string) => {
    const tarea = tareas.find(t => t.id === id);
    if (!puedeActualizarEstado(tarea)) {
      setNotificacion({ msg: "No tienes permisos para cambiar el estado de esta tarea", tipo: 'error' });
      setTimeout(() => setNotificacion(null), 3000);
      return;
    }

    try {
      const { error } = await supabase.from('tareas').update({ estado: nuevoEstado }).eq('id', id);
      if (error) throw error;
      setNotificacion({ msg: `Estado actualizado a ${nuevoEstado}`, tipo: 'success' });
      onTaskUpdate();
      setTimeout(() => setNotificacion(null), 3000);
    } catch (err: any) {
      setNotificacion({ msg: "Error al actualizar", tipo: 'error' });
      setTimeout(() => setNotificacion(null), 3000);
    }
  };

  const eliminarTarea = async (id: string) => {
    const tarea = tareas.find(t => t.id === id);
    if (!puedeEliminarTarea(tarea)) {
      setNotificacion({ msg: "No tienes permisos para eliminar esta tarea", tipo: 'error' });
      setTimeout(() => setNotificacion(null), 3000);
      return;
    }

    const { error } = await supabase.from('tareas').delete().eq('id', id);
    if (error) {
      setNotificacion({ msg: "Error al eliminar", tipo: 'error' });
    } else {
      setNotificacion({ msg: "Tarea eliminada", tipo: 'success' });
    }
    setConfirmarEliminar(null);
    onTaskUpdate();
    setTimeout(() => setNotificacion(null), 3000);
  };

  const iniciarEdicion = (tarea: any) => {
    if (!puedeEditarTarea(tarea)) {
      setNotificacion({ msg: "No tienes permisos para editar esta tarea", tipo: 'error' });
      setTimeout(() => setNotificacion(null), 3000);
      return;
    }
    setEditandoTarea(tarea.id);
    setFormEdit({
      titulo: tarea.titulo,
      descripcion: tarea.descripcion || "",
      prioridad: tarea.prioridad || "media",
      asignado_a: tarea.asignado_a,
      proyecto: tarea.proyecto || "",
      fecha_inicio: tarea.fecha_inicio || "",
      fecha_limite: tarea.fecha_limite || "",
      horas_estimadas: tarea.horas_estimadas || 0
    });
  };

  const guardarEdicion = async () => {
    setLoadingEdit(true);
    try {
      const { error } = await supabase
        .from('tareas')
        .update({
          titulo: formEdit.titulo,
          descripcion: formEdit.descripcion,
          prioridad: formEdit.prioridad,
          asignado_a: formEdit.asignado_a,
          proyecto: formEdit.proyecto,
          fecha_inicio: formEdit.fecha_inicio || null,
          fecha_limite: formEdit.fecha_limite || null,
          horas_estimadas: formEdit.horas_estimadas
        })
        .eq('id', editandoTarea);

      if (error) throw error;
      
      setNotificacion({ msg: "Tarea actualizada", tipo: 'success' });
      setEditandoTarea(null);
      onTaskUpdate();
      setTimeout(() => setNotificacion(null), 3000);
    } catch (error) {
      setNotificacion({ msg: "Error al actualizar", tipo: 'error' });
      setTimeout(() => setNotificacion(null), 3000);
    } finally {
      setLoadingEdit(false);
    }
  };

  if (notificacion) {
    return (
      <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl backdrop-blur-md border animate-in slide-in-from-top-full ${
        notificacion.tipo === 'success' ? 'bg-emerald-600/90 border-emerald-400 text-white' : 'bg-rose-600/90 border-rose-400 text-white'
      }`}>
        {notificacion.tipo === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
        <span className="text-xs font-bold uppercase tracking-wider">{notificacion.msg}</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarea & Proyecto</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Prioridad</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cronograma</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {tareas.map((t) => {
              const status = getEstadoConfig(t);
              const prioridad = getPrioridadConfig(t.prioridad);
              const puedeEditar = puedeEditarTarea(t);
              const puedeEliminar = puedeEliminarTarea(t);
              const puedeCambiarEstado = puedeActualizarEstado(t);

              if (editandoTarea === t.id) {
                return (
                  <tr key={t.id} className="bg-blue-50/30">
                    <td className="px-6 py-4" colSpan={6}>
                      <div className="space-y-3">
                        <input
                          className="w-full p-2 border rounded-lg text-sm font-bold"
                          value={formEdit.titulo}
                          onChange={(e) => setFormEdit({...formEdit, titulo: e.target.value})}
                          placeholder="Título"
                        />
                        <textarea
                          className="w-full p-2 border rounded-lg text-sm"
                          value={formEdit.descripcion}
                          onChange={(e) => setFormEdit({...formEdit, descripcion: e.target.value})}
                          placeholder="Descripción"
                          rows={2}
                        />
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          <select
                            className="p-2 border rounded-lg text-xs"
                            value={formEdit.prioridad}
                            onChange={(e) => setFormEdit({...formEdit, prioridad: e.target.value})}
                          >
                            <option value="baja">Baja</option>
                            <option value="media">Media</option>
                            <option value="alta">Alta</option>
                          </select>
                          <select
                            className="p-2 border rounded-lg text-xs"
                            value={formEdit.asignado_a}
                            onChange={(e) => setFormEdit({...formEdit, asignado_a: e.target.value})}
                          >
                            <option value="">Seleccionar...</option>
                            {usuarios.map(u => (
                              <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                            ))}
                          </select>
                          <input
                            type="date"
                            className="p-2 border rounded-lg text-xs"
                            value={formEdit.fecha_inicio}
                            onChange={(e) => setFormEdit({...formEdit, fecha_inicio: e.target.value})}
                          />
                          <input
                            type="date"
                            className="p-2 border rounded-lg text-xs"
                            value={formEdit.fecha_limite}
                            onChange={(e) => setFormEdit({...formEdit, fecha_limite: e.target.value})}
                          />
                          <input
                            type="number"
                            className="p-2 border rounded-lg text-xs"
                            placeholder="Horas estimadas"
                            value={formEdit.horas_estimadas}
                            onChange={(e) => setFormEdit({...formEdit, horas_estimadas: parseInt(e.target.value) || 0})}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditandoTarea(null)}
                            className="px-4 py-2 bg-slate-200 rounded-lg text-xs font-bold"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={guardarEdicion}
                            disabled={loadingEdit}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-2"
                          >
                            {loadingEdit && <Loader2 size={12} className="animate-spin" />}
                            Guardar
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={t.id} className="group hover:bg-blue-50/30 transition-colors relative">
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onTaskClick(t.id)}>
                    <div className="font-bold text-slate-900 text-sm leading-tight group-hover:text-blue-700 transition-colors">
                      {t.titulo}
                    </div>
                    {t.proyecto && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[9px] font-black text-blue-500 uppercase bg-blue-50 px-2 py-0.5 rounded-md italic">
                        <Briefcase size={8}/> {t.proyecto}
                      </div>
                    )}
                    {t.descripcion && (
                      <p className="text-[9px] text-slate-400 mt-1 line-clamp-1">{t.descripcion}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-inner flex-shrink-0">
                        {t.responsable?.nombre?.[0]}{t.responsable?.apellido?.[0]}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-[11px] font-black text-slate-700 uppercase leading-none truncate">
                          {t.responsable?.nombre} {t.responsable?.apellido}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Operativo</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[9px] font-black uppercase border ${prioridad.css}`}>
                      {prioridad.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg w-fit">
                        <Calendar size={10} /> {formatFecha(t.fecha_inicio)}
                      </div>
                      <div className={`flex items-center gap-2 text-[9px] font-bold px-2 py-0.5 rounded-lg w-fit ${
                        status.label === 'Atrasado' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-500'
                      }`}>
                        <Clock size={10} /> {formatFecha(t.fecha_limite)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${status.css}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => onTaskClick(t.id)} 
                        className="p-2 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all relative"
                      >
                        <MessageSquare size={14} />
                        {t.comentarios?.[0]?.count > 0 && (
                          <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                            {t.comentarios[0].count}
                          </span>
                        )}
                      </button>
                      
                      {puedeCambiarEstado && (
                        <>
                          {t.estado === 'pendiente' && (
                            <button 
                              onClick={() => actualizarEstado(t.id, 'en_proceso')} 
                              className="p-2 bg-blue-600 text-white hover:bg-slate-900 rounded-xl shadow-md transition-all" 
                              title="Iniciar"
                            >
                              <PlayCircle size={14} />
                            </button>
                          )}
                          {t.estado === 'en_proceso' && (
                            <button 
                              onClick={() => actualizarEstado(t.id, 'completada')} 
                              className="p-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl shadow-md transition-all" 
                              title="Finalizar"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                        </>
                      )}
                      
                      {puedeEditar && (
                        <button 
                          onClick={() => iniciarEdicion(t)} 
                          className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all" 
                          title="Editar"
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                      
                      {puedeEliminar && (
                        <button 
                          onClick={() => setConfirmarEliminar(t.id)} 
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all" 
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {confirmarEliminar === t.id && (
                      <div className="absolute inset-0 z-20 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center gap-4 animate-in zoom-in-95 duration-200">
                        <span className="text-white text-[10px] font-black uppercase tracking-widest">¿Eliminar?</span>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmarEliminar(null)} className="px-3 py-1.5 text-white text-[9px] font-black border border-white/20 rounded-lg">
                            No
                          </button>
                          <button onClick={() => eliminarTarea(t.id)} className="px-3 py-1.5 bg-rose-500 text-white text-[9px] font-black rounded-lg">
                            Sí, Borrar
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {tareas.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">No hay tareas registradas</p>
          <p className="text-[10px] text-slate-300 mt-1">Crea tu primera tarea usando el botón "Nueva Tarea"</p>
        </div>
      )}
    </div>
  );
}