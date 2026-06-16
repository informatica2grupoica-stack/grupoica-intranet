"use client";
// app/(dashboard)/licitaciones-mp/page.tsx — Hub Licitaciones MP · Sprint 1

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gavel, RefreshCw, ChevronDown, ChevronUp, Search,
  Loader2, AlertTriangle, CheckCircle2, XCircle,
  Clock, Zap, Target, TrendingUp, ExternalLink,
  Filter, X, FileText, Download, FolderOpen,
  ShieldCheck, Wrench, ClipboardList, FileCheck, Archive, HelpCircle,
} from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Oportunidad {
  OPPORTUNITY_ID: string;
  OPPORTUNITY_NAME: string;
  OPPORTUNITY_CLOSING_DATE?: string;
  BUDGET?: number;
  CATEGORY_NAME?: string;
  ENTITY_NAME?: string;
  REGION_NAME?: string;
  MEMBER_NAME?: string;
  USER_MAIL?: string;
  MEMBER_ACTIVE?: string | boolean;
  TAG_NAME?: string;
  GESTION?: string;
  [key: string]: any;
}

type PipelineEstado = "sin_iniciar" | "clasificando" | "viable" | "en_oferta" | "descartada";
interface PipelineItem { id: string; estado: PipelineEstado; updatedAt: string; }

type TipoDoc =
  | "BASES_ADMINISTRATIVAS" | "BASES_TECNICAS" | "CRITERIOS_EVALUACION"
  | "ANEXOS_OFERENTE" | "DOCUMENTOS_PROCESO" | "OTROS";

interface DocClasificado {
  nombre: string;
  tipo_doc: TipoDoc;
  confianza: number;
  escaneado: boolean;
  contiene_tecnicas_integradas: boolean;
  contiene_anexos_integrados: boolean;
  razon: string;
  n_paginas: number;
  extension: string;
}

interface ClasificacionResult {
  success: boolean;
  codigo: string;
  total: number;
  resultado: DocClasificado[];
  cajas: Record<TipoDoc, DocClasificado[]>;
  clasificadoAt: string;
}

// ─── Config pipeline ─────────────────────────────────────────────────────────
const PIPELINE: { key: PipelineEstado; label: string; color: string; icon: React.ElementType }[] = [
  { key: "sin_iniciar",  label: "Sin iniciar",  color: "bg-slate-100 text-slate-500 ring-slate-200", icon: Clock },
  { key: "clasificando", label: "Clasificando", color: "bg-amber-50  text-amber-600  ring-amber-200", icon: Zap },
  { key: "viable",       label: "Viable",       color: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: CheckCircle2 },
  { key: "en_oferta",   label: "En Oferta",    color: "bg-blue-50   text-blue-700   ring-blue-200", icon: Target },
  { key: "descartada",   label: "Descartada",   color: "bg-red-50    text-red-600    ring-red-200", icon: XCircle },
];
const PIPELINE_MAP = Object.fromEntries(PIPELINE.map(p => [p.key, p]));

// ─── Config cajas clasificación ───────────────────────────────────────────────
const CAJAS_CONFIG: { key: TipoDoc; label: string; bg: string; ring: string; text: string; icon: React.ElementType }[] = [
  { key: "BASES_ADMINISTRATIVAS", label: "Bases Administrativas", bg: "bg-blue-50",    ring: "ring-blue-200",    text: "text-blue-800",    icon: ShieldCheck },
  { key: "BASES_TECNICAS",        label: "Bases Técnicas",        bg: "bg-purple-50",  ring: "ring-purple-200",  text: "text-purple-800",  icon: Wrench },
  { key: "CRITERIOS_EVALUACION",  label: "Criterios Evaluación",  bg: "bg-amber-50",   ring: "ring-amber-200",   text: "text-amber-800",   icon: ClipboardList },
  { key: "ANEXOS_OFERENTE",       label: "Anexos Oferente",       bg: "bg-emerald-50", ring: "ring-emerald-200", text: "text-emerald-800", icon: FileCheck },
  { key: "DOCUMENTOS_PROCESO",    label: "Docs. Proceso",         bg: "bg-slate-50",   ring: "ring-slate-200",   text: "text-slate-700",   icon: Archive },
  { key: "OTROS",                 label: "Otros",                 bg: "bg-rose-50",    ring: "ring-rose-200",    text: "text-rose-700",    icon: HelpCircle },
];
const LS_PIPELINE  = "ica_licmp_pipeline_v1";
const LS_CLASIF    = "ica_licmp_clasif_v1";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n?: number) {
  if (!n) return "—";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}
