"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Users, ClipboardCheck, Activity, ShieldCheck, Calendar, Loader2, 
  MessageSquare, ArrowRight, ExternalLink, Bell, FileWarning, 
  Receipt, AlertTriangle 
} from "lucide-react";

// --- COMPONENTES DE ICONOS SOCIALES (Evita errores de Lucide) ---
const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
);
const InstagramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);
const TikTokIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
);

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ 
    usuarios: 0, 
    tareasPendientes: 0, 
    chatsSinLeer: 0,
    ordenesEmitidas: 0,
    ordenesFacturadas: 0,
    listaEmitidas: [] as any[]
  });
  const [fechaActual, setFechaActual] = useState("");

  useEffect(() => {
    const opciones: Intl.DateTimeFormatOptions = { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    };
    setFechaActual(new Date().toLocaleDateString('es-ES', opciones));

    const cargarDatos = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push("/login"); return; }
        const userId = session.user.id;

        // 1. Datos de Supabase
        const [resUsers, resTareas, resMensajes] = await Promise.all([
          supabase.from('perfiles').select('*', { count: 'exact', head: true }),
          supabase.from('tareas').select('*', { count: 'exact', head: true }).eq('asignado_a', userId).eq('estado', 'pendiente'),
          supabase.from('mensajes').select('*', { count: 'exact', head: true }).eq('receptor_id', userId).eq('leido', false),
        ]);

        // 2. Datos de Obuma API (Balance de Facturación)
        const resObuma = await fetch('/api/obuma/oc');
        const jsonObuma = await resObuma.json();

        let emitidasArr: any[] = [];
        let facturadasCount = 0;

        if (jsonObuma && jsonObuma.data && Array.isArray(jsonObuma.data)) {
          // Filtramos usando las llaves correctas: compra_oc_estado
          emitidasArr = jsonObuma.data.filter((oc: any) => 
            oc.compra_oc_estado === 'EMITIDA' || oc.compra_oc_estado === 'PENDIENTE'
          );
          
          facturadasCount = jsonObuma.data.filter((oc: any) => 
            oc.compra_oc_estado === 'FACTURADA'
          ).length;
        }

        setStats({
          usuarios: resUsers.count || 0,
          tareasPendientes: resTareas.count || 0,
          chatsSinLeer: resMensajes.count || 0,
          ordenesEmitidas: emitidasArr.length,
          ordenesFacturadas: facturadasCount,
          listaEmitidas: emitidasArr
        });

      } catch (err) {
        console.error("Error en sincronización:", err);
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();

    // Alerta cada hora si hay pendientes críticos
    const alertInterval = setInterval(() => {
        if (stats.ordenesEmitidas > 0) {
            alert(`SISTEMA: Tienes ${stats.ordenesEmitidas} OC en Obuma pendientes de facturar.`);
        }
    }, 3600000);

    return () => clearInterval(alertInterval);
  }, [router, stats.ordenesEmitidas]);

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-[#00338d] mb-4" />
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Conectando con Obuma ERP...</span>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500 space-y-8">
      
      {/* HEADER & REDES */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-8">
        <div>
          <h1 className="text-4xl font-black text-[#00338d] tracking-tighter uppercase italic">
            INTRANET <span className="text-blue-500">GRUPO ICA</span>
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">Gestión de Operaciones</p>
            <div className="flex gap-4 border-l pl-4 border-slate-200">
              <a href="#" className="text-slate-400 hover:text-blue-600 transition-all transform hover:scale-110"><FacebookIcon /></a>
              <a href="#" className="text-slate-400 hover:text-pink-500 transition-all transform hover:scale-110"><InstagramIcon /></a>
              <a href="#" className="text-slate-400 hover:text-black transition-all transform hover:scale-110"><TikTokIcon /></a>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-white px-5 py-2.5 rounded-xl text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-100 shadow-sm">
            <Calendar className="w-4 h-4 text-blue-600" />
            {fechaActual}
          </div>
          {stats.ordenesEmitidas > 0 && (
            <div className="flex items-center gap-2 bg-rose-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase animate-pulse">
              <Bell size={14} /> Alertas Críticas
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* BANNER TAREAS */}
        <div className="md:col-span-2 bg-[#00338d] rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-xl group">
          <div className="relative z-10">
            <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase italic">Flujo de Trabajo</h2>
            <p className="text-blue-100/80 text-lg font-bold max-w-md leading-tight mb-8">
              Tienes {stats.tareasPendientes} tareas pendientes en tu hoja de ruta.
            </p>
            <button onClick={() => router.push('/tareas')} className="bg-white text-[#00338d] px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-colors flex items-center gap-2">
              Ver Mis Tareas <ArrowRight size={14}/>
            </button>
          </div>
          <ClipboardCheck className="absolute right-[-20px] bottom-[-20px] w-64 h-64 text-white/5 -rotate-12" />
        </div>

        {/* CARD CHAT */}
        <div className={`rounded-[2.5rem] p-10 border transition-all duration-500 flex flex-col justify-between ${stats.chatsSinLeer > 0 ? 'bg-amber-400 border-amber-500 shadow-xl scale-[1.02]' : 'bg-white border-slate-100'}`}>
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl ${stats.chatsSinLeer > 0 ? 'bg-white text-amber-500' : 'bg-slate-100 text-slate-400'}`}>
                <MessageSquare size={24} />
              </div>
            </div>
            <p className={`text-6xl font-black tracking-tighter ${stats.chatsSinLeer > 0 ? 'text-white' : 'text-slate-800'}`}>{stats.chatsSinLeer}</p>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-2 ${stats.chatsSinLeer > 0 ? 'text-white/80' : 'text-slate-400'}`}>Mensajes Nuevos</p>
          </div>
          <button onClick={() => router.push('/chat')} className={`mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:underline ${stats.chatsSinLeer > 0 ? 'text-white' : 'text-[#00338d]'}`}>
            Ir a Mensajería <ExternalLink size={12}/>
          </button>
        </div>
      </div>

      {/* SECCIÓN BALANCE OBUMA API */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><Receipt size={20}/></div>
                    <h3 className="font-black text-slate-800 uppercase text-sm tracking-widest">Balance de Facturación (Obuma)</h3>
                </div>
                <div className="flex gap-4">
                    <div className="text-center px-4 border-r border-slate-100">
                        <p className="text-xl font-black text-emerald-600">{stats.ordenesFacturadas}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Facturadas</p>
                    </div>
                    <div className="text-center px-4">
                        <p className="text-xl font-black text-rose-600">{stats.ordenesEmitidas}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Por Facturar</p>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-rose-100">
                <table className="w-full text-left text-[11px]">
                    <thead className="bg-rose-50 text-rose-600 font-black uppercase italic">
                        <tr>
                            <th className="px-6 py-4">Folio Obuma</th>
                            <th className="px-6 py-4">Referencia / Glosa</th>
                            <th className="px-6 py-4 text-center">Estado</th>
                            <th className="px-6 py-4 text-right">Monto Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-50">
                        {stats.listaEmitidas.length > 0 ? stats.listaEmitidas.slice(0, 5).map((oc) => (
                            <tr key={oc.compra_oc_id} className="hover:bg-rose-50/30 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-700">#{oc.compra_oc_folio}</td>
                                <td className="px-6 py-4 font-medium text-slate-500 uppercase truncate max-w-[200px]">
                                    {oc.compra_oc_referencia || "Sin referencia"}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full font-black text-[9px] italic">
                                        {oc.compra_oc_estado}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-black text-slate-700">
                                    ${Number(oc.compra_oc_total).toLocaleString('es-CL')}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="py-10 text-center text-slate-400 font-bold uppercase italic">No hay OC emitidas pendientes</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* INDICADOR RÁPIDO */}
        <div className={`rounded-[2.5rem] p-8 text-white flex flex-col justify-between shadow-xl transition-all duration-500 ${stats.ordenesEmitidas > 0 ? 'bg-rose-600 shadow-rose-200 animate-in zoom-in' : 'bg-slate-800'}`}>
            <AlertTriangle size={40} className={`opacity-40 ${stats.ordenesEmitidas > 0 ? 'animate-bounce' : ''}`} />
            <div>
                <p className="text-5xl font-black tracking-tighter">{stats.ordenesEmitidas}</p>
                <p className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-80">Por Facturar</p>
            </div>
            <button 
              onClick={() => router.push('/compras')}
              className="mt-4 bg-white/10 hover:bg-white/20 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
            >
              Gestionar en Compras
            </button>
        </div>
      </div>

      {/* FOOTER STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex items-center gap-5">
            <div className="bg-blue-50 p-4 rounded-2xl text-blue-600"><Users size={24} /></div>
            <div>
              <p className="text-2xl font-black text-slate-800 leading-none">{stats.usuarios}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Colaboradores</p>
            </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex items-center gap-5">
            <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600"><ShieldCheck size={24} /></div>
            <div>
              <p className="text-2xl font-black text-slate-800 leading-none">Seguro</p>
              <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Sincronización SSL</p>
            </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex items-center gap-5">
            <div className="bg-orange-50 p-4 rounded-2xl text-orange-600"><Activity size={24} /></div>
            <div>
              <p className="text-2xl font-black text-slate-800 leading-none">Activa</p>
              <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Obuma API Online</p>
            </div>
        </div>
      </div>
    </div>
  );
}