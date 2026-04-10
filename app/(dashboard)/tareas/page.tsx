"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, Loader2, CheckCircle2, PlayCircle, Trash2, AlertCircle, X, Check,
  MessageSquare, Send, Briefcase, Calendar, Clock, LayoutList
} from "lucide-react";

export default function TareasPage() {
  const [tareas, setTareas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [perfilUsuario, setPerfilUsuario] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null);
  const [notificacion, setNotificacion] = useState<{msg: string, tipo: 'success' | 'error'} | null>(null);
  
  const [tareaExpandida, setTareaExpandida] = useState<string | null>(null);
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  const [form, setForm] = useState({ 
    titulo: "", descripcion: "", prioridad: "media", asignado_a: "", proyecto: "", 
    fecha_inicio: "", fecha_limite: "" 
  });

  // Formateador de fechas para Chile (DD/MM/YYYY)
  const formatFecha = (fechaStr: string) => {
    if (!fechaStr) return '--/--';
    const date = new Date(fechaStr);
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const puedeCrear = 
    perfilUsuario?.rol === 'admin' || 
    perfilUsuario?.rol === 'superuser' || 
    perfilUsuario?.permisos?.can_create_tasks === true;

  useEffect(() => {
    if (notificacion) {
      const timer = setTimeout(() => setNotificacion(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notificacion]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('cambios-tareas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios_tareas' }, () => {
          if (tareaExpandida) fetchComentarios(tareaExpandida);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tareaExpandida]);

  async function fetchData() {
    const { data: { session } } = await supabase.auth.getSession();
    let perfilActual = null;
    if (session) {
      const { data: p } = await supabase.from('perfiles').select('*').eq('user_id', session.user.id).single();
      setPerfilUsuario(p);
      perfilActual = p;
    }
    if (!perfilActual) return;

    let query = supabase.from('tareas').select(`
        *,
        responsable:perfiles!tareas_asignado_a_fkey(id, nombre, apellido),
        creador:perfiles!tareas_creado_por_fkey(id, nombre, apellido),
        comentarios:comentarios_tareas(count)
      `);

    if (perfilActual.rol === 'user') {
      query = query.or(`asignado_a.eq.${perfilActual.id},creado_por.eq.${perfilActual.id}`);
    }
    const { data: t } = await query.order('created_at', { ascending: false });
    const { data: users } = await supabase.from('perfiles').select('id, nombre, apellido').eq('activo', true);
    if (t) setTareas(t);
    if (users) setUsuarios(users);
  }

  async function fetchComentarios(tareaId: string) {
    const { data } = await supabase
      .from('comentarios_tareas')
      .select('*, autor:perfiles(nombre, apellido)')
      .eq('tarea_id', tareaId)
      .order('created_at', { ascending: true });
    if (data) setComentarios(data);
  }

  async function enviarComentario(tareaId: string) {
    if (!nuevoComentario.trim()) return;
    setEnviandoComentario(true);
    const { error } = await supabase.from('comentarios_tareas').insert([
      { tarea_id: tareaId, perfil_id: perfilUsuario.id, contenido: nuevoComentario }
    ]);
    if (!error) {
      setNuevoComentario("");
      fetchComentarios(tareaId);
    }
    setEnviandoComentario(false);
  }

  async function handleCrearTarea(e: React.FormEvent) {
    e.preventDefault();
    if (!form.asignado_a) {
        setNotificacion({ msg: "Selecciona un responsable", tipo: 'error' });
        return;
    }
    setLoading(true);
    try {
      // Supabase insertará ahora 'proyecto' y 'fecha_inicio' correctamente
      const { error } = await supabase.from('tareas').insert([{ 
        ...form, 
        creado_por: perfilUsuario.id, 
        estado: 'pendiente',
        // Aseguramos que si están vacíos se manden como null para la DB
        fecha_inicio: form.fecha_inicio || null,
        fecha_limite: form.fecha_limite || null,
        proyecto: form.proyecto || null
      }]);
      
      if (error) throw error;
      
      setForm({ titulo: "", descripcion: "", prioridad: "media", asignado_a: "", proyecto: "", fecha_inicio: "", fecha_limite: "" });
      setNotificacion({ msg: "Tarea asignada correctamente", tipo: 'success' });
      fetchData();
    } catch (error: any) { 
        setNotificacion({ msg: "Error: " + error.message, tipo: 'error' });
    } finally { setLoading(false); }
  }

  async function actualizarEstado(id: string, nuevoEstado: string) {
    try {
      const { error } = await supabase.from('tareas').update({ estado: nuevoEstado }).eq('id', id).select();
      if (error) {
        setNotificacion({ msg: "Sin permisos para actualizar", tipo: 'error' });
        return;
      }
      setNotificacion({ msg: `Estado actualizado`, tipo: 'success' });
      await fetchData();
    } catch (err: any) {
      setNotificacion({ msg: "Error inesperado", tipo: 'error' });
    }
  }

  async function eliminarTarea(id: string) {
    const { error } = await supabase.from('tareas').delete().eq('id', id);
    if (error) {
        setNotificacion({ msg: "No puedes eliminar esta tarea", tipo: 'error' });
    } else {
        setNotificacion({ msg: "Tarea eliminada", tipo: 'success' });
    }
    setConfirmarEliminar(null);
    fetchData();
  }

  const getEstadoConfig = (tarea: any) => {
    const hoy = new Date();
    const limite = tarea.fecha_limite ? new Date(tarea.fecha_limite) : null;

    if (tarea.estado === 'completada') return { label: 'Completado', css: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (limite && limite < hoy && tarea.estado !== 'completada') return { label: 'Atrasado', css: 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse' };
    if (tarea.estado === 'en_proceso') return { label: 'En Proceso', css: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'Pendiente', css: 'bg-slate-100 text-slate-600 border-slate-200' };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 space-y-10 animate-in fade-in duration-700">
      
      {/* ALERTA TOAST */}
      {notificacion && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl backdrop-blur-md border animate-in slide-in-from-top-full ${
          notificacion.tipo === 'success' ? 'bg-emerald-600/90 border-emerald-400 text-white' : 'bg-rose-600/90 border-rose-400 text-white'
        }`}>
          {notificacion.tipo === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="text-xs font-bold uppercase tracking-wider">{notificacion.msg}</span>
        </div>
      )}

      {/* HEADER ELEGANTE */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-200">
              <LayoutList size={20} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">
              Operaciones <span className="text-blue-600">Hub</span>
            </h1>
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em]">Gestión de flujo de trabajo técnico</p>
        </div>
      </div>

      {/* FORMULARIO DE TAREAS */}
      {puedeCrear && (
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 group transition-all hover:shadow-xl hover:shadow-blue-900/5">
          <form onSubmit={handleCrearTarea} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <input 
                className="md:col-span-5 bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white border rounded-2xl px-5 py-3 text-sm font-bold transition-all outline-none"
                placeholder="Nombre de la tarea..." required
                value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})}
              />
              <select required className="md:col-span-3 bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white border rounded-2xl px-4 py-3 text-sm font-bold outline-none cursor-pointer" value={form.asignado_a} onChange={e => setForm({...form, asignado_a: e.target.value})}>
                  <option value="">Responsable...</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>)}
              </select>
              <div className="md:col-span-4 flex gap-2">
                <div className="flex-1 relative group/input">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/input:text-blue-500 transition-colors" />
                  <input type="date" title="Fecha Inicio" className="w-full bg-slate-50 border-transparent border rounded-2xl pl-9 pr-3 py-3 text-[10px] font-bold outline-none focus:bg-white focus:border-blue-500 transition-all" 
                         value={form.fecha_inicio} onChange={e => setForm({...form, fecha_inicio: e.target.value})} />
                </div>
                <div className="flex-1 relative group/input">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/input:text-rose-500 transition-colors" />
                  <input type="date" title="Fecha Límite" className="w-full bg-slate-50 border-transparent border rounded-2xl pl-9 pr-3 py-3 text-[10px] font-bold outline-none focus:bg-white focus:border-blue-500 transition-all" 
                         value={form.fecha_limite} onChange={e => setForm({...form, fecha_limite: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
               <textarea 
                className="md:col-span-7 bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white border rounded-2xl px-5 py-3 text-sm font-bold outline-none h-14 resize-none transition-all"
                placeholder="Observaciones adicionales..."
                value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})}
              />
              <div className="md:col-span-3 relative group/input">
                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/input:text-blue-500" />
                <input 
                  className="w-full bg-slate-50 border-transparent focus:border-blue-500 focus:bg-white border rounded-2xl pl-10 pr-5 py-3 text-sm font-bold outline-none transition-all"
                  placeholder="Proyecto..."
                  value={form.proyecto} onChange={e => setForm({...form, proyecto: e.target.value})}
                />
              </div>
              <button type="submit" disabled={loading} className="md:col-span-2 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-900 transition-all shadow-lg shadow-blue-100 hover:shadow-none">
                  {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus size={18}/>} Asignar
              </button>
            </div>
          </form>
        </section>
      )}

      {/* CONTENEDOR DE TABLA */}
      <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarea & Proyecto</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cronograma</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tareas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <LayoutList size={48} />
                      <p className="mt-4 font-black uppercase tracking-tighter text-xl">Sin tareas pendientes</p>
                    </div>
                  </td>
                </tr>
              )}
              {tareas.map((t) => {
                const esAsignado = String(perfilUsuario?.id || "").trim() === String(t.asignado_a || "").trim();
                const esAdmin = perfilUsuario?.rol === 'admin' || perfilUsuario?.rol === 'superuser';
                const status = getEstadoConfig(t);

                return (
                  <tr key={t.id} className="group hover:bg-blue-50/30 transition-colors relative">
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-900 text-sm leading-tight group-hover:text-blue-700 transition-colors">{t.titulo}</div>
                      {t.proyecto && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[9px] font-black text-blue-500 uppercase bg-blue-50 px-2 py-0.5 rounded-md italic">
                          <Briefcase size={8}/> {t.proyecto}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-inner">
                              {t.responsable?.nombre?.[0]}{t.responsable?.apellido?.[0]}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-slate-700 uppercase leading-none">{t.responsable?.nombre}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Operativo</span>
                          </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg w-fit">
                          <Calendar size={10} /> {formatFecha(t.fecha_inicio)}
                        </div>
                        <div className="w-0.5 h-2 bg-slate-200"></div>
                        <div className={`flex items-center gap-2 text-[10px] font-bold px-2 py-1 rounded-lg w-fit ${status.label === 'Atrasado' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-500'}`}>
                          <Clock size={10} /> {formatFecha(t.fecha_limite)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${status.css}`}>
                          {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setTareaExpandida(t.id); fetchComentarios(t.id); }} className="p-2.5 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg rounded-xl transition-all relative">
                              <MessageSquare size={16} />
                              {t.comentarios?.[0]?.count > 0 && <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{t.comentarios[0].count}</span>}
                          </button>
                          
                          {(esAsignado || esAdmin) && (
                              <>
                                  {t.estado === 'pendiente' && (
                                      <button onClick={() => actualizarEstado(t.id, 'en_proceso')} className="p-2.5 bg-blue-600 text-white hover:bg-slate-900 rounded-xl shadow-lg shadow-blue-100 transition-all" title="Iniciar"><PlayCircle size={16} /></button>
                                  )}
                                  {t.estado === 'en_proceso' && (
                                      <button onClick={() => actualizarEstado(t.id, 'completada')} className="p-2.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl shadow-lg shadow-emerald-100 transition-all" title="Finalizar"><CheckCircle2 size={16} /></button>
                                  )}
                              </>
                          )}
                          {esAdmin && (
                              <button onClick={() => setConfirmarEliminar(t.id)} className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                          )}
                      </div>

                      {confirmarEliminar === t.id && (
                          <div className="absolute inset-0 z-20 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center gap-6 animate-in zoom-in-95 duration-200">
                              <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">Confirmar eliminación</span>
                              <div className="flex gap-2">
                                <button onClick={() => setConfirmarEliminar(null)} className="px-4 py-2 text-white text-[10px] font-black border border-white/20 rounded-xl hover:bg-white/10 transition-colors">Cancelar</button>
                                <button onClick={() => eliminarTarea(t.id)} className="px-4 py-2 bg-rose-500 text-white text-[10px] font-black rounded-xl hover:bg-rose-600 transition-colors">Eliminar</button>
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
      </section>

      {/* DRAWER LATERAL DE COMENTARIOS */}
      {tareaExpandida && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] animate-in fade-in duration-300" onClick={() => setTareaExpandida(null)} />
          <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.1)] z-[120] flex flex-col animate-in slide-in-from-right duration-500">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Log de Operaciones</span>
                      <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tight truncate max-w-[300px]">
                        {tareas.find(t => t.id === tareaExpandida)?.titulo}
                      </h3>
                  </div>
                  <button onClick={() => setTareaExpandida(null)} className="w-10 h-10 flex items-center justify-center hover:bg-white border border-transparent hover:border-slate-200 rounded-2xl transition-all"><X size={20}/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                  {comentarios.map(c => (
                      <div key={c.id} className={`flex flex-col ${c.perfil_id === perfilUsuario.id ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[90%] p-5 rounded-3xl shadow-sm border ${
                            c.perfil_id === perfilUsuario.id 
                            ? 'bg-blue-600 text-white border-blue-500 rounded-tr-none' 
                            : 'bg-slate-50 text-slate-800 border-slate-100 rounded-tl-none'
                          }`}>
                              <div className="flex items-center gap-2 mb-2 opacity-70">
                                <span className="text-[8px] font-black uppercase tracking-tighter">{c.autor?.nombre} {c.autor?.apellido}</span>
                                <span className="text-[8px]">•</span>
                                <span className="text-[8px] font-bold">Actividad</span>
                              </div>
                              <p className="text-xs font-bold leading-relaxed">{c.contenido}</p>
                          </div>
                      </div>
                  ))}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                  <div className="relative flex gap-2">
                    <input 
                        value={nuevoComentario} onChange={(e) => setNuevoComentario(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && enviarComentario(tareaExpandida)}
                        placeholder="Escribe una actualización..."
                        className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-blue-500 shadow-sm transition-all"
                    />
                    <button disabled={enviandoComentario} onClick={() => enviarComentario(tareaExpandida)} className="w-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-slate-900 transition-all shadow-lg shadow-blue-100">
                        {enviandoComentario ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
              </div>
          </div>
        </>
      )}
    </div>
  );
}