"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database, RefreshCw, XCircle, Search, Tag,
  FileText, Users, Clock, CheckCircle2, Mail, Contact,
  ChevronRight, Hash, X, Filter, ArrowUpDown, ArrowUp, ArrowDown,
  Calendar, TrendingUp, Award, AlertCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { TableSkeleton } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import Paginacion from "@/components/Paginacion";

// ── Helpers ──────────────────────────────────────────────────────
function fmtDate(v: any): string {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("es-CL", { year: "numeric", month: "short", day: "numeric" });
}

function isTrue(v: any) {
  return v === true || v === "true" || v === "TRUE" || v === 1 || v === "1";
}

function parseTags(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  const s = String(v).trim();
  if (!s || s === "null") return [];
  return s.split(/[,|;]/).map((t) => t.trim()).filter(Boolean);
}

const PAGE_SIZE = 15;
const GESTIONES = ["Seguimiento", "Ganada", "Postulado", "Aceptado", "Perdida", "Rechazado", "Sin Definir"];

const GESTION_STYLE: Record<string, { pill: string; dot: string }> = {
  Ganada:        { pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  Postulado:     { pill: "bg-blue-50 text-blue-700 border-blue-200",         dot: "bg-blue-500" },
  Aceptado:      { pill: "bg-teal-50 text-teal-700 border-teal-200",         dot: "bg-teal-500" },
  Seguimiento:   { pill: "bg-violet-50 text-violet-700 border-violet-200",   dot: "bg-violet-500" },
  Perdida:       { pill: "bg-rose-50 text-rose-700 border-rose-200",         dot: "bg-rose-500" },
  Rechazado:     { pill: "bg-orange-50 text-orange-700 border-orange-200",   dot: "bg-orange-500" },
  "Sin Definir": { pill: "bg-slate-50 text-slate-500 border-slate-200",      dot: "bg-slate-300" },
};

function gestionPill(g: string) {
  return GESTION_STYLE[g]?.pill ?? GESTION_STYLE["Sin Definir"].pill;
}

// ── Sub-componentes ───────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-[#2563EB] text-white rounded-full px-2.5 py-1 shadow-sm shadow-blue-300/40">
      {label}
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="hover:text-blue-200 transition-colors">
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}

function StatChip({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    violet:  "bg-violet-50 text-violet-700 border-violet-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue:    "bg-blue-50 text-blue-700 border-blue-200",
    teal:    "bg-teal-50 text-teal-700 border-teal-200",
    rose:    "bg-rose-50 text-rose-700 border-rose-200",
    amber:   "bg-amber-50 text-amber-700 border-amber-200",
    slate:   "bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2.5 py-1 border ${colors[color] || colors.slate}`}>
      {label}
      <motion.span
        key={count}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="font-black"
      >
        {count.toLocaleString("es-CL")}
      </motion.span>
    </span>
  );
}

function SortIcon({ col, sortCol, sortDir }: { col: string; sortCol: string | null; sortDir: "asc" | "desc" }) {
  if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-400 transition-colors" />;
  return sortDir === "asc"
    ? <ArrowUp className="w-3 h-3 text-[#2563EB]" />
    : <ArrowDown className="w-3 h-3 text-[#2563EB]" />;
}