function daysLeft(s?: string) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}
function confColor(c: number) {
  if (c >= 0.85) return "text-emerald-600";
  if (c >= 0.6)  return "text-amber-600";
  return "text-rose-500";
}

// ─── Componentes pequeños ─────────────────────────────────────────────────────
function PipelineBadge({ estado, onClick }: { estado: PipelineEstado; onClick?: () => void }) {
  const cfg = PIPELINE_MAP[estado];
  const Icon = cfg.icon;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ${cfg.color} hover:opacity-80 cursor-pointer transition-all`}
    >
      <Icon className="w-3 h-3" />{cfg.label}
    </button>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function LicitacionesMPPage() {
  const [rows, setRows]           = useState<Oportunidad[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [pipeline, setPipeline]   = useState<Record<string, PipelineItem>>({});
  const [clasifCache, setClasifCache] = useState<Record<string, ClasificacionResult>>({});

  // Filtros
  const [busqueda, setBusqueda]       = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<PipelineEstado | "">("");
  const [miembroFiltro, setMiembroFiltro] = useState("");
  const [filtrosOpen, setFiltrosOpen] = useState(false);

  // Tabla
  const [sortCol, setSortCol]       = useState("OPPORTUNITY_CLOSING_DATE");
  const [sortDir, setSortDir]       = useState<"asc" | "desc">("asc");
  const [selected, setSelected]     = useState<Oportunidad | null>(null);
  const [editEstado, setEditEstado] = useState<string | null>(null);

  // Acciones sobre docs
  const [descargando, setDescargando]     = useState<string | null>(null);
  const [clasificando, setClasificando]   = useState<string | null>(null);
  const [errorAccion, setErrorAccion]     = useState<string | null>(null);
  const [tabModal, setTabModal]           = useState<"info" | "docs">("info");

  // ── Persistencia ──
  useEffect(() => {
    try {
      const p = localStorage.getItem(LS_PIPELINE);
      if (p) setPipeline(JSON.parse(p));
      const c = localStorage.getItem(LS_CLASIF);
      if (c) setClasifCache(JSON.parse(c));
    } catch {}
  }, []);

  const savePipeline = useCallback((next: Record<string, PipelineItem>) => {
    setPipeline(next);
    try { localStorage.setItem(LS_PIPELINE, JSON.stringify(next)); } catch {}
  }, []);

  const saveClasif = useCallback((codigo: string, data: ClasificacionResult) => {
    setClasifCache(prev => {
      const next = { ...prev, [codigo]: data };
      try { localStorage.setItem(LS_CLASIF, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Fetch BI ──
  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch("/api/bi-export");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      setRows(json.rows ?? []);
      setFetchedAt(json.fetchedAt ?? null);
    } catch (e: any) {
      setError(e.message || "No se pudo cargar");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Computed ──
  const getEstado = useCallback((id: string): PipelineEstado => pipeline[id]?.estado ?? "sin_iniciar", [pipeline]);

  const miembros = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => { if (r.MEMBER_NAME) s.add(r.MEMBER_NAME); });
    return [...s].sort();
  }, [rows]);

  const filtradas = useMemo(() => {
    let list = rows.filter(r => r.MEMBER_NAME || r.USER_MAIL);
    if (busqueda) {
      const q = busqueda.toLowerCase();
      list = list.filter(r =>
        (r.OPPORTUNITY_NAME || "").toLowerCase().includes(q) ||
        (r.ENTITY_NAME || "").toLowerCase().includes(q) ||
        (r.CATEGORY_NAME || "").toLowerCase().includes(q)
      );
    }
    if (estadoFiltro) list = list.filter(r => getEstado(r.OPPORTUNITY_ID) === estadoFiltro);
    if (miembroFiltro) list = list.filter(r => r.MEMBER_NAME === miembroFiltro);
    return [...list].sort((a, b) => {
      let va = (a[sortCol] ?? ""), vb = (b[sortCol] ?? "");
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      return sortDir === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
  }, [rows, busqueda, estadoFiltro, miembroFiltro, sortCol, sortDir, getEstado]);

  const kpis = useMemo(() => ({
    total:       filtradas.length,
    viables:     filtradas.filter(r => getEstado(r.OPPORTUNITY_ID) === "viable").length,
    enOferta:    filtradas.filter(r => getEstado(r.OPPORTUNITY_ID) === "en_oferta").length,
    urgentes:    filtradas.filter(r => { const d = daysLeft(r.OPPORTUNITY_CLOSING_DATE); return d !== null && d <= 3 && d >= 0; }).length,
    presupTotal: filtradas.reduce((s, r) => s + (r.BUDGET || 0), 0),
  }), [filtradas, getEstado]);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }
  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-blue-500" /> : <ChevronDown className="w-3 h-3 text-blue-500" />;
  }

  function setEstadoRow(id: string, estado: PipelineEstado) {
    savePipeline({ ...pipeline, [id]: { id, estado, updatedAt: new Date().toISOString() } });
  }

  // ── Descargar documentos ──
  async function descargarDocs(codigo: string) {
    setDescargando(codigo); setErrorAccion(null);
    try {
      const res = await fetch(`/api/licitapyme/documentos/auto-descargar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
    } catch (e: any) {
      setErrorAccion(e.message || "Error al descargar");
    } finally { setDescargando(null); }
  }

  // ── Clasificar documentos ──
  async function clasificarDocs(codigo: string) {
    setClasificando(codigo); setErrorAccion(null);
    try {
      const res = await fetch(`/api/licitapyme/documentos/clasificar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      saveClasif(codigo, json as ClasificacionResult);
      setEstadoRow(codigo, "clasificando");
    } catch (e: any) {
      setErrorAccion(e.message || "Error al clasificar");
    } finally { setClasificando(null); }
  }

  const filtrosActivos = !!(busqueda || estadoFiltro || miembroFiltro);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F172A] via-[#1E3A5F] to-[#0F172A] p-6 shadow-xl"
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(ellipse at 70% 50%, #3B82F6 0%, transparent 60%)" }} />
        <div className="relative flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Gavel className="w-5 h-5 text-blue-400" />
              <span className="text-[11px] font-bold tracking-widest text-blue-400 uppercase">Hub Licitaciones</span>
            </div>
            <h2 className="text-2xl font-black text-white">Mercado Público</h2>
            <p className="text-sm text-slate-400 mt-1">Pipeline de oportunidades · {fetchedAt ? `Actualizado ${fmtDate(fetchedAt)}` : "Cargando…"}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total",     value: kpis.total,    color: "text-white" },
              { label: "Viables",   value: kpis.viables,  color: "text-emerald-400" },
              { label: "En Oferta", value: kpis.enOferta, color: "text-blue-400" },
              { label: "Urgentes",  value: kpis.urgentes, color: "text-red-400" },
            ].map(k => (
              <div key={k.label} className="bg-white/[0.06] rounded-xl px-4 py-3 text-center ring-1 ring-white/10">
                <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>
          <button onClick={fetchData} disabled={loading} className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </motion.div>

      {/* BARRA FILTROS */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, entidad o categoría…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 shadow-sm"
          />
          {busqueda && <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setFiltrosOpen(o => !o)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm border transition-colors ${filtrosActivos ? "bg-blue-600 text-white border-blue-500" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"}`}
        >
          <Filter className="w-4 h-4" />
          Filtros
          {filtrosActivos && <span className="ml-1 bg-white/30 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{[busqueda, estadoFiltro, miembroFiltro].filter(Boolean).length}</span>}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filtrosOpen ? "rotate-180" : ""}`} />
        </motion.button>
      </div>

      {/* PANEL FILTROS */}
      <AnimatePresence>
        {filtrosOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Estado Pipeline</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setEstadoFiltro("")} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!estadoFiltro ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"}`}>Todos</button>
                  {PIPELINE.map(p => { const Icon = p.icon; return (
                    <button key={p.key} onClick={() => setEstadoFiltro(p.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${estadoFiltro === p.key ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"}`}>
                      <Icon className="w-3 h-3" />{p.label}
                    </button>
                  ); })}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Miembro asignado</label>
                <select value={miembroFiltro} onChange={e => setMiembroFiltro(e.target.value)} className="w-full py-2 px-3 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40">
                  <option value="">Todos los miembros</option>
                  {miembros.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={() => { setBusqueda(""); setEstadoFiltro(""); setMiembroFiltro(""); }} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-rose-300 hover:text-rose-600 transition-colors">
                  <X className="w-3.5 h-3.5" />Limpiar filtros
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PRESUPUESTO */}
      {filtradas.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <TrendingUp className="w-4 h-4 text-slate-400" />
          <span>Presupuesto total: <strong className="text-slate-700">{fmt(kpis.presupTotal)}</strong></span>
          <span className="text-slate-300">·</span>
          <span>{filtradas.length} oportunidades</span>
        </div>
      )}

      {/* LOADING / ERROR */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando oportunidades…</span>
        </div>
      )}
      {!loading && error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">No se pudo cargar</p>
            <p className="text-xs mt-0.5 text-red-500">{error}</p>
          </div>
          <button onClick={fetchData} className="ml-auto text-xs font-bold text-red-600 hover:underline">Reintentar</button>
        </div>
      )}

      {/* TABLA */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {[
                    { col: "OPPORTUNITY_NAME",         label: "Licitación" },
                    { col: "ENTITY_NAME",              label: "Entidad" },
                    { col: "BUDGET",                   label: "Presupuesto" },
                    { col: "OPPORTUNITY_CLOSING_DATE", label: "Cierre" },
                    { col: "MEMBER_NAME",              label: "Asignado" },
                    { col: "__pipeline__",             label: "Pipeline" },
                  ].map(({ col, label }) => (
                    <th key={col} onClick={() => col !== "__pipeline__" && toggleSort(col)}
                      className={`px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap ${col !== "__pipeline__" ? "cursor-pointer hover:text-blue-600 select-none" : ""}`}
                    >
                      <span className="flex items-center gap-1">{label}{col !== "__pipeline__" && <SortIcon col={col} />}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filtradas.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-16 text-slate-400 text-sm">No hay oportunidades que coincidan.</td></tr>
                  )}
                  {filtradas.map((row, i) => {
                    const estado = getEstado(row.OPPORTUNITY_ID);
                    const days   = daysLeft(row.OPPORTUNITY_CLOSING_DATE);
                    const urgent = days !== null && days <= 3 && days >= 0;
                    const vencida = days !== null && days < 0;
                    const tieneClasif = !!clasifCache[row.OPPORTUNITY_ID];
                    return (
                      <motion.tr
                        key={row.OPPORTUNITY_ID}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -10 }}
                        transition={{ delay: i * 0.015 }}
                        className={`border-b border-slate-50 hover:bg-blue-50/30 transition-colors cursor-pointer ${estado === "descartada" ? "opacity-50" : ""}`}
                        onClick={() => { setSelected(row); setTabModal("info"); setErrorAccion(null); }}
                      >
                        <td className="px-4 py-3 max-w-[280px]">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800 truncate text-xs leading-snug">{row.OPPORTUNITY_NAME || "Sin nombre"}</p>
                            {tieneClasif && <span title="Clasificado" className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                          </div>
                          {row.CATEGORY_NAME && <p className="text-[10px] text-slate-400 truncate mt-0.5">{row.CATEGORY_NAME}</p>}
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <p className="text-xs text-slate-600 truncate">{row.ENTITY_NAME || "—"}</p>
                          {row.REGION_NAME && <p className="text-[10px] text-slate-400 truncate">{row.REGION_NAME}</p>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs font-semibold text-slate-700">{fmt(row.BUDGET)}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-xs font-medium ${urgent ? "text-red-600" : vencida ? "text-slate-400 line-through" : "text-slate-600"}`}>{fmtDate(row.OPPORTUNITY_CLOSING_DATE)}</span>
                          {days !== null && !vencida && <p className={`text-[10px] mt-0.5 ${urgent ? "text-red-500 font-bold" : "text-slate-400"}`}>{days === 0 ? "Hoy" : `${days}d`}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-600">{row.MEMBER_NAME || row.USER_MAIL || "—"}</span>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="relative">
                            <PipelineBadge estado={estado} onClick={() => setEditEstado(editEstado === row.OPPORTUNITY_ID ? null : row.OPPORTUNITY_ID)} />
                            <AnimatePresence>
                              {editEstado === row.OPPORTUNITY_ID && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 4 }}
                                  className="absolute z-20 top-8 left-0 bg-white rounded-xl shadow-xl border border-slate-200 p-2 min-w-[160px]"
                                >
                                  {PIPELINE.map(p => { const Icon = p.icon; return (
                                    <button key={p.key} onClick={() => { setEstadoRow(row.OPPORTUNITY_ID, p.key); setEditEstado(null); }}
                                      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-slate-50 ${estado === p.key ? "text-blue-600 bg-blue-50" : "text-slate-600"}`}
                                    ><Icon className="w-3.5 h-3.5" />{p.label}</button>
                                  ); })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── MODAL DETALLE ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSelected(null); setEditEstado(null); }}
            />
            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <PipelineBadge estado={getEstado(selected.OPPORTUNITY_ID)} />
                  {clasifCache[selected.OPPORTUNITY_ID] && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />Clasificado
                    </span>
                  )}
                </div>
                <button onClick={() => { setSelected(null); setEditEstado(null); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100">
                {[{ id: "info", label: "Información" }, { id: "docs", label: "Documentos" }].map(t => (
                  <button key={t.id} onClick={() => setTabModal(t.id as any)}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${tabModal === t.id ? "text-blue-600 border-b-2 border-blue-500" : "text-slate-400 hover:text-slate-600"}`}
                  >{t.label}</button>
                ))}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">

                {/* TAB INFO */}
                {tabModal === "info" && (
                  <div className="space-y-4">
                    <h4 className="text-base font-bold text-slate-800 leading-snug">{selected.OPPORTUNITY_NAME}</h4>
                    {[
                      { label: "ID",          value: selected.OPPORTUNITY_ID },
                      { label: "Entidad",     value: selected.ENTITY_NAME },
                      { label: "Región",      value: selected.REGION_NAME },
                      { label: "Categoría",   value: selected.CATEGORY_NAME },
                      { label: "Presupuesto", value: fmt(selected.BUDGET) },
                      { label: "Cierre",      value: fmtDate(selected.OPPORTUNITY_CLOSING_DATE) },
                      { label: "Asignado",    value: selected.MEMBER_NAME || selected.USER_MAIL },
                      { label: "Gestión",     value: selected.GESTION },
                      { label: "Tags",        value: selected.TAG_NAME },
                    ].filter(f => f.value).map(f => (
                      <div key={f.label} className="flex gap-3 text-sm">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-24 shrink-0 pt-0.5">{f.label}</span>
                        <span className="text-slate-700 font-medium">{f.value}</span>
                      </div>
                    ))}

                    {/* Cambiar estado */}
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Estado Pipeline</p>
                      <div className="flex flex-wrap gap-2">
                        {PIPELINE.map(p => { const Icon = p.icon; const active = getEstado(selected.OPPORTUNITY_ID) === p.key; return (
                          <button key={p.key} onClick={() => setEstadoRow(selected.OPPORTUNITY_ID, p.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"}`}
                          ><Icon className="w-3 h-3" />{p.label}</button>
                        ); })}
                      </div>
                    </div>

                    {/* Link MP */}
                    <a
                      href={`https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=${selected.OPPORTUNITY_ID}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors w-full justify-center"
                    ><ExternalLink className="w-4 h-4" />Ver en Mercado Público</a>
                  </div>
                )}

                {/* TAB DOCUMENTOS */}
                {tabModal === "docs" && (
                  <div className="space-y-4">
                    {/* Error acción */}
                    {errorAccion && (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>{errorAccion}</p>
                      </div>
                    )}

                    {/* Botones acción */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => descargarDocs(selected.OPPORTUNITY_ID)}
                        disabled={!!descargando || !!clasificando}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-blue-200 text-blue-700 text-xs font-semibold bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        {descargando === selected.OPPORTUNITY_ID ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {descargando === selected.OPPORTUNITY_ID ? "Descargando…" : "Descargar Docs"}
                      </button>
                      <button
                        onClick={() => clasificarDocs(selected.OPPORTUNITY_ID)}
                        disabled={!!clasificando || !!descargando}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-purple-200 text-purple-700 text-xs font-semibold bg-purple-50 hover:bg-purple-100 transition-colors disabled:opacity-50"
                      >
                        {clasificando === selected.OPPORTUNITY_ID ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                        {clasificando === selected.OPPORTUNITY_ID ? "Clasificando…" : "Clasificar IA"}
                      </button>
                    </div>

                    {/* Resultado clasificación */}
                    {(() => {
                      const clasif = clasifCache[selected.OPPORTUNITY_ID];
                      if (!clasif) return (
                        <div className="text-center py-10 text-slate-400">
                          <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                          <p className="text-sm font-medium">Sin clasificación aún</p>
                          <p className="text-xs mt-1">Descarga los documentos y luego haz clic en "Clasificar IA"</p>
                        </div>
                      );
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {clasif.total} documentos · {fmtDate(clasif.clasificadoAt)}
                            </p>
                            <button onClick={() => clasificarDocs(selected.OPPORTUNITY_ID)} disabled={!!clasificando} className="text-[10px] text-blue-500 hover:underline flex items-center gap-1">
                              <RefreshCw className="w-3 h-3" />Re-clasificar
                            </button>
                          </div>

                          {CAJAS_CONFIG.map(caja => {
                            const docs = clasif.cajas[caja.key] ?? [];
                            if (docs.length === 0) return null;
                            const Icon = caja.icon;
                            return (
                              <motion.div
                                key={caja.key}
                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                className={`rounded-xl ${caja.bg} ring-1 ${caja.ring} p-3`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <Icon className={`w-4 h-4 ${caja.text}`} />
                                  <span className={`text-xs font-bold ${caja.text}`}>{caja.label}</span>
                                  <span className={`ml-auto text-[10px] font-bold ${caja.text} opacity-60`}>{docs.length}</span>
                                </div>
                                <div className="space-y-1.5">
                                  {docs.map((doc, i) => (
                                    <div key={i} className="flex items-start gap-2 bg-white/60 rounded-lg px-2.5 py-1.5">
                                      <FileText className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${caja.text} opacity-60`} />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-700 truncate">{doc.nombre}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                          {doc.n_paginas > 0 && <span className="text-[10px] text-slate-400">{doc.n_paginas}p</span>}
                                          {doc.escaneado && <span className="text-[10px] text-amber-500 font-medium">OCR</span>}
                                          {doc.contiene_tecnicas_integradas && <span className="text-[10px] text-purple-500 font-medium">+Técnicas</span>}
                                          {doc.contiene_anexos_integrados && <span className="text-[10px] text-emerald-500 font-medium">+Anexos</span>}
                                          <span className={`text-[10px] font-bold ${confColor(doc.confianza)}`}>{Math.round(doc.confianza * 100)}%</span>
                                        </div>
                                        {doc.razon && <p className="text-[10px] text-slate-400 mt-0.5 italic">{doc.razon}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
