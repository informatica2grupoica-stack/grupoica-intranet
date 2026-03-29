"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Send, Search, Loader2, CheckCheck, 
  MessageSquare, Hash, X, CheckCircle2, AlertCircle 
} from "lucide-react";

export default function ChatPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [seleccionado, setSeleccionado] = useState<any>(null);
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [cargandoMensajes, setCargandoMensajes] = useState(false);
  const [notificacion, setNotificacion] = useState<{msg: string, tipo: 'success' | 'error'} | null>(null);
  const [conteosNoLeidos, setConteosNoLeidos] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sistema de auto-ocultar alertas
  useEffect(() => {
    if (notificacion) {
      const timer = setTimeout(() => setNotificacion(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notificacion]);

  // 1. Inicialización y Carga de conteos iniciales
  useEffect(() => {
    const inicializar = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setMyUserId(session.user.id);
        const { data } = await supabase.from('perfiles').select('*').neq('user_id', session.user.id); 
        if (data) setUsuarios(data);
        
        // Cargar conteo inicial de no leídos
        fetchNoLeidos(session.user.id);
      }
    };
    inicializar();
  }, []);

  async function fetchNoLeidos(userId: string) {
    const { data } = await supabase
      .from('mensajes')
      .select('emisor_id')
      .eq('receptor_id', userId)
      .eq('leido', false);

    if (data) {
      const counts = data.reduce((acc: any, curr: any) => {
        acc[curr.emisor_id] = (acc[curr.emisor_id] || 0) + 1;
        return acc;
      }, {});
      setConteosNoLeidos(counts);
    }
  }

  // 2. Suscripción Global para Notificaciones y Mensajes
  useEffect(() => {
    if (!myUserId) return;

    const canal = supabase
      .channel('notificaciones_chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (payload) => {
        const nuevoMsg = payload.new;

        // Si el mensaje es para mí
        if (nuevoMsg.receptor_id === myUserId) {
          // Si NO tengo abierto ese chat, aumento el contador
          if (seleccionado?.user_id !== nuevoMsg.emisor_id) {
            setConteosNoLeidos(prev => ({
              ...prev,
              [nuevoMsg.emisor_id]: (prev[nuevoMsg.emisor_id] || 0) + 1
            }));
            // Opcional: Alerta minimalista de nuevo mensaje
            setNotificacion({ msg: "Nuevo mensaje recibido", tipo: 'success' });
          } else {
            // Si tengo el chat abierto, lo agrego a la vista
            setMensajes(prev => [...prev, nuevoMsg]);
            marcarComoLeido(nuevoMsg.emisor_id);
          }
        } 
        // Si el mensaje lo envié yo y tengo el chat abierto
        else if (nuevoMsg.emisor_id === myUserId && seleccionado?.user_id === nuevoMsg.receptor_id) {
          setMensajes(prev => [...prev, nuevoMsg]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [seleccionado, myUserId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  async function marcarComoLeido(emisorId: string) {
    await supabase
      .from('mensajes')
      .update({ leido: true })
      .eq('emisor_id', emisorId)
      .eq('receptor_id', myUserId);
    
    setConteosNoLeidos(prev => ({ ...prev, [emisorId]: 0 }));
  }

  async function cargarChat(user: any) {
    setSeleccionado(user);
    setCargandoMensajes(true);
    marcarComoLeido(user.user_id);
    
    const { data, error } = await supabase
      .from('mensajes')
      .select('*')
      .or(`and(emisor_id.eq.${myUserId},receptor_id.eq.${user.user_id}),and(emisor_id.eq.${user.user_id},receptor_id.eq.${myUserId})`)
      .order('created_at', { ascending: true });

    if (!error) setMensajes(data || []);
    setCargandoMensajes(false);
  }

  async function enviarMensaje(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoMensaje.trim() || !seleccionado || !myUserId) return;

    const texto = nuevoMensaje;
    setNuevoMensaje(""); 

    const { error } = await supabase.from('mensajes').insert([{
      contenido: texto,
      emisor_id: myUserId,
      receptor_id: seleccionado.user_id,
      leido: false
    }]);

    if (error) {
      setNotificacion({ msg: "Error al enviar mensaje", tipo: 'error' });
      setNuevoMensaje(texto); 
    }
  }

  return (
    <div className="flex h-[calc(100vh-160px)] bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-2xl shadow-blue-900/5 relative">
      
      {/* TOAST NOTIFICACIÓN 2026 */}
      {notificacion && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl backdrop-blur-xl border animate-in slide-in-from-top-10 duration-500 ${
          notificacion.tipo === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' : 'bg-rose-500/90 border-rose-400 text-white'
        }`}>
          {notificacion.tipo === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="text-[10px] font-black uppercase tracking-widest">{notificacion.msg}</span>
          <button onClick={() => setNotificacion(null)} className="ml-2 opacity-50"><X size={12}/></button>
        </div>
      )}

      {/* BARRA LATERAL */}
      <aside className="w-80 bg-[#00338d] flex flex-col relative overflow-hidden">
        <div className="p-8 relative z-10">
          <h2 className="text-white text-xl font-black tracking-tighter mb-6 flex items-center gap-2">
            <Hash className="w-5 h-5 text-blue-300" />
            MENSAJERÍA
          </h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input type="text" placeholder="Buscar colega..." className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-[11px] text-white placeholder:text-white/40 font-bold outline-none focus:bg-white/20 transition-all" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-2 relative z-10">
          {usuarios.map((u) => {
            const count = conteosNoLeidos[u.user_id] || 0;
            return (
              <button 
                key={u.id}
                onClick={() => cargarChat(u)}
                className={`w-full flex items-center gap-3 p-4 rounded-[1.8rem] transition-all relative ${
                  seleccionado?.user_id === u.user_id 
                  ? 'bg-white text-[#00338d] shadow-xl' 
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs ${
                  seleccionado?.user_id === u.user_id ? 'bg-[#00338d] text-white' : 'bg-white/10 text-white'
                }`}>
                  {u.nombre[0]}{u.apellido[0]}
                </div>
                <div className="text-left overflow-hidden flex-1">
                  <p className="text-[13px] font-bold truncate">{u.nombre} {u.apellido}</p>
                  <p className="text-[9px] uppercase font-black tracking-widest opacity-40">{u.cargo || 'Staff'}</p>
                </div>
                
                {/* BADGE DE NOTIFICACIÓN */}
                {count > 0 && (
                  <div className="bg-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg animate-bounce">
                    {count}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ÁREA DE CHAT */}
      <main className="flex-1 flex flex-col bg-white">
        {seleccionado ? (
          <>
            <div className="px-10 py-6 border-b border-slate-100 flex items-center gap-4 bg-white/80 backdrop-blur-md">
              <div className="relative">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-[#00338d]">
                  {seleccionado.nombre[0]}{seleccionado.apellido[0]}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-4 border-white rounded-full" />
              </div>
              <div>
                <p className="font-black text-slate-800 text-sm uppercase tracking-tighter">{seleccionado.nombre} {seleccionado.apellido}</p>
                <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">{seleccionado.cargo}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-6 bg-[#fcfdfe]">
              {cargandoMensajes ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-[#00338d] opacity-20" />
                </div>
              ) : (
                mensajes.map((m, idx) => (
                  <div key={idx} className={`flex ${m.emisor_id === myUserId ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[65%]">
                      <div className={`px-6 py-4 rounded-[2rem] text-sm font-medium shadow-sm animate-in slide-in-from-bottom-2 ${
                        m.emisor_id === myUserId 
                        ? 'bg-[#00338d] text-white rounded-tr-none shadow-blue-900/10' 
                        : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                      }`}>
                        {m.contenido}
                      </div>
                      <p className={`text-[9px] mt-2 font-bold uppercase text-slate-400 ${m.emisor_id === myUserId ? 'text-right mr-2' : 'text-left ml-2'}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {m.emisor_id === myUserId && <CheckCheck className={`w-3 h-3 inline ml-1 ${m.leido ? 'text-blue-400' : 'text-slate-300'}`} />}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={scrollRef} />
            </div>

            <form onSubmit={enviarMensaje} className="p-8 bg-white border-t border-slate-50">
              <div className="relative flex items-center bg-slate-50 rounded-[2rem] p-2 pr-3 border border-slate-100 focus-within:bg-white focus-within:ring-4 ring-blue-50 transition-all">
                <input value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} placeholder="Escribir respuesta..." className="flex-1 bg-transparent px-6 py-3 text-sm font-medium outline-none" />
                <button type="submit" disabled={!nuevoMensaje.trim()} className="w-12 h-12 bg-[#00338d] text-white rounded-2xl flex items-center justify-center hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-20">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mb-6">
              <MessageSquare className="w-10 h-10 text-[#00338d] opacity-20" />
            </div>
            <h3 className="text-slate-800 font-black text-xs uppercase tracking-[0.2em]">Selecciona un colega</h3>
            <p className="text-slate-400 text-[10px] mt-2 font-bold uppercase">Chat interno privado y seguro</p>
          </div>
        )}
      </main>
    </div>
  );
}