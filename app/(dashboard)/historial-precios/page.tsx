"use client";
import { useEffect, useState, useMemo } from "react";
import {
  TrendingDown, TrendingUp, Minus, Store,
  Calendar, Search, RefreshCcw, ExternalLink,
  AlertCircle, Hash, Tag, Download, Filter, BarChart2
} from "lucide-react";
import * as XLSX from "xlsx";

export default function HistorialPreciosPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroTendencia, setFiltroTendencia] = useState("TODOS");
  const [filtroTienda, setFiltroTienda] = useState("TODAS");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [ordenPor, setOrdenPor] = useState<"fecha" | "precio" | "diferencia">("fecha");

  const fetchAnalisis = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analizar-precios");
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch {
      console.error("Error cargando historial");
    }
    setLoading(false);
  };

  useEffect(() => { fetchAnalisis(); }, []);

  // Tiendas únicas
  const tiendasUnicas = useMemo(() => {
    const set = new Set(data.map((d) => d.tienda).filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  // KPIs
  const bajas = data.filter((d) => d.tendencia === "BAJA").length;
  const subidas = data.filter((d) => d.tendencia === "SUBE").length;
  const estables = data.filter((d) => d.tendencia === "IGUAL" || !d.tendencia).length;
  const ahorroPotencial = data.filter((d) => d.tendencia === "BAJA").reduce((s, d) => s + Math.abs(d.diferencia || 0), 0);

  const filtrados = useMemo(() => {
    let list = data.filter((item) => {
      const term = filtroTexto.toLowerCase();
      const matchText =
        !term ||
        item.producto?.toLowerCase().includes(term) ||
        item.tienda?.toLowerCase().includes(term) ||
        item.sku?.toLowerCase().includes(term);
      const matchTend = filtroTendencia === "TODOS" || item.tendencia === filtroTendencia;
      const matchTienda = filtroTienda === "TODAS" || item.tienda === filtroTienda;
      const fecha = item.ultima_fecha?.slice(0, 10);
      const matchDesde = !fechaDesde || (fecha && fecha >= fechaDesde);
      const matchHasta = !fechaHasta || (fecha && fecha <= fechaHasta);
      return matchText && matchTend && matchTienda && matchDesde && matchHasta;
    });

    if (ordenPor === "precio") list = [...list].sort((a, b) => (b.precio_actual || 0) - (a.precio_actual || 0));
    else if (ordenPor === "diferencia") list = [...list].sort((a, b) => Math.abs(b.diferencia || 0) - Math.abs(a.diferencia || 0));
    else list = [...list].sort((a, b) => new Date(b.ultima_fecha || 0).getTime() - new Date(a.ultima_fecha || 0).getTime());

    return list;
  }, [data, filtroTexto, filtroTendencia, filtroTienda, fechaDesde, fechaHasta, ordenPor]);

  const exportarExcel = () => {
    const rows = filtrados.map((item) => ({
      "SKU": item.sku || "—",
      "Producto": item.producto,
      "Tienda": item.tienda,
      "Precio Anterior ($)": item.precio_anterior,
      "Precio Actual ($)": item.precio_actual,
      "Diferencia ($)": item.diferencia,
      "Tendencia": item.tendencia,
      "Última Actualización": item.ultima_fecha ? new Date(item.ultima_fecha).toLocaleDateString("es-CL") : "—",
      "Link": item.link || "—",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial Precios");
    ws["!cols"] = [12, 40, 20, 16, 16, 14, 10, 18, 50].map((w) => ({ wch: w }));
    XLSX.writeFile(wb, `HistorialPrecios_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const resetFiltros = () => {
    setFiltroTexto(""); setFiltroTendencia("TODOS");
    setFiltroTienda("TODAS"); setFechaDesde(""); setFechaHasta("");
    setOrdenPor("fecha");
  };

  return (
    <div className="space-y-5 pb-10 animate-in fade-in duration-500">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Con Baja de Precio", value: bajas, icon: TrendingDown, color: "text-emerald-600", bg: "bg-emerald-100", text: "Oportunidades" },
          { label: "Con Subida de Precio", value: subidas, icon: TrendingUp, color: "text-rose-500", bg: "bg-rose-100", text: "Atencion" },
          { label: "Sin Variación", value: estables, icon: Minus, color: "text-slate-500", bg: "bg-slate-100", text: "Estables" },
          { label: "Ahorro Potencial", value: `$${ahorroPotencial.toLocaleString("es-CL")}`, icon: BarChart2, color: "text-[#059669]", bg: "bg-[#D1FAE5]", text: "En bajadas" },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${k.bg}`}>
              <k.icon size={18} className={k.color} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{k.label}</p>
              <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
              <p className="text-[9px] text-slate-400">{k.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Buscar por nombre, SKU o tienda..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#059669]/20"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
            />
          </div>

          {/* Tendencia */}
          <select value={filtroTendencia} onChange={(e) => setFiltroTendencia(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            <option value="TODOS">Todas las tendencias</option>
            <option value="BAJA">Baja de precio</option>
            <option value="SUBE">Subida de precio</option>
            <option value="IGUAL">Sin variación</option>
          </select>

          {/* Tienda */}
          <select value={filtroTienda} onChange={(e) => setFiltroTienda(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none max-w-[180px]">
            <option value="TODAS">Todas las tiendas</option>
            {tiendasUnicas.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Fechas */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400">Desde</span>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none" />
            <span className="text-[10px] font-bold text-slate-400">Hasta</span>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none" />
          </div>

          {/* Orden */}
          <select value={ordenPor} onChange={(e) => setOrdenPor(e.target.value as any)}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            <option value="fecha">Ordenar: Fecha</option>
            <option value="precio">Ordenar: Precio</option>
            <option value="diferencia">Ordenar: Mayor variación</option>
          </select>

          {/* Acciones */}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={resetFiltros} className="px-3 py-2.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl flex items-center gap-1.5 hover:bg-slate-200 transition-all">
              <Filter size={14} /> Limpiar
            </button>
            <button onClick={exportarExcel} className="px-4 py-2.5 text-xs font-bold bg-[#059669] text-white rounded-xl flex items-center gap-1.5 shadow-sm hover:bg-[#047857] transition-all">
              <Download size={14} /> Excel
            </button>
            <button onClick={fetchAnalisis} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-[#059669] transition-all">
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Contador */}
        <p className="text-[10px] text-slate-400 mt-2.5 font-bold uppercase tracking-wider">
          {filtrados.length} registros encontrados
        </p>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <RefreshCcw size={40} className="animate-spin text-[#059669] opacity-20" />
            <p className="text-slate-400 font-black text-[9px] uppercase tracking-[0.3em]">Cargando registros...</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-20 text-center">
            <AlertCircle size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-500 font-bold text-sm">Sin registros con los filtros aplicados</p>
            <button onClick={resetFiltros} className="mt-3 text-xs text-[#059669] font-bold hover:underline">Limpiar filtros</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Tendencia</th>
                  <th className="px-6 py-4">Tienda / SKU</th>
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4 text-right">Anterior</th>
                  <th className="px-6 py-4 text-right">Actual</th>
                  <th className="px-6 py-4 text-right">Variación</th>
                  <th className="px-6 py-4 text-center">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtrados.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                        item.tendencia === "BAJA" ? "bg-emerald-100 text-emerald-600" :
                        item.tendencia === "SUBE" ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"
                      }`}>
                        {item.tendencia === "BAJA" ? <TrendingDown size={11} /> :
                         item.tendencia === "SUBE" ? <TrendingUp size={11} /> : <Minus size={11} />}
                        {item.tendencia || "IGUAL"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                          <Store size={10} className="text-[#059669]" /> {item.tienda}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                          <Hash size={10} /> {item.sku || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] font-bold text-slate-700 leading-tight line-clamp-2 max-w-[260px]">
                        {item.producto}
                      </p>
                      <span className="text-[8px] text-slate-300 font-medium">
                        {item.ultima_fecha ? new Date(item.ultima_fecha).toLocaleDateString("es-CL") : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-[11px] font-bold text-slate-400 line-through">
                        ${item.precio_anterior?.toLocaleString("es-CL")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-[13px] font-black text-slate-900">
                        ${item.precio_actual?.toLocaleString("es-CL")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-[11px] font-black ${
                        item.tendencia === "BAJA" ? "text-emerald-500" :
                        item.tendencia === "SUBE" ? "text-rose-500" : "text-slate-400"
                      }`}>
                        {item.diferencia > 0 ? "+" : ""}{item.diferencia?.toLocaleString("es-CL")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.link ? (
                        <a href={item.link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-[#059669] hover:text-white transition-all">
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        <span className="text-[8px] text-slate-300 font-bold uppercase">Sin link</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
