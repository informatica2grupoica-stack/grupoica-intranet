"use client";

import { useState, useMemo } from 'react';
import { 
  Search, ExternalLink, Loader2, Target, 
  TrendingDown, LineChart, BarChart3, ShieldCheck, 
  MapPin, ShoppingCart, AlertTriangle
} from 'lucide-react';

export default function MonitorMasivoICA() {
  const [input, setInput] = useState("");
  const [miPrecio, setMiPrecio] = useState<number | "">("");
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
    const res = await fetch(`/api/index?producto=${encodeURIComponent(input)}`);
    setLista(await res.json());
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-8 bg-[#0f172a] min-h-screen text-slate-200">
      
      {/* PANEL DE CONTROL COMPACTO */}
      <div className="max-w-[1600px] mx-auto bg-slate-900/50 p-8 rounded-[2rem] border border-slate-800 mb-8">
        <h1 className="text-2xl font-black mb-6 flex items-center gap-3">
          <div className="h-6 w-1 bg-orange-500"></div> RADAR DE PROVEEDORES ICA
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6 bg-slate-800 rounded-xl flex items-center px-4 border border-slate-700">
            <Search className="text-slate-500 mr-3" />
            <input 
              className="bg-transparent w-full py-4 outline-none font-bold" 
              placeholder="Disco Corte Inoxidable 115X1 Mm..." 
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && escanear()}
            />
          </div>
          <div className="md:col-span-3 bg-slate-800 rounded-xl flex items-center px-4 border border-slate-700">
            <Target className="text-orange-500 mr-3" />
            <input 
              type="number" className="bg-transparent w-full py-4 outline-none font-black text-orange-400" 
              placeholder="Tu Precio Venta" 
              value={miPrecio} onChange={e => setMiPrecio(Number(e.target.value))}
            />
          </div>
          <button 
            onClick={escanear} disabled={loading}
            className="md:col-span-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-700 rounded-xl font-black text-white uppercase"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" /> : "ESCANEO PROFUNDO"}
          </button>
        </div>
      </div>

      {/* MÉTRICAS RÁPIDAS */}
      {lista.length > 0 && (
        <div className="max-w-[1600px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 font-mono">
          <div className="bg-slate-900 p-4 border-l-4 border-emerald-500">
            <p className="text-[10px] uppercase text-slate-500">Mínimo Detectado</p>
            <p className="text-xl font-black">${stats.min.toLocaleString('es-cl')}</p>
          </div>
          <div className="bg-slate-900 p-4 border-l-4 border-blue-500">
            <p className="text-[10px] uppercase text-slate-500">Promedio</p>
            <p className="text-xl font-black">${stats.avg.toLocaleString('es-cl')}</p>
          </div>
          <div className="bg-slate-900 p-4 border-l-4 border-orange-500">
            <p className="text-[10px] uppercase text-slate-500">Proveedores</p>
            <p className="text-xl font-black">{stats.count}</p>
          </div>
          <div className={`bg-slate-900 p-4 border-l-4 ${miPrecio && miPrecio <= stats.min ? 'border-emerald-500 text-emerald-400' : 'border-rose-500 text-rose-400'}`}>
            <p className="text-[10px] uppercase opacity-50">Posición ICA</p>
            <p className="text-xl font-black">{miPrecio ? (miPrecio <= stats.min ? "LÍDER" : "FUERA DE RANGO") : "---"}</p>
          </div>
        </div>
      )}

      {/* TABLA DE PROVEEDORES TOTAL */}
      <div className="max-w-[1600px] mx-auto bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 text-[10px] uppercase tracking-widest text-slate-400">
              <th className="p-4">Tienda / Origen</th>
              <th className="p-4">Producto Publicado</th>
              <th className="p-4">Precio Competencia</th>
              <th className="p-4">Vs Mi Precio</th>
              <th className="p-4 text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-orange-500" size={48} /></td></tr>
            ) : lista.map((item, i) => {
              const dif = miPrecio && item.precio_valor > 0 ? item.precio_valor - Number(miPrecio) : null;
              return (
                <tr key={i} className="border-t border-slate-800 hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <span className="bg-slate-700 px-2 py-1 rounded text-[10px] font-black">{item.tienda}</span>
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-300">{item.nombre}</td>
                  <td className="p-4 font-mono font-black text-white">
                    {item.precio_valor > 0 ? item.precio_formateado : <span className="text-blue-400 flex items-center gap-1 text-[10px]"><MapPin size={12}/> LOCAL FÍSICO</span>}
                  </td>
                  <td className="p-4 font-mono text-sm">
                    {dif !== null ? (
                      <span className={dif >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                        {dif >= 0 ? '+' : '-'}${Math.abs(dif).toLocaleString('es-cl')}
                      </span>
                    ) : '---'}
                  </td>
                  <td className="p-4 text-center">
                    <a href={item.link} target="_blank" className="text-slate-500 hover:text-orange-500 transition-colors inline-block">
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
  );
}