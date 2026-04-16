"use client";

import { useEffect, useState } from 'react';
import { 
  TrendingDown, TrendingUp, Minus, Store, 
  Calendar, Search, Filter, RefreshCcw, 
  ArrowRight, AlertCircle, ShoppingCart 
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
    item.producto.toLowerCase().includes(filtro.toLowerCase()) ||
    item.tienda.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* HEADER DE LA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <TrendingUp className="text-orange-500" size={28} />
            INTELIGENCIA DE PRECIOS
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
            Análisis comparativo de mercado en tiempo real
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Filtrar por producto o tienda..."
              className="pl-11 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-orange-500/5 focus:bg-white transition-all w-64"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchAnalisis}
            className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-orange-600 transition-all active:scale-95"
          >
            <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* GRILLA DE ALERTAS */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4">
          <RefreshCcw size={40} className="animate-spin text-orange-500 opacity-20" />
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em]">Procesando comparativas...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtrados.map((item, idx) => (
            <div 
              key={idx} 
              className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl shadow-lg ${
                  item.tendencia === 'BAJA' ? 'bg-emerald-500 text-white shadow-emerald-200' : 
                  item.tendencia === 'SUBE' ? 'bg-rose-500 text-white shadow-rose-200' : 
                  'bg-slate-800 text-white shadow-slate-200'
                }`}>
                  {item.tendencia === 'BAJA' ? <TrendingDown size={24} /> : 
                   item.tendencia === 'SUBE' ? <TrendingUp size={24} /> : <Minus size={24} />}
                </div>
                <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${
                  item.tendencia === 'BAJA' ? 'bg-emerald-100 text-emerald-600' : 
                  item.tendencia === 'SUBE' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {item.tendencia}
                </span>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-black text-slate-800 uppercase leading-tight mb-2 group-hover:text-orange-600 transition-colors">
                  {item.producto}
                </h3>
                <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase">
                  <Store size={12} />
                  {item.tienda}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Precio Anterior</p>
                  <p className="text-sm font-bold text-slate-500 line-through">
                    ${item.precio_anterior?.toLocaleString('es-CL')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Precio Actual</p>
                  <p className="text-lg font-black text-slate-900 italic">
                    ${item.precio_actual?.toLocaleString('es-CL')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-slate-300" />
                  <span className="text-[10px] text-slate-400 font-bold italic">
                    Última actualización: {new Date(item.ultima_fecha).toLocaleDateString('es-CL')}
                  </span>
                </div>
                <div className={`flex items-center gap-1 font-black text-xs ${
                  item.tendencia === 'BAJA' ? 'text-emerald-500' : 
                  item.tendencia === 'SUBE' ? 'text-rose-500' : 'text-slate-400'
                }`}>
                  {item.diferencia !== 0 && (item.diferencia > 0 ? "+" : "")}
                  ${item.diferencia?.toLocaleString('es-CL')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ESTADO VACÍO */}
      {!loading && filtrados.length === 0 && (
        <div className="bg-white rounded-[3rem] p-20 border border-slate-100 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={32} className="text-slate-200" />
          </div>
          <h2 className="text-slate-800 font-black text-lg">No hay registros suficientes</h2>
          <p className="text-slate-400 text-sm max-w-xs mx-auto mt-2 font-medium">
            Realiza búsquedas en el buscador masivo para empezar a ver las comparativas de precios aquí.
          </p>
        </div>
      )}
    </div>
  );
}