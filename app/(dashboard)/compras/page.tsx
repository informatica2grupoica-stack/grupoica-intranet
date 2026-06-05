// app/(dashboard)/compras/page.tsx
"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Search, ChevronLeft, ChevronRight,
  Eye, Package, X, Loader2, Building2, DollarSign,
  AlertCircle, Download, Filter, CheckCircle2,
  FileText, CreditCard, RefreshCcw,
  ShoppingCart, Receipt, ExternalLink, Hash
} from "lucide-react";
import * as XLSX from "xlsx";
import DTEViewer from "@/components/DTEViewer";

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
  { v: "", l: "Todos los meses" },
  { v: "01", l: "01 - Enero" }, { v: "02", l: "02 - Febrero" }, { v: "03", l: "03 - Marzo" },
  { v: "04", l: "04 - Abril" }, { v: "05", l: "05 - Mayo" }, { v: "06", l: "06 - Junio" },
  { v: "07", l: "07 - Julio" }, { v: "08", l: "08 - Agosto" }, { v: "09", l: "09 - Septiembre" },
  { v: "10", l: "10 - Octubre" }, { v: "11", l: "11 - Noviembre" }, { v: "12", l: "12 - Diciembre" },
];

const AÑOS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));
const ESTADOS_OC = ["", "EMITIDA", "APROBADA", "ENVIADA", "RECEPCIONADA", "FACTURADA", "ANULADA", "PENDIENTE", "SOLICITADA"];

// Tipos de DTE chilenos
const TIPO_DTE: Record<string, string> = {
  "33": "Factura", "34": "Fact. Exenta", "39": "Boleta",
  "41": "Boleta Exenta", "52": "Guía Despacho", "56": "Nota Débito",
  "61": "Nota Crédito", "110": "Fact. Exportación", "111": "Liq. Factura",
};

const estadoColor = (e: string) => {
  const m: Record<string, string> = {
    FACTURADA: "bg-emerald-50 text-emerald-700 border-emerald-200",
    APROBADA: "bg-blue-50 text-blue-700 border-blue-200",
    ENVIADA: "bg-sky-50 text-sky-700 border-sky-200",
    EMITIDA: "bg-indigo-50 text-indigo-700 border-indigo-200",
    RECEPCIONADA: "bg-teal-50 text-teal-700 border-teal-200",
    ANULADA: "bg-rose-50 text-rose-700 border-rose-200",
    SOLICITADA: "bg-amber-50 text-amber-700 border-amber-200",
    PENDIENTE: "bg-amber-50 text-amber-700 border-amber-200",
    ACTIVA: "bg-green-50 text-green-700 border-green-200",
  };
  return m[e?.toUpperCase()] || "bg-slate-50 text-slate-600 border-slate-200";
};

const fmt = (n: number | string) => `$${Number(n || 0).toLocaleString("es-CL")}`;

