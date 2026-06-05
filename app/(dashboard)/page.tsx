"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck, MessageSquare, Bell, Cake, Clock, Loader2,
  ArrowRight, CheckCircle2, GraduationCap, Building2, Gift,
  Smile, Heart, Users, Package, AlertCircle, Sparkles,
  AlertTriangle, X, ChevronRight, TrendingDown, TrendingUp,
  Minus, Search, Star, Calendar
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer
} from "recharts";
import { motion } from "framer-motion";

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.07 } } };

// ─────────────────────────────────────────────────────────────
// Helpers mensaje del día
// ─────────────────────────────────────────────────────────────

/** Hash determinístico — mismo resultado toda la jornada para ese usuario */
function hashDia(semilla: string): number {
  let h = 0;
  for (let i = 0; i < semilla.length; i++) {
    h = ((h << 5) - h + semilla.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Elige un mensaje diferente cada día y diferente para cada usuario */
function elegirMensajeDelDia(mensajes: MensajeMotivacional[], userId: string, nombre: string): MensajeMotivacional | null {
  if (!mensajes.length) return null;
  const hoy = new Date();
  const semilla = `${userId}${nombre}${hoy.getFullYear()}${hoy.getMonth()}${hoy.getDate()}`;
  return mensajes[hashDia(semilla) % mensajes.length];
}

/** 2 de cada 3 días incluye el día de la semana en el saludo */
function incluirDiaEnSaludo(userId: string, nombre: string): boolean {
  const hoy = new Date();
  const semilla = `dia${userId}${nombre}${hoy.toDateString()}`;
  return hashDia(semilla) % 3 !== 0;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface MensajeMotivacional {
  id: number;
  mensaje: string;
  categoria: string;
}
interface Cumpleaños {
  id: string;
  nombre: string;
  apellido: string | null;
  nombre_completo: string;
  cargo: string | null;
  diasFaltantes: number;
  mes: number;
  dia: number;
}
interface Tarea {
  id: string;
  titulo: string;
  nombre?: string;
  prioridad?: string;
  fecha_limite?: string;
  estado?: string;
  completado?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Animated counter
// ─────────────────────────────────────────────────────────────
function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    let current = 0;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      current += step;
      if (current >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(current));
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display.toLocaleString("es-CL")}</>;
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [alertasOcultas, setAlertasOcultas] = useState<string[]>([]);
  const [fechaActual, setFechaActual] = useState("");
  const [mensajeHoy, setMensajeHoy] = useState<MensajeMotivacional | null>(null);
  const [conDiaEnSaludo, setConDiaEnSaludo] = useState(true);

  // ── Personal
  const [misTareas, setMisTareas] = useState<Tarea[]>([]);
  const [misMensajes, setMisMensajes] = useState(0);
  const [misNotificaciones, setMisNotificaciones] = useState(0);
  const [misCapacitaciones, setMisCapacitaciones] = useState<any[]>([]);
  const [miProximoCumpleaños, setMiProximoCumpleaños] = useState<any>(null);

  // ── Chat feed
  const [mensajesRecientes, setMensajesRecientes] = useState<any[]>([]);

  // ── Tareas chart
  const [tareasChart, setTareasChart] = useState<{ name: string; value: number; color: string }[]>([]);

  // ── Cumpleaños
  const [cumpleañosProximos, setCumpleañosProximos] = useState<Cumpleaños[]>([]);
  const [productosSinStock, setProductosSinStock] = useState(0);
  const [cumpleHoy, setCumpleHoy] = useState<Cumpleaños[]>([]);

  // ── Global KPIs
  const [totalEmpleados, setTotalEmpleados] = useState(0);
  const [totalProveedores, setTotalProveedores] = useState(0);
  const [totalProductos, setTotalProductos] = useState(0);
  const [capacitacionesProximas, setCapacitacionesProximas] = useState<any[]>([]);

  // ── Proveedores chart
  const [proveedoresPorCat, setProveedoresPorCat] = useState<{ name: string; total: number }[]>([]);
  const [avgCalificacion, setAvgCalificacion] = useState(0);

  // ── Historial precios
  const [historial, setHistorial] = useState<{ bajas: number; subidas: number; estables: number; ahorro: number; total: number } | null>(null);
  const [historialLoading, setHistorialLoading] = useState(false);

  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const ops: Intl.DateTimeFormatOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    setFechaActual(new Date().toLocaleDateString("es-ES", ops));
    cargarDatos();
  }, []);

  // Load historial separately (processed endpoint, independent)
  useEffect(() => {
    if (!loading) cargarHistorial();
  }, [loading]);

  const cargarHistorial = async () => {
    setHistorialLoading(true);
    try {
      const res = await fetch("/api/analizar-precios");
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        setHistorial({
          bajas: json.filter((d: any) => d.tendencia === "BAJA").length,
          subidas: json.filter((d: any) => d.tendencia === "SUBE").length,
          estables: json.filter((d: any) => d.tendencia === "MANTIENE" || !d.tendencia).length,
          ahorro: json
            .filter((d: any) => d.tendencia === "BAJA")
            .reduce((s: number, d: any) => s + Math.abs(d.diferencia || 0), 0),
          total: json.length,
        });
      }
    } catch { /* silent on dashboard */ }
    setHistorialLoading(false);
  };

  const formatearFecha = (fecha?: string | null) => {
    if (!fecha) return "—";
    try { return new Date(fecha).toLocaleDateString("es-CL"); } catch { return "—"; }
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const { data: perfil, error: perfilError } = await supabase
        .from("perfiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (perfilError || !perfil) { router.push("/login"); return; }
      setUserName(perfil.nombre);
      setUserRole(perfil.rol);
      setConDiaEnSaludo(incluirDiaEnSaludo(session.user.id, perfil.nombre));

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      // ── Fetch all in parallel ──────────────────────────────
      // Mensajes motivacionales del día
      const { data: frasesData } = await supabase
        .from("mensajes_motivacionales")
        .select("id, mensaje, categoria")
        .eq("activo", true);
      if (frasesData?.length) {
        setMensajeHoy(elegirMensajeDelDia(frasesData as MensajeMotivacional[], session.user.id, perfil.nombre));
      }

      const [
        { data: todosPerfiles },
        { data: tareasData },
        { count: mensajesCount },
        { data: mensajesData },
        { count: notifCount },
        { data: caps },
        misCapsResult,
        { count: empCount },
        { data: proveedoresData },
        { count: prodTotal },
        { count: sinStock },
      ] = await Promise.all([
        supabase.from("perfiles").select("id,nombre,apellido,fecha_nacimiento,cargo").eq("activo", true),
        supabase.from("tareas").select("*").eq("asignado_a", perfil.id),
        supabase.from("mensajes").select("*", { count: "exact", head: true }).eq("receptor_id", session.user.id).eq("leido", false),
        supabase.from("mensajes").select("id,contenido,created_at,emisor_id,leido").eq("receptor_id", session.user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("notificaciones").select("*", { count: "exact", head: true }).eq("usuario_id", perfil.id).eq("leida", false),
        supabase.from("capacitaciones").select("*").gte("fecha_inicio", hoy.toISOString().split("T")[0]).eq("activo", true).order("fecha_inicio", { ascending: true }).limit(5),
        perfil.empleado_id
          ? supabase.from("empleados_capacitaciones").select(`id,completado,capacitacion_id,capacitaciones!inner(id,nombre,fecha_inicio,horas_total,activo)`).eq("empleado_id", perfil.empleado_id).eq("completado", false)
          : Promise.resolve({ data: [] }),
        supabase.from("perfiles").select("id", { count: "exact", head: true }).eq("activo", true),
        supabase.from("proveedores").select("id,nombre_empresa,categoria,calificacion,activo,created_at").eq("activo", true),
        supabase.from("productos_obuma").select("id", { count: "exact", head: true }).eq("activo", true),
        supabase.from("productos_obuma").select("id", { count: "exact", head: true }).eq("activo", true).eq("inventariable", true).eq("stock_actual", 0),
      ]);

      setCapacitacionesProximas(caps || []);

      const misCapsData = (misCapsResult as any).data;
      if (misCapsData && misCapsData.length > 0) {
        const filtradas = (misCapsData as any[])
          .map((i) => i.capacitaciones)
          .filter((c: any) => c && c.fecha_inicio && new Date(c.fecha_inicio) >= hoy && c.activo)
          .sort((a: any, b: any) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())
          .slice(0, 3);
        setMisCapacitaciones(filtradas);
      }

      setMisMensajes(mensajesCount || 0);
      setMisNotificaciones(notifCount || 0);

      // Enrich mensajes with sender names
      if (mensajesData && todosPerfiles) {
        const perfilMap = new Map((todosPerfiles as any[]).map((p) => [p.id, p]));
        setMensajesRecientes((mensajesData as any[]).map((m) => ({ ...m, emisor: perfilMap.get(m.emisor_id) || null })));
      }

      // Tareas
      const pendientes = (tareasData || []).filter((t: any) =>
        t.estado === "pendiente" || t.estado === "Pendiente" || t.completado === false
      );
      setMisTareas(pendientes);

      const alta = pendientes.filter((t: any) => (t.prioridad || "").toLowerCase() === "alta").length;
      const media = pendientes.filter((t: any) => (t.prioridad || "").toLowerCase() === "media").length;
      const baja = pendientes.filter((t: any) => (t.prioridad || "").toLowerCase() === "baja").length;
      const sinPrioridad = pendientes.length - alta - media - baja;
      setTareasChart([
        ...(alta > 0 ? [{ name: "Alta", value: alta, color: "#EF4444" }] : []),
        ...(media > 0 ? [{ name: "Media", value: media, color: "#F59E0B" }] : []),
        ...(baja > 0 ? [{ name: "Baja", value: baja, color: "#22C55E" }] : []),
        ...(sinPrioridad > 0 ? [{ name: "Sin prioridad", value: sinPrioridad, color: "#94A3B8" }] : []),
      ]);

      // Cumpleaños
      const cumpleArr: Cumpleaños[] = [];
      for (const p of (todosPerfiles as any[]) || []) {
        if (!p.fecha_nacimiento) continue;
        try {
          const fn = new Date(p.fecha_nacimiento);
          if (isNaN(fn.getTime())) continue;
          const prox = new Date(hoy.getFullYear(), fn.getMonth(), fn.getDate());
          if (prox < hoy) prox.setFullYear(prox.getFullYear() + 1);
          const dias = Math.ceil((prox.getTime() - hoy.getTime()) / 86400000);
          if (dias <= 60) {
            cumpleArr.push({ id: p.id, nombre: p.nombre, apellido: p.apellido, nombre_completo: `${p.nombre} ${p.apellido || ""}`.trim(), cargo: p.cargo, diasFaltantes: dias, mes: fn.getMonth() + 1, dia: fn.getDate() });
          }
        } catch { /* skip */ }
      }
      cumpleArr.sort((a, b) => a.diasFaltantes - b.diasFaltantes);
      setCumpleañosProximos(cumpleArr);
      setCumpleHoy(cumpleArr.filter((c) => c.diasFaltantes === 0));

      if (perfil.fecha_nacimiento) {
        try {
          const fn = new Date(perfil.fecha_nacimiento);
          if (!isNaN(fn.getTime())) {
            const prox = new Date(hoy.getFullYear(), fn.getMonth(), fn.getDate());
            if (prox < hoy) prox.setFullYear(prox.getFullYear() + 1);
            setMiProximoCumpleaños({ dias: Math.ceil((prox.getTime() - hoy.getTime()) / 86400000), fecha: prox });
          }
        } catch { /* skip */ }
      }

      setTotalEmpleados(empCount || 0);
      setTotalProductos(prodTotal || 0);
      setProductosSinStock(sinStock || 0);

      const provList = (proveedoresData as any[]) || [];
      setTotalProveedores(provList.length);

      // Proveedores por categoría
      const catMap = new Map<string, number>();
      for (const p of provList) {
        const cat = p.categoria || "Sin categoría";
        catMap.set(cat, (catMap.get(cat) || 0) + 1);
      }
      setProveedoresPorCat(
        Array.from(catMap.entries())
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 8)
      );

      const califs = provList.map((p: any) => p.calificacion || 0).filter((c: number) => c > 0);
      if (califs.length > 0) setAvgCalificacion(Math.round((califs.reduce((a: number, b: number) => a + b, 0) / califs.length) * 10) / 10);

    } catch (err) {
      console.error("Error cargando dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Alertas
  // ─────────────────────────────────────────────────────────────
  const tareasAlta = misTareas.filter((t) => (t.prioridad || "").toLowerCase() === "alta").length;

  type AlertaTipo = "error" | "warning" | "success" | "info";
  interface Alerta { id: string; tipo: AlertaTipo; icon: any; texto: string; accion?: () => void; cta?: string; }
  const alertas: Alerta[] = [];
  if (tareasAlta > 0)
    alertas.push({ id: "tareas-alta", tipo: "error", icon: AlertTriangle, texto: `Tienes ${tareasAlta} tarea${tareasAlta > 1 ? "s" : ""} de alta prioridad pendiente${tareasAlta > 1 ? "s" : ""}.`, accion: () => router.push("/tareas"), cta: "Ver tareas" });
  if (productosSinStock > 0)
    alertas.push({ id: "sin-stock", tipo: "warning", icon: Package, texto: `${productosSinStock.toLocaleString("es-CL")} producto${productosSinStock > 1 ? "s" : ""} sin stock en catálogo.`, accion: () => router.push("/obuma-productos"), cta: "Revisar" });
  if (cumpleHoy.length > 0)
    alertas.push({ id: "cumple-hoy", tipo: "success", icon: Cake, texto: `🎉 Hoy cumple${cumpleHoy.length > 1 ? "n" : ""} ${cumpleHoy.map((c) => c.nombre).join(", ")}. ¡No olvides saludar!` });
  if (miProximoCumpleaños?.dias === 0)
    alertas.push({ id: "mi-cumple", tipo: "success", icon: Gift, texto: "¡Feliz cumpleaños! Hoy es tu día especial 🎂" });

  const alertasVisibles = alertas.filter((a) => !alertasOcultas.includes(a.id));
  const alertStyles: Record<AlertaTipo, string> = {
    error: "bg-rose-50 border-[#EF4444] text-rose-800",
    warning: "bg-amber-50 border-[#F59E0B] text-amber-800",
    success: "bg-emerald-50 border-[#22C55E] text-emerald-800",
    info: "bg-slate-50 border-slate-300 text-slate-700",
  };
  const alertIconColor: Record<AlertaTipo, string> = {
    error: "text-[#EF4444]", warning: "text-[#F59E0B]", success: "text-[#22C55E]", info: "text-slate-500",
  };
  const rolLabel = ({ admin: "Administrador", superuser: "Super Usuario", vendedor: "Vendedor", rrhh: "Recursos Humanos", jefe: "Jefatura" } as Record<string, string>)[userRole] ?? "Usuario";

  // ─────────────────────────────────────────────────────────────
  // Loading screen
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="relative mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#6366F1] flex items-center justify-center shadow-lg shadow-emerald-900/20">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <Loader2 className="w-20 h-20 animate-spin text-[#4F46E5]/30 absolute -top-3 -left-3" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">Cargando tu espacio…</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="max-w-[1600px] mx-auto space-y-6"
    >

      {/* ── Welcome banner ───────────────────────────────────────────── */}
      <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#111827] via-[#1E293B] to-[#111827] p-6 md:p-8 shadow-xl shadow-slate-900/20">
        {/* Orbes de fondo */}
        <div className="absolute -top-20 -right-10 w-72 h-72 bg-[#6366F1]/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-10 w-72 h-72 bg-[#4F46E5]/10 blur-[100px] rounded-full pointer-events-none" />
        {mensajeHoy && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 blur-[60px] rounded-full pointer-events-none" />
        )}

        <div className="relative">
          {/* Cabecera: saludo + rol */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#EEF2FF] text-[#4F46E5] px-2.5 py-1 rounded-full">
                <Sparkles className="w-3 h-3" /> Comercial MP Workspace
              </span>

              {/* Saludo personalizado */}
              <h1 className="text-2xl md:text-3xl font-black text-white mt-3 leading-tight">
                {conDiaEnSaludo ? (
                  <>
                    Hola,{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] to-[#818CF8]">
                      {userName}
                    </span>{' '}
                    <span className="text-slate-400 text-xl font-light">
                      — hoy es{' '}
                      <span className="capitalize">
                        {new Date().toLocaleDateString('es-ES', { weekday: 'long' })}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    Hola,{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] to-[#818CF8]">
                      {userName}
                    </span>{' '}
                    <span className="text-2xl">👋</span>
                  </>
                )}
              </h1>
              <p className="text-slate-500 text-xs mt-1 capitalize">{fechaActual}</p>
            </div>

            <span className="bg-white/10 backdrop-blur border border-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold self-start shrink-0">
              {rolLabel}
            </span>
          </div>

          {/* ── Mensaje motivacional del día ──────────────────────────── */}
          {mensajeHoy && (
            <div className="mt-6 pt-5 border-t border-white/8 animate-fade-in">
              <div className="flex items-start gap-4">
                {/* Comillas decorativas */}
                <span className="text-5xl font-black text-[#6366F1]/25 leading-none -mt-2 select-none shrink-0"
                  style={{ fontFamily: 'Georgia, serif' }}>
                  ❝
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-sm md:text-base leading-relaxed italic font-light">
                    {mensajeHoy.mensaje}
                  </p>

                  {/* Footer del quote */}
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <div className="h-px flex-1 bg-white/10 min-w-[24px]" />
                    <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold whitespace-nowrap">
                      frase del día
                    </span>
                    {{
                      licitacion:    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">📋 Licitaciones</span>,
                      equipo:        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/20">🤝 Equipo</span>,
                      logro:         <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">🏆 Logros</span>,
                      perseverancia: <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20">💪 Perseverancia</span>,
                      proposito:     <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20">🎯 Propósito</span>,
                      general:       <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/20">✨ Inspiración</span>,
                    }[mensajeHoy.categoria] ?? null}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Alertas ──────────────────────────────────────────────────── */}
      {alertasVisibles.length > 0 && (
        <motion.div variants={fadeUp} className="space-y-2.5">
          {alertasVisibles.map((a) => (
            <div key={a.id} className={`flex items-center gap-3 border-l-4 rounded-2xl px-4 py-3 shadow-sm animate-in fade-in slide-in-from-top-1 ${alertStyles[a.tipo]}`}>
              <a.icon className={`w-5 h-5 flex-shrink-0 ${alertIconColor[a.tipo]}`} />
              <p className="text-sm font-semibold flex-1">{a.texto}</p>
              {a.accion && (
                <button onClick={a.accion} className="text-xs font-bold flex items-center gap-1 hover:underline whitespace-nowrap">
                  {a.cta} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setAlertasOcultas((s) => [...s, a.id])} className="opacity-40 hover:opacity-100 transition-opacity">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MODULE KPI CARDS — 5 módulos principales                      */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Chat */}
        <div
          onClick={() => router.push("/chat")}
          className="group relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
          style={{ animationDelay: "0ms", animationFillMode: "both" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-sky-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center mb-3">
            <MessageSquare className="w-5 h-5 text-sky-600" />
          </div>
          <p className="text-3xl font-black text-[#111827] tabular-nums"><AnimatedNumber value={misMensajes} /></p>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">Chat Interno</p>
          <p className="text-[10px] text-sky-500 font-bold mt-1">mensajes nuevos</p>
          <ArrowRight className="w-4 h-4 text-slate-200 group-hover:text-sky-500 absolute top-5 right-5 transition-colors" />
        </div>

        {/* Tareas */}
        <div
          onClick={() => router.push("/tareas")}
          className="group relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
          style={{ animationDelay: "60ms", animationFillMode: "both" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
            <ClipboardCheck className="w-5 h-5 text-[#4F46E5]" />
          </div>
          <p className="text-3xl font-black text-[#111827] tabular-nums"><AnimatedNumber value={misTareas.length} /></p>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">Tareas</p>
          <p className="text-[10px] text-[#4F46E5] font-bold mt-1">pendientes</p>
          <ArrowRight className="w-4 h-4 text-slate-200 group-hover:text-[#4F46E5] absolute top-5 right-5 transition-colors" />
        </div>

        {/* Buscador */}
        <div
          onClick={() => router.push("/buscador-productos")}
          className="group relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
          style={{ animationDelay: "120ms", animationFillMode: "both" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-teal-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center mb-3">
            <Search className="w-5 h-5 text-teal-600" />
          </div>
          <p className="text-3xl font-black text-[#111827] tabular-nums"><AnimatedNumber value={totalProductos} /></p>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">Buscador</p>
          <p className="text-[10px] text-teal-500 font-bold mt-1">
            {productosSinStock > 0 ? `${productosSinStock} sin stock` : "catálogo activo"}
          </p>
          <ArrowRight className="w-4 h-4 text-slate-200 group-hover:text-teal-500 absolute top-5 right-5 transition-colors" />
        </div>

        {/* Historial Precios */}
        <div
          onClick={() => router.push("/historial-precios")}
          className="group relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
          style={{ animationDelay: "180ms", animationFillMode: "both" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-violet-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mb-3">
            <TrendingDown className="w-5 h-5 text-violet-600" />
          </div>
          {historialLoading ? (
            <div className="h-9 flex items-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
          ) : (
            <p className="text-3xl font-black text-[#111827] tabular-nums"><AnimatedNumber value={historial?.bajas ?? 0} /></p>
          )}
          <p className="text-xs text-slate-500 font-semibold mt-0.5">Historial Precios</p>
          <p className="text-[10px] text-violet-500 font-bold mt-1">productos con baja</p>
          <ArrowRight className="w-4 h-4 text-slate-200 group-hover:text-violet-500 absolute top-5 right-5 transition-colors" />
        </div>

        {/* Proveedores */}
        <div
          onClick={() => router.push("/proveedores")}
          className="group relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 col-span-2 sm:col-span-1"
          style={{ animationDelay: "240ms", animationFillMode: "both" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-slate-700/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <Building2 className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-3xl font-black text-[#111827] tabular-nums"><AnimatedNumber value={totalProveedores} /></p>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">Proveedores</p>
          <p className="text-[10px] text-slate-500 font-bold mt-1">
            {avgCalificacion > 0 ? `⭐ ${avgCalificacion} promedio` : "activos"}
          </p>
          <ArrowRight className="w-4 h-4 text-slate-200 group-hover:text-slate-600 absolute top-5 right-5 transition-colors" />
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ANALYTICS: Tareas chart | Chat feed | Proveedores chart        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Tareas por prioridad (Donut) ───────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-[#4F46E5] flex items-center justify-center flex-shrink-0">
              <ClipboardCheck size={17} />
            </span>
            <div>
              <h2 className="font-bold text-[#111827] text-sm leading-tight">Tareas Pendientes</h2>
              <p className="text-[10px] text-slate-400">por prioridad</p>
            </div>
            <button onClick={() => router.push("/tareas")} className="ml-auto text-[10px] text-[#4F46E5] font-bold flex items-center gap-0.5 hover:underline">
              Ver todas <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {misTareas.length > 0 ? (
            <>
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0" style={{ width: 130, height: 130 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tareasChart}
                        cx="50%" cy="50%"
                        innerRadius={38} outerRadius={55}
                        paddingAngle={3}
                        dataKey="value"
                        animationBegin={200}
                        animationDuration={800}
                      >
                        {tareasChart.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} strokeWidth={0} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: any) => [`${v} tarea${v > 1 ? "s" : ""}`, ""]}
                        contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px #0001", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  {tareasChart.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                        <span className="text-xs text-slate-600 font-medium">{item.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-800 tabular-nums">{item.value}</span>
                    </div>
                  ))}
                  <div className="mt-1 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-semibold">Total</span>
                    <span className="text-sm font-black text-[#111827]">{misTareas.length}</span>
                  </div>
                </div>
              </div>
              {/* Top 3 tareas */}
              <div className="mt-4 space-y-2">
                {misTareas.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    onClick={() => router.push(`/tareas/${t.id}`)}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 cursor-pointer transition-colors group"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${(t.prioridad || "").toLowerCase() === "alta" ? "bg-[#EF4444]" : (t.prioridad || "").toLowerCase() === "media" ? "bg-[#F59E0B]" : "bg-[#22C55E]"}`} />
                    <p className="text-xs text-slate-700 font-medium truncate flex-1">{t.titulo || t.nombre || "Tarea"}</p>
                    {t.fecha_limite && <p className="text-[10px] text-slate-400 whitespace-nowrap">{formatearFecha(t.fecha_limite)}</p>}
                    <Clock size={11} className="text-[#4F46E5] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-[#22C55E] opacity-40" />
              <p className="font-medium text-sm">¡Sin tareas pendientes!</p>
              <p className="text-xs mt-0.5">Todo al día ✨</p>
            </div>
          )}
        </div>

        {/* ── Chat Interno - feed ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center flex-shrink-0">
              <MessageSquare size={17} />
            </span>
            <div>
              <h2 className="font-bold text-[#111827] text-sm leading-tight">Chat Interno</h2>
              <p className="text-[10px] text-slate-400">mensajes recientes</p>
            </div>
            <button onClick={() => router.push("/chat")} className="ml-auto text-[10px] text-sky-500 font-bold flex items-center gap-0.5 hover:underline">
              Abrir <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {misMensajes > 0 && (
            <div className="mb-3 flex items-center gap-2 bg-sky-50 rounded-xl px-3 py-2.5">
              <Bell className="w-4 h-4 text-sky-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-sky-700">
                <span className="font-black">{misMensajes}</span> mensaje{misMensajes > 1 ? "s" : ""} sin leer
              </p>
            </div>
          )}

          {mensajesRecientes.length > 0 ? (
            <div className="space-y-2">
              {mensajesRecientes.map((m, idx) => {
                const nombre = m.emisor ? `${m.emisor.nombre} ${m.emisor.apellido || ""}`.trim() : "Usuario";
                const initials = nombre.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
                const ts = m.created_at ? new Date(m.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "";
                return (
                  <div
                    key={m.id}
                    onClick={() => router.push("/chat")}
                    className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${!m.leido ? "bg-sky-50 hover:bg-sky-100" : "hover:bg-slate-50"}`}
                    style={{ animationDelay: `${idx * 60}ms`, animationFillMode: "both" }}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-800 truncate">{nombre}</p>
                        {!m.leido && <span className="w-1.5 h-1.5 rounded-full bg-sky-500 flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{m.contenido || "…"}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">{ts}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-20" />
              <p className="font-medium text-sm">Sin mensajes recientes</p>
              <p className="text-xs mt-0.5">¡Empieza una conversación!</p>
            </div>
          )}
        </div>

        {/* ── Proveedores por categoría (BarChart) ──────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
              <Building2 size={17} />
            </span>
            <div>
              <h2 className="font-bold text-[#111827] text-sm leading-tight">Mis Proveedores</h2>
              <p className="text-[10px] text-slate-400">por categoría</p>
            </div>
            <button onClick={() => router.push("/proveedores")} className="ml-auto text-[10px] text-slate-500 font-bold flex items-center gap-0.5 hover:underline">
              Ver todos <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-[#111827] tabular-nums"><AnimatedNumber value={totalProveedores} /></p>
              <p className="text-[10px] text-slate-400 font-semibold">Activos</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-amber-700">{avgCalificacion > 0 ? avgCalificacion : "—"}</p>
              <p className="text-[10px] text-amber-500 font-semibold">⭐ Calificación</p>
            </div>
          </div>

          {proveedoresPorCat.length > 0 ? (
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={proveedoresPorCat} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip
                    formatter={(v: any) => [`${v} proveedor${v > 1 ? "es" : ""}`, ""]}
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px #0001", fontSize: 11 }}
                  />
                  <Bar dataKey="total" fill="#334155" radius={[0, 6, 6, 0]} animationBegin={300} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-300">
              <Building2 size={28} className="mx-auto mb-2" />
              <p className="text-xs font-medium">Sin datos de categorías</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* BUSCADOR + HISTORIAL PRECIOS                                  */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Buscador de Productos ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-8 h-8 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center flex-shrink-0"><Search size={17} /></span>
            <div>
              <h2 className="font-bold text-[#111827] text-sm leading-tight">Buscador de Productos</h2>
              <p className="text-[10px] text-slate-400">catálogo Obuma</p>
            </div>
            <button onClick={() => router.push("/buscador-productos")} className="ml-auto text-[10px] text-teal-500 font-bold flex items-center gap-0.5 hover:underline">
              Buscar <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 p-4 text-white text-center shadow-md shadow-teal-500/20">
              <p className="text-2xl font-black tabular-nums"><AnimatedNumber value={totalProductos} /></p>
              <p className="text-[10px] opacity-80 font-semibold mt-0.5">Total</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#4338CA] p-4 text-white text-center shadow-md shadow-emerald-500/20">
              <p className="text-2xl font-black tabular-nums"><AnimatedNumber value={Math.max(0, totalProductos - productosSinStock)} /></p>
              <p className="text-[10px] opacity-80 font-semibold mt-0.5">Con stock</p>
            </div>
            <div className={`rounded-2xl p-4 text-white text-center shadow-md ${productosSinStock > 0 ? "bg-gradient-to-br from-[#EF4444] to-[#DC2626] shadow-red-500/20" : "bg-gradient-to-br from-slate-400 to-slate-500"}`}>
              <p className="text-2xl font-black tabular-nums"><AnimatedNumber value={productosSinStock} /></p>
              <p className="text-[10px] opacity-80 font-semibold mt-0.5">Sin stock</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-400 font-semibold">Stock disponible</span>
              <span className="text-[10px] text-teal-600 font-bold">
                {totalProductos > 0 ? Math.round(((totalProductos - productosSinStock) / totalProductos) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-[#4F46E5] rounded-full transition-all duration-1000"
                style={{ width: totalProductos > 0 ? `${((totalProductos - productosSinStock) / totalProductos) * 100}%` : "0%" }}
              />
            </div>
          </div>

          {productosSinStock > 0 && (
            <button
              onClick={() => router.push("/obuma-productos")}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-[#EF4444] text-xs font-bold py-2.5 rounded-xl transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Revisar {productosSinStock} producto{productosSinStock > 1 ? "s" : ""} sin stock
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ── Historial de Precios ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0"><TrendingDown size={17} /></span>
            <div>
              <h2 className="font-bold text-[#111827] text-sm leading-tight">Historial de Precios</h2>
              <p className="text-[10px] text-slate-400">análisis de tendencias</p>
            </div>
            <button onClick={() => router.push("/historial-precios")} className="ml-auto text-[10px] text-violet-500 font-bold flex items-center gap-0.5 hover:underline">
              Ver detalle <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {historialLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
              <p className="text-xs text-slate-400">Analizando precios…</p>
            </div>
          ) : historial ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
                  <TrendingDown className="w-5 h-5 text-[#4F46E5] mx-auto mb-1" />
                  <p className="text-2xl font-black text-[#4F46E5] tabular-nums"><AnimatedNumber value={historial.bajas} /></p>
                  <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Bajaron</p>
                </div>
                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center">
                  <TrendingUp className="w-5 h-5 text-[#EF4444] mx-auto mb-1" />
                  <p className="text-2xl font-black text-[#EF4444] tabular-nums"><AnimatedNumber value={historial.subidas} /></p>
                  <p className="text-[10px] text-rose-600 font-semibold mt-0.5">Subieron</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
                  <Minus className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <p className="text-2xl font-black text-slate-600 tabular-nums"><AnimatedNumber value={historial.estables} /></p>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Sin cambio</p>
                </div>
              </div>

              <div className="mt-4" style={{ height: 90 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Bajaron", value: historial.bajas },
                      { name: "Subieron", value: historial.subidas },
                      { name: "Sin cambio", value: historial.estables },
                    ]}
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  >
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: any) => [`${v} producto${v > 1 ? "s" : ""}`, ""]}
                      contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 16px #0001", fontSize: 11 }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} animationBegin={400} animationDuration={900}>
                      {[{ fill: "#4F46E5" }, { fill: "#EF4444" }, { fill: "#94A3B8" }].map((c, i) => (
                        <Cell key={i} fill={c.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {historial.ahorro > 0 && (
                <div className="mt-3 flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2.5">
                  <Star className="w-4 h-4 text-[#4F46E5] flex-shrink-0" />
                  <p className="text-xs text-emerald-700 font-semibold">
                    Ahorro potencial: <span className="font-black">${historial.ahorro.toLocaleString("es-CL")}</span>
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-slate-300">
              <TrendingDown size={32} className="mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-400">Sin datos de historial</p>
              <p className="text-[10px] text-slate-300 mt-0.5">Usa el buscador para registrar precios</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PERSONAL: Cumpleaños | Capacitaciones | Mi fecha + notifs     */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Próximos Cumpleaños */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0"><Cake size={17} /></span>
            <h2 className="font-bold text-[#111827] text-sm">Próximos Cumpleaños</h2>
            {cumpleañosProximos.length > 0 && (
              <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">{cumpleañosProximos.length}</span>
            )}
          </div>
          {cumpleañosProximos.length > 0 ? (
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {cumpleañosProximos.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-amber-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {p.nombre.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-xs truncate">{p.nombre_completo}</p>
                    <p className="text-[10px] text-slate-400">{p.dia}/{p.mes}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${p.diasFaltantes === 0 ? "bg-amber-500 text-white animate-pulse" : p.diasFaltantes <= 7 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                    {p.diasFaltantes === 0 ? "🎉 HOY" : `${p.diasFaltantes}d`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-300">
              <Smile size={28} className="mx-auto mb-2" />
              <p className="text-xs font-medium">Sin próximos cumpleaños</p>
            </div>
          )}
        </div>

        {/* Capacitaciones */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center flex-shrink-0"><GraduationCap size={17} /></span>
            <h2 className="font-bold text-[#111827] text-sm">Capacitaciones</h2>
            <button onClick={() => router.push("/capacitaciones")} className="ml-auto text-[10px] text-sky-500 font-bold flex items-center gap-0.5 hover:underline">
              Ver <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {capacitacionesProximas.length > 0 ? (
            <div className="space-y-2">
              {capacitacionesProximas.map((cap) => (
                <div key={cap.id} className="p-3 rounded-xl bg-sky-50 hover:bg-sky-100 transition-colors">
                  <p className="font-semibold text-slate-800 text-xs">{cap.nombre}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Calendar size={10} /> {formatearFecha(cap.fecha_inicio)}
                    </p>
                    <span className="text-[10px] font-semibold text-sky-600">
                      {cap.modalidad === "presencial" ? "📌 Pres." : cap.modalidad === "online" ? "💻 Online" : "🎓 Mixto"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-300">
              <Calendar size={28} className="mx-auto mb-2" />
              <p className="text-xs font-medium">Sin capacitaciones próximas</p>
            </div>
          )}
          {misCapacitaciones.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Mis pendientes</p>
              {misCapacitaciones.map((cap, i) => (
                <div key={cap.id || i} className="flex items-center gap-2 py-1.5">
                  <Clock size={12} className="text-violet-400 flex-shrink-0" />
                  <p className="text-xs text-slate-600 font-medium truncate">{cap.nombre}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mi Fecha Especial + Notificaciones + KPIs mini */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-500 flex items-center justify-center flex-shrink-0"><Heart size={17} /></span>
            <h2 className="font-bold text-[#111827] text-sm">Mi Fecha Especial</h2>
          </div>

          {miProximoCumpleaños ? (
            <div className={`flex items-center justify-between p-4 rounded-xl ${miProximoCumpleaños.dias === 0 ? "bg-amber-100 border-2 border-amber-400" : "bg-amber-50 border border-amber-100"}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${miProximoCumpleaños.dias === 0 ? "bg-amber-500" : "bg-amber-200"}`}>
                  <Gift size={18} className={miProximoCumpleaños.dias === 0 ? "text-white" : "text-amber-600"} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{miProximoCumpleaños.dias === 0 ? "¡ES HOY! 🎉" : "Mi Cumpleaños"}</p>
                  <p className="text-[10px] text-slate-500">{miProximoCumpleaños.fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}</p>
                </div>
              </div>
              <span className="text-sm font-black text-amber-600">
                {miProximoCumpleaños.dias === 0 ? "🎊" : `en ${miProximoCumpleaños.dias}d`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <AlertCircle size={18} className="text-slate-300 flex-shrink-0" />
              <p className="text-xs text-slate-400">Sin fecha registrada · Contacta a RR.HH.</p>
            </div>
          )}

          <div
            onClick={() => router.push("/notificaciones")}
            className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all ${misNotificaciones > 0 ? "bg-amber-50 hover:bg-amber-100 border border-amber-100" : "bg-slate-50 hover:bg-slate-100"}`}
          >
            <Bell className={`w-5 h-5 flex-shrink-0 ${misNotificaciones > 0 ? "text-amber-500" : "text-slate-400"}`} />
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-700">Notificaciones</p>
              <p className="text-[10px] text-slate-400">{misNotificaciones > 0 ? `${misNotificaciones} sin leer` : "Todo al día"}</p>
            </div>
            {misNotificaciones > 0 && (
              <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                {misNotificaciones > 9 ? "9+" : misNotificaciones}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            <div className="bg-gradient-to-br from-[#4F46E5] to-[#4338CA] rounded-xl p-3 text-white">
              <Users size={14} className="mb-1 opacity-80" />
              <p className="text-lg font-black tabular-nums"><AnimatedNumber value={totalEmpleados} /></p>
              <p className="text-[9px] opacity-70 font-semibold">Colaboradores</p>
            </div>
            <div className="bg-gradient-to-br from-[#111827] to-[#374151] rounded-xl p-3 text-white">
              <Package size={14} className="mb-1 opacity-80" />
              <p className="text-lg font-black tabular-nums"><AnimatedNumber value={totalProveedores} /></p>
              <p className="text-[9px] opacity-70 font-semibold">Proveedores</p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
