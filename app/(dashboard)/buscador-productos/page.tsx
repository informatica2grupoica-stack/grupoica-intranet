"use client";

import { useState } from 'react';
import { 
  Search, 
  ExternalLink, 
  Loader2, 
  Store, 
  Target, 
  ArrowDownCircle, 
  ArrowUpCircle,
  TrendingDown,
  LineChart,
  BarChart3
} from 'lucide-react';

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
    setLista([]); // Limpiar para nueva búsqueda
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

  // Cálculos de Inteligencia de Mercado
  const precioMinimo = lista.length > 0 ? Math.min(...lista.filter(p => p.precio_valor > 0).map(p => p.precio_valor)) : 0;
  const precioPromedio = lista.length > 0 ? Math.round(lista.reduce((acc, curr) => acc + curr.precio_valor, 0) / lista.length) : 0;

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
      
      {/* Panel de Control Principal */}
      <div className="bg-[#00338d] p-8 md:p-12 rounded-[2.5rem] text-white shadow-2xl mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-black mb-6 uppercase tracking-tighter italic flex items-center gap-3">
            Monitor de Margen <span className="text-orange-400">ICA</span>
            <div className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse"></div>
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white rounded-3xl p-2 shadow-inner">
            <div className="md:col-span-6 flex items-center px-4 border-r border-slate-100">
              <Search className="text-slate-400 mr-3" size={20} />
              <input 
                className="w-full py-4 text-slate-800 outline-none font-medium"
                placeholder="Producto a comparar (ej: Cemento Melón 25kg)..."
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
              className="md:col-span-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 rounded-2xl font-black transition-all uppercase text-xs flex items-center justify-center gap-2 px-6 py-4 md:py-0 shadow-lg shadow-orange-500/30"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : "Escanear Mercado"}
            </button>
          </div>
        </div>
        <div className="absolute top-[-20%] right-[-10%] w-80 h-80 bg-blue-400 rounded-full blur-[120px] opacity-20"></div>
      </div>

      {/* Panel de Inteligencia de Mercado (Resumen) */}
      {lista.length > 0 && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white border-l-8 border-emerald-500 p-6 rounded-3xl shadow-sm">
            <div className="flex items-center gap-3 mb-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
              <TrendingDown size={18} /> Precio Mínimo Chile
            </div>
            <p className="text-3xl font-black text-slate-900 italic">${precioMinimo.toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-white border-l-8 border-slate-800 p-6 rounded-3xl shadow-sm">
            <div className="flex items-center gap-3 mb-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
              <LineChart size={18} /> Promedio Mercado
            </div>
            <p className="text-3xl font-black text-slate-900 italic">${precioPromedio.toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-white border-l-8 border-blue-500 p-6 rounded-3xl shadow-sm">
            <div className="flex items-center gap-3 mb-2 text-blue-500 font-bold text-xs uppercase tracking-wider">
              <BarChart3 size={18} /> Tiendas Detectadas
            </div>
            <p className="text-3xl font-black text-slate-900 italic">{lista.length} Fuentes</p>
          </div>
        </div>
      )}

      {/* Resultados en Tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white border border-slate-100 p-8 rounded-[2.5rem] animate-pulse h-64 shadow-sm"></div>
          ))
        ) : lista.length > 0 ? (
          lista.map((item, i) => {
            const esGanador = miPrecio && item.precio_valor > 0 && miPrecio < item.precio_valor;
            
            return (
              <div key={i} className={`group bg-white border p-6 rounded-[2.5rem] transition-all duration-300 flex flex-col justify-between hover:shadow-xl ${esGanador ? 'border-emerald-500 bg-emerald-50/20 ring-4 ring-emerald-500/5' : 'border-slate-100 shadow-sm'}`}>
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                      <Store size={12} className="text-blue-600" />
                      <span className="text-[10px] font-black uppercase text-slate-600 tracking-tight">
                        {item.tienda}
                      </span>
                    </div>
                    {esGanador && (
                      <span className="bg-emerald-500 text-white text-[9px] font-bold px-3 py-1 rounded-full uppercase italic">
                        Líder en Precio
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm mb-2 leading-snug h-10 overflow-hidden group-hover:text-[#00338d] transition-colors">
                    {item.nombre}
                  </h3>
                  {renderDiferencia(item.precio_valor)}
                </div>
                
                <div className="flex items-end justify-between pt-6 mt-6 border-t border-slate-100">
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase font-black mb-1 tracking-widest">Market Price</p>
                    <p className="text-2xl font-black text-slate-900 tracking-tighter italic">
                       {item.precio_formateado}
                    </p>
                  </div>
                  <a 
                    href={item.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-slate-900 text-white p-4 rounded-2xl hover:bg-orange-500 transition-all hover:-translate-y-1 shadow-md shadow-slate-200"
                  >
                    <ExternalLink size={18} />
                  </a>
                </div>
              </div>
            );
          })
        ) : (
          !loading && (
            <div className="col-span-full text-center py-24 bg-white rounded-[3.5rem] border-2 border-dashed border-slate-200 shadow-inner">
              <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search size={32} className="text-slate-300" />
              </div>
              <h3 className="text-slate-800 font-black uppercase tracking-tighter text-xl mb-2 italic">Sin Datos de Mercado</h3>
              <p className="text-slate-400 font-medium max-w-xs mx-auto text-sm leading-relaxed">
                Ingresa un producto de ferretería para iniciar el análisis comparativo de precios en Chile.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}