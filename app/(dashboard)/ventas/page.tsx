"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  TrendingUp, Search, Download, Filter, RefreshCcw,
  ChevronLeft, ChevronRight, Eye, X, Loader2,
  AlertCircle, DollarSign, Users, FileText, Receipt,
  CreditCard, CheckCircle2, Hash, ExternalLink
} from "lucide-react";
import * as XLSX from "xlsx";

type TabType = "ventas" | "cotizaciones" | "cobros";

const AÑOS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));
const MESES = [
  { v: "", l: "Todos los meses" },
  ...["01","02","03","04","05","06","07","08","09","10","11","12"].map((m,i) => ({
    v: m, l: `${m} - ${["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][i]}`
  }))
];
const TIPO_DTE: Record<string, string> = {
  "33":"Factura","34":"Fact. Exenta","39":"Boleta","41":"Boleta Exenta",
  "52":"Guía Despacho","56":"Nota Débito","61":"Nota Crédito","110":"Fact. Exportación",
};
const fmt = (n: any) => `$${Number(n||0).toLocaleString("es-CL")}`;
const fmtF = (raw: string|null|undefined) => {
  if (!raw || raw.startsWith("0000")) return "—";
  const d = raw.split(" ")[0];
  const p = d.split("-");
  if (p.length !== 3) return raw;
  return p[0].length === 4 ? `${p[2]}-${p[1]}-${p[0]}` : `${p[0]}-${p[1]}-${p[2]}`;
};

