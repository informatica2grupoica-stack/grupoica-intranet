"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Users, 
  ClipboardCheck, 
  Activity, 
  ShieldCheck, 
  Calendar, 
  Loader2, 
  MessageSquare, 
  ArrowRight,
  ExternalLink
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ usuarios: 0, tareasPendientes: 0, chatsSinLeer: 0 });
  const [fechaActual, setFechaActual] = useState("");

  useEffect(() => {
    const opciones: Intl.DateTimeFormatOptions = { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    };
    setFechaActual(new Date().toLocaleDateString('es-ES', opciones));

    const cargarDatosSeguros = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      const userId = session.user.id;

      // Consultas directas y seguras
      const [resUsers, resTareas, resMensajes] = await Promise.all([
        supabase.from('perfiles').select('*', { count: 'exact', head: true }),
        supabase.from('tareas').select('*', { count: 'exact', head: true }).eq('asignado_a', userId).eq('estado', 'pendiente'),
        supabase.from('mensajes').select('*', { count: 'exact', head: true }).eq('receptor_id', userId).eq('leido', false)
      ]);

      setStats({
        usuarios: resUsers.count || 0,
        tareasPendientes: resTareas.count || 0,
        chatsSinLeer: resMensajes.count || 0
      });

      setLoading(false);
    };

    cargarDatosSeguros();
  }, [router]);

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-[#00338d] mb-4" />
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Cargando Panel Central...</span>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500 space-y-8">
      
      {/* HEADER SIMPLE */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-8">
        <div>
          <h1 className="text-4xl font-black text-[#00338d] tracking-tighter uppercase italic">
            INTRANET <span className="text-blue-500">GRUPO ICA</span>
          </h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] mt-1">Gestión de Operaciones Hardware & Construcción</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 px-5 py-2.5 rounded-xl text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-100">
          <Calendar className="w-4 h-4 text-blue-600" />
          {fechaActual}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* BANNER PRINCIPAL: TAREAS */}
        <div className="md:col-span-2 bg-[#00338d] rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-xl group">
          <div className="relative z-10">
            <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase italic">Mis Pendientes</h2>
            <p className="text-blue-100/80 text-lg font-bold max-w-md leading-tight mb-8">
              Actualmente tienes {stats.tareasPendientes} tareas asignadas en espera de revisión o ejecución.
            </p>
            <button 
              onClick={() => router.push('/tareas')}
              className="bg-white text-[#00338d] px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              Ir a mis tareas <ArrowRight size={14}/>
            </button>
          </div>
          <ClipboardCheck className="absolute right-[-20px] bottom-[-20px] w-64 h-64 text-white/5 -rotate-12" />
        </div>

        {/* CARD: CHATS */}
        <div className={`rounded-[2.5rem] p-10 border transition-all duration-300 flex flex-col justify-between ${stats.chatsSinLeer > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl ${stats.chatsSinLeer > 0 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                <MessageSquare size={24} />
              </div>
              {stats.chatsSinLeer > 0 && (
                <span className="bg-amber-500 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase">Nuevo Mensaje</span>
              )}
            </div>
            <p className="text-6xl font-black text-slate-800 tracking-tighter">{stats.chatsSinLeer}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Mensajes de Chat</p>
          </div>
          <button 
            onClick={() => router.push('/chat')}
            className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#00338d] hover:underline"
          >
            Abrir Mensajería <ExternalLink size={12}/>
          </button>
        </div>

        {/* FILA INFERIOR: EQUIPO Y SISTEMA */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="bg-blue-50 p-4 rounded-2xl text-blue-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800 leading-none">{stats.usuarios}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Usuarios Activos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800 leading-none">Protegido</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Estado del Sistema</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="bg-orange-50 p-4 rounded-2xl text-orange-600">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800 leading-none">Online</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sincronización</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}