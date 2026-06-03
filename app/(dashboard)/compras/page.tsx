// app/(dashboard)/compras/page.tsx
"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ShoppingBag, Search, ChevronLeft, ChevronRight,
  Eye, Package, X, Loader2, Building2, Calendar, DollarSign,
  AlertCircle, Download, Filter, Hash, CheckCircle2,
  FileText, CreditCard, RefreshCcw, Banknote, TrendingUp,
  ShoppingCart, Receipt
} from "lucide-react";
import * as XLSX from "xlsx";

// ─── Tipos ─────────────────────────────────────────────────────────────────────
type TabType = "oc" | "compras" | "dte" | "pagos";

interface Filtros {
  texto: string;
  estado: string;
  fechaDesde: string;
  fechaHasta: string;
  mes: string;
  ano: string;
  proveedorRut: string;
}

const FILTROS_INICIAL: Filtros = {
  texto: "", estado: "", fechaDesde: "", fechaHasta: "",
  mes: "", ano: new Date().getFullYear().toString(), proveedorRut: "",
};

const MESES = [
  "", "01-Enero", "02-Febrero", "03-Marzo", "04-Abril", "05-Mayo", "06-Junio",
  "07-Julio", "08-Agosto", "09-Septiembre", "10-Octubre", "11-Noviembre", "12-Diciembre",
];

const AÑOS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

const ESTADOS_OC = ["", "SOLICITADA", "APROBADA", "ENVIADA", "RECEPCIONADA", "FACTURADA", "ANULADA", "PENDIENTE"];