export default function VentasPage() {
  const [tab, setTab] = useState<TabType>("ventas");
  const [datos, setDatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState(new Date().getFullYear().toString());
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [pag, setPag] = useState(1);
  const [debugMode, setDebugMode] = useState(false);
  const [modalDetalle, setModalDetalle] = useState<{visible:boolean;loading:boolean;data:any}>({visible:false,loading:false,data:null});
  const POR_PAG = 20;

  const cargar = useCallback(async () => {
    setLoading(true); setError(null); setDatos([]); setPag(1);
    try {
      const p: Record<string,string> = {};
      if (mes) p.mes = mes;
      if (ano) p.ano = ano;
      if (fechaDesde) p.fecha_desde = fechaDesde.split("-").reverse().join("-");
      if (fechaHasta) p.fecha_hasta = fechaHasta.split("-").reverse().join("-");
      const qs = new URLSearchParams(p).toString();
      const urls: Record<TabType,string> = {
        ventas: `/api/obuma/ventas${qs?`?${qs}`:""}`,
        cotizaciones: `/api/obuma/ventas/cotizaciones${qs?`?${qs}`:""}`,
        cobros: `/api/obuma/ventas/cobros${qs?`?${qs}`:""}`,
      };
      const res = await fetch(urls[tab]);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setDatos(json.data || json.docs || (Array.isArray(json) ? json : []));
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  }, [tab, mes, ano, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => {
    if (!texto) return datos;
    const t = texto.toLowerCase();
    return datos.filter(r => JSON.stringify(r).toLowerCase().includes(t));
  }, [datos, texto]);

  const totalPags = Math.ceil(filtrados.length / POR_PAG);
  const pagActual = filtrados.slice((pag-1)*POR_PAG, pag*POR_PAG);

  const verDetalle = async (id: string) => {
    setModalDetalle({visible:true,loading:true,data:null});
    try {
      const res = await fetch(`/api/obuma/ventas/${id}`);
      const d = await res.json();
      setModalDetalle({visible:true,loading:false,data:res.ok?d:null});
    } catch { setModalDetalle({visible:true,loading:false,data:null}); }
  };

  // KPIs dinámicos
  const kpis = useMemo(() => {
    if (tab === "ventas") {
      const total = filtrados.reduce((s,r)=>s+Number(r.venta_total||r.total||0),0);
      const clientes = new Set(filtrados.map(r=>r.venta_rut_cliente||r.cliente_rut)).size;
      return [
        {label:"Total Ventas",value:filtrados.length,color:"text-slate-700",bg:"bg-slate-100",icon:TrendingUp},
        {label:"Monto Total",value:fmt(total),color:"text-[#2563EB]",bg:"bg-[#EFF6FF]",icon:DollarSign},
        {label:"Clientes únicos",value:clientes,color:"text-purple-600",bg:"bg-purple-100",icon:Users},
        {label:"Tipos Dcto.",value:new Set(filtrados.map(r=>r.venta_tipo_dcto||r.tipo_dcto)).size,color:"text-blue-600",bg:"bg-blue-100",icon:FileText},
      ];
    }
    if (tab === "cotizaciones") {
      const total = filtrados.reduce((s,r)=>s+Number(r.cotizacion_total||r.total||0),0);
      return [
        {label:"Total Cotizaciones",value:filtrados.length,color:"text-slate-700",bg:"bg-slate-100",icon:FileText},
        {label:"Monto Total",value:fmt(total),color:"text-[#2563EB]",bg:"bg-[#EFF6FF]",icon:DollarSign},
        {label:"Clientes",value:new Set(filtrados.map(r=>r.cliente_rut||r.cotizacion_cliente)).size,color:"text-purple-600",bg:"bg-purple-100",icon:Users},
        {label:"Vigentes",value:filtrados.filter(r=>r.cotizacion_estado==="VIGENTE").length,color:"text-emerald-600",bg:"bg-emerald-100",icon:CheckCircle2},
      ];
    }
    // cobros
    const total = filtrados.reduce((s,r)=>s+Number(r.vc_total||r.monto||0),0);
    return [
      {label:"Total Cobros",value:filtrados.length,color:"text-slate-700",bg:"bg-slate-100",icon:CreditCard},
      {label:"Monto Total",value:fmt(total),color:"text-[#2563EB]",bg:"bg-[#EFF6FF]",icon:DollarSign},
      {label:"Orígenes",value:new Set(filtrados.map(r=>r.vc_origen_nombre||r.origen)).size,color:"text-blue-600",bg:"bg-blue-100",icon:Hash},
      {label:"Mes/Año",value:`${mes||"*"}/${ano}`,color:"text-slate-500",bg:"bg-slate-100",icon:Receipt},
    ];
  }, [filtrados, tab, mes, ano]);

  const exportar = () => {
    const ts = new Date().toISOString().slice(0,10);
    const ws = XLSX.utils.json_to_sheet(filtrados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab.toUpperCase());
    XLSX.writeFile(wb, `${tab}_${ts}.xlsx`);
  };

  const TABS = [
    {id:"ventas" as TabType,label:"Ventas / Facturas",icon:TrendingUp},
    {id:"cotizaciones" as TabType,label:"Cotizaciones",icon:FileText},
    {id:"cobros" as TabType,label:"Cobros",icon:CreditCard},
  ];

  return (
    <div className="space-y-5 pb-10">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={()=>{setTab(t.id);setDatos([]);setDebugMode(false);}}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wide transition-all ${
              tab===t.id?"bg-[#2563EB] text-white shadow-md":"bg-white text-slate-500 border border-slate-200 hover:border-[#2563EB] hover:text-[#2563EB]"
            }`}>
            <t.icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k,i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${k.bg}`}><k.icon size={18} className={k.color}/></div>
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{k.label}</p>
              <p className={`text-xl font-black ${k.color} leading-tight`}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
            <input type="text" placeholder="Buscar en resultados..." value={texto} onChange={e=>setTexto(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"/>
          </div>
          <select value={mes} onChange={e=>setMes(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            {MESES.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <select value={ano} onChange={e=>setAno(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
            {AÑOS.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Desde</span>
            <input type="date" value={fechaDesde} onChange={e=>setFechaDesde(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none"/>
            <span className="text-[10px] text-slate-400">Hasta</span>
            <input type="date" value={fechaHasta} onChange={e=>setFechaHasta(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none"/>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={()=>{setMes("");setFechaDesde("");setFechaHasta("");setTexto("");}}
              className="px-3 py-2.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl flex items-center gap-1.5">
              <Filter size={13}/> Limpiar
            </button>
            <button onClick={cargar} disabled={loading}
              className="px-3 py-2.5 text-xs font-bold text-white bg-slate-800 rounded-xl flex items-center gap-1.5 hover:bg-[#2563EB] disabled:opacity-50">
              <RefreshCcw size={13} className={loading?"animate-spin":""}/> Buscar
            </button>
            <button onClick={exportar}
              className="px-4 py-2.5 text-xs font-bold bg-[#2563EB] text-white rounded-xl flex items-center gap-1.5">
              <Download size={13}/> Excel
            </button>
            <button onClick={()=>setDebugMode(d=>!d)}
              className={`px-3 py-2.5 text-xs font-bold rounded-xl ${debugMode?"bg-amber-400 text-white":"bg-slate-100 text-slate-400"}`}>
              {} Debug
            </button>
          </div>
        </div>
        {!loading && <p className="text-[10px] text-slate-400 mt-2 font-bold">{filtrados.length} registros · API Obuma</p>}
      </div>

      {/* Debug */}
      {debugMode && datos.length > 0 && (
        <div className="bg-slate-900 rounded-2xl p-5 font-mono text-xs overflow-x-auto">
          <p className="text-amber-400 mb-2">CAMPOS [{tab}]: {Object.keys(datos[0]).join(" | ")}</p>
          <pre className="text-slate-300 text-[10px]">{JSON.stringify(datos[0],null,2)}</pre>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-5 py-4">Tipo/Folio</th>
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
                  <Loader2 className="animate-spin text-[#2563EB] mx-auto mb-2" size={32}/>
                  <p className="text-slate-400 text-xs">Consultando API Obuma...</p>
                </td></tr>
              ) : error ? (
                <tr><td colSpan={6} className="p-16 text-center">
                  <AlertCircle className="mx-auto text-rose-400 mb-2" size={32}/>
                  <p className="text-rose-500 text-sm">{error}</p>
                  <button onClick={cargar} className="mt-2 text-xs text-[#2563EB] font-bold">Reintentar</button>
                </td></tr>
              ) : pagActual.length === 0 ? (
                <tr><td colSpan={6} className="p-16 text-center text-slate-400">Sin resultados.</td></tr>
              ) : pagActual.map((r, i) => {
                // Intentar leer campos comunes en ventas/cotizaciones/cobros
                const folio = r.venta_folio || r.cotizacion_folio || r.vc_id || r.folio || "—";
                const tipo = r.venta_tipo_dcto || r.cotizacion_tipo || r.tipo_dcto || "";
                const fecha = r.venta_fecha || r.cotizacion_fecha || r.vc_fecha_ingreso || r.fecha;
                const cliente = r.venta_razon_social || r.cliente_razon_social || r.cotizacion_cliente_razon_social || r.vc_cliente_razon_social || "—";
                const clienteRut = r.venta_rut_cliente || r.cliente_rut || r.cotizacion_rut_cliente || "";
                const total = r.venta_total || r.cotizacion_total || r.vc_total || r.total || 0;
                const estado = r.venta_estado || r.cotizacion_estado || r.vc_estado || r.estado;
                const id = r.venta_id || r.cotizacion_id || r.vc_id || r.id;
                return (
                  <tr key={id||i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      {tipo && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded mr-1">{TIPO_DTE[tipo]||tipo}</span>}
                      <span className="text-xs font-bold text-[#2563EB]">#{folio}</span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">{fmtF(fecha)}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-xs font-bold text-slate-700 truncate max-w-[180px]">{cliente}</p>
                      {clienteRut && <p className="text-[9px] font-mono text-slate-400">{clienteRut}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-slate-800">{fmt(total)}</td>
                    <td className="px-5 py-3.5 text-center">
                      {estado && <span className="px-2.5 py-1 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{estado}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {id && <button onClick={()=>verDetalle(String(id))}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-[#EFF6FF] text-slate-500 hover:text-[#2563EB] transition-all">
                        <Eye size={14}/>
                      </button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && filtrados.length > POR_PAG && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">{(pag-1)*POR_PAG+1}–{Math.min(pag*POR_PAG,filtrados.length)} de {filtrados.length}</p>
            <div className="flex gap-2">
              <button onClick={()=>setPag(p=>Math.max(p-1,1))} disabled={pag===1}
                className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-30"><ChevronLeft className="w-4 h-4 text-slate-600"/></button>
              <div className="flex items-center px-4 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600">{pag}/{totalPags}</div>
              <button onClick={()=>setPag(p=>Math.min(p+1,totalPags))} disabled={pag===totalPags}
                className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-30"><ChevronRight className="w-4 h-4 text-slate-600"/></button>
            </div>
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {modalDetalle.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Detalle {tab.charAt(0).toUpperCase()+tab.slice(1,-1)}</h2>
              <button onClick={()=>setModalDetalle({visible:false,loading:false,data:null})} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {modalDetalle.loading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#2563EB]" size={36}/></div>
              ) : modalDetalle.data ? (
                <pre className="text-[10px] font-mono text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-4 overflow-x-auto">
                  {JSON.stringify(modalDetalle.data, null, 2)}
                </pre>
              ) : (
                <div className="text-center py-16"><AlertCircle size={36} className="mx-auto text-rose-300 mb-3"/><p className="text-slate-500">Sin detalle disponible.</p></div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button onClick={()=>setModalDetalle({visible:false,loading:false,data:null})}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
