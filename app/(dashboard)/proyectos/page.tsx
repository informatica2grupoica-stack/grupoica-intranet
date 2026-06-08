"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FolderOpen, Plus, Search, RefreshCcw, Download, Filter,
  ChevronLeft, ChevronRight, Eye, Pencil, Trash2, X, Save,
  Loader2, AlertCircle, DollarSign, Users, CheckCircle2,
  Clock, PauseCircle, XCircle, TrendingUp, Building2,
  Calendar, MapPin, StickyNote, Tag, BarChart2, Zap,
  ArrowUpRight
} from "lucide-react";
import * as XLSX from "xlsx";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Proyecto {
  id: string;
  obuma_id?: string;
  nombre: string;
  descripcion?: string;
  estado: string;
  tipo?: string;
  cliente_nombre?: string;
  cliente_rut?: string;
  responsable_nombre?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  monto_contrato: number;
  monto_ejecutado: number;
  avance_pct: number;
  ubicacion?: string;
  notas?: string;
  etiquetas?: string[];
  created_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt   = (n: number) => `$${Number(n || 0).toLocaleString("es-CL")}`;
const fmtF  = (d?: string | null) => d ? new Date(d).toLocaleDateString("es-CL") : "—";
const pct   = (ejec: number, cont: number) => cont > 0 ? Math.min(100, Math.round((ejec / cont) * 100)) : 0;

const ESTADO_CFG: Record<string, { label: string; bg: string; text: string; icon: any; dot: string }> = {
  activo:      { label: "Activo",      bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", icon: TrendingUp   },
  pausado:     { label: "Pausado",     bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-500",   icon: PauseCircle  },
  completado:  { label: "Completado",  bg: "bg-blue-100",    text: "text-[#2563EB]",   dot: "bg-[#2563EB]",   icon: CheckCircle2 },
  cancelado:   { label: "Cancelado",   bg: "bg-rose-100",    text: "text-rose-600",    dot: "bg-rose-500",    icon: XCircle      },
  "en espera": { label: "En espera",   bg: "bg-slate-100",   text: "text-slate-600",   dot: "bg-slate-400",   icon: Clock        },
};
const estadoCfg = (e: string) => ESTADO_CFG[e?.toLowerCase()] || ESTADO_CFG["activo"];

const TIPOS = ["licitacion", "privado", "interno", "concesion", "otro"];
const ESTADOS_FORM = ["activo", "en espera", "pausado", "completado", "cancelado"];

const FORM_VACIO: Partial<Proyecto> = {
  nombre: "", descripcion: "", estado: "activo", tipo: "",
  cliente_nombre: "", cliente_rut: "", responsable_nombre: "",
  fecha_inicio: "", fecha_fin: "",
  monto_contrato: 0, monto_ejecutado: 0, avance_pct: 0,
  ubicacion: "", notas: "", etiquetas: [],
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ProyectosPage() {
  const [proyectos, setProyectos]   = useState<Proyecto[]>([]);
  const [stats, setStats]           = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [syncing, setSyncing]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [texto, setTexto]           = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroTipo, setFiltroTipo]     = useState("");
  const [pag, setPag]               = useState(1);
  const [modal, setModal]           = useState<"crear" | "editar" | "ver" | null>(null);
  const [seleccionado, setSeleccionado] = useState<Proyecto | null>(null);
  const [form, setForm]             = useState<Partial<Proyecto>>(FORM_VACIO);
  const [guardando, setGuardando]   = useState(false);
  const [syncMsg, setSyncMsg]       = useState<string | null>(null);
  const POR_PAG = 15;

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      if (filtroEstado) qs.set("estado", filtroEstado);
      if (filtroTipo)   qs.set("tipo", filtroTipo);
      if (texto)        qs.set("q", texto);
      const res  = await fetch(`/api/proyectos${qs.toString() ? `?${qs}` : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setProyectos(json.data || []);
      setStats(json.stats || null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [filtroEstado, filtroTipo, texto]);

  useEffect(() => { cargar(); }, [cargar]);

  const syncObuma = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const res  = await fetch("/api/proyectos/sync", { method: "POST" });
      const json = await res.json();
      if (json.obuma_ok) {
        setSyncMsg(`✅ Obuma: ${json.sincronizados} proyectos sincronizados (${json.creados} nuevos, ${json.actualizados} actualizados)`);
        cargar();
      } else {
        setSyncMsg(`ℹ️ ${json.error || "Módulo Obuma no activo aún"} — Los proyectos en BD están actualizados.`);
      }
    } catch (e: any) { setSyncMsg(`❌ ${e.message}`); }
    finally { setSyncing(false); }
  };

  // Filtros locales adicionales
  const filtrados = useMemo(() => {
    if (!texto) return proyectos;
    const t = texto.toLowerCase();
    return proyectos.filter(p =>
      [p.nombre, p.cliente_nombre, p.ubicacion, p.tipo, p.responsable_nombre]
        .some(f => f?.toLowerCase().includes(t))
    );
  }, [proyectos, texto]);

  const totalPags = Math.ceil(filtrados.length / POR_PAG);
  const pagActual = filtrados.slice((pag - 1) * POR_PAG, pag * POR_PAG);

  // CRUD
  const abrirCrear = () => { setForm(FORM_VACIO); setModal("crear"); };
  const abrirEditar = (p: Proyecto) => { setSeleccionado(p); setForm(p); setModal("editar"); };
  const abrirVer    = async (p: Proyecto) => {
    setSeleccionado(p); setModal("ver");
    try {
      const res  = await fetch(`/api/proyectos/${p.id}`);
      const json = await res.json();
      if (res.ok) setSeleccionado(json.data);
    } catch {}
  };

  const guardar = async () => {
    if (!form.nombre?.trim()) return;
    setGuardando(true);
    try {
      const url    = modal === "editar" ? `/api/proyectos/${seleccionado?.id}` : "/api/proyectos";
      const method = modal === "editar" ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error);
      setModal(null);
      cargar();
    } catch (e: any) { alert(e.message); }
    finally { setGuardando(false); }
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Archivar este proyecto?")) return;
    await fetch(`/api/proyectos/${id}`, { method: "DELETE" });
    cargar();
  };

  const exportar = () => {
    const ws = XLSX.utils.json_to_sheet(filtrados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PROYECTOS");
    XLSX.writeFile(wb, `proyectos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-12">

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Total",       value: stats?.total      ?? 0,  color: "text-slate-700", bg: "bg-slate-100",   icon: FolderOpen },
          { label: "Activos",     value: stats?.activos    ?? 0,  color: "text-emerald-600", bg: "bg-emerald-100", icon: TrendingUp },
          { label: "Pausados",    value: stats?.pausados   ?? 0,  color: "text-amber-600",  bg: "bg-amber-100",   icon: PauseCircle },
          { label: "Completados", value: stats?.completados?? 0,  color: "text-[#2563EB]",  bg: "bg-[#EFF6FF]",   icon: CheckCircle2 },
          { label: "Monto Total", value: fmt(stats?.monto_total ?? 0), color: "text-slate-800", bg: "bg-slate-100", icon: DollarSign },
          { label: "Ejecutado",   value: fmt(stats?.monto_ejecutado ?? 0), color: "text-emerald-700", bg: "bg-emerald-50", icon: BarChart2 },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${k.bg} flex-shrink-0`}><k.icon size={17} className={k.color} /></div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider truncate">{k.label}</p>
              <p className={`text-lg font-black ${k.color} leading-tight truncate`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sync mensaje */}
      {syncMsg && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-xs font-bold text-slate-600 flex items-center justify-between">
          <span>{syncMsg}</span>
          <button onClick={() => setSyncMsg(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
        </div>
      )}

      {/* ── Filtros + acciones ─────────────────────────────────────────── */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Buscar proyecto, cliente, ubicación…" value={texto}
              onChange={e => { setTexto(e.target.value); setPag(1); }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" />
          </div>

          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPag(1); }}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            <option value="">Todos los estados</option>
            {ESTADOS_FORM.map(e => <option key={e} value={e}>{estadoCfg(e).label}</option>)}
          </select>

          <select value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setPag(1); }}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            <option value="">Todos los tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>

          <div className="flex gap-2 ml-auto">
            <button onClick={() => { setTexto(""); setFiltroEstado(""); setFiltroTipo(""); }}
              className="px-3 py-2.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl flex items-center gap-1.5">
              <Filter size={13} /> Limpiar
            </button>
            <button onClick={cargar} disabled={loading}
              className="px-3 py-2.5 text-xs font-bold text-white bg-slate-800 rounded-xl flex items-center gap-1.5 hover:bg-[#2563EB] disabled:opacity-50">
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} /> Actualizar
            </button>
            <button onClick={syncObuma} disabled={syncing}
              className="px-3 py-2.5 text-xs font-bold text-white bg-violet-600 rounded-xl flex items-center gap-1.5 hover:bg-violet-700 disabled:opacity-50">
              <Zap size={13} className={syncing ? "animate-pulse" : ""} /> Sync Obuma
            </button>
            <button onClick={exportar}
              className="px-3 py-2.5 text-xs font-bold bg-slate-700 text-white rounded-xl flex items-center gap-1.5">
              <Download size={13} /> Excel
            </button>
            <button onClick={abrirCrear}
              className="px-4 py-2.5 text-xs font-bold bg-[#2563EB] text-white rounded-xl flex items-center gap-1.5">
              <Plus size={14} /> Nuevo Proyecto
            </button>
          </div>
        </div>
        {!loading && (
          <p className="text-[10px] text-slate-400 mt-2 font-bold">
            {filtrados.length} proyecto{filtrados.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* ── Tabla / Cards ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="animate-spin text-[#2563EB] mb-3" size={36} />
            <p className="text-slate-400 text-sm">Cargando proyectos…</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center">
            <AlertCircle className="mx-auto text-rose-400 mb-2" size={32} />
            <p className="text-rose-600 font-bold text-sm">{error}</p>
            <button onClick={cargar} className="mt-3 text-xs text-[#2563EB] font-bold underline">Reintentar</button>
          </div>
        ) : pagActual.length === 0 ? (
          <div className="bg-white rounded-[2rem] border border-slate-100 p-16 text-center">
            <FolderOpen className="mx-auto text-slate-200 mb-3" size={48} />
            <p className="text-slate-400 font-bold">Sin proyectos registrados</p>
            <button onClick={abrirCrear} className="mt-4 px-5 py-2.5 bg-[#2563EB] text-white rounded-xl text-xs font-bold">
              Crear primer proyecto
            </button>
          </div>
        ) : (
          <>
            {pagActual.map(p => {
              const cfg   = estadoCfg(p.estado);
              const EIcon = cfg.icon;
              const avance = p.avance_pct || pct(p.monto_ejecutado, p.monto_contrato);
              return (
                <div key={p.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      {/* Info principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black ${cfg.bg} ${cfg.text}`}>
                            <EIcon size={9} /> {cfg.label}
                          </span>
                          {p.tipo && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 uppercase">
                              {p.tipo}
                            </span>
                          )}
                          {p.obuma_id && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-600">
                              🔗 Obuma #{p.obuma_id}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-black text-slate-800 truncate">{p.nombre}</h3>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                          {p.cliente_nombre && (
                            <span className="flex items-center gap-1"><Building2 size={10} /> {p.cliente_nombre}</span>
                          )}
                          {p.ubicacion && (
                            <span className="flex items-center gap-1"><MapPin size={10} /> {p.ubicacion}</span>
                          )}
                          {p.responsable_nombre && (
                            <span className="flex items-center gap-1"><Users size={10} /> {p.responsable_nombre}</span>
                          )}
                          {p.fecha_inicio && (
                            <span className="flex items-center gap-1"><Calendar size={10} /> {fmtF(p.fecha_inicio)} → {fmtF(p.fecha_fin)}</span>
                          )}
                        </div>
                      </div>

                      {/* Montos */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Contrato</p>
                        <p className="text-lg font-black text-slate-800">{fmt(p.monto_contrato)}</p>
                        {p.monto_ejecutado > 0 && (
                          <p className="text-[10px] text-emerald-600 font-bold">{fmt(p.monto_ejecutado)} ejecutado</p>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => abrirVer(p)} className="p-2 rounded-xl hover:bg-[#EFF6FF] hover:text-[#2563EB] text-slate-400 transition-colors" title="Ver detalle">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => abrirEditar(p)} className="p-2 rounded-xl hover:bg-amber-50 hover:text-amber-600 text-slate-400 transition-colors" title="Editar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => eliminar(p.id)} className="p-2 rounded-xl hover:bg-rose-50 hover:text-rose-500 text-slate-400 transition-colors" title="Archivar">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Barra de avance */}
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-slate-400 font-bold">Avance</span>
                        <span className="text-[10px] font-black text-slate-600">{avance}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            avance >= 100 ? "bg-[#2563EB]" :
                            avance >= 60  ? "bg-emerald-500" :
                            avance >= 30  ? "bg-amber-400" : "bg-slate-300"
                          }`}
                          style={{ width: `${avance}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Paginación */}
            {totalPags > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-400">{(pag - 1) * POR_PAG + 1}–{Math.min(pag * POR_PAG, filtrados.length)} de {filtrados.length}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPag(p => Math.max(p - 1, 1))} disabled={pag === 1}
                    className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-30"><ChevronLeft className="w-4 h-4 text-slate-600" /></button>
                  <span className="px-4 flex items-center bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600">{pag} / {totalPags}</span>
                  <button onClick={() => setPag(p => Math.min(p + 1, totalPags))} disabled={pag === totalPags}
                    className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-30"><ChevronRight className="w-4 h-4 text-slate-600" /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal Crear / Editar ──────────────────────────────────────── */}
      {(modal === "crear" || modal === "editar") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-[#EFF6FF] to-white">
              <div className="flex items-center gap-2">
                <FolderOpen size={18} className="text-[#2563EB]" />
                <h2 className="text-base font-black text-slate-800">
                  {modal === "crear" ? "Nuevo Proyecto" : "Editar Proyecto"}
                </h2>
              </div>
              <button onClick={() => setModal(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Nombre */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Nombre del proyecto *</label>
                <input value={form.nombre || ""} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-[#2563EB]/50 focus:bg-white transition-all"
                  placeholder="Nombre del proyecto…" />
              </div>

              {/* Estado + Tipo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Estado</label>
                  <select value={form.estado || "activo"} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none">
                    {ESTADOS_FORM.map(e => <option key={e} value={e}>{estadoCfg(e).label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Tipo</label>
                  <select value={form.tipo || ""} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none">
                    <option value="">Sin tipo</option>
                    {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              {/* Cliente */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Cliente</label>
                  <input value={form.cliente_nombre || ""} onChange={e => setForm(f => ({ ...f, cliente_nombre: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-[#2563EB]/50 transition-all"
                    placeholder="Razón social…" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">RUT Cliente</label>
                  <input value={form.cliente_rut || ""} onChange={e => setForm(f => ({ ...f, cliente_rut: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-[#2563EB]/50 transition-all"
                    placeholder="12.345.678-9" />
                </div>
              </div>

              {/* Responsable + Ubicación */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Responsable</label>
                  <input value={form.responsable_nombre || ""} onChange={e => setForm(f => ({ ...f, responsable_nombre: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-[#2563EB]/50 transition-all"
                    placeholder="Nombre del responsable…" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Ubicación</label>
                  <input value={form.ubicacion || ""} onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-[#2563EB]/50 transition-all"
                    placeholder="Ciudad, región…" />
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Fecha Inicio</label>
                  <input type="date" value={form.fecha_inicio || ""} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Fecha Término</label>
                  <input type="date" value={form.fecha_fin || ""} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                </div>
              </div>

              {/* Montos */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Monto Contrato ($)</label>
                  <input type="number" value={form.monto_contrato || 0} onChange={e => setForm(f => ({ ...f, monto_contrato: Number(e.target.value) }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Monto Ejecutado ($)</label>
                  <input type="number" value={form.monto_ejecutado || 0} onChange={e => setForm(f => ({ ...f, monto_ejecutado: Number(e.target.value) }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Avance (%)</label>
                  <input type="number" min={0} max={100} value={form.avance_pct || 0} onChange={e => setForm(f => ({ ...f, avance_pct: Number(e.target.value) }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Descripción</label>
                <textarea value={form.descripcion || ""} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none resize-none focus:border-[#2563EB]/50 transition-all"
                  placeholder="Descripción del proyecto…" />
              </div>

              {/* Notas */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Notas internas</label>
                <textarea value={form.notas || ""} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none resize-none focus:border-[#2563EB]/50 transition-all"
                  placeholder="Notas internas, observaciones…" />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button onClick={() => setModal(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:border-slate-300 transition-colors">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando || !form.nombre?.trim()}
                className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {modal === "crear" ? "Crear Proyecto" : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Ver Detalle ─────────────────────────────────────────── */}
      {modal === "ver" && seleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-[#EFF6FF] to-white">
              <div className="flex items-center gap-2">
                <FolderOpen size={18} className="text-[#2563EB]" />
                <h2 className="text-base font-black text-slate-800 truncate">{seleccionado.nombre}</h2>
                {(() => { const cfg = estadoCfg(seleccionado.estado); const I = cfg.icon; return (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black ml-1 ${cfg.bg} ${cfg.text}`}>
                    <I size={9} /> {cfg.label}
                  </span>
                ); })()}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setModal(null); setTimeout(() => abrirEditar(seleccionado), 100); }}
                  className="p-2 hover:bg-amber-50 hover:text-amber-600 text-slate-400 rounded-xl transition-colors" title="Editar">
                  <Pencil size={16} />
                </button>
                <button onClick={() => setModal(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Datos principales */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Cliente",      value: seleccionado.cliente_nombre, icon: Building2 },
                  { label: "RUT",          value: seleccionado.cliente_rut,    icon: Tag },
                  { label: "Responsable",  value: seleccionado.responsable_nombre, icon: Users },
                  { label: "Tipo",         value: seleccionado.tipo,           icon: FolderOpen },
                  { label: "Inicio",       value: fmtF(seleccionado.fecha_inicio), icon: Calendar },
                  { label: "Término",      value: fmtF(seleccionado.fecha_fin),    icon: Calendar },
                  { label: "Ubicación",    value: seleccionado.ubicacion,      icon: MapPin },
                  { label: "Monto Contrato",  value: fmt(seleccionado.monto_contrato),  icon: DollarSign },
                  { label: "Monto Ejecutado", value: fmt(seleccionado.monto_ejecutado), icon: ArrowUpRight },
                ].filter(i => i.value).map((item, i) => (
                  <div key={i} className="bg-slate-50 rounded-2xl p-3">
                    <p className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1 mb-0.5">
                      <item.icon size={9} /> {item.label}
                    </p>
                    <p className="text-sm font-bold text-slate-700">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Barra avance */}
              <div className="bg-slate-50 rounded-2xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wide">Avance del proyecto</span>
                  <span className="text-sm font-black text-slate-700">
                    {seleccionado.avance_pct || pct(seleccionado.monto_ejecutado, seleccionado.monto_contrato)}%
                  </span>
                </div>
                <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#3B82F6] transition-all duration-700"
                    style={{ width: `${seleccionado.avance_pct || pct(seleccionado.monto_ejecutado, seleccionado.monto_contrato)}%` }}
                  />
                </div>
              </div>

              {/* Descripción y notas */}
              {seleccionado.descripcion && (
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Descripción</p>
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-2xl p-4">{seleccionado.descripcion}</p>
                </div>
              )}
              {seleccionado.notas && (
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2 flex items-center gap-1">
                    <StickyNote size={10} /> Notas internas
                  </p>
                  <p className="text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded-2xl p-4">{seleccionado.notas}</p>
                </div>
              )}

              {/* Hitos */}
              {(seleccionado as any).hitos?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Hitos</p>
                  <div className="space-y-2">
                    {(seleccionado as any).hitos.map((h: any) => (
                      <div key={h.id} className={`flex items-center gap-3 p-3 rounded-xl border ${h.completado ? "bg-emerald-50 border-emerald-100" : "bg-white border-slate-100"}`}>
                        <CheckCircle2 size={14} className={h.completado ? "text-emerald-500" : "text-slate-300"} />
                        <span className={`text-xs font-bold flex-1 ${h.completado ? "text-emerald-700 line-through" : "text-slate-700"}`}>{h.nombre}</span>
                        {h.fecha_limite && <span className="text-[10px] text-slate-400">{fmtF(h.fecha_limite)}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button onClick={() => setModal(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
