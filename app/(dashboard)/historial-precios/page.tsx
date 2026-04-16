"use client";

import { useEffect, useState } from 'react';
import { 
  TrendingDown, TrendingUp, Minus, Store, 
  Calendar, Search, RefreshCcw, ExternalLink, 
  AlertCircle, Hash, Tag
} from 'lucide-react';

export default function HistorialPreciosPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");

  const fetchAnalisis = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analizar-precios');
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error("Error cargando historial");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAnalisis();
  }, []);

  const filtrados = data.filter(item => 
    item.producto?.toLowerCase().includes(filtro.toLowerCase()) ||
    item.tienda?.toLowerCase().includes(filtro.toLowerCase()) ||
    item.sku?.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <TrendingUp className="text-orange-500" size={24} />
            HISTORIAL DE INTELIGENCIA
          </h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
            Listado detallado de movimientos y links de compra
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text"
              placeholder="Buscar por nombre, SKU o tienda..."
              className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-orange-500/5 focus:bg-white transition-all w-72"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchAnalisis}
            className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-orange-600 transition-all"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* TABLA DE DATOS */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <RefreshCcw size={40} className="animate-spin text-orange-500 opacity-10" />
            <p className="text-slate-400 font-black text-[9px] uppercase tracking-[0.3em]">Cargando base de datos...</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-20 text-center">
            <AlertCircle size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-500 font-bold text-sm">No se encontraron registros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black tracking-widest">
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Tienda / SKU</th>
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4 text-right">Anterior</th>
                  <th className="px-6 py-4 text-right">Actual</th>
                  <th className="px-6 py-4 text-right">Variación</th>
                  <th className="px-6 py-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtrados.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    {/* STATUS TENDENCIA */}
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                        item.tendencia === 'BAJA' ? 'bg-emerald-100 text-emerald-600' : 
                        item.tendencia === 'SUBE' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {item.tendencia === 'BAJA' ? <TrendingDown size={12} /> : 
                         item.tendencia === 'SUBE' ? <TrendingUp size={12} /> : <Minus size={12} />}
                        {item.tendencia}
                      </div>
                    </td>

                    {/* TIENDA Y SKU */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                          <Store size={10} className="text-orange-500" />
                          {item.tienda}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                          <Hash size={10} />
                          {item.sku || 'S/N'}
                        </span>
                      </div>
                    </td>

                    {/* NOMBRE PRODUCTO */}
                    <td className="px-6 py-4">
                      <div className="max-w-[280px]">
                        <p className="text-[11px] font-bold text-slate-700 leading-tight line-clamp-2">
                          {item.producto}
                        </p>
                        <span className="text-[8px] text-slate-300 font-medium italic">
                          Act: {new Date(item.ultima_fecha).toLocaleDateString('es-CL')}
                        </span>
                      </div>
                    </td>

                    {/* PRECIO ANTERIOR */}
                    <td className="px-6 py-4 text-right">
                      <span className="text-[11px] font-bold text-slate-400 line-through">
                        ${item.precio_anterior?.toLocaleString('es-CL')}
                      </span>
                    </td>

                    {/* PRECIO ACTUAL */}
                    <td className="px-6 py-4 text-right">
                      <span className="text-[13px] font-black text-slate-900 italic">
                        ${item.precio_actual?.toLocaleString('es-CL')}
                      </span>
                    </td>

                    {/* DIFERENCIA */}
                    <td className="px-6 py-4 text-right">
                      <span className={`text-[11px] font-black ${
                        item.tendencia === 'BAJA' ? 'text-emerald-500' : 
                        item.tendencia === 'SUBE' ? 'text-rose-500' : 'text-slate-400'
                      }`}>
                        {item.diferencia > 0 ? '+' : ''}{item.diferencia?.toLocaleString('es-CL')}
                      </span>
                    </td>

                    {/* LINK (EL QUE FALTABA) */}
                    <td className="px-6 py-4 text-center">
                      {item.link ? (
                        <a 
                          href={item.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                          title="Ir a la tienda"
                        >
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        <span className="text-[8px] text-slate-300 font-bold uppercase tracking-tighter">Sin Link</span>
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