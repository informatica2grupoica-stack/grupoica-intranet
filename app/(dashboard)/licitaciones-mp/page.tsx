"use client";
// app/(dashboard)/licitaciones-mp/page.tsx — Hub Licitaciones MP · Sprint 1
// Mejoras: paginación 25/página, solo miembros activos, sin stagger en tabla,
// UI rediseñada, caché BI con SWR manual.

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gavel, RefreshCw, ChevronDown, ChevronUp, Search,
  Loader2, AlertTriangle, CheckCircle2, XCircle,
  Clock, Zap, Target, TrendingUp, ExternalLink,
  Filter, X, FileText, Download, FolderOpen,
  ShieldCheck, Wrench, ClipboardList, FileCheck, Archive, HelpCircle,
  ChevronLeft, ChevronRight as ChevronRightIcon,
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
  MEMBER_ACTIVE?: string | boolean | number;
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
  nombre: string; tipo_doc: TipoDoc; confianza: number;
  escaneado: boolean; contiene_tecnicas_integradas: boolean;
  contiene_anexos_integrados: boolean; razon: string;
  n_paginas: number; extension: string;
}
interface ClasificacionResult {
  success: boolean; codigo: string; total: number;
  resultado: DocClasificado[]; cajas: Record<TipoDoc, DocClasificado[]>;
  clasificadoAt: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;
const LS_PIPELINE = "ica_licmp_pipeline_v1";
const LS_CLASIF   = "ica_licmp_clasif_v1";

const PIPELINE: { key: PipelineEstado; label: string; color: string; dot: string; icon: React.ElementType }[] = [
  { key: "sin_iniciar",  label: "Sin iniciar",  color: "bg-slate-100 text-slate-500 ring-slate-200",        dot: "bg-slate-400",   icon: Clock },
  { key: "clasificando", label: "Clasificando", color: "bg-amber-50  text-amber-600  ring-amber-200",        dot: "bg-amber-400",   icon: Zap },
  { key: "viable",       label: "Viable",       color: "bg-emerald-50 text-emerald-700 ring-emerald-200",    dot: "bg-emerald-400", icon: CheckCircle2 },
  { key: "en_oferta",   label: "En Oferta",    color: "bg-blue-50   text-blue-700   ring-blue-200",         dot: "bg-blue-400",    icon: Target },
  { key: "descartada",   label: "Descartada",   color: "bg-red-50    text-red-500    ring-red-200",          dot: "bg-red-400",     icon: XCircle },
];
const PIPELINE_MAP = Object.fromEntries(PIPELINE.map(p => [p.key, p]));

const CAJAS: { key: TipoDoc; label: string; bg: string; ring: string; text: string; icon: React.ElementType }[] = [
  { key: "BASES_ADMINISTRATIVAS", label: "Bases Adm.",        bg: "bg-blue-50",    ring: "ring-blue-200",    text: "text-blue-800",    icon: ShieldCheck },
  { key: "BASES_TECNICAS",        label: "Bases Técnicas",    bg: "bg-purple-50",  ring: "ring-purple-200",  text: "text-purple-800",  icon: Wrench },
  { key: "CRITERIOS_EVALUACION",  label: "Criterios",         bg: "bg-amber-50",   ring: "ring-amber-200",   text: "text-amber-800",   icon: ClipboardList },
  { key: "ANEXOS_OFERENTE",       label: "Anexos Oferente",   bg: "bg-emerald-50", ring: "ring-emerald-200", text: "text-emerald-800", icon: FileCheck },
  { key: "DOCUMENTOS_PROCESO",    label: "Docs. Proceso",     bg: "bg-slate-50",   ring: "ring-slate-200",   text: "text-slate-700",   icon: Archive },
  { key: "OTROS",                 label: "Otros",             bg: "bg-rose-50",    ring: "ring-rose-200",    text: "text-rose-700",    icon: HelpCircle },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isActive(v: any): boolean {
  if (v === undefined || v === null) return true; // sin dato → mostrar
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "activo" || s === "active";
}

function fmt(n?: number) {
  if (!n) return "—";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}
function daysLeft(s?: string): number | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}
function confBadge(c: number) {
  if (c >= 0.85) return "text-emerald-600 bg-emerald-50";
  if (c >= 0.6)  return "text-amber-600 bg-amber-50";
  return "text-rose-500 bg-rose-50";
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function PipelineBadge({ estado, onClick }: { estado: PipelineEstado; onClick?: () => void }) {
  const cfg = PIPELINE_MAP[estado];
  const Icon = cfg.icon;
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ${cfg.color} hover:opacity-80 transition-opacity`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </button>
  );
}

function Paginador({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }

  return (
    <div className="flex items-center justify-between px-1 pt-3 border-t border-slate-100">
      <span className="text-xs text-slate-400">{from}–{to} de {total}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="w-8 text-center text-xs text-slate-400">…</span>
          ) : (
            <button key={n} onClick={() => onChange(n as number)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === n ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"}`}>
              {n}
            </button>
          )
        )}
        <button onClick={() => onChange(page + 1)} disabled={page === pages}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors">
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function LicitacionesMPPage() {
  const [rows, setRows]           = useState<Oportunidad[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [pipeline, setPipeline]   = useState<Record<string, PipelineItem>>({});
  const [clasifCache, setClasifCache] = useState<Record<string, ClasificacionResult>>({});

  // Filtros
  const [busqueda, setBusqueda]         = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<PipelineEstado | "">("");
  const [miembroFiltro, setMiembroFiltro] = useState("");
  const [filtrosOpen, setFiltrosOpen]   = useState(false);

  // Tabla
  const [sortCol, setSortCol] = useState("OPPORTUNITY_CLOSING_DATE");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage]       = useState(1);

  // Modal
  const [selected, setSelected]     = useState<Oportunidad | null>(null);
  const [editEstado, setEditEstado] = useState<string | null>(null);
  const [tabModal, setTabModal]     = useState<"info" | "docs">("info");
  const [descargando, setDescargando]   = useState<string | null>(null);
  const [clasificando, setClasificando] = useState<string | null>(null);
  const [errorAccion, setErrorAccion]   = useState<string | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);

  // ── Persistencia ──────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const p = localStorage.getItem(LS_PIPELINE); if (p) setPipeline(JSON.parse(p));
      const c = localStorage.getItem(LS_CLASIF);   if (c) setClasifCache(JSON.parse(c));
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

  // ── Fetch ─────────────────────────────────────────────────────────────────
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

  // ── Computed ──────────────────────────────────────────────────────────────
  const getEstado = useCallback((id: string): PipelineEstado =>
    pipeline[id]?.estado ?? "sin_iniciar", [pipeline]);

  // Solo miembros activos
  const rowsActivos = useMemo(() =>
    rows.filter(r => (r.MEMBER_NAME || r.USER_MAIL) && isActive(r.MEMBER_ACTIVE)),
  [rows]);

  const miembros = useMemo(() => {
    const s = new Set<string>();
    rowsActivos.forEach(r => { if (r.MEMBER_NAME) s.add(r.MEMBER_NAME); });
    return [...s].sort();
  }, [rowsActivos]);

  const filtradas = useMemo(() => {
    let list = rowsActivos;
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
      let va = a[sortCol] ?? "", vb = b[sortCol] ?? "";
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      return sortDir === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
  }, [rowsActivos, busqueda, estadoFiltro, miembroFiltro, sortCol, sortDir, getEstado]);

  // Reset página cuando cambian filtros
  useEffect(() => { setPage(1); }, [busqueda, estadoFiltro, miembroFiltro, sortCol, sortDir]);

  const pagina = useMemo(() =>
    filtradas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  [filtradas, page]);

  const kpis = useMemo(() => ({
    total:       filtradas.length,
    viables:     filtradas.filter(r => getEstado(r.OPPORTUNITY_ID) === "viable").length,
    enOferta:    filtradas.filter(r => getEstado(r.OPPORTUNITY_ID) === "en_oferta").length,
    urgentes:    filtradas.filter(r => { const d = daysLeft(r.OPPORTUNITY_CLOSING_DATE); return d !== null && d <= 3 && d >= 0; }).length,
    presupTotal: filtradas.reduce((s, r) => s + (r.BUDGET || 0), 0),
  }), [filtradas, getEstado]);

  function setEstadoRow(id: string, estado: PipelineEstado) {
    savePipeline({ ...pipeline, [id]: { id, estado, updatedAt: new Date().toISOString() } });
  }

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function cambiarPagina(p: number) {
    setPage(p);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Acciones docs ─────────────────────────────────────────────────────────
  async function descargarDocs(codigo: string) {
    setDescargando(codigo); setErrorAccion(null);
    try {
      const res = await fetch("/api/licitapyme/documentos/auto-descargar", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ licitacionCodigo: codigo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
    } catch (e: any) {
      setErrorAccion(e.message || "Error al descargar");
    } finally { setDescargando(null); }
  }

  async function clasificarDocs(codigo: string) {
    setClasificando(codigo); setErrorAccion(null);
    try {
      const res = await fetch("/api/licitapyme/documentos/clasificar", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      saveClasif(codigo, json as ClasificacionResult);
      if (getEstado(codigo) === "sin_iniciar") setEstadoRow(codigo, "clasificando");
    } catch (e: any) {
      setErrorAccion(e.message || "Error al clasificar");
    } finally { setClasificando(null); }
  }

  const filtrosActivos = !!(busqueda || estadoFiltro || miembroFiltro);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── HEADER ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0D1B2A] via-[#1B3A5C] to-[#0D1B2A] p-6 shadow-xl">
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(ellipse at 75% 40%, #60A5FA 0%, transparent 55%)" }} />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex-1">
            <p className="text-[11px] font-bold tracking-[0.2em] text-blue-400 uppercase mb-1 flex items-center gap-2">
              <Gavel className="w-3.5 h-3.5" /> Hub Licitaciones
            </p>
            <h2 className="text-[22px] font-black text-white leading-tight">Mercado Público</h2>
            <p className="text-[12px] text-slate-400 mt-1">
              {loading ? "Cargando…" : `${rowsActivos.length} oportunidades activas · ${fetchedAt ? `Datos de ${fmtDate(fetchedAt)}` : ""}`}
            </p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-2 lg:gap-3">
            {[
              { label: "Total",      value: kpis.total,    accent: "text-white",         bg: "bg-white/[0.07]" },
              { label: "Viables",    value: kpis.viables,  accent: "text-emerald-400",   bg: "bg-emerald-500/10" },
              { label: "En Oferta",  value: kpis.enOferta, accent: "text-sky-400",       bg: "bg-sky-500/10" },
              { label: "⚡ Urgente", value: kpis.urgentes, accent: "text-red-400",       bg: "bg-red-500/10" },
            ].map(k => (
              <div key={k.label} className={`${k.bg} rounded-xl px-3 py-3 text-center ring-1 ring-white/[0.08]`}>
                <p className={`text-xl font-black ${k.accent}`}>{k.value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{k.label}</p>
              </div>
            ))}
          </div>

          <button onClick={fetchData} disabled={loading} title="Actualizar datos"
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/[0.08] text-slate-300 hover:bg-white/[0.15] hover:text-white transition-colors disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── BARRA BÚSQUEDA + FILTROS ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar licitación, entidad o categoría…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-all" />
          {busqueda && (
            <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button onClick={() => setFiltrosOpen(o => !o)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors shadow-sm ${filtrosActivos ? "bg-blue-600 text-white border-blue-500 shadow-blue-200" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"}`}>
          <Filter className="w-4 h-4" />
          Filtros
          {filtrosActivos && (
            <span className="w-4 h-4 rounded-full bg-white/30 text-white text-[9px] font-black flex items-center justify-center">
              {[busqueda, estadoFiltro, miembroFiltro].filter(Boolean).length}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${filtrosOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* ── PANEL FILTROS ── */}
      <AnimatePresence>
        {filtrosOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Estado */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Pipeline</p>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setEstadoFiltro("")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${!estadoFiltro ? "bg-slate-800 text-white border-slate-800" : "text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                    Todos
                  </button>
                  {PIPELINE.map(p => { const Icon = p.icon; return (
                    <button key={p.key} onClick={() => setEstadoFiltro(p.key)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${estadoFiltro === p.key ? "bg-slate-800 text-white border-slate-800" : "text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                      <Icon className="w-3 h-3" />{p.label}
                    </button>
                  ); })}
                </div>
              </div>
              {/* Miembro */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Miembro activo</p>
                <select value={miembroFiltro} onChange={e => setMiembroFiltro(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30">
                  <option value="">Todos</option>
                  {miembros.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {/* Limpiar */}
              <div className="flex items-end">
                <button onClick={() => { setBusqueda(""); setEstadoFiltro(""); setMiembroFiltro(""); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-colors">
                  <X className="w-3.5 h-3.5" />Limpiar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ESTADO LOADING / ERROR ── */}
      {loading && (
        <div className="flex items-center justify-center py-24 text-slate-400 gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando oportunidades…</span>
        </div>
      )}
      {!loading && error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">No se pudo cargar</p>
            <p className="text-xs mt-0.5 text-red-400 truncate">{error}</p>
          </div>
          <button onClick={fetchData} className="text-xs font-bold text-red-500 hover:underline whitespace-nowrap">Reintentar</button>
        </div>
      )}

      {/* ── TABLA ── */}
      {!loading && !error && (
        <div ref={tableRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Meta info */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500">
                <strong className="text-slate-700 font-semibold">{filtradas.length}</strong> oportunidades
                {filtradas.length > 0 && (
                  <span className="ml-2 text-slate-400">·  presup. {fmt(kpis.presupTotal)}</span>
                )}
              </span>
            </div>
            {filtradas.length > PAGE_SIZE && (
              <span className="text-[11px] text-slate-400">
                Pág. {page}/{Math.ceil(filtradas.length / PAGE_SIZE)}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {[
                    { col: "OPPORTUNITY_NAME",         label: "Licitación",   w: "min-w-[240px]" },
                    { col: "ENTITY_NAME",              label: "Entidad",      w: "min-w-[160px]" },
                    { col: "BUDGET",                   label: "Presupuesto",  w: "min-w-[120px]" },
                    { col: "OPPORTUNITY_CLOSING_DATE", label: "Cierre",       w: "min-w-[110px]" },
                    { col: "MEMBER_NAME",              label: "Asignado",     w: "min-w-[120px]" },
                    { col: "__pipeline__",             label: "Pipeline",     w: "min-w-[140px]" },
                  ].map(({ col, label, w }) => (
                    <th key={col} onClick={() => col !== "__pipeline__" && toggleSort(col)}
                      className={`${w} px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap ${col !== "__pipeline__" ? "cursor-pointer hover:text-blue-500 select-none" : ""} transition-colors`}>
                      <span className="flex items-center gap-1">
                        {label}
                        {col !== "__pipeline__" && (
                          sortCol === col
                            ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-blue-500" /> : <ChevronDown className="w-3 h-3 text-blue-500" />)
                            : <ChevronDown className="w-3 h-3 opacity-20" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50">
                {pagina.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-slate-400 text-sm">
                      No hay oportunidades que coincidan con los filtros.
                    </td>
                  </tr>
                ) : pagina.map((row) => {
                  const estado  = getEstado(row.OPPORTUNITY_ID);
                  const days    = daysLeft(row.OPPORTUNITY_CLOSING_DATE);
                  const urgent  = days !== null && days <= 3 && days >= 0;
                  const vencida = days !== null && days < 0;
                  const clasif  = !!clasifCache[row.OPPORTUNITY_ID];

                  return (
                    <tr key={row.OPPORTUNITY_ID}
                      onClick={() => { setSelected(row); setTabModal("info"); setErrorAccion(null); setEditEstado(null); }}
                      className={`group cursor-pointer hover:bg-blue-50/40 transition-colors ${estado === "descartada" ? "opacity-40" : ""}`}>

                      {/* Licitación */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {clasif && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Clasificado" />}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-xs truncate max-w-[260px] group-hover:text-blue-700 transition-colors">
                              {row.OPPORTUNITY_NAME || "Sin nombre"}
                            </p>
                            {row.CATEGORY_NAME && (
                              <p className="text-[10px] text-slate-400 truncate max-w-[260px] mt-0.5">{row.CATEGORY_NAME}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Entidad */}
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-600 truncate max-w-[160px]">{row.ENTITY_NAME || "—"}</p>
                        {row.REGION_NAME && <p className="text-[10px] text-slate-400 truncate">{row.REGION_NAME}</p>}
                      </td>

                      {/* Presupuesto */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-semibold text-slate-700">{fmt(row.BUDGET)}</span>
                      </td>

                      {/* Cierre */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className={`text-xs font-medium ${urgent ? "text-red-600" : vencida ? "text-slate-300 line-through" : "text-slate-600"}`}>
                          {fmtDate(row.OPPORTUNITY_CLOSING_DATE)}
                        </p>
                        {days !== null && !vencida && (
                          <p className={`text-[10px] mt-0.5 font-medium ${urgent ? "text-red-500" : "text-slate-400"}`}>
                            {days === 0 ? "Hoy" : days === 1 ? "Mañana" : `${days}d`}
                          </p>
                        )}
                      </td>

                      {/* Asignado */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-600">{row.MEMBER_NAME || row.USER_MAIL || "—"}</span>
                      </td>

                      {/* Pipeline */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="relative">
                          <PipelineBadge estado={estado}
                            onClick={() => setEditEstado(editEstado === row.OPPORTUNITY_ID ? null : row.OPPORTUNITY_ID)} />
                          <AnimatePresence>
                            {editEstado === row.OPPORTUNITY_ID && (
                              <motion.div
                                initial={{ opacity: 0, y: 4, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                                transition={{ duration: 0.12 }}
                                className="absolute z-30 top-8 left-0 bg-white rounded-xl shadow-xl border border-slate-200 py-1 min-w-[160px]"
                              >
                                {PIPELINE.map(p => { const Icon = p.icon; return (
                                  <button key={p.key}
                                    onClick={() => { setEstadoRow(row.OPPORTUNITY_ID, p.key); setEditEstado(null); }}
                                    className={`flex items-center gap-2 w-full px-3 py-2 text-xs font-medium transition-colors hover:bg-slate-50 ${estado === p.key ? "text-blue-600 bg-blue-50/60" : "text-slate-600"}`}>
                                    <Icon className="w-3.5 h-3.5" />{p.label}
                                  </button>
                                ); })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginador */}
          <div className="px-4 pb-3">
            <Paginador page={page} total={filtradas.length} pageSize={PAGE_SIZE} onChange={cambiarPagina} />
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE ── */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[2px]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSelected(null); setEditEstado(null); }} />

            <motion.aside
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] bg-white shadow-2xl flex flex-col"
            >
              {/* Header modal */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <PipelineBadge estado={getEstado(selected.OPPORTUNITY_ID)} />
                {clasifCache[selected.OPPORTUNITY_ID] && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 ring-1 ring-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />Clasificado
                  </span>
                )}
                <button onClick={() => { setSelected(null); setEditEstado(null); }}
                  className="ml-auto p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 bg-slate-50/50">
                {(["info", "docs"] as const).map(t => (
                  <button key={t} onClick={() => setTabModal(t)}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors capitalize ${tabModal === t ? "text-blue-600 border-b-2 border-blue-500 bg-white" : "text-slate-400 hover:text-slate-600"}`}>
                    {t === "info" ? "Información" : "Documentos"}
                  </button>
                ))}
              </div>

              {/* Contenido */}
              <div className="flex-1 overflow-y-auto">

                {/* TAB INFO */}
                {tabModal === "info" && (
                  <div className="p-5 space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 leading-snug">{selected.OPPORTUNITY_NAME}</h4>

                    <dl className="space-y-2.5">
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
                      ].filter(f => f.value && f.value !== "—").map(f => (
                        <div key={f.label} className="flex gap-3">
                          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-24 shrink-0 pt-0.5">{f.label}</dt>
                          <dd className="text-xs text-slate-700 font-medium flex-1">{f.value}</dd>
                        </div>
                      ))}
                    </dl>

                    {/* Cambiar estado pipeline */}
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Cambiar pipeline</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PIPELINE.map(p => { const Icon = p.icon; const active = getEstado(selected.OPPORTUNITY_ID) === p.key; return (
                          <button key={p.key} onClick={() => setEstadoRow(selected.OPPORTUNITY_ID, p.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${active ? "bg-slate-800 text-white border-slate-800 shadow-sm" : "text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"}`}>
                            <Icon className="w-3 h-3" />{p.label}
                          </button>
                        ); })}
                      </div>
                    </div>

                    <a href={`https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=${selected.OPPORTUNITY_ID}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                      <ExternalLink className="w-4 h-4" />Ver en Mercado Público
                    </a>
                  </div>
                )}

                {/* TAB DOCS */}
                {tabModal === "docs" && (
                  <div className="p-5 space-y-4">
                    {errorAccion && (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><p>{errorAccion}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => descargarDocs(selected.OPPORTUNITY_ID)}
                        disabled={!!descargando || !!clasificando}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-blue-200 text-blue-700 text-xs font-semibold bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50">
                        {descargando === selected.OPPORTUNITY_ID ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {descargando === selected.OPPORTUNITY_ID ? "Descargando…" : "Descargar Docs"}
                      </button>
                      <button onClick={() => clasificarDocs(selected.OPPORTUNITY_ID)}
                        disabled={!!clasificando || !!descargando}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-purple-200 text-purple-700 text-xs font-semibold bg-purple-50 hover:bg-purple-100 transition-colors disabled:opacity-50">
                        {clasificando === selected.OPPORTUNITY_ID ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                        {clasificando === selected.OPPORTUNITY_ID ? "Clasificando…" : "Clasificar IA"}
                      </button>
                    </div>

                    {/* Resultado clasificación */}
                    {(() => {
                      const clasif = clasifCache[selected.OPPORTUNITY_ID];
                      if (!clasif) return (
                        <div className="text-center py-12 text-slate-400">
                          <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                          <p className="text-sm font-medium text-slate-500">Sin clasificación</p>
                          <p className="text-xs mt-1 max-w-[220px] mx-auto">Descarga los documentos y luego haz clic en "Clasificar IA"</p>
                        </div>
                      );
                      return (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {clasif.total} docs · {fmtDate(clasif.clasificadoAt)}
                            </p>
                            <button onClick={() => clasificarDocs(selected.OPPORTUNITY_ID)} disabled={!!clasificando}
                              className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 disabled:opacity-50">
                              <RefreshCw className="w-3 h-3" />Re-clasificar
                            </button>
                          </div>
                          {CAJAS.map(caja => {
                            const docs = clasif.cajas[caja.key] ?? [];
                            if (!docs.length) return null;
                            const Icon = caja.icon;
                            return (
                              <div key={caja.key} className={`rounded-xl ${caja.bg} ring-1 ${caja.ring} p-3`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <Icon className={`w-3.5 h-3.5 ${caja.text}`} />
                                  <span className={`text-xs font-bold ${caja.text}`}>{caja.label}</span>
                                  <span className={`ml-auto text-[10px] font-bold ${caja.text} opacity-50`}>{docs.length}</span>
                                </div>
                                <div className="space-y-1.5">
                                  {docs.map((doc, i) => (
                                    <div key={i} className="flex items-start gap-2 bg-white/70 rounded-lg px-2.5 py-1.5">
                                      <FileText className={`w-3 h-3 shrink-0 mt-0.5 ${caja.text} opacity-50`} />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-slate-700 truncate">{doc.nombre}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                          {doc.n_paginas > 0 && <span className="text-[9px] text-slate-400">{doc.n_paginas}p</span>}
                                          {doc.escaneado && <span className="text-[9px] font-semibold text-amber-500">OCR</span>}
                                          {doc.contiene_tecnicas_integradas && <span className="text-[9px] font-semibold text-purple-500">+Téc.</span>}
                                          {doc.contiene_anexos_integrados && <span className="text-[9px] font-semibold text-emerald-500">+Anx.</span>}
                                          <span className={`text-[9px] font-bold px-1 rounded ${confBadge(doc.confianza)}`}>{Math.round(doc.confianza * 100)}%</span>
                                        </div>
                                        {doc.razon && <p className="text-[9px] text-slate-400 italic mt-0.5 truncate">{doc.razon}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
