"use client";

import { useState, useMemo } from 'react';
import { 
  Search, ExternalLink, Loader2, Target, 
  TrendingDown, LineChart, BarChart3, 
  MapPin, ShoppingCart, Globe
} from 'lucide-react';

export default function MonitorMasivoICA() {
  const [input, setInput] = useState("");
  const [miPrecio, setMiPrecio] = useState<number | "">("");
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Lógica de cálculo (Sin cambios)
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

  // Lógica de escaneo (Sin cambios)
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
    <div className="p-0 bg-[#f1f5f9] min-h-screen text-slate-800 font-sans antialiased">
      
      {/* HEADER TOP BAR - ESTILO INTRANET */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-orange-500 text-white p-2 rounded-lg">
              <BarChart3 size={20} strokeWidth={3} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">
                RADAR <span className="text-orange-600">ICA</span> PRO
              </h1>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Inteligencia de Mercados v2.6</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Servidor Activo</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-6 md:p-8">
        
        {/* PANEL DE CONTROL MINIMALISTA */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-7 flex items-center bg-slate-50 rounded-xl px-4 border border-slate-200 focus-within:border-orange-500 focus-within:bg-white transition-all">
              <Search className="text-slate-400 mr-3" size={18} />
              <input 
                className="bg-transparent w-full py-4 outline-none font-semibold text-slate-700 placeholder:text-slate-400" 
                placeholder="Nombre del producto o SKU..." 
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && escanear()}
              />
            </div>
            <div className="md:col-span-3 flex items-center bg-slate-50 rounded-xl px-4 border border-slate-200 focus-within:border-orange-500 focus-within:bg-white transition-all">
              <Target className="text-orange-500 mr-3" size={18} />
              <input 
                type="number" className="bg-transparent w-full py-4 outline-none font-bold text-slate-900" 
                placeholder="Mi Precio" 
                value={miPrecio} onChange={e => setMiPrecio(e.target.value ? Number(e.target.value) : "")}
              />
            </div>
            <button 
              onClick={escanear} disabled={loading}
              className="md:col-span-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 rounded-xl font-bold text-white uppercase text-xs tracking-widest shadow-md transition-all active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin mx-auto text-white" /> : "Escanear"}
            </button>
          </div>
        </div>

        {/* MÉTRICAS DE RESUMEN */}
        {lista.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Mínimo Mercado" value={`$${stats.min.toLocaleString('es-cl')}`} color="emerald" icon={<TrendingDown size={14}/>} />
            <StatCard label="Precio Promedio" value={`$${stats.avg.toLocaleString('es-cl')}`} color="blue" icon={<LineChart size={14}/>} />
            <StatCard label="Total Fuentes" value={`${stats.count}`} color="slate" icon={<Globe size={14}/>} />
            <div className={`p-5 rounded-2xl border shadow-sm ${miPrecio && miPrecio <= stats.min ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'}`}>
              <p className="text-[10px] uppercase font-bold opacity-70 mb-1">Status Competitivo</p>
              <p className="text-xl font-black italic">{miPrecio ? (miPrecio <= stats.min ? "LÍDER DE PRECIO" : "SOBRE EL MÍNIMO") : "---"}</p>
            </div>
          </div>
        )}

        {/* TABLA DE DATOS TÉCNICOS */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  <th className="p-4">Fuente / Canal</th>
                  <th className="p-4">Descripción del Item</th>
                  <th className="p-4 text-right">Precio Ref.</th>
                  <th className="p-4 text-right">Delta ICA</th>
                  <th className="p-4 text-center">Enlace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-20 text-center">
                      <Loader2 className="animate-spin mx-auto text-orange-500 mb-2" size={32} />
                      <p className="text-slate-400 font-bold text-xs uppercase animate-pulse">Consultando Red de Proveedores...</p>
                    </td>
                  </tr>
                ) : lista.map((item, i) => {
                  const dif = miPrecio && item.precio_valor > 0 ? item.precio_valor - Number(miPrecio) : null;
                  return (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold w-fit border border-slate-200">
                            {item.tienda}
                          </span>
                          <div className={`flex items-center gap-1 text-[9px] font-black uppercase ${item.canal === 'SHOPPING' ? 'text-orange-500' : 'text-blue-500'}`}>
                            {item.canal === 'SHOPPING' ? <ShoppingCart size={10}/> : <Globe size={10}/>}
                            {item.canal || 'WEB'}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-700 leading-snug truncate max-w-sm">
                          {item.nombre}
                        </p>
                      </td>
                      <td className="p-4 text-right">
                        {item.precio_valor > 0 ? (
                          <span className="text-base font-black text-slate-900 font-mono">
                            {item.precio_formateado}
                          </span>
                        ) : (
                          <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-[9px] font-bold">CONTACTAR</span>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono text-xs">
                        {dif !== null ? (
                          <span className={`font-bold ${dif >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {dif >= 0 ? '+' : ''}{dif.toLocaleString('es-cl')}
                          </span>
                        ) : '--'}
                      </td>
                      <td className="p-4 text-center">
                        <a 
                          href={item.link} 
                          target="_blank" 
                          className="text-slate-400 hover:text-orange-600 transition-colors p-2 inline-block"
                        >
                          <ExternalLink size={16} />
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
    </div>
  );
}

function StatCard({ label, value, color, icon }: any) {
  const colors: any = {
    emerald: "border-emerald-200 bg-white text-emerald-600",
    blue: "border-blue-200 bg-white text-blue-600",
    slate: "border-slate-200 bg-white text-slate-500"
  };
  return (
    <div className={`p-5 rounded-2xl border shadow-sm ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1 font-bold text-[10px] uppercase tracking-wider opacity-60 italic">
        {icon} {label}
      </div>
      <p className="text-2xl font-black text-slate-900 font-mono italic">{value}</p>
    </div>
  );
}