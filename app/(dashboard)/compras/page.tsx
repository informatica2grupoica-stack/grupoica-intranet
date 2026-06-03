// app/(dashboard)/compras/page.tsx
"use client";
import { useEffect, useState, useMemo } from "react";
import {
  RefreshCcw, ShoppingBag, Search, ChevronLeft, ChevronRight,
  Eye, Package, X, Loader2, Building2, Calendar, DollarSign,
  AlertCircle, Download, Filter, TrendingUp, Hash, CheckCircle2
} from "lucide-react";
import * as XLSX from "xlsx";

interface ProductoOC {
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  sku: string;
  unidad: string;
}

interface DetalleOC {
  id: string;
  folio: string;
  fecha: string;
  fecha_emision: string;
  estado: string;
  total: number;
  proveedor: { id: string; rut: string; razon_social: string; direccion: string };
  productos: ProductoOC[];
  observacion: string;
}

const ESTADOS = ["TODOS", "FACTURADA", "PENDIENTE", "ANULADA", "EN PROCESO"];

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtroProveedorId, setFiltroProveedorId] = useState("TODOS");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [detalleModal, setDetalleModal] = useState<{
    visible: boolean; loading: boolean; data: DetalleOC | null;
  }>({ visible: false, loading: false, data: null });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/obuma/oc");
      const json = await res.json();
      if (json?.data && Array.isArray(json.data)) setOrdenes(json.data);
    } catch (err) {
      console.error("Error cargando OC:", err);
    } finally {
      setLoading(false);
    }
  };

  const verDetalle = async (ocId: string) => {
    setDetalleModal({ visible: true, loading: true, data: null });
    try {
      const res = await fetch(`/api/obuma/oc/${ocId}`);
      const data = await res.json();
      setDetalleModal({ visible: true, loading: false, data: res.ok ? data : null });
    } catch {
      setDetalleModal({ visible: true, loading: false, data: null });
    }
  };

  useEffect(() => { loadData(); }, []);

  const formatearFecha = (raw: string | null) => {
    if (!raw) return "—";
    const [y, m, d] = raw.split(" ")[0].split("-");
    return `${d}-${m}-${y}`;
  };

  const formatearPrecio = (p: number) => `$${Number(p).toLocaleString("es-CL")}`;

  // Proveedores únicos para filtro
  const proveedoresUnicos = useMemo(() => {
    const map = new Map<string, string>();
    ordenes.forEach((oc) => {
      if (oc.proveedor_id && oc.proveedor_razon_social) {
        map.set(oc.proveedor_id, oc.proveedor_razon_social);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [ordenes]);

  const filteredOrdenes = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return ordenes.filter((oc) => {
      const matchText =
        !term ||
        oc.compra_oc_folio?.toString().includes(term) ||
        oc.compra_oc_estado?.toLowerCase().includes(term) ||
        oc.proveedor_razon_social?.toLowerCase().includes(term) ||
        (oc.compra_oc_referencia && oc.compra_oc_referencia.toLowerCase().includes(term));

      const matchEstado =
        filtroEstado === "TODOS" ||
        (oc.compra_oc_estado || "PENDIENTE") === filtroEstado;

      const matchProveedor =
        filtroProveedorId === "TODOS" || oc.proveedor_id === filtroProveedorId;

      const fechaOC = oc.compra_oc_fecha_ingreso?.split(" ")[0];
      const matchDesde = !fechaDesde || (fechaOC && fechaOC >= fechaDesde);
      const matchHasta = !fechaHasta || (fechaOC && fechaOC <= fechaHasta);

      return matchText && matchEstado && matchProveedor && matchDesde && matchHasta;
    });
  }, [ordenes, searchTerm, filtroEstado, filtroProveedorId, fechaDesde, fechaHasta]);

  const totalPages = Math.ceil(filteredOrdenes.length / itemsPerPage);
  const indexOfFirst = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredOrdenes.slice(indexOfFirst, indexOfFirst + itemsPerPage);

  // KPIs
  const totalMonto = filteredOrdenes.reduce((s, oc) => s + Number(oc.compra_oc_total || 0), 0);
  const facturadas = filteredOrdenes.filter((oc) => oc.compra_oc_estado === "FACTURADA").length;
  const pendientes = filteredOrdenes.filter((oc) => (oc.compra_oc_estado || "PENDIENTE") === "PENDIENTE").length;

  const resetFiltros = () => {
    setSearchTerm(""); setFiltroEstado("TODOS");
    setFiltroProveedorId("TODOS"); setFechaDesde(""); setFechaHasta("");
    setCurrentPage(1);
  };

  const exportarExcel = () => {
    const rows = filteredOrdenes.map((oc) => ({
      "Folio": oc.compra_oc_folio,
      "Fecha Ingreso": formatearFecha(oc.compra_oc_fecha_ingreso),
      "Fecha Emisión": formatearFecha(oc.compra_oc_fecha_emision),
      "Estado": oc.compra_oc_estado || "PENDIENTE",
      "Proveedor": oc.proveedor_razon_social || "—",
      "RUT Proveedor": oc.proveedor_rut || "—",
      "Total ($)": Number(oc.compra_oc_total || 0),
      "Referencia": oc.compra_oc_referencia || "—",
      "Observación": oc.compra_oc_observacion || "—",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Órdenes de Compra");
    ws["!cols"] = [8, 14, 14, 12, 40, 16, 14, 20, 30].map((w) => ({ wch: w }));
    XLSX.writeFile(wb, `OC_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportarDetalleExcel = () => {
    if (!detalleModal.data) return;
    const d = detalleModal.data;
    const rows = d.productos.map((p) => ({
      "Folio OC": d.folio,
      "Proveedor": d.proveedor.razon_social,
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

  const estadoColor = (estado: string) => {
    const e = (estado || "PENDIENTE").toUpperCase();
    if (e === "FACTURADA") return "bg-emerald-50 text-emerald-600 border-emerald-200";
    if (e === "ANULADA") return "bg-rose-50 text-rose-600 border-rose-200";
    if (e === "EN PROCESO") return "bg-blue-50 text-blue-600 border-blue-200";
    return "bg-amber-50 text-amber-600 border-amber-200";
  };

  return (
    <div className="space-y-5 pb-10">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total OC", value: filteredOrdenes.length, icon: ShoppingBag, color: "text-slate-700", bg: "bg-slate-100" },
          { label: "Facturadas", value: facturadas, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
          { label: "Pendientes", value: pendientes, icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-100" },
          { label: "Monto Total", value: `$${totalMonto.toLocaleString("es-CL")}`, icon: DollarSign, color: "text-[#059669]", bg: "bg-[#D1FAE5]" },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${k.bg}`}>
              <k.icon size={18} className={k.color} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{k.label}</p>
              <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Barra de filtros */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Búsqueda texto */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar folio, proveedor, referencia..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/20"
            />
          </div>

          {/* Filtro estado */}
          <select
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none"
          >
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>

          {/* Filtro proveedor */}
          <select
            value={filtroProveedorId}
            onChange={(e) => { setFiltroProveedorId(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none max-w-[200px]"
          >
            <option value="TODOS">Todos los proveedores</option>
            {proveedoresUnicos.map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>

          {/* Fechas */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Desde</span>
            <input type="date" value={fechaDesde} onChange={(e) => { setFechaDesde(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">Hasta</span>
            <input type="date" value={fechaHasta} onChange={(e) => { setFechaHasta(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none" />
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={resetFiltros} className="px-3 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 rounded-xl flex items-center gap-1.5 transition-all">
              <Filter size={14} /> Limpiar
            </button>
            <button onClick={exportarExcel} className="px-4 py-2.5 text-xs font-bold bg-[#059669] text-white rounded-xl flex items-center gap-1.5 shadow-sm hover:bg-[#047857] transition-all">
              <Download size={14} /> Excel
            </button>
            <button onClick={loadData} disabled={loading} className="p-2.5 hover:bg-slate-50 rounded-xl transition-colors">
              <RefreshCcw className={`w-4 h-4 text-slate-400 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4"><Hash size={10} className="inline mr-1" />Folio</th>
                <th className="px-6 py-4"><Calendar size={10} className="inline mr-1" />Fecha</th>
                <th className="px-6 py-4"><Building2 size={10} className="inline mr-1" />Proveedor</th>
                <th className="px-6 py-4 text-right"><DollarSign size={10} className="inline mr-1" />Total</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="p-16 text-center">
                  <Loader2 className="animate-spin text-[#059669] mx-auto mb-2" size={32} />
                  <p className="text-slate-400 text-xs">Cargando órdenes...</p>
                </td></tr>
              ) : currentItems.length === 0 ? (
                <tr><td colSpan={6} className="p-16 text-center text-slate-400 text-sm">
                  No se encontraron órdenes con los filtros aplicados.
                </td></tr>
              ) : (
                currentItems.map((oc: any) => (
                  <tr key={oc.compra_oc_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#059669]">#{oc.compra_oc_folio}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatearFecha(oc.compra_oc_fecha_ingreso)}</td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-700 truncate max-w-[200px]">
                        {oc.proveedor_razon_social || "—"}
                      </p>
                      {oc.proveedor_rut && <p className="text-[9px] text-slate-400 font-mono">{oc.proveedor_rut}</p>}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-800">
                      {formatearPrecio(oc.compra_oc_total)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${estadoColor(oc.compra_oc_estado)}`}>
                        {oc.compra_oc_estado || "PENDIENTE"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => verDetalle(oc.compra_oc_id)}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-[#D1FAE5] text-slate-500 hover:text-[#059669] transition-all"
                        title="Ver detalle"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && filteredOrdenes.length > 0 && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {indexOfFirst + 1}–{Math.min(indexOfFirst + itemsPerPage, filteredOrdenes.length)} de {filteredOrdenes.length} órdenes
            </p>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <div className="flex items-center px-4 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                {currentPage} / {totalPages}
              </div>
              <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALLE */}
      {detalleModal.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <ShoppingBag className="text-[#059669]" size={20} />
                  Detalle de Orden de Compra
                </h2>
                {detalleModal.data && (
                  <p className="text-[10px] text-slate-400 font-mono mt-1">
                    Folio #{detalleModal.data.folio} • {detalleModal.data.estado}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {detalleModal.data && (
                  <button onClick={exportarDetalleExcel}
                    className="px-4 py-2 text-xs font-bold bg-[#059669] text-white rounded-xl flex items-center gap-1.5 shadow-sm hover:bg-[#047857] transition-all">
                    <Download size={14} /> Excel
                  </button>
                )}
                <button onClick={() => setDetalleModal({ visible: false, loading: false, data: null })}
                  className="p-2 hover:bg-slate-100 rounded-xl">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {detalleModal.loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-[#059669]" size={40} />
                </div>
              ) : detalleModal.data ? (
                <div className="space-y-5">
                  {/* Info proveedor + fechas */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 size={16} className="text-[#059669]" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Proveedor</span>
                      </div>
                      <p className="font-bold text-slate-800">{detalleModal.data.proveedor.razon_social}</p>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{detalleModal.data.proveedor.rut}</p>
                      {detalleModal.data.proveedor.direccion && (
                        <p className="text-xs text-slate-400 mt-1">{detalleModal.data.proveedor.direccion}</p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Fecha Emisión</p>
                        <p className="text-sm font-bold text-slate-700">{formatearFecha(detalleModal.data.fecha_emision)}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3">
                        <p className="text-[9px] font-bold uppercase text-emerald-500 mb-1">Total OC</p>
                        <p className="text-lg font-black text-emerald-600">{formatearPrecio(detalleModal.data.total)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Tabla productos */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Package size={16} className="text-[#059669]" />
                      <h3 className="font-bold text-slate-800">Productos ({detalleModal.data.productos.length})</h3>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">SKU</th>
                            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Producto</th>
                            <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase">Cant.</th>
                            <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase">Und.</th>
                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase">P. Unitario</th>
                            <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {detalleModal.data.productos.map((p, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-[10px] font-mono text-slate-400">{p.sku || "—"}</td>
                              <td className="px-4 py-3 font-medium text-slate-700 max-w-[250px]">{p.nombre}</td>
                              <td className="px-4 py-3 text-center font-bold text-slate-700">{p.cantidad}</td>
                              <td className="px-4 py-3 text-center text-slate-500 text-xs">{p.unidad}</td>
                              <td className="px-4 py-3 text-right text-slate-600">{formatearPrecio(p.precio_unitario)}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800">{formatearPrecio(p.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-100">
                          <tr>
                            <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-600 text-xs uppercase tracking-wider">Total:</td>
                            <td className="px-4 py-3 text-right font-black text-emerald-600 text-base">
                              {formatearPrecio(detalleModal.data.total)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {detalleModal.data.observacion && (
                    <div className="bg-amber-50 rounded-xl p-4">
                      <p className="text-xs text-amber-700">
                        <strong>Observación:</strong> {detalleModal.data.observacion}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20">
                  <AlertCircle size={40} className="mx-auto text-red-300 mb-4" />
                  <p className="text-slate-500">No se pudo cargar el detalle de esta orden.</p>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button onClick={() => setDetalleModal({ visible: false, loading: false, data: null })}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
