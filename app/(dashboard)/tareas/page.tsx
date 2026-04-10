"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, User as UserIcon, Loader2, 
  CheckCircle2, PlayCircle, Trash2, Clock, AlertCircle, Bookmark, X, Check,
  MessageSquare, Send, Briefcase
} from "lucide-react";

export default function TareasPage() {
  const [tareas, setTareas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [perfilUsuario, setPerfilUsuario] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null);
  const [notificacion, setNotificacion] = useState<{msg: string, tipo: 'success' | 'error'} | null>(null);
  
  // ESTADOS PARA COMENTARIOS
  const [tareaExpandida, setTareaExpandida] = useState<string | null>(null);
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  // FORMULARIO ACTUALIZADO CON CAMPO PROYECTO
  const [form, setForm] = useState({ 
    titulo: "", descripcion: "", prioridad: "media", asignado_a: "", proyecto: "" 
  });

  // LÓGICA DE PERMISOS
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
      const { error } = await supabase.from('tareas').insert([{ 
        ...form, creado_por: perfilUsuario.id, estado: 'pendiente' 
      }]);
      if (error) throw error;
      setForm({ titulo: "", descripcion: "", prioridad: "media", asignado_a: "", proyecto: "" });
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
      setNotificacion({ msg: `Estado: ${nuevoEstado.replace('_', ' ')}`, tipo: 'success' });
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

  const getPrioridadEstilo = (p: string) => {
    switch(p) {
      case 'alta': return 'bg-rose-100 text-rose-700';
      case 'media': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 relative animate-in fade-in duration-700">
      
      {/* ALERTA TOAST */}
      {notificacion && (
        <div className={`fixed top-10 right-1/2 translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-[2rem] shadow-2xl backdrop-blur-xl border animate-in slide-in-from-top-10 ${
          notificacion.tipo === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' : 'bg-rose-500/90 border-rose-400 text-white'
        }`}>
          {notificacion.tipo === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-[10px] font-black uppercase tracking-widest">{notificacion.msg}</span>
          <button onClick={() => setNotificacion(null)} className="ml-4 opacity-50"><X size={14}/></button>
        </div>
      )}

      {/* HEADER */}
      <header className="px-4 md:px-0">
        <h2 className="text-4xl font-black text-[#00338d] tracking-tighter uppercase italic leading-none">
          Muro de <span className="text-blue-500">Operaciones</span>
        </h2>
        <div className="flex items-center gap-2 mt-3">
          <span className="h-1 w-12 bg-blue-600 rounded-full" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Gestión y Proyectos</p>
        </div>
      </header>

      {/* FORMULARIO DE ASIGNACIÓN */}
      {puedeCrear && (
        <section className="mx-4 md:mx-0 bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-slate-100">
          <form onSubmit={handleCrearTarea} className="space-y-6">
            <div className="flex items-center gap-2 text-[#00338d]">
              <Bookmark className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Nueva Asignación de Tarea</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input 
                className="md:col-span-2 bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-4 ring-blue-50 focus:bg-white transition-all"
                placeholder="¿Qué hay que hacer? (Título)" required
                value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})}
              />
              <div className="relative">
                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold outline-none focus:ring-4 ring-blue-50"
                    placeholder="Proyecto (Opcional)"
                    value={form.proyecto} onChange={e => setForm({...form, proyecto: e.target.value})}
                />
              </div>
              <select className="bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none" value={form.prioridad} onChange={e => setForm({...form, prioridad: e.target.value})}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-stretch">
              <textarea 
                className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none h-24 resize-none focus:ring-4 ring-blue-50"
                placeholder="Detalles técnicos de la tarea..."
                value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})}
              />
              <div className="flex flex-col gap-4 w-full md:w-64">
                <select required className="bg-[#00338d] text-white rounded-2xl px-6 py-4 text-sm font-bold outline-none cursor-pointer h-full" value={form.asignado_a} onChange={e => setForm({...form, asignado_a: e.target.value})}>
                    <option value="">Asignar Responsable...</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>)}
                </select>
                <button type="submit" disabled={loading} className="h-full bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#00338d] transition-all shadow-lg shadow-blue-200">
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Plus size={20}/>} Asignar
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* GRID DE TAREAS */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4 md:px-0">
        {tareas.map((t) => {
          const idActual = String(perfilUsuario?.id || "").trim();
          const esAsignado = idActual === String(t.asignado_a || "").trim();
          const esAdmin = perfilUsuario?.rol === 'admin' || perfilUsuario?.rol === 'superuser';
          const estaAbierta = tareaExpandida === t.id;

          return (
            <div key={t.id} className={`group bg-white rounded-[2.5rem] border border-slate-100 p-8 flex flex-col shadow-sm hover:shadow-2xl transition-all duration-500 relative overflow-hidden ${estaAbierta ? 'ring-2 ring-[#00338d]' : ''}`}>
              
              {/* MODAL COMENTARIOS */}
              {estaAbierta && (
                <div className="absolute inset-0 z-30 bg-white flex flex-col animate-in slide-in-from-bottom-full duration-500">
                    <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#00338d]">Bitácora: {t.titulo}</span>
                        <button onClick={() => setTareaExpandida(null)} className="p-2 hover:bg-slate-200 rounded-full"><X size={18}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {comentarios.map(c => (
                            <div key={c.id} className={`max-w-[85%] p-4 rounded-2xl ${c.perfil_id === perfilUsuario.id ? 'bg-blue-600 text-white ml-auto' : 'bg-slate-100 text-slate-800'}`}>
                                <p className="text-[9px] font-black uppercase mb-1 opacity-70">{c.autor?.nombre} {c.autor?.apellido}</p>
                                <p className="text-xs font-bold leading-relaxed">{c.contenido}</p>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 bg-white border-t flex gap-2">
                        <input 
                            value={nuevoComentario} onChange={(e) => setNuevoComentario(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && enviarComentario(t.id)}
                            placeholder="Escribe un avance..."
                            className="flex-1 bg-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                        />
                        <button disabled={enviandoComentario} onClick={() => enviarComentario(t.id)} className="w-12 h-12 bg-[#00338d] text-white rounded-xl flex items-center justify-center">
                            {enviandoComentario ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />}
                        </button>
                    </div>
                </div>
              )}

              {/* INDICADOR PROYECTO Y PRIORIDAD */}
              <div className="flex flex-wrap gap-2 mb-6">
                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${getPrioridadEstilo(t.prioridad)}`}>
                  {t.prioridad}
                </span>
                {t.proyecto && (
                    <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                        <Briefcase size={10} /> {t.proyecto}
                    </span>
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter mb-4 leading-tight">{t.titulo}</h3>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/50 mb-6">
                  <p className="text-slate-600 font-bold text-xs leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                    {t.descripcion || "Sin descripción adicional."}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#00338d] rounded-xl flex items-center justify-center text-white text-[10px] font-black">
                      {t.responsable?.nombre[0]}{t.responsable?.apellido[0]}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-800 uppercase">{t.responsable?.nombre} {t.responsable?.apellido}</p>
                      <p className="text-[9px] font-bold text-blue-500 uppercase">Responsable</p>
                    </div>
                </div>
                
                <button onClick={() => { setTareaExpandida(t.id); fetchComentarios(t.id); }} className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl hover:bg-blue-100 transition-colors">
                    <MessageSquare size={14} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-500">{t.comentarios?.[0]?.count || 0}</span>
                </button>
              </div>

              <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-50">
                <div className="flex gap-2">
                  {(esAsignado || esAdmin) && (
                    <>
                      {t.estado === 'pendiente' && (
                        <button onClick={() => actualizarEstado(t.id, 'en_proceso')} className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all"><PlayCircle className="w-3 h-3" /> Iniciar</button>
                      )}
                      {t.estado === 'en_proceso' && (
                        <button onClick={() => actualizarEstado(t.id, 'completada')} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all"><CheckCircle2 className="w-3 h-3" /> Terminar</button>
                      )}
                    </>
                  )}
                  {t.estado === 'completada' && (
                    <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase">
                      <CheckCircle2 className="w-4 h-4" /> Completada
                    </div>
                  )}
                </div>

                {esAdmin && (
                  <button onClick={() => setConfirmarEliminar(t.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* CONFIRMACIÓN DE ELIMINACIÓN */}
              {confirmarEliminar === t.id && (
                <div className="absolute inset-0 z-40 bg-[#00338d]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                   <p className="text-white text-[10px] font-black uppercase tracking-widest mb-6">¿Eliminar tarea?</p>
                   <div className="flex gap-4">
                     <button onClick={() => setConfirmarEliminar(null)} className="w-12 h-12 rounded-full border border-white/20 text-white"><X size={18}/></button>
                     <button onClick={() => eliminarTarea(t.id)} className="w-12 h-12 rounded-full bg-rose-500 text-white shadow-xl"><Check size={18}/></button>
                   </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}