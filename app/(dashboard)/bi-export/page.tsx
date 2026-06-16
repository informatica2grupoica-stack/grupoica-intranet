"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Database, RefreshCw, XCircle, Search, Tag,
  FileText, Users, Clock, CheckCircle2, Mail, Contact,
  ChevronRight, Hash, X,
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

const GESTION_COLORS: Record<string, string> = {
  Ganada:        "bg-emerald-100 text-emerald-700",
  Postulado:     "bg-blue-100 text-blue-700",
  Aceptado:      "bg-teal-100 text-teal-700",
  Seguimiento:   "bg-violet-100 text-violet-700",
  Perdida:       "bg-rose-100 text-rose-700",
  Rechazado:     "bg-orange-100 text-orange-700",
  "Sin Definir": "bg-slate-100 text-slate-500",
};

// ── Página ───────────────────────────────────────────────────────
export default function BiExportPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);

  // Filtros de la tabla de oportunidades
  const [selectedMemberKey, setSelectedMemberKey] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

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
  useEffect(() => { setPage(1); }, [search, selectedMemberKey, selectedTags]);

  // ── Miembros activos (solo filas con usuario asignado) ───────
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
      .filter((m) => isTrue(m.MEMBER_ACTIVE)) // solo activos
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  // ── Etiquetas disponibles (sobre filas con miembro asignado) ─
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

  // ── Oportunidades filtradas ──────────────────────────────────
  const filtradas = useMemo(() => {
    // Base: solo oportunidades con miembro asignado
    let r = rows.filter((x) => x.MEMBER_NAME || x.USER_MAIL);

    // Filtro por usuario
    if (selectedMemberKey) {
      r = r.filter((x) => `${x.USER_ID ?? ""}-${x.MEMBER_NAME ?? ""}` === selectedMemberKey);
    }

    // Filtro por etiquetas (la fila debe tener TODAS las seleccionadas)
    if (selectedTags.size > 0) {
      r = r.filter((x) => {
        const rowTags = new Set(parseTags(x.TRANSLATED_TAGS));
        for (const t of selectedTags) {
          if (!rowTags.has(t)) return false;
        }
        return true;
      });
    }

    // Búsqueda de texto
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((x) =>
        [x.OPPORTUNITY_CODE, x.OPPORTUNITY_NAME, x.ORGANISM, x.TRANSLATED_TAGS, x.B_LINE, x.MEMBER_NAME]
          .some((v) => (v || "").toString().toLowerCase().includes(q))
      );
    }

    return r;
  }, [rows, search, selectedMemberKey, selectedTags]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageRows = filtradas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectedMember = members.find((m) => m.key === selectedMemberKey);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  const hasFilters = !!selectedMemberKey || selectedTags.size > 0 || search.trim();

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[#111827] flex items-center gap-2">
            <Database className="w-5 h-5 text-[#2563EB]" /> LiciTaLab BI — Oportunidades por usuario
          </h1>
          {fetchedAt && (
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Última consulta: {new Date(fetchedAt).toLocaleString("es-CL")}
            </p>
          )}
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-[#2563EB] to-[#3B82F6] px-3 py-2 rounded-xl shadow-lg shadow-blue-900/30 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div className="bg-rose-50 border-l-4 border-[#EF4444] rounded-2xl px-5 py-4 shadow-sm">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-rose-800">
                No se pudo obtener la data{error.status ? ` (HTTP ${error.status})` : ""}
              </p>
              <p className="text-xs text-rose-700 mt-0.5">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Usuarios activos (cards) ──────────────────────────── */}
      {!error && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-[#111827] text-sm flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-[#2563EB]" />
            Usuarios activos{!loading && ` (${members.length})`}
          </h2>

          {loading ? (
            <TableSkeleton rows={2} />
          ) : members.length === 0 ? (
            <EmptyState icon={Users} title="Sin usuarios activos" description="No hay oportunidades asignadas a usuarios activos." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {members.map((m) => {
                const isSelected = selectedMemberKey === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setSelectedMemberKey(isSelected ? null : m.key)}
                    className={`text-left rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? "border-[#2563EB] bg-blue-50 shadow-sm shadow-blue-100"
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-[#111827] text-sm truncate">{m.MEMBER_NAME || "—"}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                          {m.MEMBER_TYPE || "—"}
                        </p>
                      </div>
                      <span className={`text-xl font-black tabular-nums shrink-0 ${isSelected ? "text-[#2563EB]" : "text-slate-700"}`}>
                        {m.total.toLocaleString("es-CL")}
                      </span>
                    </div>
                    {m.USER_MAIL && (
                      <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 text-slate-300 shrink-0" /> {m.USER_MAIL}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(m.porGestion as Record<string, number>)
                        .sort((a, b) => (b[1] as number) - (a[1] as number))
                        .slice(0, 4)
                        .map(([g, c]) => (
                          <span
                            key={g}
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${GESTION_COLORS[g] || GESTION_COLORS["Sin Definir"]}`}
                          >
                            {g} {c as number}
                          </span>
                        ))}
                    </div>
                    {isTrue(m.IS_CONTACT) && (
                      <p className="text-[9px] font-bold text-violet-600 flex items-center gap-0.5 mt-1.5">
                        <Contact className="w-3 h-3" /> Contacto ext.
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tabla oportunidades ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Barra de filtros */}
        <div className="px-5 py-4 border-b border-slate-50 space-y-3">

          {/* Fila 1: título + búsqueda texto */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h2 className="font-bold text-[#111827] text-sm flex items-center gap-2 flex-1">
              <FileText className="w-4 h-4 text-[#2563EB]" />
              Oportunidades asignadas ({loading ? "…" : filtradas.length})
            </h2>
            <div className="relative sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Código, nombre, organismo…"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
              />
            </div>
          </div>

          {/* Fila 2: selector de usuario */}
          {!loading && members.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
                <Users className="w-3 h-3" /> Usuario
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedMemberKey(null)}
                  className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-colors ${
                    !selectedMemberKey
                      ? "bg-[#2563EB] text-white border-[#2563EB]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  Todos
                </button>
                {members.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setSelectedMemberKey(selectedMemberKey === m.key ? null : m.key)}
                    className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-colors ${
                      selectedMemberKey === m.key
                        ? "bg-[#2563EB] text-white border-[#2563EB]"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {m.MEMBER_NAME || m.USER_MAIL || "—"}
                    <span className={`ml-1.5 text-[10px] font-normal ${selectedMemberKey === m.key ? "text-blue-200" : "text-slate-400"}`}>
                      {m.total.toLocaleString("es-CL")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fila 3: filtro de etiquetas */}
          {!loading && tagsMap.length > 0 && (
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1 pt-1">
                <Tag className="w-3 h-3" /> Etiquetas
              </span>
              <div className="flex flex-wrap gap-1.5">
                {tagsMap.map(([tag, count]) => {
                  const active = selectedTags.has(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? "bg-[#2563EB] text-white border-[#2563EB]"
                          : "bg-blue-50 text-[#2563EB] border-blue-100 hover:bg-blue-100"
                      }`}
                    >
                      <Hash className="w-2.5 h-2.5" /> {tag}
                      <span className={`text-[10px] font-normal ${active ? "text-blue-200" : "text-blue-400"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Limpiar filtros */}
          {hasFilters && (
            <button
              onClick={() => { setSelectedMemberKey(null); setSelectedTags(new Set()); setSearch(""); }}
              className="text-[11px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" /> Limpiar filtros
            </button>
          )}
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="px-5 py-4"><TableSkeleton rows={8} /></div>
        ) : error ? null : filtradas.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin resultados"
            description="Ninguna oportunidad coincide con los filtros aplicados."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-50">
                    {!selectedMemberKey && <th className="px-5 py-3 whitespace-nowrap">Usuario</th>}
                    <th className="px-5 py-3 whitespace-nowrap">Código</th>
                    <th className="px-5 py-3">Nombre</th>
                    <th className="px-5 py-3 whitespace-nowrap">Organismo</th>
                    <th className="px-5 py-3 whitespace-nowrap">Gestión</th>
                    <th className="px-5 py-3">Etiquetas</th>
                    <th className="px-5 py-3 whitespace-nowrap">Línea negocio</th>
                    <th className="px-5 py-3 whitespace-nowrap">Cierre</th>
                    <th className="px-5 py-3 whitespace-nowrap text-right">Monto</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pageRows.map((r, i) => {
                    const tags = parseTags(r.TRANSLATED_TAGS);
                    return (
                      <tr
                        key={r.OPPORTUNITY_ID ?? i}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        onClick={() => setSelected(r)}
                      >
                        {!selectedMemberKey && (
                          <td className="px-5 py-3 whitespace-nowrap">
                            <p className="font-bold text-slate-700">{r.MEMBER_NAME || "—"}</p>
                            <p className="text-[10px] text-slate-400">{r.USER_MAIL || ""}</p>
                          </td>
                        )}
                        <td className="px-5 py-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                          {r.OPPORTUNITY_CODE || "—"}
                        </td>
                        <td className="px-5 py-3 text-slate-700 max-w-[240px] truncate">
                          {r.OPPORTUNITY_NAME || "—"}
                        </td>
                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap max-w-[160px] truncate">
                          {r.ORGANISM || "—"}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${GESTION_COLORS[r.MANAGED_STATUS_NAME] || GESTION_COLORS["Sin Definir"]}`}>
                            {r.MANAGED_STATUS_NAME || "Sin Definir"}
                          </span>
                        </td>
                        <td className="px-5 py-3 max-w-[200px]">
                          <div className="flex flex-wrap gap-1">
                            {tags.length > 0
                              ? tags.map((t) => (
                                <span
                                  key={t}
                                  className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 ${
                                    selectedTags.has(t)
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
                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{r.B_LINE || "—"}</td>
                        <td className="px-5 py-3 whitespace-nowrap text-slate-500">{fmtDate(r.CLOSING_DATE)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                          {r.AVAILABLE_AMOUNT ? `$${Number(r.AVAILABLE_AMOUNT).toLocaleString("es-CL")}` : "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pb-5">
              <Paginacion currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* ── Modal detalle ───────────────────────────────────── */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.OPPORTUNITY_NAME || "Oportunidad"}
        subtitle={selected?.OPPORTUNITY_CODE}
        size="xl"
      >
        {selected && (
          <div className="space-y-4">

            <div className="rounded-2xl border border-slate-100 p-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
                <Users className="w-3.5 h-3.5 text-[#2563EB]" /> Usuario asignado
              </h3>
              <dl className="grid grid-cols-2 gap-2 text-[11px]">
                <div><dt className="text-slate-400 font-semibold">Nombre</dt><dd className="text-slate-700 font-bold">{selected.MEMBER_NAME || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Tipo</dt><dd className="text-slate-700">{selected.MEMBER_TYPE || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Activo</dt><dd className="text-slate-700">{isTrue(selected.MEMBER_ACTIVE) ? "Sí" : "No"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Es contacto ext.</dt><dd className="text-slate-700">{isTrue(selected.IS_CONTACT) ? "Sí" : "No"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">User ID</dt><dd className="text-slate-700 font-mono">{selected.USER_ID || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Email</dt><dd className="text-slate-700">{selected.USER_MAIL || "—"}</dd></div>
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-100 p-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
                <Tag className="w-3.5 h-3.5 text-[#2563EB]" /> Etiquetas y clasificación
              </h3>
              <div className="space-y-2.5 text-[11px]">
                <div>
                  <p className="text-slate-400 font-semibold mb-1">Etiquetas (TRANSLATED_TAGS)</p>
                  <div className="flex flex-wrap gap-1">
                    {parseTags(selected.TRANSLATED_TAGS).length > 0
                      ? parseTags(selected.TRANSLATED_TAGS).map((t) => (
                        <span key={t} className="bg-blue-50 text-[#2563EB] font-bold rounded-full px-2 py-0.5">{t}</span>
                      ))
                      : <span className="text-slate-400">Sin etiquetas</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-slate-400 font-semibold">Tags (códigos)</dt>
                    <dd className="font-mono text-slate-700 mt-0.5">{selected.TAGS || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 font-semibold">Línea de negocio (B_LINE)</dt>
                    <dd className="text-slate-700 mt-0.5">{selected.B_LINE || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 font-semibold">Estado gestión</dt>
                    <dd className="mt-0.5">
                      <span className={`font-bold rounded-full px-2 py-0.5 ${GESTION_COLORS[selected.MANAGED_STATUS_NAME] || GESTION_COLORS["Sin Definir"]}`}>
                        {selected.MANAGED_STATUS_NAME || "Sin Definir"}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 font-semibold">Seguimiento / Leída / Descartada</dt>
                    <dd className="text-slate-700 mt-0.5">
                      {[
                        isTrue(selected.IS_FOLLOWED) && "En seguimiento",
                        isTrue(selected.IS_READ) && "Leída",
                        isTrue(selected.IS_DISCARTED) && "Descartada",
                      ].filter(Boolean).join(" · ") || "—"}
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 p-4">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
                <FileText className="w-3.5 h-3.5 text-[#2563EB]" /> Datos de la oportunidad
              </h3>
              <dl className="grid grid-cols-2 gap-2 text-[11px]">
                <div><dt className="text-slate-400 font-semibold">Código</dt><dd className="font-mono text-slate-700">{selected.OPPORTUNITY_CODE || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Tipo</dt><dd className="text-slate-700">{selected.OPPORTUNITY_TYPE || "—"}</dd></div>
                <div className="col-span-2"><dt className="text-slate-400 font-semibold">Nombre</dt><dd className="text-slate-700">{selected.OPPORTUNITY_NAME || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Organismo</dt><dd className="text-slate-700">{selected.ORGANISM || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Categoría organismo</dt><dd className="text-slate-700">{selected.ORGANISM_CATEGORY || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Región</dt><dd className="text-slate-700">{selected.REGION || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Estado origen</dt><dd className="text-slate-700">{selected.STATUS || "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Fecha publicación</dt><dd className="text-slate-700">{fmtDate(selected.PUBLISH_DATE)}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Fecha cierre</dt><dd className="text-slate-700">{fmtDate(selected.CLOSING_DATE)}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Monto disponible</dt><dd className="text-slate-700">{selected.AVAILABLE_AMOUNT ? `$${Number(selected.AVAILABLE_AMOUNT).toLocaleString("es-CL")} ${selected.CURRENCY || ""}` : "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Monto postulado</dt><dd className="text-slate-700">{selected.APPLIED_AMOUNT ? `$${Number(selected.APPLIED_AMOUNT).toLocaleString("es-CL")}` : "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Monto ganado</dt><dd className="text-slate-700">{selected.WON_AMOUNT ? `$${Number(selected.WON_AMOUNT).toLocaleString("es-CL")}` : "—"}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Fecha postulación</dt><dd className="text-slate-700">{fmtDate(selected.ACTUAL_APPLICATION_DATE)}</dd></div>
                <div><dt className="text-slate-400 font-semibold">Workspace</dt><dd className="text-slate-700">{selected.WORKSPACE_TITLE || "—"}</dd></div>
                {selected.COMMENTS && (
                  <div className="col-span-2">
                    <dt className="text-slate-400 font-semibold">Comentarios</dt>
                    <dd className="text-slate-700 mt-0.5 whitespace-pre-line">{selected.COMMENTS}</dd>
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
