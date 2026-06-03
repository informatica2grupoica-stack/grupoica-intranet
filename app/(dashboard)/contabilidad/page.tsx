"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BookOpen, Search, Download, Filter, RefreshCcw,
  ChevronLeft, ChevronRight, Loader2, AlertCircle,
  DollarSign, CreditCard, Hash, TrendingUp, Layers
} from "lucide-react";
import * as XLSX from "xlsx";

type TabType = "diario" | "cheques" | "centros_costo" | "plan_cuentas";

const fmt = (n: any) => `$${Number(n||0).toLocaleString("es-CL")}`;
const fmtF = (raw: string|null|undefined) => {
  if (!raw || raw.startsWith("0000")) return "—";
  const d = raw.split(" ")[0], p = d.split("-");
  if (p.length !== 3) return raw;
  return p[0].length === 4 ? `${p[2]}-${p[1]}-${p[0]}` : raw;
};

const AÑOS = Array.from({length:5},(_,i)=>String(new Date().getFullYear()-i));
const MESES = ["","01","02","03","04","05","06","07","08","09","10","11","12"];

export default function ContabilidadPage() {
  const [tab, setTab] = useState<TabType>("diario");
  const [datos, setDatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [texto, setTexto] = useState("");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState(new Date().getFullYear().toString());
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [pag, setPag] = useState(1);
  const [debugMode, setDebugMode] = useState(false);
  const POR_PAG = 25;

  const cargar = useCallback(async () => {
    setLoading(true); setError(null); setDatos([]); setPag(1);
    try {
      let url = "";
      if (tab === "diario") {
        const p: Record<string,string> = {};
        if (fechaDesde) p.fecha_desde = fechaDesde;
        if (fechaHasta) p.fecha_hasta = fechaHasta;
        url = `/api/obuma/contabilidad/diario?${new URLSearchParams(p)}`;
      } else if (tab === "cheques") {
        const p: Record<string,string> = {};
        if (mes) p.mes = mes;
        if (ano) p.ano = ano;
        url = `/api/obuma/contabilidad/cheques?${new URLSearchParams(p)}`;
      } else if (tab === "centros_costo") {
        url = "/api/obuma/contabilidad/centros-costo";
      } else {
        url = "/api/obuma/contabilidad/plan-cuentas";
      }
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setDatos(json.data || json.docs || (Array.isArray(json) ? json : []));
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  }, [tab, mes, ano, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => {
    if (!texto) return datos;
    return datos.filter(r => JSON.stringify(r).toLowerCase().includes(texto.toLowerCase()));
  }, [datos, texto]);

  const totalPags = Math.ceil(filtrados.length / POR_PAG);
  const pagActual = filtrados.slice((pag-1)*POR_PAG, pag*POR_PAG);

  const kpis = useMemo(() => {
    if (tab === "diario") {
      const debe = filtrados.reduce((s,r)=>s+Number(r.debe||r.monto_debe||0),0);
      const haber = filtrados.reduce((s,r)=>s+Number(r.haber||r.monto_haber||0),0);
      return [
        {label:"Asientos",value:filtrados.length,color:"text-slate-700",bg:"bg-slate-100",icon:Hash},
        {label:"Total Debe",value:fmt(debe),color:"text-rose-600",bg:"bg-rose-100",icon:TrendingUp},
        {label:"Total Haber",value:fmt(haber),color:"text-emerald-600",bg:"bg-emerald-100",icon:DollarSign},
        {label:"Diferencia",value:fmt(Math.abs(debe-haber)),color:"text-blue-600",bg:"bg-blue-100",icon:Layers},
      ];
    }
    if (tab === "cheques") {
      const total = filtrados.reduce((s,r)=>s+Number(r.cheque_monto||r.monto||0),0);
      return [
        {label:"Total Cheques",value:filtrados.length,color:"text-slate-700",bg:"bg-slate-100",icon:CreditCard},
        {label:"Monto Total",value:fmt(total),color:"text-[#059669]",bg:"bg-[#D1FAE5]",icon:DollarSign},
        {label:"Mes/Año",value:`${mes||"*"}/${ano}`,color:"text-slate-500",bg:"bg-slate-100",icon:Hash},
        {label:"Bancos únicos",value:new Set(filtrados.map(r=>r.banco_id||r.banco)).size,color:"text-blue-600",bg:"bg-blue-100",icon:Layers},
      ];
    }
    return [
      {label:"Total registros",value:filtrados.length,color:"text-slate-700",bg:"bg-slate-100",icon:Hash},
      {label:"Tab activo",value:tab.replace("_"," "),color:"text-[#059669]",bg:"bg-[#D1FAE5]",icon:BookOpen},
      {label:"","value":"","color":"text-slate-400","bg":"bg-slate-50",icon:Layers},
      {label:"","value":"","color":"text-slate-400","bg":"bg-slate-50",icon:Layers},
    ];
  }, [filtrados, tab, mes, ano]);

  const exportar = () => {
    const ws = XLSX.utils.json_to_sheet(filtrados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab.toUpperCase());
    XLSX.writeFile(wb, `contabilidad_${tab}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const TABS = [
    {id:"diario" as TabType, label:"Libro Diario", icon:BookOpen},
    {id:"cheques" as TabType, label:"Cheques", icon:CreditCard},
    {id:"centros_costo" as TabType, label:"Centros de Costo", icon:Layers},
    {id:"plan_cuentas" as TabType, label:"Plan de Cuentas", icon:Hash},
  ];

  return (
    <div className="space-y-5 pb-10">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={()=>{setTab(t.id);setDatos([]);setDebugMode(false);}}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wide transition-all ${
              tab===t.id?"bg-[#059669] text-white shadow-md":"bg-white text-slate-500 border border-slate-200 hover:border-[#059669] hover:text-[#059669]"
            }`}>
            <t.icon size={14}/> {t.label}
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

          {tab === "cheques" && <>
            <select value={mes} onChange={e=>setMes(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
              {MESES.map(m=><option key={m} value={m}>{m||"Todos los meses"}</option>)}
            </select>
            <select value={ano} onChange={e=>setAno(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none">
              {AÑOS.map(a=><option key={a} value={a}>{a}</option>)}
            </select>
          </>}

          {tab === "diario" && <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Desde</span>
            <input type="date" value={fechaDesde} onChange={e=>setFechaDesde(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none"/>
            <span className="text-[10px] text-slate-400">Hasta</span>
            <input type="date" value={fechaHasta} onChange={e=>setFechaHasta(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none"/>
          </div>}

          <div className="flex gap-2 ml-auto">
            <button onClick={()=>{setTexto("");setMes("");setFechaDesde("");setFechaHasta("");}}
              className="px-3 py-2.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl flex items-center gap-1.5">
              <Filter size={13}/> Limpiar
            </button>
            <button onClick={cargar} disabled={loading}
              className="px-3 py-2.5 text-xs font-bold text-white bg-slate-800 rounded-xl flex items-center gap-1.5 hover:bg-[#059669] disabled:opacity-50">
              <RefreshCcw size={13} className={loading?"animate-spin":""}/> Buscar
            </button>
            <button onClick={exportar} className="px-4 py-2.5 text-xs font-bold bg-[#059669] text-white rounded-xl flex items-center gap-1.5">
              <Download size={13}/> Excel
            </button>
            <button onClick={()=>setDebugMode(d=>!d)} className={`px-3 py-2.5 text-xs font-bold rounded-xl ${debugMode?"bg-amber-400 text-white":"bg-slate-100 text-slate-400"}`}>
              {} Debug
            </button>
          </div>
        </div>
        {!loading && <p className="text-[10px] text-slate-400 mt-2 font-bold">{filtrados.length} registros</p>}
      </div>

      {/* Debug */}
      {debugMode && datos.length > 0 && (
        <div className="bg-slate-900 rounded-2xl p-5 font-mono text-xs overflow-x-auto">
          <p className="text-amber-400 mb-2">CAMPOS [{tab}]: {Object.keys(datos[0]).join(" | ")}</p>
          <pre className="text-slate-300 text-[10px]">{JSON.stringify(datos[0],null,2)}</pre>
        </div>
      )}

      {/* Tabla genérica */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-16 text-center">
              <Loader2 className="animate-spin text-[#059669] mx-auto mb-2" size={32}/>
              <p className="text-slate-400 text-xs">Consultando API Obuma...</p>
            </div>
          ) : error ? (
            <div className="p-16 text-center">
              <AlertCircle className="mx-auto text-rose-400 mb-2" size={32}/>
              <p className="text-rose-500 text-sm">{error}</p>
              <button onClick={cargar} className="mt-2 text-xs text-[#059669] font-bold">Reintentar</button>
            </div>
          ) : pagActual.length === 0 ? (
            <div className="p-16 text-center text-slate-400">Sin resultados para los filtros aplicados.</div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  {Object.keys(pagActual[0]).slice(0,8).map(k => (
                    <th key={k} className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{k.replace(/_/g," ")}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pagActual.map((r,i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    {Object.values(r).slice(0,8).map((v:any, j) => (
                      <td key={j} className="px-4 py-3 text-xs text-slate-700 truncate max-w-[200px]">
                        {typeof v === "string" || typeof v === "number" ? String(v) : JSON.stringify(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filtrados.length > POR_PAG && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">{(pag-1)*POR_PAG+1}–{Math.min(pag*POR_PAG,filtrados.length)} de {filtrados.length}</p>
            <div className="flex gap-2">
              <button onClick={()=>setPag(p=>Math.max(p-1,1))} disabled={pag===1} className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-30"><ChevronLeft className="w-4 h-4"/></button>
              <div className="flex items-center px-4 bg-white border border-slate-200 rounded-lg text-xs font-bold">{pag}/{totalPags}</div>
              <button onClick={()=>setPag(p=>Math.min(p+1,totalPags))} disabled={pag===totalPags} className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-30"><ChevronRight className="w-4 h-4"/></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
