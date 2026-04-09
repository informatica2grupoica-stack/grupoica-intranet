"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, User as UserIcon, Loader2, 
  CheckCircle2, PlayCircle, Trash2, Clock, AlertCircle, Bookmark, X, Check,
  MessageSquare, Send
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

  const [form, setForm] = useState({ 
    titulo: "", descripcion: "", prioridad: "media", asignado_a: "" 
  });

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios_tareas' }, (payload) => {
          // Si el comentario pertenece a la tarea abierta, recargar comentarios
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

  // LOGICA DE COMENTARIOS
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
        setNotificacion({ msg: "Selecciona un responsable para la tarea", tipo: 'error' });
        return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('tareas').insert([{ 
        ...form, creado_por: perfilUsuario.id, estado: 'pendiente' 
      }]);
      if (error) throw error;
      setForm({ titulo: "", descripcion: "", prioridad: "media", asignado_a: "" });
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
        setNotificacion({ msg: "No tienes permisos para esta acción", tipo: 'error' });
        return;
      }
      setNotificacion({ msg: `Estado actualizado a ${nuevoEstado.replace('_', ' ')}`, tipo: 'success' });
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
        setNotificacion({ msg: "Tarea eliminada del muro", tipo: 'success' });
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
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 relative">
      
      {/* ALERTA FLOTANTE (TOAST) */}
      {notificacion && (
        <div className={`fixed top-10 right-1/2 translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-[2rem] shadow-2xl backdrop-blur-xl border animate-in slide-in-from-top-10 duration-500 ${
          notificacion.tipo === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' : 'bg-rose-500/90 border-rose-400 text-white'
        }`}>
          {notificacion.tipo === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-xs font-black uppercase tracking-widest">{notificacion.msg}</span>
          <button onClick={() => setNotificacion(null)} className="ml-4 opacity-50 hover:opacity-100"><X size={14}/></button>
        </div>
      )}

      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-4 md:px-0">
        <div>
          <h2 className="text-4xl font-black text-[#00338d] tracking-tighter uppercase italic leading-none">
            Muro de <span className="text-blue-500">Operaciones</span>
          </h2>
          <div className="flex items-center gap-2 mt-3">
            <span className="h-1 w-12 bg-blue-600 rounded-full" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Gestión de Flujo de Trabajo</p>
          </div>
        </div>
      </header>

      {/* FORMULARIO */}
      {perfilUsuario?.rol !== 'user' && (
        <section className="mx-4 md:mx-0 bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-slate-100 relative overflow-hidden group">
          <form onSubmit={handleCrearTarea} className="relative z-10 space-y-6">
            <div className="flex items-center gap-2 mb-2 text-[#00338d]">
              <Bookmark className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Nueva Asignación</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2">
                <input 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-4 ring-blue-50 focus:bg-white transition-all"
                  placeholder="Título de la tarea..." required
                  value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})}
                />
              </div>
              <select className="bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none cursor-pointer focus:ring-4 ring-blue-50" value={form.prioridad} onChange={e => setForm({...form, prioridad: e.target.value})}>
                <option value="baja">Prioridad Baja</option>
                <option value="media">Prioridad Media</option>
                <option value="alta">Prioridad Alta</option>
              </select>
              <select required className="bg-[#00338d] text-white rounded-2xl px-6 py-4 text-sm font-bold outline-none appearance-none cursor-pointer" value={form.asignado_a} onChange={e => setForm({...form, asignado_a: e.target.value})}>
                <option value="">Asignar a...</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>)}
              </select>
            </div>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <textarea 
                className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none h-20 resize-none focus:ring-4 ring-blue-50 focus:bg-white transition-all"
                placeholder="Descripción detallada..."
                value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})}
              />
              <button type="submit" disabled={loading} className="w-full md:w-auto h-20 px-12 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#00338d] transition-all shadow-xl shadow-blue-200">
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Plus size={20}/>} Crear
              </button>
            </div>
          </form>
        </section>
      )}

      {/* GRID TARJETAS */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4 md:px-0">
        {tareas.map((t) => {
          const idActual = String(perfilUsuario?.id || "").trim();
          const esAsignado = idActual === String(t.asignado_a || "").trim();
          const esCreador = idActual === String(t.creado_por || "").trim();
          const esAdmin = perfilUsuario?.rol === 'admin' || perfilUsuario?.rol === 'super-user';
          const esConfirmando = confirmarEliminar === t.id;
          const estaAbierta = tareaExpandida === t.id;

          return (
            <div key={t.id} className={`group bg-white rounded-[2.5rem] border border-slate-100 p-8 flex flex-col shadow-sm hover:shadow-2xl hover:shadow-blue-900/5 transition-all duration-500 relative overflow-hidden ${estaAbierta ? 'ring-2 ring-[#00338d]' : ''}`}>
              
              {/* MODAL COMENTARIOS INTERNO */}
              {estaAbierta && (
                <div className="absolute inset-0 z-30 bg-white flex flex-col animate-in slide-in-from-bottom-full duration-500">
                    <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#00338d]">Bitácora de Tarea</span>
                        <button onClick={() => setTareaExpandida(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={18}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {comentarios.length === 0 && <p className="text-center text-[10px] font-bold text-slate-400 uppercase mt-10">Sin comentarios aún</p>}
                        {comentarios.map(c => (
                            <div key={c.id} className={`max-w-[85%] p-4 rounded-2xl ${c.perfil_id === perfilUsuario.id ? 'bg-blue-600 text-white ml-auto' : 'bg-slate-100 text-slate-800'}`}>
                                <p className="text-[9px] font-black uppercase mb-1 opacity-70">{c.autor?.nombre} {c.autor?.apellido}</p>
                                <p className="text-xs font-bold leading-relaxed">{c.contenido}</p>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-white border-t flex gap-2">
                        <input 
                            value={nuevoComentario}
                            onChange={(e) => setNuevoComentario(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && enviarComentario(t.id)}
                            placeholder="Escribe un avance..."
                            className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none"
                        />
                        <button 
                            disabled={enviandoComentario}
                            onClick={() => enviarComentario(t.id)}
                            className="w-12 h-12 bg-[#00338d] text-white rounded-xl flex items-center justify-center hover:scale-105 transition-transform"
                        >
                            {enviandoComentario ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />}
                        </button>
                    </div>
                </div>
              )}

              {/* ALERTA DE CONFIRMACIÓN */}
              {esConfirmando && (
                <div className="absolute inset-0 z-20 bg-[#00338d]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                   <AlertCircle className="text-white/40 w-12 h-12 mb-4" />
                   <p className="text-white text-[10px] font-black uppercase tracking-[0.2em] mb-6">¿Confirmas eliminar esta tarea?</p>
                   <div className="flex gap-4">
                     <button onClick={() => setConfirmarEliminar(null)} className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-all"><X size={18}/></button>
                     <button onClick={() => eliminarTarea(t.id)} className="w-12 h-12 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-xl shadow-rose-900/40 hover:scale-110 transition-all"><Check size={18}/></button>
                   </div>
                </div>
              )}

              <div className={`absolute top-0 left-0 w-2 h-full ${
                t.estado === 'completada' ? 'bg-emerald-400' : 
                t.estado === 'en_proceso' ? 'bg-blue-500' : 'bg-slate-200'
              }`} />

              <div className="flex justify-between items-start mb-6">
                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${getPrioridadEstilo(t.prioridad)}`}>
                  {t.prioridad}
                </span>
                <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold">
                  <Clock className="w-3 h-3" />
                  {new Date(t.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter mb-4 leading-tight">{t.titulo}</h3>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/50 mb-6 relative group/desc">
                  <p className="text-slate-600 font-bold text-xs leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                    {t.descripcion || "Sin descripción técnica adicional."}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#00338d] rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-blue-900/20">
                      {t.responsable?.nombre[0]}{t.responsable?.apellido[0]}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-800 uppercase">{t.responsable?.nombre} {t.responsable?.apellido}</p>
                      <p className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter">Responsable</p>
                    </div>
                </div>
                
                {/* BOTON COMENTARIOS (BURBUJA) */}
                <button 
                    onClick={() => {
                        setTareaExpandida(t.id);
                        fetchComentarios(t.id);
                    }}
                    className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl hover:bg-blue-100 transition-colors group/msg"
                >
                    <MessageSquare size={14} className="text-slate-400 group-hover/msg:text-blue-600" />
                    <span className="text-[10px] font-black text-slate-500 group-hover/msg:text-blue-600">
                        {t.comentarios?.[0]?.count || 0}
                    </span>
                </button>
              </div>

              <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-50">
                <div className="flex gap-2">
                  {(esAsignado || esAdmin) && (
                    <>
                      {t.estado === 'pendiente' && (
                        <button onClick={() => actualizarEstado(t.id, 'en_proceso')} className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-blue-600 hover:text-white transition-all"><PlayCircle className="w-3 h-3" /> Iniciar</button>
                      )}
                      {t.estado === 'en_proceso' && (
                        <button onClick={() => actualizarEstado(t.id, 'completada')} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-emerald-600 hover:text-white transition-all"><CheckCircle2 className="w-3 h-3" /> Terminar</button>
                      )}
                    </>
                  )}
                  {t.estado === 'completada' && (
                    <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase">
                      <CheckCircle2 className="w-4 h-4" /> Completada
                    </div>
                  )}
                </div>

                {(esCreador || esAdmin) && (
                  <button onClick={() => setConfirmarEliminar(t.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* FOOTER VACIO */}
      {tareas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 opacity-20">
          <AlertCircle className="w-16 h-16 mb-4" />
          <p className="font-black uppercase tracking-[0.3em] text-xs">No hay tareas activas</p>
        </div>
      )}
    </div>
  );
}