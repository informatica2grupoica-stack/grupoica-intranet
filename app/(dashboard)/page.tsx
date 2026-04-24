// app/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Users, ClipboardCheck, Activity, ShieldCheck, Calendar, Loader2, 
  MessageSquare, ArrowRight, ExternalLink, Bell, 
  Receipt, AlertTriangle, TrendingUp, CheckCircle2, Cake, 
  FileText, Clock, UserCheck, Briefcase, Award
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';

// --- COMPONENTES DE ICONOS SOCIALES ---
const FacebookIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>);
const InstagramIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>);
const TikTokIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>);

export default function HomePage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ 
    usuarios: 0, 
    tareasPendientes: 0, 
    chatsSinLeer: 0,
    ordenesEmitidas: 0,
    ordenesFacturadas: 0,
    montoPendiente: 0,
    listaEmitidas: [] as any[],
    dataGrafico: [] as any[]
  });
  
  // ✅ Nuevos estados para RRHH
  const [rrhhStats, setRrhhStats] = useState({
    totalEmpleados: 0,
    empleadosActivos: 0,
    vacacionesProximas: [] as any[],
    cumpleañosProximos: [] as any[],
    permisosPendientes: 0,
    contratosPorVencer: 0,
    solicitudesPendientes: [] as any[]
  });
  
  const [fechaActual, setFechaActual] = useState("");

  useEffect(() => {
    setIsMounted(true);
    const opciones: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setFechaActual(new Date().toLocaleDateString('es-ES', opciones));
    cargarDatosBase();
    cargarDatosRRHH();
    
    const setupSubscriptions = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const tareasSub = supabase.channel('cambios-tareas')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, () => fetchTareasCount())
          .subscribe();

        const mensajesSub = supabase.channel('cambios-mensajes')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, () => fetchMensajesCount())
          .subscribe();

        return () => {
          supabase.removeChannel(tareasSub);
          supabase.removeChannel(mensajesSub);
        };
    };
    setupSubscriptions();
  }, []);

  const fetchTareasCount = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { count } = await supabase.from('tareas').select('*', { count: 'exact', head: true }).eq('asignado_a', session.user.id).eq('estado', 'pendiente');
      setStats(prev => ({ ...prev, tareasPendientes: count || 0 }));
    }
  };

  const fetchMensajesCount = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { count } = await supabase.from('mensajes').select('*', { count: 'exact', head: true }).eq('receptor_id', session.user.id).eq('leido', false);
      setStats(prev => ({ ...prev, chatsSinLeer: count || 0 }));
    }
  };

  const cargarDatosRRHH = async () => {
    try {
      // Obtener empleados
      const { data: empleados } = await supabase
        .from('empleados')
        .select('*')
        .eq('activo', true);
      
      const total = empleados?.length || 0;
      const activos = empleados?.filter(e => e.estado === 'activo').length || 0;
      
      // Próximos cumpleaños
      const hoy = new Date();
      const proximosCumpleaños = empleados?.filter(e => e.fecha_nacimiento)
        .map(e => {
          const fechaNac = new Date(e.fecha_nacimiento);
          const proximoCumple = new Date(hoy.getFullYear(), fechaNac.getMonth(), fechaNac.getDate());
          if (proximoCumple < hoy) {
            proximoCumple.setFullYear(proximoCumple.getFullYear() + 1);
          }
          const diasFaltantes = Math.ceil((proximoCumple.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
          return { ...e, diasFaltantes };
        })
        .filter(e => e.diasFaltantes <= 30)
        .sort((a, b) => a.diasFaltantes - b.diasFaltantes)
        .slice(0, 5) || [];
      
      // Próximas vacaciones (permisos aprobados)
      const { data: permisosAprobados } = await supabase
        .from('permisos_empleados')
        .select('*, empleado:empleados(nombre_completo, cargo)')
        .eq('estado', 'aprobado')
        .eq('tipo', 'vacaciones')
        .gte('fecha_inicio', new Date().toISOString().split('T')[0])
        .order('fecha_inicio', { ascending: true })
        .limit(5);
      
      // Solicitudes pendientes
      const { count: solicitudesPendientes } = await supabase
        .from('permisos_empleados')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'pendiente');
      
      // Contratos por vencer (próximos 30 días)
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() + 30);
      const { count: contratosVencer } = await supabase
        .from('contratos_empleados')
        .select('*', { count: 'exact', head: true })
        .eq('vigente', true)
        .lte('fecha_fin', fechaLimite.toISOString().split('T')[0]);
      
      setRrhhStats({
        totalEmpleados: total,
        empleadosActivos: activos,
        vacacionesProximas: permisosAprobados || [],
        cumpleañosProximos: proximosCumpleaños,
        permisosPendientes: solicitudesPendientes || 0,
        contratosPorVencer: contratosVencer || 0,
        solicitudesPendientes: permisosAprobados || []
      });
    } catch (error) {
      console.error('Error cargando datos RRHH:', error);
    }
  };

  const cargarDatosBase = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const [resUsers, resObuma] = await Promise.all([
        supabase.from('perfiles').select('*', { count: 'exact', head: true }),
        fetch('/api/obuma/oc').then(r => r.json()).catch(() => ({ data: [] }))
      ]);

      let emitidasArr = [];
      let facturadasCount = 0;
      let sumaMontoPendiente = 0;
      let chartData: any[] = [];

      if (resObuma?.data && Array.isArray(resObuma.data)) {
        emitidasArr = resObuma.data.filter((oc: any) => oc.compra_oc_estado === 'EMITIDA' || oc.compra_oc_estado === 'PENDIENTE');
        facturadasCount = resObuma.data.filter((oc: any) => oc.compra_oc_estado === 'FACTURADA').length;
        sumaMontoPendiente = emitidasArr.reduce((acc: number, curr: any) => acc + (Number(curr.compra_oc_total) || 0), 0);

        chartData = resObuma.data.slice(0, 10).reverse().map((oc: any) => ({
          name: `F-${oc.compra_oc_folio}`,
          valor: Number(oc.compra_oc_total) || 0
        }));
      }

      setStats(prev => ({
        ...prev,
        usuarios: resUsers.count || 0,
        ordenesEmitidas: emitidasArr.length,
        ordenesFacturadas: facturadasCount,
        montoPendiente: sumaMontoPendiente,
        listaEmitidas: emitidasArr,
        dataGrafico: chartData
      }));

      fetchTareasCount();
      fetchMensajesCount();
    } catch (err) {
      console.error("Error en sincronización:", err);
    } finally {
      setLoading(false);
    }
  };

  const eficienciaOC = useMemo(() => {
    const total = stats.ordenesFacturadas + stats.ordenesEmitidas;
    return total === 0 ? 0 : Math.round((stats.ordenesFacturadas / total) * 100);
  }, [stats.ordenesFacturadas, stats.ordenesEmitidas]);

  if (loading || !isMounted) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
      <Loader2 className="w-12 h-12 animate-spin text-[#00338d] mb-4" />
      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">Iniciando Radar ICA...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto animate-in fade-in duration-700 space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-5xl font-black text-[#00338d] tracking-tighter uppercase italic">
              DASHBOARD <span className="text-orange-600">ICA</span>
            </h1>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter animate-pulse">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> Sincronizado
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">Gestión de Operaciones</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col items-end mr-4">
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sistema Operativo</span>
             <span className="text-xs font-bold text-slate-700">{fechaActual}</span>
          </div>
          <button onClick={() => { cargarDatosBase(); cargarDatosRRHH(); }} className="bg-white border border-slate-200 p-3 rounded-2xl hover:bg-slate-50 transition-all">
            <Activity size={18} className="text-blue-600" />
          </button>
        </div>
      </div>

      {/* MÉTRICAS PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-50 rounded-2xl text-orange-600"><TrendingUp size={20}/></div>
            <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">+{eficienciaOC}%</span>
          </div>
          <p className="text-4xl font-black text-slate-900 tracking-tighter">{eficienciaOC}%</p>
          <p className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-widest">Eficiencia OC</p>
        </div>

        <div onClick={() => router.push('/tareas')} className="bg-[#00338d] p-8 rounded-[2.5rem] shadow-xl text-white cursor-pointer hover:scale-[1.02] transition-all relative overflow-hidden">
          <ClipboardCheck className="absolute right-[-10px] top-[-10px] w-24 h-24 text-white/10 -rotate-12" />
          <p className="text-4xl font-black tracking-tighter">{stats.tareasPendientes}</p>
          <p className="text-[10px] font-black text-blue-200 uppercase mt-1 tracking-widest">Tareas</p>
          <div className="mt-6 flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest">
            Gestionar <ArrowRight size={12}/>
          </div>
        </div>

        <div onClick={() => router.push('/chat')} className={`p-8 rounded-[2.5rem] shadow-xl cursor-pointer transition-all ${stats.chatsSinLeer > 0 ? 'bg-amber-400' : 'bg-white border border-slate-100'}`}>
          <MessageSquare size={24} className={stats.chatsSinLeer > 0 ? 'text-white' : 'text-slate-300'} />
          <p className={`text-4xl font-black tracking-tighter mt-4 ${stats.chatsSinLeer > 0 ? 'text-white' : 'text-slate-900'}`}>{stats.chatsSinLeer}</p>
          <p className={`text-[10px] font-black uppercase mt-1 tracking-widest ${stats.chatsSinLeer > 0 ? 'text-white/80' : 'text-slate-400'}`}>Mensajes</p>
        </div>

        <div onClick={() => router.push('/rrhh/empleados')} className="bg-emerald-600 p-8 rounded-[2.5rem] shadow-xl text-white cursor-pointer hover:scale-[1.02] transition-all relative overflow-hidden">
          <Users className="absolute right-[-10px] top-[-10px] w-24 h-24 text-white/10 -rotate-12" />
          <p className="text-4xl font-black tracking-tighter">{rrhhStats.totalEmpleados}</p>
          <p className="text-[10px] font-black text-emerald-100 uppercase mt-1 tracking-widest">Empleados Activos</p>
          <div className="mt-6 flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest">
            Ver Equipo <ArrowRight size={12}/>
          </div>
        </div>
      </div>

      {/* SECCIÓN RRHH - ALERTAS Y PRÓXIMOS EVENTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Próximos Cumpleaños */}
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6 flex items-center gap-2">
            <Cake size={16} className="text-amber-500" />
            Próximos Cumpleaños 🎂
          </h3>
          <div className="space-y-3">
            {rrhhStats.cumpleañosProximos.length > 0 ? (
              rrhhStats.cumpleañosProximos.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center text-white font-bold">
                      {emp.nombre_completo?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{emp.nombre_completo}</p>
                      <p className="text-[9px] text-slate-500">{emp.cargo || 'Sin cargo'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-amber-600">{emp.diasFaltantes} días</p>
                    <p className="text-[9px] text-slate-400">{new Date(emp.fecha_nacimiento).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Cake size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">No hay cumpleaños próximos</p>
              </div>
            )}
          </div>
        </div>

        {/* Solicitudes Pendientes */}
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6 flex items-center gap-2">
            <Bell size={16} className="text-rose-500" />
            Solicitudes Pendientes {rrhhStats.permisosPendientes > 0 && `(${rrhhStats.permisosPendientes})`}
          </h3>
          <div className="space-y-3">
            {rrhhStats.solicitudesPendientes.length > 0 ? (
              rrhhStats.solicitudesPendientes.slice(0, 5).map((permiso) => (
                <div key={permiso.id} className="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-100 cursor-pointer hover:bg-rose-100" onClick={() => router.push('/rrhh/permisos')}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center text-white text-lg">
                      {permiso.tipo === 'vacaciones' ? '🏖️' : '📋'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{permiso.empleado?.nombre_completo || 'Empleado'}</p>
                      <p className="text-[9px] text-slate-500">{permiso.tipo === 'vacaciones' ? 'Vacaciones' : permiso.tipo}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-amber-600">{permiso.dias_solicitados} días</p>
                    <p className="text-[9px] text-slate-400">Pendiente</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400">
                <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">No hay solicitudes pendientes</p>
              </div>
            )}
            {rrhhStats.permisosPendientes > 5 && (
              <button onClick={() => router.push('/rrhh/permisos')} className="w-full mt-2 text-center text-[10px] font-bold text-blue-600 hover:text-blue-700">
                Ver todas ({rrhhStats.permisosPendientes}) →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN DE VACACIONES Y CONTRATOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Próximas Vacaciones */}
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6 flex items-center gap-2">
            <Calendar size={16} className="text-blue-500" />
            Próximas Vacaciones 🌴
          </h3>
          <div className="space-y-3">
            {rrhhStats.vacacionesProximas.length > 0 ? (
              rrhhStats.vacacionesProximas.map((vac) => (
                <div key={vac.id} className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{vac.empleado?.nombre_completo}</p>
                    <p className="text-[9px] text-slate-500">{vac.empleado?.cargo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-blue-600">
                      {new Date(vac.fecha_inicio).toLocaleDateString()} - {new Date(vac.fecha_fin).toLocaleDateString()}
                    </p>
                    <p className="text-[9px] text-slate-400">{vac.dias_solicitados} días</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">No hay vacaciones programadas</p>
              </div>
            )}
          </div>
        </div>

        {/* Alertas RRHH */}
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            Alertas RRHH ⚠️
          </h3>
          <div className="space-y-3">
            {rrhhStats.contratosPorVencer > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white">
                    <FileText size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Contratos por vencer</p>
                    <p className="text-[9px] text-slate-500">Próximos 30 días</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-amber-600">{rrhhStats.contratosPorVencer}</p>
                  <button onClick={() => router.push('/rrhh/contratos')} className="text-[9px] text-blue-600">Revisar →</button>
                </div>
              </div>
            )}
            
            {rrhhStats.permisosPendientes > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center text-white">
                    <Clock size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Permisos pendientes</p>
                    <p className="text-[9px] text-slate-500">Esperando aprobación</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-rose-600">{rrhhStats.permisosPendientes}</p>
                  <button onClick={() => router.push('/rrhh/permisos')} className="text-[9px] text-blue-600">Revisar →</button>
                </div>
              </div>
            )}

            {rrhhStats.empleadosActivos > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                    <UserCheck size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Equipo Activo</p>
                    <p className="text-[9px] text-slate-500">Talento humano</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-emerald-600">{rrhhStats.empleadosActivos}</p>
                  <button onClick={() => router.push('/rrhh/empleados')} className="text-[9px] text-blue-600">Ver equipo →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GRÁFICO FINANCIERO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm min-h-[400px]">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-8 flex items-center gap-2">
            <Activity size={16} className="text-blue-600"/> Flujo Financiero Reciente (Obuma)
          </h3>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.dataGrafico}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00338d" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#00338d" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="valor" stroke="#00338d" strokeWidth={3} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* OC Pendientes */}
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm flex flex-col">
          <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em] mb-6 flex items-center gap-2">
            <Bell size={14} className="text-rose-500" /> OC Pendientes Críticas
          </h3>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[320px] pr-2">
            {stats.listaEmitidas.length > 0 ? stats.listaEmitidas.slice(0, 6).map((oc) => (
              <div key={oc.compra_oc_id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                <div>
                  <p className="font-black text-[11px] text-slate-800">#{oc.compra_oc_folio}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase truncate w-32">{oc.compra_oc_referencia || 'Pendiente'}</p>
                </div>
                <p className="font-black text-[11px] text-rose-600">${Number(oc.compra_oc_total).toLocaleString('es-CL')}</p>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 italic py-10">
                <CheckCircle2 size={32} className="mb-2 opacity-20" />
                <p className="text-[10px] font-bold">Sin alertas pendientes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}