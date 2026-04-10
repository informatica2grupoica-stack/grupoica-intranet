"use client";

import { useState, useMemo } from 'react';
import { 
  Search, ExternalLink, Loader2, Target, 
  TrendingDown, LineChart, BarChart3, 
  MapPin, ShoppingCart, Globe, Factory
} from 'lucide-react';

export default function MonitorMasivoICA() {
  const [input, setInput] = useState("");
  const [miPrecio, setMiPrecio] = useState<number | "">("");
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Cálculo de estadísticas en tiempo real
  const stats = useMemo(() => {
    const conPrecio = lista.filter(p => p.precio_valor > 0);
    if (conPrecio.length === 0) return { min: 0, avg: 0, count: 0 };
    const precios = conPrecio.map(p => p.precio_valor);
    return {
      min: Math.min(...precios),
      avg: Math.round(precios.reduce((a, b) => a + b, 0) / precios.length),
      count: lista.length
    };
  }, [lista]);

  const escanear = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setLista([]);
    try {
      const res = await fetch(`/api/index?producto=${encodeURIComponent(input)}`);
      const data = await res.json();
      setLista(data);
    } catch (e) {
      console.error("Error en radar:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-[#020617] min-h-screen text-slate-300 font-sans">
      
      {/* HEADER DE CONTROL INDUSTRIAL */}
      <div className="max-w-[1600px] mx-auto bg-slate-900/80 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-2xl mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-white italic tracking-tighter flex items-center gap-3">
              <span className="bg-orange-500 w-2 h-8 rounded-full"></span>
              RADAR <span className="text-orange-500">ICA</span> PRO
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-1">
              Escaneo Masivo: Shopping + Web + Mayoristas + Maps
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Sistema Activo</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 bg-slate-950 rounded-2xl flex items-center px-5 border border-slate-800 focus-within:border-orange-500 transition-all shadow-inner">
            <Search className="text-slate-600 mr-4" size={20} />
            <input 
              className="bg-transparent w-full py-5 outline-none font-bold text-white placeholder:text-slate-700" 
              placeholder="Nombre del producto o SKU (ej: Disco Corte 115mm)..." 
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && escanear()}
            />
          </div>
          <div className="md:col-span-3 bg-slate-950 rounded-2xl flex items-center px-5 border border-slate-800 focus-within:border-orange-500 transition-all shadow-inner">
            <Target className="text-orange-500 mr-4" size={20} />
            <input 
              type="number" className="bg-transparent w-full py-5 outline-none font-black text-orange-400 placeholder:text-slate-700 text-xl" 
              placeholder="P. Venta" 
              value={miPrecio} onChange={e => setMiPrecio(e.target.value ? Number(e.target.value) : "")}
            />
          </div>
          <button 
            onClick={escanear} disabled={loading}
            className="md:col-span-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-800 rounded-2xl font-black text-white uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg shadow-orange-900/20"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" /> : "Iniciar Barrido Total"}
          </button>
        </div>
      </div>

      {/* DASHBOARD DE MÉTRICAS RÁPIDAS */}
      {lista.length > 0 && (
        <div className="max-w-[1600px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="P. Mínimo Mercado" value={`$${stats.min.toLocaleString('es-cl')}`} color="emerald" icon={<TrendingDown size={14}/>} />
          <StatCard label="Promedio General" value={`$${stats.avg.toLocaleString('es-cl')}`} color="blue" icon={<LineChart size={14}/>} />
          <StatCard label="Fuentes Detectadas" value={`${stats.count} Proveedores`} color="slate" icon={<BarChart3 size={14}/>} />
          <div className={`p-5 rounded-2xl border-l-8 shadow-xl ${miPrecio && miPrecio <= stats.min ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-rose-500 text-rose-400'}`}>
            <p className="text-[10px] uppercase font-black opacity-60 mb-1 tracking-widest">Posición Competitiva</p>
            <p className="text-2xl font-black italic">{miPrecio ? (miPrecio <= stats.min ? "LÍDER DE PRECIO" : "SOBRE EL MÍNIMO") : "---"}</p>
          </div>
        </div>
      )}

      {/* TABLA DE PROVEEDORES DE ALTA DENSIDAD */}
      <div className="max-w-[1600px] mx-auto bg-slate-900/30 rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/40 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">
                <th className="p-6">Origen / Canal</th>
                <th className="p-6">Descripción del Proveedor</th>
                <th className="p-6">Precio</th>
                <th className="p-6">Diferencia ICA</th>
                <th className="p-6 text-center">Enlace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-32 text-center">
                    <Loader2 className="animate-spin mx-auto text-orange-500 mb-4" size={48} />
                    <p className="text-orange-500 font-black uppercase tracking-widest text-xs">Escaneando Retail y Shopping...</p>
                  </td>
                </tr>
              ) : lista.map((item, i) => {
                const dif = miPrecio && item.precio_valor > 0 ? item.precio_valor - Number(miPrecio) : null;
                return (
                  <tr key={i} className="group hover:bg-white/[0.03] transition-colors">
                    <td className="p-6">
                      <div className="flex flex-col gap-2">
                        <span className="bg-slate-800 text-white px-3 py-1 rounded-lg text-[10px] font-black w-fit border border-slate-700 group-hover:border-orange-500 transition-colors">
                          {item.tienda}
                        </span>
                        <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tighter ${item.canal === 'SHOPPING' ? 'text-orange-400' : 'text-blue-400'}`}>
                          {item.canal === 'SHOPPING' ? <ShoppingCart size={10}/> : <Globe size={10}/>}
                          {item.canal || 'WEB'}
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <p className="text-sm font-bold text-slate-200 leading-tight max-w-md group-hover:text-white transition-colors">
                        {item.nombre}
                      </p>
                    </td>
                    <td className="p-6 whitespace-nowrap">
                      {item.precio_valor > 0 ? (
                        <p className="text-xl font-black text-white font-mono italic tracking-tighter">
                          {item.precio_formateado}
                        </p>
                      ) : (
                        <span className="text-blue-500 flex items-center gap-1.5 text-[10px] font-black bg-blue-500/10 px-3 py-1.5 rounded-full w-fit">
                          <MapPin size={12}/> CONSULTAR LOCAL
                        </span>
                      )}
                    </td>
                    <td className="p-6 whitespace-nowrap">
                      {dif !== null ? (
                        <div className={`flex flex-col ${dif >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <span className="text-xs font-black uppercase tracking-widest mb-1 opacity-50">
                            {dif >= 0 ? 'Ahorro' : 'Exceso'}
                          </span>
                          <span className="text-lg font-black font-mono">
                            {dif >= 0 ? '+' : '-'}${Math.abs(dif).toLocaleString('es-cl')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs italic">Sin comparar</span>
                      )}
                    </td>
                    <td className="p-6 text-center">
                      <a 
                        href={item.link} 
                        target="_blank" 
                        className="bg-slate-800 hover:bg-orange-500 text-white p-4 rounded-2xl transition-all inline-block shadow-lg hover:shadow-orange-500/20"
                      >
                        <ExternalLink size={18} />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: any) {
  const colors: any = {
    emerald: "border-emerald-500 text-emerald-500",
    blue: "border-blue-500 text-blue-500",
    slate: "border-slate-700 text-slate-400"
  };
  return (
    <div className={`bg-slate-900/50 p-6 rounded-3xl border-l-4 shadow-xl ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2 font-black text-[10px] uppercase tracking-widest opacity-60">
        {icon} {label}
      </div>
      <p className="text-2xl font-black text-white italic font-mono">{value}</p>
    </div>
  );
}