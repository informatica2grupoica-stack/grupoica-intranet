"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText, Search, Download, RefreshCcw, ChevronLeft, ChevronRight,
  Eye, X, Loader2, AlertCircle, DollarSign, Users, CheckCircle2,
  Clock, XCircle, TrendingUp, Filter, Calendar, Hash
} from "lucide-react";
import * as XLSX from "xlsx";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt  = (n: any) => `$${Number(n || 0).toLocaleString("es-CL")}`;
const fmtF = (raw?: string | null) => {
  if (!raw || raw.startsWith("0000")) return "—";
  const d = raw.split(" ")[0].split("-");
  return d.length === 3 ? (d[0].length === 4 ? `${d[2]}-${d[1]}-${d[0]}` : raw) : raw;
};

const ESTADO_STYLE: Record<string, { bg: string; text: string; dot: string; icon: any }> = {
  VIGENTE:   { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", icon: CheckCircle2 },
  ACEPTADA:  { bg: "bg-blue-100",    text: "text-[#2563EB]",   dot: "bg-[#2563EB]",  icon: CheckCircle2 },
  RECHAZADA: { bg: "bg-rose-100",    text: "text-rose-600",    dot: "bg-rose-500",   icon: XCircle      },
  VENCIDA:   { bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-500",  icon: Clock        },
  ENVIADA:   { bg: "bg-sky-100",     text: "text-sky-700",     dot: "bg-sky-400",    icon: TrendingUp   },
};
const estadoStyle = (e?: string) => ESTADO_STYLE[e?.toUpperCase() || ""] || { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", icon: FileText };

const AÑOS  = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));
const MESES = [
  { v: "", l: "Todos los meses" },
  ...["01","02","03","04","05","06","07","08","09","10","11","12"].map((m, i) => ({
    v: m, l: `${m} – ${"Enero Febrero Marzo Abril Mayo Junio Julio Agosto Septiembre Octubre Noviembre Diciembre".split(" ")[i]}`,
  })),
];
const POR_PAG = 25;

// ─── Componente ──────────────────────────────────────────────────────────────
export default function CotizacionesPage() {
  const [datos, setDatos]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [texto, setTexto]           = useState("");
  const [mes, setMes]               = useState("");
  const [ano, setAno]               = useState(String(new Date().getFullYear()));
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [pag, setPag]               = useState(1);
  const [modal, setModal]           = useState<{ visible: boolean; loading: boolean; data: any }>({ visible: false, loading: false, data: null });
  const [debug, setDebug]           = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null); setDatos([]); setPag(1);
    try {
      const p: Record<string, string> = {};
      if (mes)       p.mes        = mes;
      if (ano)       p.ano        = ano;
      if (fechaDesde) p.fecha_desde = fechaDesde.split("-").reverse().join("-");
      if (fechaHasta) p.fecha_hasta = fechaHasta.split("-").reverse().join("-");
      const qs  = new URLSearchParams(p).toString();
      const res = await fetch(`/api/obuma/ventas/cotizaciones${qs ? `?${qs}` : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al consultar Obuma");
      setDatos(json.data || json.docs || (Array.isArray(json) ? json : []));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [mes, ano, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const verDetalle = async (id: string) => {
    setModal({ visible: true, loading: true, data: null });
    try {
      const res = await fetch(`/api/obuma/ventas/${id}`);
      const d   = await res.json();
      setModal({ visible: true, loading: false, data: res.ok ? d : null });
    } catch { setModal({ visible: true, loading: false, data: null }); }
  };

  // Filtros locales
  const filtrados = useMemo(() => {
    let lista = datos;
    if (filtroEstado) lista = lista.filter(r => (r.cotizacion_estado || r.estado || "").toUpperCase() === filtroEstado);
    if (texto) {
      const t = texto.toLowerCase();
      lista = lista.filter(r => JSON.stringify(r).toLowerCase().includes(t));
    }
    return lista;
  }, [datos, texto, filtroEstado]);

  // KPIs
  const kpis = useMemo(() => {
    const total   = filtrados.reduce((s, r) => s + Number(r.cotizacion_total || r.total || 0), 0);
    const vigentes = filtrados.filter(r => (r.cotizacion_estado || r.estado || "").toUpperCase() === "VIGENTE").length;
    const aceptadas = filtrados.filter(r => (r.cotizacion_estado || r.estado || "").toUpperCase() === "ACEPTADA").length;
    const clientes = new Set(filtrados.map(r => r.cotizacion_rut_cliente || r.cliente_rut)).size;
    return { total: filtrados.length, monto: total, vigentes, aceptadas, clientes };
  }, [filtrados]);

  const totalPags = Math.ceil(filtrados.length / POR_PAG);
  const pagActual = filtrados.slice((pag - 1) * POR_PAG, pag * POR_PAG);

  const exportar = () => {
    const ws = XLSX.utils.json_to_sheet(filtrados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "COTIZACIONES");
    XLSX.writeFile(wb, `cotizaciones_${ano}${mes ? "_" + mes : ""}.xlsx`);
  };

  const estados = useMemo(() => {
    const set = new Set(datos.map(r => (r.cotizacion_estado || r.estado || "").toUpperCase()).filter(Boolean));
    return Array.from(set).sort();
  }, [datos]);

  return (
    <div className="space-y-5 pb-10">

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total",     value: kpis.total,                    color: "text-slate-700", bg: "bg-slate-100",   icon: Hash },
          { label: "Monto",     value: fmt(kpis.monto),               color: "text-[#2563EB]", bg: "bg-[#EFF6FF]",   icon: DollarSign },
          { label: "Clientes",  value: kpis.clientes,                 color: "text-purple-600",bg: "bg-purple-100",  icon: Users },
          { label: "Vigentes",  value: kpis.vigentes,                 color: "text-emerald-600",bg:"bg-emerald-100", icon: CheckCircle2 },
          { label: "Aceptadas", value: kpis.aceptadas,                color: "text-blue-600",  bg: "bg-blue-100",    icon: TrendingUp },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${k.bg}`}><k.icon size={18} className={k.color} /></div>
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{k.label}</p>
              <p className={`text-xl font-black ${k.color} leading-tight`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center gap-3">

          {/* Búsqueda texto */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text" placeholder="Buscar cliente, folio, RUT…" value={texto}
              onChange={e => { setTexto(e.target.value); setPag(1); }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
            />
          </div>

          {/* Estado */}
          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPag(1); }}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            <option value="">Todos los estados</option>
            {estados.map(e => <option key={e} value={e}>{e}</option>)}
          </select>

          {/* Mes / Año */}
          <select value={mes} onChange={e => setMes(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            {MESES.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            {AÑOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          {/* Rango fechas */}
          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-slate-400" />
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none" />
            <span className="text-slate-300 text-xs">—</span>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none" />
          </div>

          {/* Acciones */}
          <div className="flex gap-2 ml-auto">
            <button onClick={() => { setMes(""); setFechaDesde(""); setFechaHasta(""); setTexto(""); setFiltroEstado(""); }}
              className="px-3 py-2.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl flex items-center gap-1.5">
              <Filter size={13} /> Limpiar
            </button>
            <button onClick={cargar} disabled={loading}
              className="px-3 py-2.5 text-xs font-bold text-white bg-slate-800 rounded-xl flex items-center gap-1.5 hover:bg-[#2563EB] disabled:opacity-50">
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} /> Buscar
            </button>
            <button onClick={exportar}
              className="px-4 py-2.5 text-xs font-bold bg-[#2563EB] text-white rounded-xl flex items-center gap-1.5">
              <Download size={13} /> Excel
            </button>
            <button onClick={() => setDebug(d => !d)}
              className={`px-3 py-2.5 text-xs font-bold rounded-xl ${debug ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-400"}`}>
              {} Debug
            </button>
          </div>
        </div>
        {!loading && (
          <p className="text-[10px] text-slate-400 mt-2 font-bold">
            {filtrados.length} cotización{filtrados.length !== 1 ? "es" : ""} · API Obuma
          </p>
        )}
      </div>

      {/* Debug */}
      {debug && datos.length > 0 && (
        <div className="bg-slate-900 rounded-2xl p-5 font-mono text-xs overflow-x-auto">
          <p className="text-amber-400 mb-2">CAMPOS: {Object.keys(datos[0]).join(" | ")}</p>
          <pre className="text-slate-300 text-[10px]">{JSON.stringify(datos[0], null, 2)}</pre>
        </div>
      )}

      {/* ── Tabla ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-5 py-4">Folio</th>
                <th className="px-5 py-4">Fecha</th>
                <th className="px-5 py-4">Cliente</th>
                <th className="px-5 py-4 text-right">Total</th>
                <th className="px-5 py-4 text-center">Estado</th>
                <th className="px-5 py-4 text-center">Ver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="p-16 text-center">
                  <Loader2 className="animate-spin text-[#2563EB] mx-auto mb-2" size={32} />
                  <p className="text-slate-400 text-xs">Consultando API Obuma…</p>
                </td></tr>
              ) : error ? (
                <tr><td colSpan={6} className="p-16 text-center">
                  <AlertCircle className="mx-auto text-rose-400 mb-2" size={32} />
                  <p className="text-rose-500 text-sm font-bold">{error}</p>
                  <button onClick={cargar} className="mt-3 text-xs text-[#2563EB] font-bold underline">Reintentar</button>
                </td></tr>
              ) : pagActual.length === 0 ? (
                <tr><td colSpan={6} className="p-16 text-center">
                  <FileText className="mx-auto text-slate-200 mb-3" size={40} />
                  <p className="text-slate-400 text-sm">Sin cotizaciones para este período</p>
                </td></tr>
              ) : pagActual.map((r, i) => {
                const folio   = r.cotizacion_folio   || r.folio     || "—";
                const fecha   = r.cotizacion_fecha   || r.fecha;
                const cliente = r.cotizacion_cliente_razon_social || r.cliente_razon_social || r.cotizacion_cliente || "—";
                const rut     = r.cotizacion_rut_cliente || r.cliente_rut || "";
                const total   = r.cotizacion_total   || r.total     || 0;
                const estado  = (r.cotizacion_estado || r.estado    || "").toUpperCase();
                const id      = r.cotizacion_id      || r.id;
                const es      = estadoStyle(estado);
                const EIcon   = es.icon;
                return (
                  <tr key={id || i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-black text-[#2563EB]">#{folio}</span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">{fmtF(fecha)}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-xs font-bold text-slate-800 truncate max-w-[200px]">{cliente}</p>
                      {rut && <p className="text-[9px] font-mono text-slate-400 mt-0.5">{rut}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-black text-slate-800">{fmt(total)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {estado && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black ${es.bg} ${es.text}`}>
                          <EIcon size={9} />
                          {estado}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {id && (
                        <button onClick={() => verDetalle(String(id))}
                          className="p-2 rounded-lg bg-slate-50 hover:bg-[#EFF6FF] text-slate-400 hover:text-[#2563EB] transition-all opacity-0 group-hover:opacity-100">
                          <Eye size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && filtrados.length > POR_PAG && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {(pag - 1) * POR_PAG + 1}–{Math.min(pag * POR_PAG, filtrados.length)} de {filtrados.length}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPag(p => Math.max(p - 1, 1))} disabled={pag === 1}
                className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-30 hover:border-[#2563EB] transition-colors">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <span className="px-4 flex items-center bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600">
                {pag} / {totalPags}
              </span>
              <button onClick={() => setPag(p => Math.min(p + 1, totalPags))} disabled={pag === totalPags}
                className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-30 hover:border-[#2563EB] transition-colors">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal detalle ─────────────────────────────────────────────── */}
      {modal.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-[#EFF6FF] to-white">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[#2563EB]" />
                <h2 className="text-base font-black text-slate-800">Detalle Cotización</h2>
              </div>
              <button onClick={() => setModal({ visible: false, loading: false, data: null })}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {modal.loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="animate-spin text-[#2563EB] mb-3" size={36} />
                  <p className="text-slate-400 text-sm">Cargando detalle…</p>
                </div>
              ) : modal.data ? (
                <pre className="text-[10px] font-mono text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-2xl p-5 overflow-x-auto">
                  {JSON.stringify(modal.data, null, 2)}
                </pre>
              ) : (
                <div className="text-center py-20">
                  <AlertCircle size={36} className="mx-auto text-rose-300 mb-3" />
                  <p className="text-slate-500 text-sm">Sin detalle disponible</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button onClick={() => setModal({ visible: false, loading: false, data: null })}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:border-[#2563EB] hover:text-[#2563EB] transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