// ── Página ───────────────────────────────────────────────────────
export default function BiExportPage() {
  // ── Data ────────────────────────────────────────────────────
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);

  // ── Filtros ─────────────────────────────────────────────────
  const [texto, setTexto] = useState("");
  const [memberKey, setMemberKey] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [gestion, setGestion] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [filtrosOpen, setFiltrosOpen] = useState(false);

  // ── Ordenación ──────────────────────────────────────────────
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  // ── Cargar datos ────────────────────────────────────────────
  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bi-export");
      const json = await res.json();
      if (!res.ok || json.error) {
        setError({ message: json.error || `Error ${res.status}`, status: json.status || res.status });
        setRows([]);
      } else {
        setRows(Array.isArray(json.rows) ? json.rows : []);
        setFetchedAt(json.fetchedAt || null);
      }
    } catch (err: any) {
      setError({ message: err?.message || "Error de red al consultar la API." });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);
  useEffect(() => { setPage(1); }, [texto, memberKey, selectedTags, gestion, fechaDesde, fechaHasta]);

  // ── Miembros activos ────────────────────────────────────────
  const members = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of rows) {
      if (!r.MEMBER_NAME && !r.USER_MAIL) continue;
      const key = `${r.USER_ID ?? ""}-${r.MEMBER_NAME ?? ""}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          MEMBER_NAME: r.MEMBER_NAME,
          MEMBER_TYPE: r.MEMBER_TYPE,
          MEMBER_ACTIVE: r.MEMBER_ACTIVE,
          IS_CONTACT: r.IS_CONTACT,
          USER_ID: r.USER_ID,
          USER_MAIL: r.USER_MAIL,
          total: 0,
          porGestion: {} as Record<string, number>,
        });
      }
      const m = map.get(key);
      m.total += 1;
      const g = r.MANAGED_STATUS_NAME || "Sin Definir";
      m.porGestion[g] = (m.porGestion[g] || 0) + 1;
    }
    return Array.from(map.values())
      .filter((m) => isTrue(m.MEMBER_ACTIVE))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  // ── Etiquetas disponibles ────────────────────────────────────
  const tagsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (!r.MEMBER_NAME && !r.USER_MAIL) continue;
      for (const tag of parseTags(r.TRANSLATED_TAGS)) {
        map.set(tag, (map.get(tag) || 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  // ── Total asignadas (base sin filtros, solo miembros activos) ─
  const totalAsignadas = useMemo(
    () => rows.filter((x) => (x.MEMBER_NAME || x.USER_MAIL) && isTrue(x.MEMBER_ACTIVE)).length,
    [rows]
  );

  // ── Filtrado + ordenación ────────────────────────────────────
  const filtradas = useMemo(() => {
    // Base: solo oportunidades con miembro activo asignado
    let r = rows.filter((x) => (x.MEMBER_NAME || x.USER_MAIL) && isTrue(x.MEMBER_ACTIVE));

    if (memberKey)
      r = r.filter((x) => `${x.USER_ID ?? ""}-${x.MEMBER_NAME ?? ""}` === memberKey);

    if (selectedTags.length > 0)
      r = r.filter((x) => {
        const rt = new Set(parseTags(x.TRANSLATED_TAGS));
        return selectedTags.every((t) => rt.has(t));
      });

    if (gestion)
      r = r.filter((x) => (x.MANAGED_STATUS_NAME || "Sin Definir") === gestion);

    if (fechaDesde) {
      const d = new Date(fechaDesde);
      r = r.filter((x) => x.CLOSING_DATE && new Date(x.CLOSING_DATE) >= d);
    }
    if (fechaHasta) {
      const d = new Date(fechaHasta);
      d.setHours(23, 59, 59);
      r = r.filter((x) => x.CLOSING_DATE && new Date(x.CLOSING_DATE) <= d);
    }

    if (texto.trim()) {
      const q = texto.trim().toLowerCase();
      r = r.filter((x) =>
        [x.OPPORTUNITY_CODE, x.OPPORTUNITY_NAME, x.ORGANISM, x.TRANSLATED_TAGS, x.B_LINE, x.MEMBER_NAME]
          .some((v) => (v || "").toString().toLowerCase().includes(q))
      );
    }

    if (sortCol) {
      r = [...r].sort((a, b) => {
        let av: any = a[sortCol] ?? "";
        let bv: any = b[sortCol] ?? "";
        if (["CLOSING_DATE", "PUBLISH_DATE", "ACTUAL_APPLICATION_DATE"].includes(sortCol)) {
          av = av ? new Date(av).getTime() : 0;
          bv = bv ? new Date(bv).getTime() : 0;
        } else if (["AVAILABLE_AMOUNT", "APPLIED_AMOUNT", "WON_AMOUNT"].includes(sortCol)) {
          av = Number(av) || 0;
          bv = Number(bv) || 0;
        } else {
          av = String(av).toLowerCase();
          bv = String(bv).toLowerCase();
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return r;
  }, [rows, texto, memberKey, selectedTags, gestion, fechaDesde, fechaHasta, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageRows = filtradas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount =
    [memberKey, gestion, fechaDesde, fechaHasta].filter(Boolean).length +
    selectedTags.length +
    (texto.trim() ? 1 : 0);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function limpiarFiltros() {
    setTexto(""); setMemberKey(""); setSelectedTags([]);
    setGestion(""); setFechaDesde(""); setFechaHasta("");
  }

  const selectedMemberName = members.find((m) => m.key === memberKey)?.MEMBER_NAME;

  // ── KPIs del header ─────────────────────────────────────────
  // ── Stats en vivo (siempre desde filtradas) ─────────────────
  const liveStats = useMemo(() => {
    const ganadas     = filtradas.filter((r) => r.MANAGED_STATUS_NAME === "Ganada").length;
    const seguimiento = filtradas.filter((r) => r.MANAGED_STATUS_NAME === "Seguimiento").length;
    const postulado   = filtradas.filter((r) => r.MANAGED_STATUS_NAME === "Postulado").length;
    const aceptado    = filtradas.filter((r) => r.MANAGED_STATUS_NAME === "Aceptado").length;
    const perdida     = filtradas.filter((r) => r.MANAGED_STATUS_NAME === "Perdida").length;
    const montoTotal  = filtradas.reduce((s, r) => s + (Number(r.AVAILABLE_AMOUNT) || 0), 0);
    const montoGanado = filtradas.reduce((s, r) => s + (Number(r.WON_AMOUNT) || 0), 0);
    const conCierre   = filtradas.filter((r) => r.CLOSING_DATE).length;
    const proximos    = filtradas.filter((r) => {
      if (!r.CLOSING_DATE) return false;
      const diff = new Date(r.CLOSING_DATE).getTime() - Date.now();
      return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
    }).length;
    return { ganadas, seguimiento, postulado, aceptado, perdida, montoTotal, montoGanado, conCierre, proximos };
  }, [filtradas]);

  const kpiGanadas = useMemo(() => rows.filter((r) => (r.MANAGED_STATUS_NAME || "") === "Ganada").length, [rows]);
  const kpiSeguimiento = useMemo(() => rows.filter((r) => (r.MANAGED_STATUS_NAME || "") === "Seguimiento").length, [rows]);

  // ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header gradient ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#111827] to-[#1a2744] p-6 md:p-8 shadow-xl shadow-slate-900/25">
        <div className="absolute -top-24 -right-12 w-80 h-80 bg-[#3B82F6]/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-32 bg-[#6366F1]/10 blur-[80px] rounded-full pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest bg-blue-500/15 text-[#60A5FA] px-3 py-1 rounded-full border border-blue-500/20">
              <Database className="w-3 h-3" /> LiciTaLab · BI Export
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-white mt-3 leading-tight">
              Oportunidades{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#60A5FA] to-[#818CF8]">
                por Usuario
              </span>
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Fuente: <code className="text-slate-400">LICITALAB.GOLD.VW_CLIENT_OPPORTUNITIES</code>
            </p>

            {/* KPI strip */}
            {!loading && !error && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="flex flex-wrap items-center gap-2 mt-4"
              >
                <div className="flex items-center gap-2 bg-white/[0.07] backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/[0.08]">
                  <Users className="w-4 h-4 text-[#60A5FA]" />
                  <span className="text-white font-black text-base tabular-nums">{members.length}</span>
                  <span className="text-slate-400 text-[11px]">usuarios activos</span>
                </div>
                <div className="flex items-center gap-2 bg-white/[0.07] backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/[0.08]">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="text-white font-black text-base tabular-nums">{totalAsignadas.toLocaleString("es-CL")}</span>
                  <span className="text-slate-400 text-[11px]">asignadas</span>
                </div>
                <div className="flex items-center gap-2 bg-white/[0.07] backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/[0.08]">
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                  <span className="text-white font-black text-base tabular-nums">{kpiSeguimiento.toLocaleString("es-CL")}</span>
                  <span className="text-slate-400 text-[11px]">en seguimiento</span>
                </div>
                <div className="flex items-center gap-2 bg-white/[0.07] backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/[0.08]">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span className="text-white font-black text-base tabular-nums">{kpiGanadas}</span>
                  <span className="text-slate-400 text-[11px]">ganadas</span>
                </div>
                {fetchedAt && (
                  <p className="text-slate-600 text-[11px] flex items-center gap-1 ml-1">
                    <Clock className="w-3 h-3" /> {new Date(fetchedAt).toLocaleString("es-CL")}
                  </p>
                )}
              </motion.div>
            )}
          </div>

          <button
            onClick={cargar}
            disabled={loading}
            className="self-start flex items-center gap-2 text-[12px] font-bold text-white bg-gradient-to-r from-[#2563EB] to-[#3B82F6] px-5 py-2.5 rounded-xl shadow-lg shadow-blue-900/40 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar datos
          </button>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4 flex items-start gap-3 shadow-sm"
          >
            <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-rose-800">
                Error al obtener datos{error.status ? ` · HTTP ${error.status}` : ""}
              </p>
              <p className="text-xs text-rose-600 mt-0.5">{error.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Usuarios activos ─────────────────────────────────── */}
      {!error && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-[#111827] text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-[#2563EB]" />
              Usuarios activos
              {!loading && (
                <span className="text-[11px] font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                  {members.length}
                </span>
              )}
            </h2>
            {memberKey && (
              <button
                onClick={() => setMemberKey("")}
                className="text-[11px] font-bold text-[#2563EB] hover:text-blue-800 flex items-center gap-1 transition-colors"
              >
                <X className="w-3 h-3" /> Ver todos
              </button>
            )}
          </div>

          {loading ? (
            <TableSkeleton rows={2} />
          ) : members.length === 0 ? (
            <EmptyState icon={Users} title="Sin usuarios activos" description="No hay oportunidades asignadas a usuarios activos." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {members.map((m, idx) => {
                const isSelected = memberKey === m.key;
                const topGestion = Object.entries(m.porGestion as Record<string, number>)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .slice(0, 3);
                return (
                  <motion.button
                    key={m.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, type: "spring", stiffness: 400, damping: 30 }}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setMemberKey(isSelected ? "" : m.key)}
                    className={`text-left rounded-2xl border p-4 transition-colors ${
                      isSelected
                        ? "border-[#2563EB] bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md shadow-blue-100"
                        : "border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    }`}
                  >
                    {/* Avatar + nombre */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-black shrink-0 ${
                        isSelected
                          ? "bg-gradient-to-br from-[#2563EB] to-[#6366F1] shadow-md shadow-blue-300/40"
                          : "bg-gradient-to-br from-slate-600 to-slate-700"
                      }`}>
                        {(m.MEMBER_NAME || "?").substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-black text-sm truncate ${isSelected ? "text-[#1D4ED8]" : "text-[#111827]"}`}>
                          {m.MEMBER_NAME || "—"}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold truncate">
                          {m.MEMBER_TYPE || "—"}
                        </p>
                      </div>
                    </div>

                    {/* Conteo + email */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-2xl font-black tabular-nums ${isSelected ? "text-[#2563EB]" : "text-slate-700"}`}>
                        {m.total.toLocaleString("es-CL")}
                      </span>
                      {isTrue(m.IS_CONTACT) && (
                        <span className="text-[9px] font-bold text-violet-600 bg-violet-50 rounded-full px-2 py-0.5 border border-violet-100">
                          Contacto ext.
                        </span>
                      )}
                    </div>

                    {m.USER_MAIL && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate mb-2">
                        <Mail className="w-3 h-3 shrink-0" /> {m.USER_MAIL}
                      </p>
                    )}

                    {/* Breakdown gestión */}
                    <div className="flex flex-wrap gap-1">
                      {topGestion.map(([g, c]) => (
                        <span
                          key={g}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${gestionPill(g)}`}
                        >
                          {g} · {c as number}
                        </span>
                      ))}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tabla con filtros ─────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Barra superior */}
        <div className="px-6 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <h2 className="font-black text-[#111827] text-sm flex items-center gap-2 shrink-0">
            <FileText className="w-4 h-4 text-[#2563EB]" />
            Oportunidades asignadas
            {!loading && (
              <span className="text-[11px] font-normal text-slate-400">
                ({activeFilterCount > 0 ? `${filtradas.length} de ${totalAsignadas.toLocaleString("es-CL")}` : filtradas.length.toLocaleString("es-CL")})
              </span>
            )}
          </h2>

          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
            {/* Búsqueda */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Código, nombre, organismo…"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
              />
              {texto && (
                <button onClick={() => setTexto("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Botón filtros */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setFiltrosOpen((o) => !o)}
              className={`relative flex items-center gap-2 text-[12px] font-bold px-4 py-2 rounded-xl border transition-all ${
                filtrosOpen || activeFilterCount > 0
                  ? "bg-[#2563EB] text-white border-[#2563EB] shadow-md shadow-blue-300/30"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-white">
                  {activeFilterCount}
                </span>
              )}
            </motion.button>

            {/* Limpiar */}
            <AnimatePresence>
              {activeFilterCount > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={limpiarFiltros}
                  className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500 hover:text-rose-500 px-3 py-2 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all"
                >
                  <X className="w-3.5 h-3.5" /> Limpiar
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Panel de filtros colapsable */}
        <AnimatePresence initial={false}>
          {filtrosOpen && (
            <motion.div
              key="filtros"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="overflow-hidden"
            >
              <div className="px-6 py-5 bg-slate-50/60 border-b border-slate-100 grid gap-5">

                {/* Usuario */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-[#2563EB]" /> Usuario asignado
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setMemberKey("")}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${
                        !memberKey
                          ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm"
                          : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      Todos
                    </button>
                    {members.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => setMemberKey(memberKey === m.key ? "" : m.key)}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${
                          memberKey === m.key
                            ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:border-[#2563EB]/40 hover:text-[#2563EB]"
                        }`}
                      >
                        {m.MEMBER_NAME || m.USER_MAIL || "—"}
                        <span className={`ml-1.5 text-[10px] font-normal ${memberKey === m.key ? "text-blue-200" : "text-slate-400"}`}>
                          {m.total.toLocaleString("es-CL")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Estado gestión */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-[#2563EB]" /> Estado de gestión
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setGestion("")}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${
                        !gestion
                          ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm"
                          : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      Todos
                    </button>
                    {GESTIONES.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGestion(gestion === g ? "" : g)}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${
                          gestion === g
                            ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm"
                            : `${GESTION_STYLE[g]?.pill || "bg-slate-50 text-slate-500 border-slate-200"} hover:border-slate-300`
                        }`}
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${GESTION_STYLE[g]?.dot || "bg-slate-300"}`} />
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rango de fechas */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-[#2563EB]" /> Fecha de cierre
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-500 font-semibold whitespace-nowrap">Desde</label>
                      <input
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                        className="text-xs rounded-xl border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] bg-white transition-all"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-500 font-semibold whitespace-nowrap">Hasta</label>
                      <input
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                        className="text-xs rounded-xl border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] bg-white transition-all"
                      />
                    </div>
                    {(fechaDesde || fechaHasta) && (
                      <button
                        onClick={() => { setFechaDesde(""); setFechaHasta(""); }}
                        className="text-[11px] text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3 h-3" /> Borrar fechas
                      </button>
                    )}
                  </div>
                </div>

                {/* Etiquetas */}
                {tagsMap.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-[#2563EB]" /> Etiquetas (TRANSLATED_TAGS)
                      {selectedTags.length > 0 && (
                        <button onClick={() => setSelectedTags([])} className="text-[10px] text-slate-400 hover:text-rose-500 font-bold ml-1 transition-colors">
                          · limpiar
                        </button>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tagsMap.map(([tag, count]) => {
                        const active = selectedTags.includes(tag);
                        return (
                          <motion.button
                            key={tag}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleTag(tag)}
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                              active
                                ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm shadow-blue-300/30"
                                : "bg-blue-50/60 text-[#2563EB] border-blue-100 hover:bg-blue-100 hover:border-blue-200"
                            }`}
                          >
                            <Hash className="w-2.5 h-2.5" /> {tag}
                            <span className={`text-[10px] font-normal ml-0.5 ${active ? "text-blue-200" : "text-blue-400"}`}>
                              {count}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chips de filtros activos (panel cerrado) */}
        <AnimatePresence>
          {activeFilterCount > 0 && !filtrosOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-6 py-2.5 bg-blue-50/50 border-b border-blue-100/60 flex items-center gap-2 flex-wrap">
                {memberKey && (
                  <FilterChip label={`Usuario: ${selectedMemberName || memberKey}`} onRemove={() => setMemberKey("")} />
                )}
                {gestion && (
                  <FilterChip label={`Gestión: ${gestion}`} onRemove={() => setGestion("")} />
                )}
                {selectedTags.map((t) => (
                  <FilterChip key={t} label={t} onRemove={() => toggleTag(t)} />
                ))}
                {fechaDesde && (
                  <FilterChip label={`Desde ${fechaDesde}`} onRemove={() => setFechaDesde("")} />
                )}
                {fechaHasta && (
                  <FilterChip label={`Hasta ${fechaHasta}`} onRemove={() => setFechaHasta("")} />
                )}
                {texto.trim() && (
                  <FilterChip label={`"${texto}"`} onRemove={() => setTexto("")} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Barra de resultados en vivo ──────────────────── */}
        {!loading && !error && (
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/40 flex flex-wrap items-center gap-3">

            {/* Conteo principal animado */}
            <div className="flex items-baseline gap-1.5">
              <motion.span
                key={filtradas.length}
                initial={{ opacity: 0, y: -6, scale: 1.2 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                className="text-lg font-black text-[#111827] tabular-nums"
              >
                {filtradas.length.toLocaleString("es-CL")}
              </motion.span>
              <span className="text-xs text-slate-400 font-medium">
                {activeFilterCount > 0
                  ? `resultado${filtradas.length !== 1 ? "s" : ""} de ${totalAsignadas.toLocaleString("es-CL")} asignadas`
                  : `oportunidad${filtradas.length !== 1 ? "es" : ""} asignadas`}
              </span>
            </div>

            {/* Separador */}
            {(liveStats.seguimiento > 0 || liveStats.ganadas > 0 || liveStats.postulado > 0 || liveStats.aceptado > 0 || liveStats.perdida > 0) && (
              <span className="text-slate-200 select-none">|</span>
            )}

            {/* Desglose por gestión (solo estados con datos) */}
            {liveStats.seguimiento > 0 && <StatChip label="Seguimiento" count={liveStats.seguimiento} color="violet" />}
            {liveStats.ganadas > 0     && <StatChip label="Ganadas"     count={liveStats.ganadas}     color="emerald" />}
            {liveStats.postulado > 0   && <StatChip label="Postulado"   count={liveStats.postulado}   color="blue" />}
            {liveStats.aceptado > 0    && <StatChip label="Aceptado"    count={liveStats.aceptado}    color="teal" />}
            {liveStats.perdida > 0     && <StatChip label="Perdida"     count={liveStats.perdida}     color="rose" />}

            {/* Cierre próximo */}
            {liveStats.proximos > 0 && (
              <>
                <span className="text-slate-200 select-none">|</span>
                <StatChip label="⚠ Cierre esta semana" count={liveStats.proximos} color="amber" />
              </>
            )}

            {/* Monto disponible total filtrado */}
            {liveStats.montoTotal > 0 && (
              <div className="ml-auto flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total disponible</span>
                <motion.span
                  key={liveStats.montoTotal}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm font-black text-slate-700 tabular-nums"
                >
                  ${liveStats.montoTotal.toLocaleString("es-CL")}
                </motion.span>
              </div>
            )}
          </div>
        )}

        {/* Tabla */}
        {loading ? (
          <div className="px-6 py-5"><TableSkeleton rows={8} /></div>
        ) : error ? null : filtradas.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title="Sin resultados"
            description="Ninguna oportunidad coincide con los filtros aplicados. Prueba ajustando los criterios de búsqueda."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50 border-b border-slate-100">
                    {!memberKey && (
                      <th
                        className="px-6 py-3 whitespace-nowrap cursor-pointer select-none group"
                        onClick={() => toggleSort("MEMBER_NAME")}
                      >
                        <span className="flex items-center gap-1 hover:text-slate-600 transition-colors">
                          Usuario <SortIcon col="MEMBER_NAME" sortCol={sortCol} sortDir={sortDir} />
                        </span>
                      </th>
                    )}
                    <th
                      className="px-6 py-3 whitespace-nowrap cursor-pointer select-none group"
                      onClick={() => toggleSort("OPPORTUNITY_CODE")}
                    >
                      <span className="flex items-center gap-1 hover:text-slate-600 transition-colors">
                        Código <SortIcon col="OPPORTUNITY_CODE" sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </th>
                    <th className="px-6 py-3">Nombre</th>
                    <th
                      className="px-6 py-3 whitespace-nowrap cursor-pointer select-none group"
                      onClick={() => toggleSort("ORGANISM")}
                    >
                      <span className="flex items-center gap-1 hover:text-slate-600 transition-colors">
                        Organismo <SortIcon col="ORGANISM" sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </th>
                    <th className="px-6 py-3 whitespace-nowrap">Gestión</th>
                    <th className="px-6 py-3">Etiquetas</th>
                    <th className="px-6 py-3 whitespace-nowrap">Línea negocio</th>
                    <th
                      className="px-6 py-3 whitespace-nowrap cursor-pointer select-none group"
                      onClick={() => toggleSort("CLOSING_DATE")}
                    >
                      <span className="flex items-center gap-1 hover:text-slate-600 transition-colors">
                        Cierre <SortIcon col="CLOSING_DATE" sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </th>
                    <th
                      className="px-6 py-3 whitespace-nowrap text-right cursor-pointer select-none group"
                      onClick={() => toggleSort("AVAILABLE_AMOUNT")}
                    >
                      <span className="flex items-center justify-end gap-1 hover:text-slate-600 transition-colors">
                        Monto <SortIcon col="AVAILABLE_AMOUNT" sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="wait">
                    {pageRows.map((r, i) => {
                      const tags = parseTags(r.TRANSLATED_TAGS);
                      const isClosingSoon = r.CLOSING_DATE && (() => {
                        const diff = new Date(r.CLOSING_DATE).getTime() - Date.now();
                        return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
                      })();
                      return (
                        <motion.tr
                          key={r.OPPORTUNITY_ID ?? i}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i * 0.025, 0.35), duration: 0.2, ease: "easeOut" }}
                          className="group border-b border-slate-50 last:border-0 hover:bg-blue-50/30 transition-colors cursor-pointer"
                          onClick={() => setSelected(r)}
                        >
                          {!memberKey && (
                            <td className="px-6 py-3.5 whitespace-nowrap">
                              <p className="font-bold text-slate-800">{r.MEMBER_NAME || "—"}</p>
                              {r.USER_MAIL && (
                                <p className="text-[10px] text-slate-400 mt-0.5">{r.USER_MAIL}</p>
                              )}
                            </td>
                          )}
                          <td className="px-6 py-3.5 font-mono font-bold text-slate-700 whitespace-nowrap text-[11px]">
                            {r.OPPORTUNITY_CODE || "—"}
                          </td>
                          <td className="px-6 py-3.5 text-slate-700 max-w-[240px]">
                            <p className="truncate">{r.OPPORTUNITY_NAME || "—"}</p>
                          </td>
                          <td className="px-6 py-3.5 text-slate-500 max-w-[160px]">
                            <p className="truncate">{r.ORGANISM || "—"}</p>
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 border ${gestionPill(r.MANAGED_STATUS_NAME || "Sin Definir")}`}>
                              {r.MANAGED_STATUS_NAME || "Sin Definir"}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 max-w-[200px]">
                            <div className="flex flex-wrap gap-1">
                              {tags.length > 0
                                ? tags.map((t) => (
                                  <span
                                    key={t}
                                    className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 ${
                                      selectedTags.includes(t)
                                        ? "bg-[#2563EB] text-white"
                                        : "bg-blue-50 text-[#2563EB]"
                                    }`}
                                  >
                                    {t}
                                  </span>
                                ))
                                : <span className="text-slate-300">—</span>}
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-slate-500 whitespace-nowrap">{r.B_LINE || "—"}</td>
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <span className={isClosingSoon ? "text-amber-600 font-bold" : "text-slate-500"}>
                              {fmtDate(r.CLOSING_DATE)}
                            </span>
                            {isClosingSoon && (
                              <span className="ml-1.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">
                                ¡Próximo!
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-right tabular-nums text-slate-700 whitespace-nowrap">
                            {r.AVAILABLE_AMOUNT ? `$${Number(r.AVAILABLE_AMOUNT).toLocaleString("es-CL")}` : "—"}
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-[#2563EB] transition-colors" />
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            <div className="py-4 border-t border-slate-50">
              <Paginacion currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* ── Modal detalle ─────────────────────────────────────── */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.OPPORTUNITY_NAME || "Oportunidad"}
        subtitle={selected?.OPPORTUNITY_CODE}
        size="xl"
      >
        {selected && (
          <div className="space-y-4">

            {/* Usuario */}
            <div className="rounded-2xl border border-slate-100 p-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
                <Users className="w-3.5 h-3.5 text-[#2563EB]" /> Usuario asignado
              </h3>
              <dl className="grid grid-cols-2 gap-2.5 text-[11px]">
                <div><dt className="text-slate-400 font-semibold">Nombre</dt><dd className="text-slate-800 font-black mt-0.5">{selected.MEMBER_NAME || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Tipo</dt><dd className="text-slate-700 mt-0.5">{selected.MEMBER_TYPE || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Activo</dt><dd className="mt-0.5">{isTrue(selected.MEMBER_ACTIVE) ? <span className="text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Sí</span> : <span className="text-slate-400">No</span>}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Contacto ext.</dt><dd className="text-slate-700 mt-0.5">{isTrue(selected.IS_CONTACT) ? "Sí" : "No"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">User ID</dt><dd className="font-mono text-slate-700 mt-0.5">{selected.USER_ID || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Email</dt><dd className="text-slate-700 mt-0.5">{selected.USER_MAIL || "—"}</dd></div>
              </dl>
            </div>

            {/* Etiquetas */}
            <div className="rounded-2xl border border-slate-100 p-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
                <Tag className="w-3.5 h-3.5 text-[#2563EB]" /> Clasificación y etiquetas
              </h3>
              <div className="space-y-3 text-[11px]">
                <div>
                  <p className="text-slate-400 font-semibold mb-1.5">Etiquetas (TRANSLATED_TAGS)</p>
                  <div className="flex flex-wrap gap-1">
                    {parseTags(selected.TRANSLATED_TAGS).length > 0
                      ? parseTags(selected.TRANSLATED_TAGS).map((t) => (
                        <span key={t} className="bg-blue-50 text-[#2563EB] font-bold rounded-full px-2 py-0.5 border border-blue-100">{t}</span>
                      ))
                      : <span className="text-slate-400">Sin etiquetas</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div><dt className="text-slate-400 font-semibold">Tags (códigos)</dt><dd className="font-mono text-slate-700 mt-0.5 text-[10px]">{selected.TAGS || "—"}</dd></div>
                  <div><dt className="text-slate-400 font-semibold">Línea de negocio</dt><dd className="text-slate-700 mt-0.5">{selected.B_LINE || "—"}</dd></div>
                  <div>
                    <dt className="text-slate-400 font-semibold">Estado gestión</dt>
                    <dd className="mt-0.5">
                      <span className={`font-bold rounded-full px-2 py-0.5 border ${gestionPill(selected.MANAGED_STATUS_NAME || "Sin Definir")}`}>
                        {selected.MANAGED_STATUS_NAME || "Sin Definir"}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 font-semibold">Banderas</dt>
                    <dd className="text-slate-700 mt-0.5">
                      {[isTrue(selected.IS_FOLLOWED) && "Seguimiento", isTrue(selected.IS_READ) && "Leída", isTrue(selected.IS_DISCARTED) && "Descartada"].filter(Boolean).join(" · ") || "—"}
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            {/* Oportunidad */}
            <div className="rounded-2xl border border-slate-100 p-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
                <FileText className="w-3.5 h-3.5 text-[#2563EB]" /> Datos de la oportunidad
              </h3>
              <dl className="grid grid-cols-2 gap-2.5 text-[11px]">
                <div><dt className="text-slate-400 font-semibold">Código</dt><dd className="font-mono font-bold text-slate-800 mt-0.5">{selected.OPPORTUNITY_CODE || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Tipo</dt><dd className="text-slate-700 mt-0.5">{selected.OPPORTUNITY_TYPE || "—"}</dd></div>
                <div className="col-span-2"><dt className="text-slate-400 font-semibold">Nombre</dt><dd className="text-slate-700 mt-0.5">{selected.OPPORTUNITY_NAME || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Organismo</dt><dd className="text-slate-700 mt-0.5">{selected.ORGANISM || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Categoría organismo</dt><dd className="text-slate-700 mt-0.5">{selected.ORGANISM_CATEGORY || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Región</dt><dd className="text-slate-700 mt-0.5">{selected.REGION || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Estado origen</dt><dd className="text-slate-700 mt-0.5">{selected.STATUS || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Fecha publicación</dt><dd className="text-slate-700 mt-0.5">{fmtDate(selected.PUBLISH_DATE)}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Fecha cierre</dt><dd className="text-slate-700 mt-0.5">{fmtDate(selected.CLOSING_DATE)}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Monto disponible</dt><dd className="text-slate-700 mt-0.5">{selected.AVAILABLE_AMOUNT ? `$${Number(selected.AVAILABLE_AMOUNT).toLocaleString("es-CL")} ${selected.CURRENCY || ""}` : "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Monto postulado</dt><dd className="text-slate-700 mt-0.5">{selected.APPLIED_AMOUNT ? `$${Number(selected.APPLIED_AMOUNT).toLocaleString("es-CL")}` : "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Monto ganado</dt><dd className="text-slate-700 mt-0.5">{selected.WON_AMOUNT ? `$${Number(selected.WON_AMOUNT).toLocaleString("es-CL")}` : "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Fecha postulación</dt><dd className="text-slate-700 mt-0.5">{fmtDate(selected.ACTUAL_APPLICATION_DATE)}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Workspace</dt><dd className="text-slate-700 mt-0.5">{selected.WORKSPACE_TITLE || "—"}</dd></div>
                {selected.COMMENTS && (
                  <div className="col-span-2">
                    <dt className="text-slate-400 font-semibold">Comentarios</dt>
                    <dd className="text-slate-700 mt-1 whitespace-pre-line bg-slate-50 rounded-xl p-3">{selected.COMMENTS}</dd>
                  </div>
                )}
              </dl>
            </div>

          </div>
        )}
      </Modal>

    </div>
  );
}