const estadoColor = (e: string) => {
  const m: Record<string, string> = {
    FACTURADA: "bg-emerald-50 text-emerald-700 border-emerald-200",
    APROBADA: "bg-blue-50 text-blue-700 border-blue-200",
    ENVIADA: "bg-sky-50 text-sky-700 border-sky-200",
    RECEPCIONADA: "bg-teal-50 text-teal-700 border-teal-200",
    ANULADA: "bg-rose-50 text-rose-700 border-rose-200",
    SOLICITADA: "bg-amber-50 text-amber-700 border-amber-200",
    PENDIENTE: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return m[e?.toUpperCase()] || "bg-slate-50 text-slate-600 border-slate-200";
};

const fmt = (n: number | string) => `$${Number(n || 0).toLocaleString("es-CL")}`;
const fmtFecha = (raw: string | null) => {
  if (!raw) return "—";
  const d = raw.split(" ")[0]; // "yyyy-mm-dd" o "dd-mm-yyyy"
  const parts = d.split("-");
  if (parts.length !== 3) return raw;
  if (parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`; // yyyy→dd/mm/yyyy
  return `${parts[0]}-${parts[1]}-${parts[2]}`;
};

// ─── Componente principal ───────────────────────────────────────────────────────
export default function ComprasPage() {
  const [tab, setTab] = useState<TabType>("oc");
  const [datos, setDatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Filtros>({ ...FILTROS_INICIAL });
  const [pag, setPag] = useState(1);
  const POR_PAG = 20;

  // Modal detalle OC
  const [modalOC, setModalOC] = useState<{ visible: boolean; loading: boolean; data: any }>({
    visible: false, loading: false, data: null,
  });

  // ─── Construir params para la API ──────────────────────────────────────────
  const buildParams = useCallback(() => {
    const p: Record<string, string> = {};
    if (filtros.fechaDesde) p.fecha_desde = filtros.fechaDesde.split("-").reverse().join("-"); // dd-mm-yyyy
    if (filtros.fechaHasta) p.fecha_hasta = filtros.fechaHasta.split("-").reverse().join("-");
    if (filtros.mes) p.mes = filtros.mes.split("-")[0];
    if (filtros.ano) {
      if (tab === "oc") p.ano = filtros.ano;
      else if (tab === "compras") p.ano_contable = filtros.ano;
      else if (tab === "dte") p.ano_contable = filtros.ano;
      else p.ano = filtros.ano;
    }
    if (filtros.estado && tab === "oc") p.estado = filtros.estado;
    if (filtros.proveedorRut) p.proveedor_rut = filtros.proveedorRut;
    return new URLSearchParams(p).toString();
  }, [filtros, tab]);

  // ─── Cargar datos ────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDatos([]);
    setPag(1);
    try {
      const qs = buildParams();
      const endpoints: Record<TabType, string> = {
        oc: `/api/obuma/oc${qs ? `?${qs}` : ""}`,
        compras: `/api/obuma/compras${qs ? `?${qs}` : ""}`,
        dte: `/api/obuma/compras-dte${qs ? `?${qs}` : ""}`,
        pagos: `/api/obuma/compras-pagos${qs ? `?${qs}` : ""}`,
      };
      const res = await fetch(endpoints[tab]);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al cargar datos");
      const rows = json.data || json.docs || (Array.isArray(json) ? json : []);
      setDatos(rows);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tab, buildParams]);

  useEffect(() => { cargar(); }, [cargar]);

  // ─── Filtro texto local ──────────────────────────────────────────────────────
  const datosFiltrados = useMemo(() => {
    if (!filtros.texto) return datos;
    const t = filtros.texto.toLowerCase();
    return datos.filter((row) =>
      JSON.stringify(row).toLowerCase().includes(t)
    );
  }, [datos, filtros.texto]);

  const totalPags = Math.ceil(datosFiltrados.length / POR_PAG);
  const pagActual = datosFiltrados.slice((pag - 1) * POR_PAG, pag * POR_PAG);

  // ─── KPIs dinámicos ─────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (tab === "oc") {
      const monto = datosFiltrados.reduce((s, r) => s + Number(r.compra_oc_total || 0), 0);
      const fac = datosFiltrados.filter((r) => r.compra_oc_estado === "FACTURADA").length;
      const ap = datosFiltrados.filter((r) => r.compra_oc_estado === "APROBADA").length;
      return [
        { label: "Total OC", value: datosFiltrados.length, color: "text-slate-700", bg: "bg-slate-100", icon: ShoppingCart },
        { label: "Facturadas", value: fac, color: "text-emerald-600", bg: "bg-emerald-100", icon: CheckCircle2 },
        { label: "Aprobadas", value: ap, color: "text-blue-600", bg: "bg-blue-100", icon: Receipt },
        { label: "Monto Total", value: fmt(monto), color: "text-[#059669]", bg: "bg-[#D1FAE5]", icon: DollarSign },
      ];
    }
    if (tab === "compras") {
      const total = datosFiltrados.reduce((s, r) => s + Number(r.compra_total || 0), 0);
      const pagado = datosFiltrados.reduce((s, r) => s + Number(r.compra_total_pagado || 0), 0);
      const porPagar = datosFiltrados.reduce((s, r) => s + Number(r.compra_total_por_pagar || 0), 0);
      return [
        { label: "Total Compras", value: datosFiltrados.length, color: "text-slate-700", bg: "bg-slate-100", icon: FileText },
        { label: "Monto Total", value: fmt(total), color: "text-[#059669]", bg: "bg-[#D1FAE5]", icon: DollarSign },
        { label: "Pagado", value: fmt(pagado), color: "text-emerald-600", bg: "bg-emerald-100", icon: CheckCircle2 },
        { label: "Por Pagar", value: fmt(porPagar), color: "text-rose-600", bg: "bg-rose-100", icon: AlertCircle },
      ];
    }
    if (tab === "dte") {
      const monto = datosFiltrados.reduce((s, r) => s + Number(r.total || r.compra_total || 0), 0);
      return [
        { label: "Total DTE", value: datosFiltrados.length, color: "text-slate-700", bg: "bg-slate-100", icon: FileText },
        { label: "Monto Total", value: fmt(monto), color: "text-[#059669]", bg: "bg-[#D1FAE5]", icon: DollarSign },
        { label: "Proveedores", value: new Set(datosFiltrados.map((r) => r.proveedor_rut || r.rut_proveedor)).size, color: "text-purple-600", bg: "bg-purple-100", icon: Building2 },
        { label: "Tipos Dcto.", value: new Set(datosFiltrados.map((r) => r.tipo_dcto)).size, color: "text-amber-600", bg: "bg-amber-100", icon: Hash },
      ];
    }
    // pagos
    const monto = datosFiltrados.reduce((s, r) => s + Number(r.cp_monto || 0), 0);
    return [
      { label: "Total Pagos", value: datosFiltrados.length, color: "text-slate-700", bg: "bg-slate-100", icon: CreditCard },
      { label: "Monto Total", value: fmt(monto), color: "text-[#059669]", bg: "bg-[#D1FAE5]", icon: DollarSign },
      { label: "Orígenes", value: new Set(datosFiltrados.map((r) => r.cp_origen_nombre)).size, color: "text-blue-600", bg: "bg-blue-100", icon: TrendingUp },
      { label: "Mes/Año", value: `${filtros.mes || "*"}/${filtros.ano}`, color: "text-slate-500", bg: "bg-slate-100", icon: Calendar },
    ];
  }, [datosFiltrados, tab, filtros]);

  // ─── Ver detalle OC ─────────────────────────────────────────────────────────
  const verDetalleOC = async (id: string) => {
    setModalOC({ visible: true, loading: true, data: null });
    try {
      const res = await fetch(`/api/obuma/oc/${id}`);
      const data = await res.json();
      setModalOC({ visible: true, loading: false, data: res.ok ? data : null });
    } catch {
      setModalOC({ visible: true, loading: false, data: null });
    }
  };

  // ─── Exportar Excel ─────────────────────────────────────────────────────────
  const exportarExcel = () => {
    let rows: any[] = [];
    const ts = new Date().toISOString().slice(0, 10);

    if (tab === "oc") {
      rows = datosFiltrados.map((r) => ({
        "Folio": r.compra_oc_folio,
        "Fecha": fmtFecha(r.compra_oc_fecha_ingreso),
        "Estado": r.compra_oc_estado || "—",
        "Proveedor": r.proveedor_razon_social || "—",
        "RUT Proveedor": r.proveedor_rut || "—",
        "Forma Pago": r.compra_oc_forma_pago || "—",
        "Método Despacho": r.compra_oc_metodo_despacho || "—",
        "Moneda": r.compra_oc_moneda || "CLP",
        "Centro Costo": r.compra_oc_centro_costo || "—",
        "Concepto Gasto": r.compra_oc_concepto_gasto || "—",
        "Subtotal ($)": Number(r.compra_oc_subtotal || 0),
        "Neto ($)": Number(r.compra_oc_neto || 0),
        "IVA ($)": Number(r.compra_oc_iva || 0),
        "Total ($)": Number(r.compra_oc_total || 0),
        "Observación": r.compra_oc_observacion || "—",
        "Referencia": r.compra_oc_referencia || "—",
      }));
    } else if (tab === "compras") {
      rows = datosFiltrados.map((r) => ({
        "ID": r.compra_id,
        "Folio": r.folio_dcto || "—",
        "Tipo Dcto.": r.tipo_dcto || "—",
        "Fecha": fmtFecha(r.compra_fecha),
        "Período": r.compra_periodo_contable || "—",
        "Proveedor": r.proveedor_razon_social || "—",
        "RUT": r.proveedor_rut || "—",
        "Estado": r.compra_estado || "—",
        "Total ($)": Number(r.compra_total || 0),
        "Total Pagado ($)": Number(r.compra_total_pagado || 0),
        "Por Pagar ($)": Number(r.compra_total_por_pagar || 0),
      }));
    } else if (tab === "dte") {
      rows = datosFiltrados.map((r) => ({
        "ID DTE": r.dte_id || r.id,
        "Folio": r.folio_dcto || "—",
        "Tipo Dcto.": r.tipo_dcto || "—",
        "Proveedor": r.proveedor_razon_social || "—",
        "RUT Proveedor": r.rut_proveedor || r.proveedor_rut || "—",
        "Mes Contable": r.mes_contable || "—",
        "Año Contable": r.ano_contable || "—",
        "Total ($)": Number(r.total || r.compra_total || 0),
        "Compra ID": r.id_compra || "—",
      }));
    } else {
      rows = datosFiltrados.map((r) => ({
        "ID Pago": r.cp_id,
        "Fecha": fmtFecha(r.cp_fecha_ingreso),
        "Mes": r.cp_mes,
        "Año": r.cp_ano,
        "Origen": r.cp_origen_nombre || "—",
        "Monto ($)": Number(r.cp_monto || 0),
      }));
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab.toUpperCase());
    XLSX.writeFile(wb, `${tab.toUpperCase()}_${ts}.xlsx`);
  };

  const exportarDetalleOC = () => {
    if (!modalOC.data) return;
    const d = modalOC.data;
    const rows = (d.productos || []).map((p: any) => ({
      "Folio OC": d.folio,
      "Proveedor": d.proveedor?.razon_social || "—",
      "Estado": d.estado,
      "SKU": p.sku || "—",
      "Producto": p.nombre,
      "Cantidad": p.cantidad,
      "Unidad": p.unidad,
      "Precio Unitario ($)": p.precio_unitario,
      "Subtotal ($)": p.subtotal,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `OC-${d.folio}`);
    XLSX.writeFile(wb, `Detalle_OC_${d.folio}.xlsx`);
  };

  // ─── Renderizar tabla según pestaña ────────────────────────────────────────
  const renderTabla = () => {
    if (loading) return (
      <tr><td colSpan={8} className="p-16 text-center">
        <Loader2 className="animate-spin text-[#059669] mx-auto mb-2" size={32} />
        <p className="text-slate-400 text-xs">Consultando API Obuma...</p>
      </td></tr>
    );
    if (error) return (
      <tr><td colSpan={8} className="p-16 text-center">
        <AlertCircle className="mx-auto text-rose-400 mb-2" size={32} />
        <p className="text-rose-500 text-sm font-bold">{error}</p>
        <button onClick={cargar} className="mt-2 text-xs text-[#059669] font-bold hover:underline">Reintentar</button>
      </td></tr>
    );
    if (pagActual.length === 0) return (
      <tr><td colSpan={8} className="p-16 text-center text-slate-400">
        No hay registros para los filtros aplicados.
      </td></tr>
    );

    if (tab === "oc") return pagActual.map((r) => (
      <tr key={r.compra_oc_id} className="hover:bg-slate-50/50 transition-colors">
        <td className="px-5 py-3.5 font-bold text-[#059669]">#{r.compra_oc_folio}</td>
        <td className="px-5 py-3.5 text-xs text-slate-600">{fmtFecha(r.compra_oc_fecha_ingreso)}</td>
        <td className="px-5 py-3.5">
          <p className="text-xs font-bold text-slate-700 truncate max-w-[180px]">{r.proveedor_razon_social || "—"}</p>
          <p className="text-[9px] font-mono text-slate-400">{r.proveedor_rut || "—"}</p>
        </td>
        <td className="px-5 py-3.5 text-xs text-slate-500">{r.compra_oc_forma_pago || "—"}</td>
        <td className="px-5 py-3.5 text-right font-black text-slate-800">{fmt(r.compra_oc_total)}</td>
        <td className="px-5 py-3.5 text-center">
          <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold border ${estadoColor(r.compra_oc_estado)}`}>
            {r.compra_oc_estado || "PENDIENTE"}
          </span>
        </td>
        <td className="px-5 py-3.5 text-center">
          <button onClick={() => verDetalleOC(r.compra_oc_id)}
            className="p-2 rounded-lg bg-slate-100 hover:bg-[#D1FAE5] text-slate-500 hover:text-[#059669] transition-all" title="Ver detalle">
            <Eye size={15} />
          </button>
        </td>
      </tr>
    ));

    if (tab === "compras") return pagActual.map((r, i) => (
      <tr key={r.compra_id || i} className="hover:bg-slate-50/50 transition-colors">
        <td className="px-5 py-3.5 font-bold text-slate-700">{r.compra_id || "—"}</td>
        <td className="px-5 py-3.5 text-[10px] font-bold text-slate-500 bg-slate-50 rounded-md">{r.tipo_dcto || "—"} {r.folio_dcto || ""}</td>
        <td className="px-5 py-3.5 text-xs text-slate-600">{fmtFecha(r.compra_fecha)}</td>
        <td className="px-5 py-3.5">
          <p className="text-xs font-bold text-slate-700 truncate max-w-[180px]">{r.proveedor_razon_social || "—"}</p>
          <p className="text-[9px] font-mono text-slate-400">{r.proveedor_rut || "—"}</p>
        </td>
        <td className="px-5 py-3.5 text-right font-black text-slate-800">{fmt(r.compra_total)}</td>
        <td className="px-5 py-3.5 text-right text-emerald-600 font-bold text-xs">{fmt(r.compra_total_pagado)}</td>
        <td className="px-5 py-3.5 text-right text-rose-500 font-bold text-xs">{fmt(r.compra_total_por_pagar)}</td>
        <td className="px-5 py-3.5 text-center">
          <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold border ${estadoColor(r.compra_estado)}`}>
            {r.compra_estado || "—"}
          </span>
        </td>
      </tr>
    ));

    if (tab === "dte") return pagActual.map((r, i) => (
      <tr key={r.dte_id || r.id || i} className="hover:bg-slate-50/50 transition-colors">
        <td className="px-5 py-3.5 font-mono text-[10px] text-slate-500">{r.dte_id || r.id || "—"}</td>
        <td className="px-5 py-3.5">
          <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{r.tipo_dcto || "—"}</span>
          <span className="ml-1.5 text-xs font-bold text-slate-700">#{r.folio_dcto || "—"}</span>
        </td>
        <td className="px-5 py-3.5">
          <p className="text-xs font-bold text-slate-700 truncate max-w-[180px]">{r.proveedor_razon_social || "—"}</p>
          <p className="text-[9px] font-mono text-slate-400">{r.rut_proveedor || r.proveedor_rut || "—"}</p>
        </td>
        <td className="px-5 py-3.5 text-xs text-slate-500">{r.mes_contable || "—"}/{r.ano_contable || "—"}</td>
        <td className="px-5 py-3.5 text-right font-black text-slate-800">{fmt(r.total || r.compra_total)}</td>
        <td className="px-5 py-3.5 text-center text-[10px] text-slate-400">{r.id_compra || "—"}</td>
      </tr>
    ));

    // Pagos
    return pagActual.map((r, i) => (
      <tr key={r.cp_id || i} className="hover:bg-slate-50/50 transition-colors">
        <td className="px-5 py-3.5 font-mono text-[10px] text-slate-500">{r.cp_id}</td>
        <td className="px-5 py-3.5 text-xs text-slate-600">{fmtFecha(r.cp_fecha_ingreso)}</td>
        <td className="px-5 py-3.5 text-xs text-slate-500">{r.cp_mes}/{r.cp_ano}</td>
        <td className="px-5 py-3.5">
          <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded uppercase">
            {r.cp_origen_nombre || "—"}
          </span>
        </td>
        <td className="px-5 py-3.5 text-right font-black text-emerald-600">{fmt(r.cp_monto)}</td>
      </tr>
    ));
  };

  const colHeaders: Record<TabType, string[]> = {
    oc: ["Folio", "Fecha", "Proveedor", "Forma Pago", "Total", "Estado", "Ver"],
    compras: ["ID", "Tipo/Folio", "Fecha", "Proveedor", "Total", "Pagado", "Por Pagar", "Estado"],
    dte: ["ID", "Tipo/Folio", "Proveedor", "Período", "Total", "Compra ID"],
    pagos: ["ID", "Fecha", "Período", "Origen", "Monto"],
  };

  const TABS = [
    { id: "oc" as TabType, label: "Órdenes de Compra", icon: ShoppingCart, desc: "OC / comprasOc" },
    { id: "compras" as TabType, label: "Compras / Facturas", icon: FileText, desc: "Facturas registradas" },
    { id: "dte" as TabType, label: "DTE Recibidos", icon: Receipt, desc: "Documentos tributarios" },
    { id: "pagos" as TabType, label: "Pagos", icon: CreditCard, desc: "Pagos realizados" },
  ];

  return (
    <div className="space-y-5 pb-10">

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setDatos([]); setFiltros({ ...FILTROS_INICIAL }); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wide transition-all ${
              tab === t.id
                ? "bg-[#059669] text-white shadow-md shadow-emerald-900/20"
                : "bg-white text-slate-500 border border-slate-200 hover:border-[#059669] hover:text-[#059669]"
            }`}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
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
          {/* Búsqueda local */}
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Buscar en resultados..."
              value={filtros.texto}
              onChange={(e) => setFiltros((f) => ({ ...f, texto: e.target.value }))}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#059669]/20" />
          </div>

          {/* Estado (solo OC) */}
          {tab === "oc" && (
            <select value={filtros.estado}
              onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
              {ESTADOS_OC.map((e) => <option key={e} value={e}>{e || "Todos los estados"}</option>)}
            </select>
          )}

          {/* RUT Proveedor */}
          <input type="text" placeholder="RUT proveedor"
            value={filtros.proveedorRut}
            onChange={(e) => setFiltros((f) => ({ ...f, proveedorRut: e.target.value }))}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none w-36" />

          {/* Mes / Año */}
          <select value={filtros.mes}
            onChange={(e) => setFiltros((f) => ({ ...f, mes: e.target.value }))}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            {MESES.map((m) => <option key={m} value={m.split("-")[0]}>{m || "Todos los meses"}</option>)}
          </select>

          <select value={filtros.ano}
            onChange={(e) => setFiltros((f) => ({ ...f, ano: e.target.value }))}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            {AÑOS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>

          {/* Fechas */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold">Desde</span>
            <input type="date" value={filtros.fechaDesde}
              onChange={(e) => setFiltros((f) => ({ ...f, fechaDesde: e.target.value }))}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none" />
            <span className="text-[10px] text-slate-400 font-bold">Hasta</span>
            <input type="date" value={filtros.fechaHasta}
              onChange={(e) => setFiltros((f) => ({ ...f, fechaHasta: e.target.value }))}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none" />
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => { setFiltros({ ...FILTROS_INICIAL }); }}
              className="px-3 py-2.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl flex items-center gap-1.5 hover:bg-slate-200 transition-all">
              <Filter size={13} /> Limpiar
            </button>
            <button onClick={cargar} disabled={loading}
              className="px-3 py-2.5 text-xs font-bold text-white bg-slate-800 rounded-xl flex items-center gap-1.5 hover:bg-[#059669] transition-all">
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} /> Buscar en API
            </button>
            <button onClick={exportarExcel}
              className="px-4 py-2.5 text-xs font-bold bg-[#059669] text-white rounded-xl flex items-center gap-1.5 shadow-sm hover:bg-[#047857] transition-all">
              <Download size={13} /> Excel
            </button>
          </div>
        </div>

        {!loading && (
          <p className="text-[10px] text-slate-400 mt-2.5 font-bold">
            {datosFiltrados.length} registros · API Obuma
          </p>
        )}
      </div>

      {/* ── Tabla ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <tr>
                {colHeaders[tab].map((h) => (
                  <th key={h} className="px-5 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {renderTabla()}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && datosFiltrados.length > POR_PAG && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {(pag - 1) * POR_PAG + 1}–{Math.min(pag * POR_PAG, datosFiltrados.length)} de {datosFiltrados.length}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPag((p) => Math.max(p - 1, 1))} disabled={pag === 1}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <div className="flex items-center px-4 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                {pag} / {totalPags}
              </div>
              <button onClick={() => setPag((p) => Math.min(p + 1, totalPags))} disabled={pag === totalPags}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal detalle OC ─────────────────────────────────────────── */}
      {modalOC.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="text-[#059669]" size={18} />
                  Detalle Orden de Compra
                </h2>
                {modalOC.data && (
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Folio #{modalOC.data.folio} · {modalOC.data.estado} · {modalOC.data.proveedor?.razon_social}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {modalOC.data && (
                  <button onClick={exportarDetalleOC}
                    className="px-4 py-2 text-xs font-bold bg-[#059669] text-white rounded-xl flex items-center gap-1.5 hover:bg-[#047857]">
                    <Download size={13} /> Excel
                  </button>
                )}
                <button onClick={() => setModalOC({ visible: false, loading: false, data: null })}
                  className="p-2 hover:bg-slate-100 rounded-xl">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {modalOC.loading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#059669]" size={36} /></div>
              ) : modalOC.data ? (
                <div className="space-y-5">
                  {/* Proveedor + totales */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 bg-slate-50 rounded-xl p-4">
                      <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Proveedor</p>
                      <p className="font-bold text-slate-800">{modalOC.data.proveedor?.razon_social}</p>
                      <p className="text-xs font-mono text-slate-400">{modalOC.data.proveedor?.rut}</p>
                      {modalOC.data.proveedor?.direccion && (
                        <p className="text-xs text-slate-400 mt-1">{modalOC.data.proveedor.direccion}</p>
                      )}
                      {modalOC.data.proveedor?.email && (
                        <p className="text-xs text-[#059669] mt-0.5">{modalOC.data.proveedor.email}</p>
                      )}
                      {modalOC.data.proveedor?.telefono && (
                        <p className="text-xs text-slate-500">{modalOC.data.proveedor.telefono}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {[
                        ["Fecha Emisión", fmtFecha(modalOC.data.fecha_emision)],
                        ["Estado", modalOC.data.estado],
                        ["Forma Pago", modalOC.data.forma_pago || "—"],
                        ["Despacho", modalOC.data.metodo_despacho || "—"],
                      ].map(([k, v]) => (
                        <div key={k} className="bg-slate-50 rounded-xl px-3 py-2">
                          <p className="text-[9px] font-bold uppercase text-slate-400">{k}</p>
                          <p className="text-xs font-bold text-slate-700">{v}</p>
                        </div>
                      ))}
                      <div className="bg-emerald-50 rounded-xl px-3 py-2">
                        <p className="text-[9px] font-bold uppercase text-emerald-500">Total OC</p>
                        <p className="text-lg font-black text-emerald-600">{fmt(modalOC.data.total)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Productos */}
                  <div>
                    <p className="text-xs font-black text-slate-600 uppercase mb-2 flex items-center gap-1.5">
                      <Package size={14} className="text-[#059669]" />
                      Productos ({(modalOC.data.productos || []).length})
                    </p>
                    <div className="rounded-xl border border-slate-100 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            {["SKU", "Producto", "Cant.", "Und.", "P. Unitario", "Subtotal"].map((h) => (
                              <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(modalOC.data.productos || []).map((p: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-mono text-[9px] text-slate-400">{p.sku || "—"}</td>
                              <td className="px-4 py-2.5 font-medium text-slate-700 max-w-[220px]">{p.nombre}</td>
                              <td className="px-4 py-2.5 text-center font-bold">{p.cantidad}</td>
                              <td className="px-4 py-2.5 text-slate-400">{p.unidad}</td>
                              <td className="px-4 py-2.5 text-right">{fmt(p.precio_unitario)}</td>
                              <td className="px-4 py-2.5 text-right font-bold">{fmt(p.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-100">
                          <tr>
                            <td colSpan={5} className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase">Total</td>
                            <td className="px-4 py-2.5 text-right font-black text-emerald-600 text-base">{fmt(modalOC.data.total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {modalOC.data.observacion && (
                    <div className="bg-amber-50 rounded-xl p-3">
                      <p className="text-xs text-amber-700"><strong>Observación:</strong> {modalOC.data.observacion}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16">
                  <AlertCircle size={36} className="mx-auto text-rose-300 mb-3" />
                  <p className="text-slate-500">No se pudo cargar el detalle.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button onClick={() => setModalOC({ visible: false, loading: false, data: null })}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
