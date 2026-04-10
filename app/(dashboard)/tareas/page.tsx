"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, Loader2, CheckCircle2, PlayCircle, Trash2, AlertCircle, X, Check,
  MessageSquare, Send, Briefcase, Calendar, Clock
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

  const getEstadoEstilo = (tarea: any) => {
    const hoy = new Date();
    const limite = tarea.fecha_limite ? new Date(tarea.fecha_limite) : null;

    if (tarea.estado === 'completada') return 'bg-emerald-500 text-white';
    if (limite && limite < hoy && tarea.estado !== 'completada') return 'bg-rose-500 text-white';
    if (tarea.estado === 'en_proceso') return 'bg-amber-400 text-white';
    return 'bg-slate-200 text-slate-600';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 relative animate-in fade-in duration-700">
      
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
          Gestor de <span className="text-blue-500">Tareas</span>
        </h2>
        <div className="flex items-center gap-2 mt-3">
          <span className="h-1 w-12 bg-blue-600 rounded-full" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Panel de Control en Tabla</p>
        </div>
      </header>

      {/* FORMULARIO */}
      {puedeCrear && (
        <section className="mx-4 md:mx-0 bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100">
          <form onSubmit={handleCrearTarea} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input 
              className="md:col-span-2 bg-slate-50 border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 ring-blue-500 transition-all"
              placeholder="Tarea / Título" required
              value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})}
            />
            <select required className="bg-slate-50 border rounded-xl px-4 py-3 text-sm font-bold outline-none" value={form.asignado_a} onChange={e => setForm({...form, asignado_a: e.target.value})}>
                <option value="">Responsable...</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>)}
            </select>
            <select className="bg-slate-50 border rounded-xl px-4 py-3 text-sm font-bold outline-none" value={form.prioridad} onChange={e => setForm({...form, prioridad: e.target.value})}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
            </select>
            <div className="md:col-span-1 flex gap-2">
                <div className="flex-1 relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="date" className="w-full bg-slate-50 border rounded-xl pl-9 pr-3 py-3 text-[10px] font-bold outline-none" 
                           value={form.fecha_inicio} onChange={e => setForm({...form, fecha_inicio: e.target.value})} />
                </div>
                <div className="flex-1 relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="date" className="w-full bg-slate-50 border rounded-xl pl-9 pr-3 py-3 text-[10px] font-bold outline-none" 
                           value={form.fecha_limite} onChange={e => setForm({...form, fecha_limite: e.target.value})} />
                </div>
            </div>
            <textarea 
              className="md:col-span-2 bg-slate-50 border rounded-xl px-4 py-3 text-sm font-bold outline-none h-12 resize-none"
              placeholder="Observaciones / Descripción"
              value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})}
            />
            <input 
              className="bg-slate-50 border rounded-xl px-4 py-3 text-sm font-bold outline-none"
              placeholder="Proyecto"
              value={form.proyecto} onChange={e => setForm({...form, proyecto: e.target.value})}
            />
            <button type="submit" disabled={loading} className="bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#00338d] transition-all">
                {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus size={16}/>} Crear Tarea
            </button>
          </form>
        </section>
      )}

      {/* TABLA DE TAREAS */}
      <section className="px-4 md:px-0 overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-3">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-left">
              <th className="px-6 py-2">Tarea / Proyecto</th>
              <th className="px-6 py-2">Responsable</th>
              <th className="px-6 py-2">Inicio</th>
              <th className="px-6 py-2">Límite</th>
              <th className="px-6 py-2">Estado</th>
              <th className="px-6 py-2">Observaciones</th>
              <th className="px-6 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tareas.map((t) => {
              const esAsignado = String(perfilUsuario?.id || "").trim() === String(t.asignado_a || "").trim();
              const esAdmin = perfilUsuario?.rol === 'admin' || perfilUsuario?.rol === 'superuser';

              return (
                <tr key={t.id} className="bg-white group hover:shadow-md transition-all relative">
                  <td className="px-6 py-5 rounded-l-[1.5rem] border-y border-l border-slate-50">
                    <div className="font-black text-slate-800 text-xs uppercase italic">{t.titulo}</div>
                    {t.proyecto && <div className="text-[9px] text-blue-500 font-bold flex items-center gap-1 mt-1"><Briefcase size={10}/> {t.proyecto}</div>}
                  </td>
                  <td className="px-6 py-5 border-y border-slate-50">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#00338d] rounded-lg flex items-center justify-center text-white text-[9px] font-black">
                            {t.responsable?.nombre[0]}{t.responsable?.apellido[0]}
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 uppercase">{t.responsable?.nombre}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 border-y border-slate-50 text-[10px] font-bold text-slate-400">
                    {t.fecha_inicio || '-'}
                  </td>
                  <td className="px-6 py-5 border-y border-slate-50 text-[10px] font-bold text-slate-400">
                    {t.fecha_limite || '-'}
                  </td>
                  <td className="px-6 py-5 border-y border-slate-50">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${getEstadoEstilo(t)}`}>
                        {t.estado === 'pendiente' ? 'Pendiente' : t.estado === 'en_proceso' ? 'En Proceso' : 'Completado'}
                    </span>
                  </td>
                  <td className="px-6 py-5 border-y border-slate-50">
                    <p className="text-[10px] text-slate-500 font-medium line-clamp-1 max-w-[200px]">{t.descripcion || '-'}</p>
                  </td>
                  <td className="px-6 py-5 rounded-r-[1.5rem] border-y border-r border-slate-50">
                    <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setTareaExpandida(t.id); fetchComentarios(t.id); }} className="p-2 bg-slate-50 hover:bg-blue-100 rounded-lg transition-colors relative">
                            <MessageSquare size={14} className="text-slate-400" />
                            {t.comentarios?.[0]?.count > 0 && <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center">{t.comentarios[0].count}</span>}
                        </button>
                        
                        {(esAsignado || esAdmin) && (
                            <>
                                {t.estado === 'pendiente' && (
                                    <button onClick={() => actualizarEstado(t.id, 'en_proceso')} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all"><PlayCircle size={14} /></button>
                                )}
                                {t.estado === 'en_proceso' && (
                                    <button onClick={() => actualizarEstado(t.id, 'completada')} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-all"><CheckCircle2 size={14} /></button>
                                )}
                            </>
                        )}
                        {esAdmin && (
                            <button onClick={() => setConfirmarEliminar(t.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                        )}
                    </div>

                    {/* CONFIRMACIÓN BORRADO LOCAL AL TR */}
                    {confirmarEliminar === t.id && (
                        <div className="absolute inset-0 z-10 bg-[#00338d]/90 backdrop-blur-sm rounded-[1.5rem] flex items-center justify-center gap-4 animate-in fade-in">
                            <span className="text-white text-[10px] font-black uppercase">¿Eliminar?</span>
                            <button onClick={() => setConfirmarEliminar(null)} className="text-white hover:scale-110 transition-transform"><X size={16}/></button>
                            <button onClick={() => eliminarTarea(t.id)} className="bg-rose-500 text-white p-2 rounded-full hover:scale-110 transition-transform"><Check size={16}/></button>
                        </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* PANEL LATERAL DE COMENTARIOS (SIN PERDER FUNCIONALIDAD) */}
      {tareaExpandida && (
        <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-[110] flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-100">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#00338d]">Bitácora de Tarea</span>
                    <span className="text-xs font-bold text-slate-500 truncate">{tareas.find(t => t.id === tareaExpandida)?.titulo}</span>
                </div>
                <button onClick={() => setTareaExpandida(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {comentarios.length === 0 && <p className="text-center text-[10px] font-bold text-slate-400 uppercase mt-10">No hay comentarios aún</p>}
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
                    onKeyDown={(e) => e.key === 'Enter' && enviarComentario(tareaExpandida)}
                    placeholder="Escribe un avance..."
                    className="flex-1 bg-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none border border-transparent focus:border-blue-500"
                />
                <button disabled={enviandoComentario} onClick={() => enviarComentario(tareaExpandida)} className="w-12 h-12 bg-[#00338d] text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-colors">
                    {enviandoComentario ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />}
                </button>
            </div>
        </div>
      )}
    </div>
  );
}