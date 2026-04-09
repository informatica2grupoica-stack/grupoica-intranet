"use client";

import { useState } from 'react';
import { Search, ExternalLink, Loader2, Store, Target, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

interface ProductoCompetencia {
  tienda: string;
  nombre: string;
  precio_formateado: string;
  precio_valor: number;
  link: string;
}

export default function ComparadorB2B() {
  const [input, setInput] = useState("");
  const [miPrecio, setMiPrecio] = useState<number | "">("");
  const [lista, setLista] = useState<ProductoCompetencia[]>([]);
  const [loading, setLoading] = useState(false);

  const escanearPrecios = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/index?producto=${encodeURIComponent(input)}`);
      const data = await res.json();
      setLista(data);
    } catch (error) {
      console.error("Error al buscar:", error);
    } finally {
      setLoading(false);
    }
  };

  // Lógica para mostrar la diferencia de precio
  const renderDiferencia = (precioCompetencia: number) => {
    if (!miPrecio || precioCompetencia === 0) return null;
    
    const diff = ((precioCompetencia - miPrecio) / precioCompetencia) * 100;
    const esMasBarato = diff > 0;

    return (
      <div className={`mt-3 flex items-center gap-1.5 font-bold text-xs ${esMasBarato ? 'text-emerald-600' : 'text-rose-600'}`}>
        {esMasBarato ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
        <span>
          {esMasBarato 
            ? `Estás un ${diff.toFixed(1)}% más barato` 
            : `Estás un ${Math.abs(diff).toFixed(1)}% más caro`}
        </span>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      {/* Panel de Control Pro */}
      <div className="bg-[#00338d] p-8 md:p-12 rounded-[2.5rem] text-white shadow-2xl mb-10 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-black mb-6 uppercase tracking-tighter italic">
            Monitor de Margen <span className="text-orange-400">ICA</span>
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white rounded-3xl p-2 shadow-inner">
            <div className="md:col-span-6 flex items-center px-4 border-r border-slate-100">
              <Search className="text-slate-400 mr-3" size={20} />
              <input 
                className="w-full py-4 text-slate-800 outline-none font-medium"
                placeholder="Producto a comparar (ej: Cemento Melón)..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && escanearPrecios()}
              />
            </div>
            <div className="md:col-span-3 flex items-center px-4 border-r border-slate-100">
              <Target className="text-orange-500 mr-3" size={20} />
              <input 
                type="number"
                className="w-full py-4 text-slate-800 outline-none font-bold placeholder:font-normal"
                placeholder="Tu Precio Venta"
                value={miPrecio}
                onChange={(e) => setMiPrecio(e.target.value ? Number(e.target.value) : "")}
              />
            </div>
            <button 
              onClick={escanearPrecios}
              disabled={loading}
              className="md:col-span-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 rounded-2xl font-black transition-all uppercase text-xs flex items-center justify-center gap-2 px-6 py-4 md:py-0"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : "Escanear Mercado"}
            </button>
          </div>
        </div>
        <div className="absolute top-[-20%] right-[-10%] w-80 h-80 bg-blue-400 rounded-full blur-[120px] opacity-20"></div>
      </div>

      {/* Resultados en Tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white border border-slate-100 p-6 rounded-[2rem] animate-pulse h-48"></div>
          ))
        ) : lista.length > 0 ? (
          lista.map((item, i) => {
            const esGanador = miPrecio && item.precio_valor > 0 && miPrecio < item.precio_valor;
            
            return (
              <div key={i} className={`group bg-white border p-6 rounded-[2rem] transition-all duration-300 flex flex-col justify-between ${esGanador ? 'border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-500/5' : 'border-slate-100 shadow-sm'}`}>
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-100">
                      <Store size={12} className="text-blue-500" />
                      <span className="text-[10px] font-black uppercase text-slate-600">
                        {item.tienda}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm mb-2 leading-tight h-10 overflow-hidden">
                    {item.nombre}
                  </h3>
                  {renderDiferencia(item.precio_valor)}
                </div>
                
                <div className="flex items-end justify-between pt-6 mt-6 border-t border-slate-100">
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase font-black mb-1">P. Competencia</p>
                    <p className="text-2xl font-black text-slate-900 tracking-tighter">
                       {item.precio_formateado}
                    </p>
                  </div>
                  <a href={item.link} target="_blank" className="bg-slate-900 text-white p-3.5 rounded-2xl hover:bg-orange-500 transition-all">
                    <ExternalLink size={18} />
                  </a>
                </div>
              </div>
            );
          })
        ) : (
          !loading && (
            <div className="col-span-full text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
              <Search size={48} className="mx-auto mb-4 text-slate-200" />
              <p className="text-slate-400 font-medium italic">Listo para escanear precios de la competencia...</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}