const fmtFecha = (raw: string | null | undefined) => {
  if (!raw || raw.startsWith("0000")) return "—";
  const d = raw.split(" ")[0];
  const parts = d.split("-");
  if (parts.length !== 3) return raw;
  if (parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return `${parts[0]}-${parts[1]}-${parts[2]}`;
};

const tipoLabel = (tipo: string) => TIPO_DTE[tipo] || `Tipo ${tipo}`;

export default function ComprasPage() {
  const [tab, setTab] = useState<TabType>("oc");
  const [datos, setDatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Filtros>({ ...FILTROS_INICIAL });
  const [pag, setPag] = useState(1);
  const [debugMode, setDebugMode] = useState(false);
  // Cache proveedores para lookup por rel_proveedor_id
  const [provCache, setProvCache] = useState<Record<string, string>>({});

  const POR_PAG = 20;

  const [modalOC, setModalOC] = useState<{ visible: boolean; loading: boolean; data: any }>({
    visible: false, loading: false, data: null,
  });
  const [modalDTE, setModalDTE] = useState<{ visible: boolean; loading: boolean; data: any }>({
    visible: false, loading: false, data: null,
  });
  const [xmlViewer, setXmlViewer] = useState<{ visible: boolean; loading: boolean; content: string; url: string }>({
    visible: false, loading: false, content: "", url: "",
  });
  const [dteViewerUrl, setDteViewerUrl] = useState<{ url: string; info: any } | null>(null);

  const verXML = async (url: string) => {
    setXmlViewer({ visible: true, loading: true, content: "", url });
    try {
      const res = await fetch(`/api/obuma/compras-dte/xml?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      // Formatear XML con indentación básica
      const formatted = xml
        .replace(/></g, ">\n<")
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .join("\n");
      setXmlViewer({ visible: true, loading: false, content: formatted, url });
    } catch (e: any) {
      setXmlViewer({ visible: true, loading: false, content: `Error: ${e.message}`, url });
    }
  };

  // ─── Cargar cache proveedores ────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/obuma/proveedores")
      .then((r) => r.json())
      .then((j) => {
        const lista = j.data || j.proveedores || [];
        const map: Record<string, string> = {};
        lista.forEach((p: any) => {
          if (p.proveedor_id) map[String(p.proveedor_id)] = p.proveedor_razon_social || p.proveedor_rut;
        });
        setProvCache(map);
      })
      .catch(() => {});
  }, []);

  const getProvNombre = (id: string) => provCache[String(id)] || `ID: ${id}`;

  // ─── Construir query string ─────────────────────────────────────────────────
  const buildParams = useCallback(() => {
    const p: Record<string, string> = {};
    // Convertir fecha HTML (yyyy-mm-dd) a formato Obuma (dd-mm-yyyy)
    if (filtros.fechaDesde) p.fecha_desde = filtros.fechaDesde.split("-").reverse().join("-");
    if (filtros.fechaHasta) p.fecha_hasta = filtros.fechaHasta.split("-").reverse().join("-");
    if (filtros.mes) {
      p.mes = filtros.mes;
      if (tab === "compras") p.mes_contable = filtros.mes;
      if (tab === "dte") p.mes_contable = filtros.mes;
    }
    if (filtros.ano) {
      if (tab === "compras") p.ano_contable = filtros.ano;
      else if (tab === "dte") p.ano_contable = filtros.ano;
      else p.ano = filtros.ano;
    }
    if (filtros.estado && tab === "oc") p.estado = filtros.estado;
    if (filtros.proveedorRut) p.proveedor_rut = filtros.proveedorRut;
    return new URLSearchParams(p).toString();
  }, [filtros, tab]);

  // ─── Cargar datos ─────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDatos([]);
    setPag(1);
    try {
      const qs = buildParams();
      const urls: Record<TabType, string> = {
        oc: `/api/obuma/oc${qs ? `?${qs}` : ""}`,
        compras: `/api/obuma/compras${qs ? `?${qs}` : ""}`,
        dte: `/api/obuma/compras-dte${qs ? `?${qs}` : ""}`,
        pagos: `/api/obuma/compras-pagos${qs ? `?${qs}` : ""}`,
      };
      const res = await fetch(urls[tab]);
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
    return datos.filter((row) => JSON.stringify(row).toLowerCase().includes(t));
  }, [datos, filtros.texto]);

  const totalPags = Math.ceil(datosFiltrados.length / POR_PAG);
  const pagActual = datosFiltrados.slice((pag - 1) * POR_PAG, pag * POR_PAG);

  // ─── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (tab === "oc") {
      const monto = datosFiltrados.reduce((s, r) => s + Number(r.compra_oc_total || 0), 0);
      const fac = datosFiltrados.filter((r) => r.compra_oc_estado === "FACTURADA").length;
      const emit = datosFiltrados.filter((r) => r.compra_oc_estado === "EMITIDA").length;
      return [
        { label: "Total OC", value: datosFiltrados.length, color: "text-slate-700", bg: "bg-slate-100", icon: ShoppingCart },
        { label: "Facturadas", value: fac, color: "text-emerald-600", bg: "bg-emerald-100", icon: CheckCircle2 },
        { label: "Emitidas", value: emit, color: "text-indigo-600", bg: "bg-indigo-100", icon: Receipt },
        { label: "Monto Total", value: fmt(monto), color: "text-[#4F46E5]", bg: "bg-[#EEF2FF]", icon: DollarSign },
      ];
    }
    if (tab === "compras") {
      const total = datosFiltrados.reduce((s, r) => s + Number(r.compra_total || 0), 0);
      const pagado = datosFiltrados.reduce((s, r) => s + Number(r.compra_total_pagado || 0), 0);
      const porPagar = datosFiltrados.reduce((s, r) => s + Number(r.compra_total_por_pagar || 0), 0);
      return [
        { label: "Total Compras", value: datosFiltrados.length, color: "text-slate-700", bg: "bg-slate-100", icon: FileText },
        { label: "Monto Total", value: fmt(total), color: "text-[#4F46E5]", bg: "bg-[#EEF2FF]", icon: DollarSign },
        { label: "Pagado", value: fmt(pagado), color: "text-emerald-600", bg: "bg-emerald-100", icon: CheckCircle2 },
        { label: "Por Pagar", value: fmt(porPagar), color: "text-rose-600", bg: "bg-rose-100", icon: AlertCircle },
      ];
    }
    if (tab === "dte") {
      const monto = datosFiltrados.reduce((s, r) => s + Number(r.dte_total || 0), 0);
      const neto = datosFiltrados.reduce((s, r) => s + Number(r.dte_total_neto || 0), 0);
      return [
        { label: "Total DTE", value: datosFiltrados.length, color: "text-slate-700", bg: "bg-slate-100", icon: FileText },
        { label: "Monto Total", value: fmt(monto), color: "text-[#4F46E5]", bg: "bg-[#EEF2FF]", icon: DollarSign },
        { label: "Total Neto", value: fmt(neto), color: "text-blue-600", bg: "bg-blue-100", icon: Hash },
        { label: "Emisores únicos", value: new Set(datosFiltrados.map((r) => r.dte_rut_emisor)).size, color: "text-purple-600", bg: "bg-purple-100", icon: Building2 },
      ];
    }
    // Pagos — campos correctos: cp_total, cp_pagado, cp_por_pagar
    const montoTotal = datosFiltrados.reduce((s, r) => s + Number(r.cp_total || 0), 0);
    const monPagado = datosFiltrados.reduce((s, r) => s + Number(r.cp_pagado || 0), 0);
    const monPorPagar = datosFiltrados.reduce((s, r) => s + Number(r.cp_por_pagar || 0), 0);
    const pagosConSaldo = datosFiltrados.filter(r => Number(r.cp_por_pagar || 0) > 0).length;
    return [
      { label: "Total Pagos", value: datosFiltrados.length, color: "text-slate-700", bg: "bg-slate-100", icon: CreditCard },
      { label: "Monto Total", value: fmt(montoTotal), color: "text-[#4F46E5]", bg: "bg-[#EEF2FF]", icon: DollarSign },
      { label: "Total Pagado", value: fmt(monPagado), color: "text-emerald-600", bg: "bg-emerald-100", icon: CheckCircle2 },
      { label: "Por Pagar", value: `${fmt(monPorPagar)} (${pagosConSaldo})`, color: "text-rose-500", bg: "bg-rose-100", icon: AlertCircle },
    ];
  }, [datosFiltrados, tab]);

  // ─── Ver detalle OC ─────────────────────────────────────────────────────────
  const verDetalleOC = async (id: string) => {
    setModalOC({ visible: true, loading: true, data: null });
    try {
      const res = await fetch(`/api/obuma/oc/${id}`);
      const data = await res.json();
      if (!res.ok) { setModalOC({ visible: true, loading: false, data: null }); return; }
      // Enriquecer proveedor desde cache si no viene en el detalle
      if (data.proveedor && !data.proveedor.razon_social && data.proveedor.id) {
        data.proveedor.razon_social = provCache[String(data.proveedor.id)] || `ID: ${data.proveedor.id}`;
      }
      setModalOC({ visible: true, loading: false, data });
    } catch {
      setModalOC({ visible: true, loading: false, data: null });
    }
  };

  // ─── Ver detalle DTE ────────────────────────────────────────────────────────
  const verDetalleDTE = async (id: string) => {
    setModalDTE({ visible: true, loading: true, data: null });
    try {
      const res = await fetch(`/api/obuma/compras-dte/${id}`);
      const data = await res.json();
      setModalDTE({ visible: true, loading: false, data: res.ok ? data : null });
    } catch {
      setModalDTE({ visible: true, loading: false, data: null });
    }
  };

  // ─── Excel ──────────────────────────────────────────────────────────────────
  const exportarExcel = () => {
    const ts = new Date().toISOString().slice(0, 10);
    let rows: any[] = [];

    if (tab === "oc") {
      rows = datosFiltrados.map((r) => ({
        "Folio": r.compra_oc_folio,
        "Fecha": fmtFecha(r.compra_oc_fecha_ingreso),
        "Estado": r.compra_oc_estado || "—",
        "Proveedor ID": r.rel_proveedor_id || "—",
        "Proveedor": getProvNombre(r.rel_proveedor_id),
        "Forma Pago": r.compra_oc_forma_pago || "—",
        "Método Despacho": r.compra_oc_metodo_despacho || "—",
        "Centro Costo": r.compra_oc_centro_costo || "—",
        "Concepto": r.compra_oc_concepto || "—",
        "Items": Number(r.compra_oc_cantidad_items || 0),
        "Subtotal ($)": Number(r.compra_oc_subtotal || 0),
        "Neto ($)": Number(r.compra_oc_neto || 0),
        "IVA ($)": Number(r.compra_oc_iva || 0),
        "Total ($)": Number(r.compra_oc_total || 0),
        "Pagada": r.compra_oc_pagada === "1" ? "Sí" : "No",
        "Enviada": r.compra_oc_enviada === "1" ? "Sí" : "No",
        "Observación": r.compra_oc_observacion || "—",
      }));
    } else if (tab === "compras") {
      rows = datosFiltrados.map((r) => ({
        "ID": r.compra_id,
        "Tipo Dcto.": r.compra_tipo_dcto || "—",
        "Folio": r.compra_folio || "—",
        "Fecha": fmtFecha(r.compra_fechaingreso),
        "Período Contable": `${r.compra_mes_contable || "—"}/${r.compra_ano_contable || "—"}`,
        "Proveedor ID": r.rel_proveedor_id || "—",
        "Proveedor": getProvNombre(r.rel_proveedor_id),
        "Sucursal ID": r.rel_sucursal_id || "—",
        "Concepto": r.compra_concepto || "—",
        "Centro Costo": r.compra_centro_costo || "—",
        "Neto ($)": Number(r.compra_neto || 0),
        "IVA ($)": Number(r.compra_iva || 0),
        "Total ($)": Number(r.compra_total || 0),
        "Pagado ($)": Number(r.compra_total_pagado || 0),
        "Por Pagar ($)": Number(r.compra_total_por_pagar || 0),
        "Anulada": r.compra_anulada === "1" ? "Sí" : "No",
        "Nota Crédito": r.compra_notacredito === "1" ? "Sí" : "No",
        "Observación": r.compra_observacion || "—",
      }));
    } else if (tab === "dte") {
      rows = datosFiltrados.map((r) => ({
        "ID DTE": r.dte_id,
        "ID Único": r.dte_id_unico || "—",
        "Folio": r.dte_folio || "—",
        "Tipo": tipoLabel(r.dte_tipo),
        "Código Tipo": r.dte_tipo || "—",
        "Emisor (Proveedor)": r.dte_razonsocial_emisor || "—",
        "RUT Emisor": r.dte_rut_emisor || "—",
        "Email Emisor": r.dte_email_emisor || "—",
        "Fecha DTE": r.dte_fecha || "—",
        "Período": r.dte_periodo_tributario || "—",
        "Neto ($)": Number(r.dte_total_neto || 0),
        "IVA ($)": Number(r.dte_total_iva || 0),
        "Exento ($)": Number(r.dte_total_exento || 0),
        "Total ($)": Number(r.dte_total || 0),
        "Forma Pago": r.dte_forma_pago || "—",
        "Compra ID vinculada": r.rel_compra_id || "—",
        "XML válido": r.xml_valido === "1" ? "Sí" : "No",
        "Link XML": r.s3_link || "—",
        "Respuesta Documento": r.dte_respuesta_documento || "—",
        "Respuesta Mercadería": r.dte_respuesta_mercaderia || "—",
      }));
    } else {
      rows = datosFiltrados.map((r) => ({
        "ID Pago": r.cp_id,
        "Fecha Pago": r.cp_fecha || "—",
        "Fecha Ingreso": fmtFecha(r.cp_fecha_ingreso),
        "Mes": r.cp_mes,
        "Año": r.cp_ano,
        "Origen": r.cp_origen_nombre || "—",
        "Forma Pago": r.cp_forma_pago || "—",
        "Total ($)": Number(r.cp_total || 0),
        "Pagado ($)": Number(r.cp_pagado || 0),
        "Por Pagar ($)": Number(r.cp_por_pagar || 0),
        "Compra ID": r.rel_compra_id || "—",
        "Proveedor ID": r.rel_proveedor_id || "—",
        "Proveedor": getProvNombre(r.rel_proveedor_id),
        "Detalle": r.cp_detalle || "—",
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

  // ─── Tablas por pestaña ─────────────────────────────────────────────────────
  const renderTabla = () => {
    if (loading) return (
      <tr><td colSpan={9} className="p-16 text-center">
        <Loader2 className="animate-spin text-[#4F46E5] mx-auto mb-2" size={32} />
        <p className="text-slate-400 text-xs">Consultando API Obuma...</p>
      </td></tr>
    );
    if (error) return (
      <tr><td colSpan={9} className="p-16 text-center">
        <AlertCircle className="mx-auto text-rose-400 mb-2" size={32} />
        <p className="text-rose-500 text-sm font-bold">{error}</p>
        <button onClick={cargar} className="mt-2 text-xs text-[#4F46E5] font-bold hover:underline">Reintentar</button>
      </td></tr>
    );
    if (pagActual.length === 0) return (
      <tr><td colSpan={9} className="p-16 text-center text-slate-400">No hay registros para los filtros aplicados.</td></tr>
    );

    if (tab === "oc") return pagActual.map((r) => (
      <tr key={r.compra_oc_id} className="hover:bg-slate-50/50 transition-colors">
        <td className="px-5 py-3.5 font-bold text-[#4F46E5]">#{r.compra_oc_folio}</td>
        <td className="px-5 py-3.5 text-xs text-slate-600">{fmtFecha(r.compra_oc_fecha_ingreso)}</td>
        <td className="px-5 py-3.5">
          <p className="text-xs font-bold text-slate-700 truncate max-w-[180px]">
            {provCache[String(r.rel_proveedor_id)] || <span className="text-slate-400 italic text-[10px]">ID:{r.rel_proveedor_id}</span>}
          </p>
        </td>
        <td className="px-5 py-3.5 text-xs text-slate-500 truncate max-w-[120px]">{r.compra_oc_forma_pago || "—"}</td>
        <td className="px-5 py-3.5 text-xs text-slate-400">{r.compra_oc_cantidad_items || 0} items</td>
        <td className="px-5 py-3.5 text-right font-black text-slate-800">{fmt(r.compra_oc_total)}</td>
        <td className="px-5 py-3.5 text-center">
          <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold border ${estadoColor(r.compra_oc_estado)}`}>
            {r.compra_oc_estado || "—"}
          </span>
        </td>
        <td className="px-5 py-3.5 text-center">
          <button onClick={() => verDetalleOC(r.compra_oc_id)}
            className="p-2 rounded-lg bg-slate-100 hover:bg-[#EEF2FF] text-slate-500 hover:text-[#4F46E5] transition-all">
            <Eye size={15} />
          </button>
        </td>
      </tr>
    ));

    if (tab === "compras") return pagActual.map((r, i) => (
      <tr key={r.compra_id || i} className="hover:bg-slate-50/50 transition-colors">
        <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{r.compra_id}</td>
        <td className="px-5 py-3.5">
          <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded mr-1">
            {tipoLabel(r.compra_tipo_dcto)}
          </span>
          <span className="text-xs font-bold text-slate-700">#{r.compra_folio || "—"}</span>
        </td>
        <td className="px-5 py-3.5 text-xs text-slate-600">{fmtFecha(r.compra_fechaingreso)}</td>
        <td className="px-5 py-3.5">
          <p className="text-xs font-bold text-slate-700 truncate max-w-[160px]">
            {provCache[String(r.rel_proveedor_id)] || <span className="text-slate-400 italic text-[10px]">ID:{r.rel_proveedor_id}</span>}
          </p>
          <p className="text-[9px] text-slate-400">{r.compra_mes_contable}/{r.compra_ano_contable}</p>
        </td>
        <td className="px-5 py-3.5 text-right font-black text-slate-800">{fmt(r.compra_total)}</td>
        <td className="px-5 py-3.5 text-right text-emerald-600 font-bold text-xs">{fmt(r.compra_total_pagado)}</td>
        <td className="px-5 py-3.5 text-right text-rose-500 font-bold text-xs">{fmt(r.compra_total_por_pagar)}</td>
        <td className="px-5 py-3.5 text-center">
          {r.compra_anulada === "1" ? (
            <span className="px-2.5 py-1 rounded-full text-[9px] font-bold border bg-rose-50 text-rose-700 border-rose-200">Anulada</span>
          ) : r.compra_notacredito === "1" ? (
            <span className="px-2.5 py-1 rounded-full text-[9px] font-bold border bg-purple-50 text-purple-700 border-purple-200">N.Crédito</span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-[9px] font-bold border bg-green-50 text-green-700 border-green-200">Activa</span>
          )}
        </td>
      </tr>
    ));

    if (tab === "dte") return pagActual.map((r, i) => (
      <tr key={r.dte_id || i} className="hover:bg-slate-50/50 transition-colors">
        <td className="px-5 py-3.5">
          <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
            {tipoLabel(r.dte_tipo)}
          </span>
          <p className="text-xs font-bold text-slate-700 mt-0.5">#{r.dte_folio}</p>
        </td>
        <td className="px-5 py-3.5">
          <p className="text-xs font-bold text-slate-700 truncate max-w-[180px]">{r.dte_razonsocial_emisor || "—"}</p>
          <p className="text-[9px] font-mono text-slate-400">{r.dte_rut_emisor || "—"}</p>
        </td>
        <td className="px-5 py-3.5 text-xs text-slate-600">{r.dte_fecha || "—"}</td>
        <td className="px-5 py-3.5 text-xs text-slate-500">{r.dte_periodo_tributario || "—"}</td>
        <td className="px-5 py-3.5 text-right font-black text-slate-800">{fmt(r.dte_total)}</td>
        <td className="px-5 py-3.5 text-right text-xs text-slate-500">{fmt(r.dte_total_neto)}</td>
        <td className="px-5 py-3.5 text-center">
          {r.rel_compra_id !== "0" ? (
            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">Vinculada #{r.rel_compra_id}</span>
          ) : (
            <span className="text-[9px] text-slate-300 font-bold">Sin vincular</span>
          )}
        </td>
        <td className="px-5 py-3.5 text-center">
          {r.s3_link ? (
            <a href={r.s3_link} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-all inline-flex" title="Descargar XML">
              <ExternalLink size={14} />
            </a>
          ) : "—"}
        </td>
        <td className="px-5 py-3.5 text-center">
          <button onClick={() => verDetalleDTE(r.dte_id)}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#EEF2FF] text-slate-500 hover:text-[#4F46E5] transition-all">
            <Eye size={14} />
          </button>
        </td>
      </tr>
    ));

    // Pagos — campos correctos: cp_total, cp_pagado, cp_por_pagar
    return pagActual.map((r, i) => (
      <tr key={r.cp_id || i} className="hover:bg-slate-50/50 transition-colors">
        <td className="px-5 py-3.5 font-mono text-[10px] text-slate-500">{r.cp_id}</td>
        <td className="px-5 py-3.5">
          <p className="text-xs text-slate-700 font-medium">{r.cp_fecha || "—"}</p>
          <p className="text-[9px] text-slate-400">{r.cp_mes}/{r.cp_ano}</p>
        </td>
        <td className="px-5 py-3.5">
          <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded uppercase">
            {r.cp_origen_nombre || "—"}
          </span>
          {r.cp_forma_pago && <p className="text-[9px] text-slate-400 mt-0.5">{r.cp_forma_pago}</p>}
        </td>
        <td className="px-5 py-3.5">
          {r.rel_proveedor_id && r.rel_proveedor_id !== "0" ? (
            <p className="text-xs font-bold text-slate-700 truncate max-w-[150px]">
              {provCache[String(r.rel_proveedor_id)] || <span className="text-slate-400 italic text-[10px]">ID:{r.rel_proveedor_id}</span>}
            </p>
          ) : <span className="text-slate-300">—</span>}
          {r.rel_compra_id && r.rel_compra_id !== "0" && (
            <p className="text-[9px] font-mono text-slate-400">Compra #{r.rel_compra_id}</p>
          )}
        </td>
        <td className="px-5 py-3.5 text-right font-black text-slate-800">{fmt(r.cp_total)}</td>
        <td className="px-5 py-3.5 text-right font-bold text-emerald-600">{fmt(r.cp_pagado)}</td>
        <td className="px-5 py-3.5 text-right font-bold text-rose-500">
          {Number(r.cp_por_pagar) > 0 ? (
            <span className="bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">{fmt(r.cp_por_pagar)}</span>
          ) : <span className="text-slate-300 text-[10px]">$0</span>}
        </td>
        <td className="px-5 py-3.5 text-center">
          {r.cp_detalle ? (
            <span className="text-[9px] text-slate-500 max-w-[100px] truncate block">{r.cp_detalle}</span>
          ) : "—"}
        </td>
      </tr>
    ));
  };

  const colHeaders: Record<TabType, string[]> = {
    oc: ["Folio", "Fecha", "Proveedor", "Forma Pago", "Items", "Total", "Estado", "Ver"],
    compras: ["ID", "Tipo/Folio", "Fecha", "Proveedor / Período", "Total", "Pagado", "Por Pagar", "Estado"],
    dte: ["Tipo/Folio", "Emisor (Proveedor)", "Fecha DTE", "Período", "Total", "Neto", "Compra Vinculada", "XML", "Ver"],
    pagos: ["ID", "Fecha / Período", "Origen / Forma Pago", "Proveedor / Compra", "Total", "Pagado", "Por Pagar", "Detalle"],
  };

  const TABS = [
    { id: "oc" as TabType, label: "Órdenes de Compra", icon: ShoppingCart },
    { id: "compras" as TabType, label: "Compras / Facturas", icon: FileText },
    { id: "dte" as TabType, label: "DTE Recibidos", icon: Receipt },
    { id: "pagos" as TabType, label: "Pagos", icon: CreditCard },
  ];

  return (
    <div className="space-y-5 pb-10">

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id}
            onClick={() => { setTab(t.id); setDatos([]); setFiltros({ ...FILTROS_INICIAL }); setDebugMode(false); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wide transition-all ${
              tab === t.id
                ? "bg-[#4F46E5] text-white shadow-md shadow-emerald-900/20"
                : "bg-white text-slate-500 border border-slate-200 hover:border-[#4F46E5] hover:text-[#4F46E5]"
            }`}>
            <t.icon size={14} /> {t.label}
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
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Buscar en resultados..."
              value={filtros.texto}
              onChange={(e) => setFiltros((f) => ({ ...f, texto: e.target.value }))}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#4F46E5]/20" />
          </div>

          {tab === "oc" && (
            <select value={filtros.estado}
              onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
              {ESTADOS_OC.map((e) => <option key={e} value={e}>{e || "Todos los estados"}</option>)}
            </select>
          )}

          {(tab === "compras" || tab === "dte") && (
            <input type="text" placeholder="RUT emisor / proveedor"
              value={filtros.proveedorRut}
              onChange={(e) => setFiltros((f) => ({ ...f, proveedorRut: e.target.value }))}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none w-40" />
          )}

          <select value={filtros.mes}
            onChange={(e) => setFiltros((f) => ({ ...f, mes: e.target.value }))}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            {MESES.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>

          <select value={filtros.ano}
            onChange={(e) => setFiltros((f) => ({ ...f, ano: e.target.value }))}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            {AÑOS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>

          {tab !== "pagos" && (
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
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setFiltros({ ...FILTROS_INICIAL })}
              className="px-3 py-2.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl flex items-center gap-1.5 hover:bg-slate-200 transition-all">
              <Filter size={13} /> Limpiar
            </button>
            <button onClick={cargar} disabled={loading}
              className="px-3 py-2.5 text-xs font-bold text-white bg-slate-800 rounded-xl flex items-center gap-1.5 hover:bg-[#4F46E5] transition-all disabled:opacity-50">
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} /> Buscar en API
            </button>
            <button onClick={exportarExcel}
              className="px-4 py-2.5 text-xs font-bold bg-[#4F46E5] text-white rounded-xl flex items-center gap-1.5 shadow-sm hover:bg-[#4338CA] transition-all">
              <Download size={13} /> Excel
            </button>
            <button onClick={() => setDebugMode((d) => !d)}
              className={`px-3 py-2.5 text-xs font-bold rounded-xl transition-all ${debugMode ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-600"}`}
              title="Ver campos reales de la API">
              {} Debug
            </button>
          </div>
        </div>
        {!loading && (
          <p className="text-[10px] text-slate-400 mt-2.5 font-bold">
            {datosFiltrados.length} registros · API Obuma · {Object.keys(provCache).length} proveedores en caché
          </p>
        )}
      </div>

      {/* ── Debug ─────────────────────────────────────────────────────── */}
      {debugMode && datos.length > 0 && (
        <div className="bg-slate-900 rounded-2xl p-5 text-xs font-mono text-emerald-400 overflow-x-auto">
          <p className="text-slate-400 text-[9px] font-bold uppercase mb-2">
            🔬 Debug — [{tab}] · {Object.keys(datos[0]).length} campos
          </p>
          <p className="text-amber-400 mb-2 text-[10px]">CAMPOS: {Object.keys(datos[0]).join(" | ")}</p>
          <pre className="text-[10px] leading-relaxed whitespace-pre-wrap text-slate-300">
            {JSON.stringify(datos[0], null, 2)}
          </pre>
        </div>
      )}

      {/* ── Tabla ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <tr>
                {colHeaders[tab].map((h) => <th key={h} className="px-5 py-4">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">{renderTabla()}</tbody>
          </table>
        </div>

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
                  <ShoppingCart className="text-[#4F46E5]" size={18} /> Detalle Orden de Compra
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
                    className="px-4 py-2 text-xs font-bold bg-[#4F46E5] text-white rounded-xl flex items-center gap-1.5 hover:bg-[#4338CA]">
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
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#4F46E5]" size={36} /></div>
              ) : modalOC.data ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 bg-slate-50 rounded-xl p-4">
                      <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Proveedor</p>
                      <p className="font-bold text-slate-800">{modalOC.data.proveedor?.razon_social}</p>
                      <p className="text-xs font-mono text-slate-400">{modalOC.data.proveedor?.rut}</p>
                      {modalOC.data.proveedor?.direccion && <p className="text-xs text-slate-400 mt-1">{modalOC.data.proveedor.direccion}</p>}
                      {modalOC.data.proveedor?.email && <p className="text-xs text-[#4F46E5] mt-0.5">{modalOC.data.proveedor.email}</p>}
                      {modalOC.data.proveedor?.telefono && <p className="text-xs text-slate-500">{modalOC.data.proveedor.telefono}</p>}
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

                  {/* Condiciones / observación */}
                  {(modalOC.data.observacion || modalOC.data.contacto) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {modalOC.data.observacion && (
                        <div className="bg-amber-50 rounded-xl p-3">
                          <p className="text-[9px] font-bold uppercase text-amber-600 mb-1">Observación</p>
                          <p className="text-xs text-amber-700">{modalOC.data.observacion}</p>
                        </div>
                      )}
                      {modalOC.data.contacto && (
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Contacto OC</p>
                          <p className="text-xs text-slate-700">{modalOC.data.contacto}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Montos desglosados */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ["Neto", modalOC.data.neto, "text-blue-600"],
                      ["IVA", modalOC.data.iva, "text-amber-600"],
                      ["Descuento", modalOC.data.descuento_pesos, "text-rose-500"],
                      ["TOTAL", modalOC.data.total, "text-emerald-600"],
                    ].map(([k, v, c]) => (
                      <div key={k as string} className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-[9px] font-bold uppercase text-slate-400">{k as string}</p>
                        <p className={`text-base font-black ${c as string}`}>{fmt(v as number)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Productos */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-black text-slate-600 uppercase flex items-center gap-1.5">
                        <Package size={14} className="text-[#4F46E5]" />
                        Productos ({(modalOC.data.productos || []).length} / declarados: {modalOC.data.cantidad_items})
                      </p>
                      {(modalOC.data.productos || []).length === 0 && (
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                          Cargando desde API items…
                        </span>
                      )}
                    </div>

                    {/* Debug: campos raw si no hay productos */}
                    {(modalOC.data.productos || []).length === 0 && modalOC.data._raw_keys && (
                      <div className="bg-slate-800 rounded-xl p-3 mb-3 text-[9px] font-mono">
                        <p className="text-amber-400 mb-1">Campos OC findById: {(modalOC.data._raw_keys || []).join(" | ")}</p>
                        {(modalOC.data._items_raw_keys || []).length > 0 && (
                          <p className="text-emerald-400">Campos items: {(modalOC.data._items_raw_keys || []).join(" | ")}</p>
                        )}
                      </div>
                    )}

                    <div className="rounded-xl border border-slate-100 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            {["SKU", "Producto", "Cant.", "Und.", "P. Unitario", "Dto %", "Subtotal"].map((h) => (
                              <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(modalOC.data.productos || []).length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-[11px]">
                                Sin productos disponibles en esta OC. El API no retornó ítems.
                              </td>
                            </tr>
                          ) : (modalOC.data.productos || []).map((p: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-mono text-[9px] text-slate-400">{p.sku || "—"}</td>
                              <td className="px-4 py-2.5 text-slate-700 max-w-[200px]">
                                <p className="font-medium">{p.nombre}</p>
                                {p.descripcion && p.descripcion !== p.nombre && (
                                  <p className="text-[9px] text-slate-400">{p.descripcion}</p>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center font-bold">{p.cantidad}</td>
                              <td className="px-4 py-2.5 text-slate-400 text-[10px]">{p.unidad}</td>
                              <td className="px-4 py-2.5 text-right">{fmt(p.precio_unitario)}</td>
                              <td className="px-4 py-2.5 text-center text-slate-400 text-[10px]">
                                {p.descuento > 0 ? `${p.descuento}%` : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-slate-800">{fmt(p.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-100">
                          <tr>
                            <td colSpan={6} className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase">Total OC</td>
                            <td className="px-4 py-2.5 text-right font-black text-emerald-600 text-base">{fmt(modalOC.data.total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
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

      {/* ── Modal detalle DTE ─────────────────────────────────────────── */}
      {modalDTE.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Receipt className="text-blue-600" size={18} /> Detalle DTE Recibido
                </h2>
                {modalDTE.data && (
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {tipoLabel(modalDTE.data.dte_tipo)} #{modalDTE.data.dte_folio} · {modalDTE.data.dte_razonsocial_emisor}
                  </p>
                )}
              </div>
              <button onClick={() => setModalDTE({ visible: false, loading: false, data: null })}
                className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {modalDTE.loading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={36} /></div>
              ) : modalDTE.data ? (
                <div className="space-y-4">
                  {/* Emisor */}
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Emisor (Proveedor)</p>
                    <p className="font-bold text-slate-800 text-lg">{modalDTE.data.dte_razonsocial_emisor || "—"}</p>
                    <p className="text-xs font-mono text-slate-400">{modalDTE.data.dte_rut_emisor}</p>
                    {modalDTE.data.dte_email_emisor && <p className="text-xs text-[#4F46E5] mt-1">{modalDTE.data.dte_email_emisor}</p>}
                  </div>

                  {/* Datos tributarios */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ["Tipo DTE", `${tipoLabel(modalDTE.data.dte_tipo)} (${modalDTE.data.dte_tipo})`],
                      ["Folio", `#${modalDTE.data.dte_folio}`],
                      ["Fecha DTE", modalDTE.data.dte_fecha || "—"],
                      ["Período", modalDTE.data.dte_periodo_tributario || "—"],
                      ["Recep. XML", fmtFecha(modalDTE.data.dte_fecharecepcion_xml)],
                      ["Traspaso Libro", modalDTE.data.dte_traspasolibro === "1" ? "Sí" : "Pendiente"],
                      ["XML válido", modalDTE.data.xml_valido === "1" ? "✅ Sí" : "❌ No"],
                      ["Compra vinculada", modalDTE.data.rel_compra_id !== "0" ? `#${modalDTE.data.rel_compra_id}` : "Sin vincular"],
                    ].map(([k, v]) => (
                      <div key={k} className="bg-slate-50 rounded-xl px-3 py-2">
                        <p className="text-[9px] font-bold uppercase text-slate-400">{k}</p>
                        <p className="text-xs font-bold text-slate-700">{v}</p>
                      </div>
                    ))}
                  </div>

                  {/* Montos */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ["Neto", modalDTE.data.dte_total_neto, "text-blue-600"],
                      ["IVA", modalDTE.data.dte_total_iva, "text-amber-600"],
                      ["Exento", modalDTE.data.dte_total_exento, "text-slate-500"],
                      ["TOTAL", modalDTE.data.dte_total, "text-emerald-600"],
                    ].map(([k, v, c]) => (
                      <div key={k as string} className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-[9px] font-bold uppercase text-slate-400">{k as string}</p>
                        <p className={`text-xl font-black ${c as string}`}>{fmt(v as string)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Estados de respuesta */}
                  {(modalDTE.data.dte_respuesta_documento || modalDTE.data.dte_respuesta_mercaderia || modalDTE.data.dte_respuestacomercial) && (
                    <div className="bg-amber-50 rounded-xl p-4 space-y-1">
                      <p className="text-[10px] font-bold uppercase text-amber-600 mb-2">Respuestas SII</p>
                      {modalDTE.data.dte_respuesta_documento && <p className="text-xs text-amber-700"><strong>Documento:</strong> {modalDTE.data.dte_respuesta_documento}</p>}
                      {modalDTE.data.dte_respuesta_mercaderia && <p className="text-xs text-amber-700"><strong>Mercadería:</strong> {modalDTE.data.dte_respuesta_mercaderia}</p>}
                      {modalDTE.data.dte_respuestacomercial && <p className="text-xs text-amber-700"><strong>Comercial:</strong> {modalDTE.data.dte_respuestacomercial}</p>}
                    </div>
                  )}

                  {/* XML / DTE */}
                  {modalDTE.data.s3_link && (
                    <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-slate-50 rounded-xl border border-blue-100">
                      <FileText size={20} className="text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Documento XML DTE</p>
                        <p className="text-[9px] text-slate-400 truncate mt-0.5">{modalDTE.data.s3_link.split("/").pop()}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            setDteViewerUrl({
                              url: modalDTE.data.s3_link,
                              info: {
                                id: modalDTE.data.dte_id,
                                folio: modalDTE.data.dte_folio,
                                tipo: modalDTE.data.dte_tipo,
                                emisor: modalDTE.data.dte_razonsocial_emisor,
                                total: modalDTE.data.dte_total,
                              }
                            });
                          }}
                          className="px-3 py-1.5 bg-[#4F46E5] text-white text-xs font-bold rounded-lg hover:bg-[#4338CA] flex items-center gap-1.5 shadow-sm"
                        >
                          <FileText size={12} /> Ver DTE
                        </button>
                        <button onClick={() => verXML(modalDTE.data.s3_link)}
                          className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-600 flex items-center gap-1.5">
                          &lt;/&gt; Ver XML
                        </button>
                        <a href={modalDTE.data.s3_link} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
                          <ExternalLink size={12} /> Descargar
                        </a>
                      </div>
                    </div>
                  )}

                  {/* ID Único */}
                  <div className="text-center">
                    <p className="text-[9px] text-slate-300 font-mono">{modalDTE.data.dte_id_unico}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <AlertCircle size={36} className="mx-auto text-rose-300 mb-3" />
                  <p className="text-slate-500">No se pudo cargar el detalle del DTE.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button onClick={() => setModalDTE({ visible: false, loading: false, data: null })}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Visor DTE renderizado ────────────────────────────────────── */}
      {dteViewerUrl && (
        <DTEViewer
          xmlUrl={dteViewerUrl.url}
          dteInfo={dteViewerUrl.info}
          onClose={() => setDteViewerUrl(null)}
        />
      )}

      {/* ── Visor XML raw ─────────────────────────────────────────────── */}
      {xmlViewer.visible && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl bg-slate-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-emerald-400" />
                <p className="text-sm font-bold text-white">Visor XML — DTE</p>
                <span className="text-[9px] font-mono text-slate-400 truncate max-w-[300px]">{xmlViewer.url.split("/").pop()}</span>
              </div>
              <div className="flex gap-2">
                <a href={xmlViewer.url} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                  <ExternalLink size={12} /> Descargar XML
                </a>
                <button onClick={() => setXmlViewer({ visible: false, loading: false, content: "", url: "" })}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {xmlViewer.loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="animate-spin text-emerald-400" size={32} />
                </div>
              ) : (
                <pre className="text-[11px] font-mono text-emerald-300 whitespace-pre leading-relaxed">
                  {xmlViewer.content}
                </pre>
              )}
            </div>

            <div className="p-3 border-t border-slate-700 bg-slate-800">
              <p className="text-[9px] text-slate-500 font-mono">
                {xmlViewer.content.split("\n").length} líneas · {new Blob([xmlViewer.content]).size} bytes
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
