"use client";

import { useState, useMemo } from 'react';
import { 
  Search, ExternalLink, Loader2, Store, Target, 
  TrendingDown, LineChart, BarChart3, AlertCircle, 
  CheckCircle2, ShieldCheck, Info, MapPin, 
  Building2, Factory, ShoppingCart, ArrowRight
} from 'lucide-react';

interface ProductoCompetencia {
  tienda: string;
  nombre: string;
  precio_formateado: string;
  precio_valor: number;
  link: string;
  canal?: string; // Nuevo: Clasificación de competidor
}

export default function MonitorIntelligenceICA() {
  const [input, setInput] = useState("");
  const [miPrecio, setMiPrecio] = useState<number | "">("");
  const [lista, setLista] = useState<ProductoCompetencia[]>([]);
  const [loading, setLoading] = useState(false);

  const escanearPrecios = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setLista([]); 
    try {
      const res = await fetch(`/api/index?producto=${encodeURIComponent(input)}`);
      const data = await res.json();
      setLista(data);
    } catch (error) {
      console.error("Error de conexión:", error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const validos = lista.filter(p => p.precio_valor > 0);
    if (validos.length === 0) return { min: 0, avg: 0, count: 0, max: 0 };
    const precios = validos.map(p => p.precio_valor);
    return {
      min: Math.min(...precios),
      max: Math.max(...precios),
      avg: Math.round(precios.reduce((a, b) => a + b, 0) / precios.length),
      count: validos.length
    };
  }, [lista]);

  // Función para asignar iconos por tipo de tienda (basado en nombre)
  const getIconCanal = (tienda: string) => {
    const t = tienda.toLowerCase();
    if (t.includes('sodimac') || t.includes('easy')) return <ShoppingCart size={14} />;
    if (t.includes('mayorista') || t.includes('bodega') || t.includes('distribuidora')) return <Factory size={14} />;
    return <Building2 size={14} />;
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#f1f5f9]">
      
      {/* Header Corporativo ICA - Diseño Ultra-Moderno */}
      <div className="bg-[#00338d] p-10 md:p-16 rounded-[3.5rem] text-white shadow-2xl mb-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-3 bg-orange-500 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.5)]"></div>
                <h1 className="text-5xl font-black uppercase tracking-tighter italic leading-none">
                  Intelligence <span className="text-orange-400 text-6xl">ICA</span>
                </h1>
              </div>
              <p className="text-blue-200 font-bold uppercase tracking-[0.3em] text-xs ml-1">
                Advanced Market Monitoring / Mayorista Constructor
              </p>
            </div>
            
            {/* Input Group - Integrado y Robusto */}
            <div className="flex flex-col md:flex-row gap-3 bg-white/10 backdrop-blur-xl p-3 rounded-[2.5rem] border border-white/20 shadow-inner w-full md:max-w-3xl">
              <div className="flex-1 flex items-center px-6">
                <Search className="text-blue-300 mr-4" size={22} />
                <input 
                  className="w-full py-4 bg-transparent text-white placeholder:text-blue-300 outline-none font-bold text-lg"
                  placeholder="Producto, Marca o SKU..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && escanearPrecios()}
                />
              </div>
              <div className="flex items-center px-6 border-l border-white/10 bg-white/5 rounded-2xl md:rounded-none">
                <Target className="text-orange-400 mr-4" size={22} />
                <input 
                  type="number"
                  className="w-24 md:w-32 py-4 bg-transparent text-white placeholder:text-blue-300 outline-none font-black text-xl"
                  placeholder="Tu P.V."
                  value={miPrecio}
                  onChange={(e) => setMiPrecio(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
              <button 
                onClick={escanearPrecios}
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-slate-500 rounded-2xl font-black transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-3 px-10 py-4 shadow-lg active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Analizar Mercado"}
              </button>
            </div>
          </div>
        </div>
        {/* Decoración geométrica */}
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-400 rounded-full blur-[120px] opacity-20"></div>
      </div>

      {/* Dashboard Analítico */}
      {lista.length > 0 && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <AnalyticCard 
            label="Mínimo País" 
            value={`$${stats.min.toLocaleString('es-CL')}`} 
            icon={<TrendingDown className="text-emerald-500" />}
            sub="Precio líder detectado"
          />
          <AnalyticCard 
            label="Promedio Sector" 
            value={`$${stats.avg.toLocaleString('es-CL')}`} 
            icon={<LineChart className="text-blue-500" />}
            sub="Equilibrio de mercado"
          />
          <AnalyticCard 
            label="Fuentes" 
            value={`${stats.count} Sitios`} 
            icon={<BarChart3 className="text-orange-500" />}
            sub="Escaneo 360° completado"
          />
          <div className={`p-8 rounded-[2.5rem] shadow-xl border-4 transition-all ${miPrecio && miPrecio <= stats.min ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-white border-white text-slate-900'}`}>
            <div className="flex items-center gap-2 mb-2 font-black text-[10px] uppercase tracking-[0.2em] opacity-80">
              <ShieldCheck size={18} /> Posicionamiento ICA
            </div>
            <p className="text-3xl font-black italic">
              {miPrecio ? (miPrecio <= stats.min ? "LÍDER DE PRECIO" : "AJUSTAR MARGEN") : "SIN DATOS"}
            </p>
          </div>
        </div>
      )}

      {/* Grilla de Resultados Inteligente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {loading ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-[3rem] h-[350px] animate-pulse border-2 border-slate-100 shadow-sm"></div>
          ))
        ) : lista.map((item, i) => {
          const diferenciaPesos = miPrecio ? item.precio_valor - Number(miPrecio) : 0;
          const esGanador = diferenciaPesos > 0;
          
          return (
            <div key={i} className={`group bg-white border-2 p-8 rounded-[3rem] transition-all duration-500 flex flex-col justify-between hover:shadow-2xl hover:-translate-y-2 ${miPrecio && esGanador ? 'border-emerald-500/20 bg-emerald-50/5' : 'border-white shadow-lg shadow-slate-200/50'}`}>
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-2 bg-slate-100 px-5 py-2.5 rounded-full border border-slate-200 shadow-sm">
                    <span className="text-[#00338d]">{getIconCanal(item.tienda)}</span>
                    <span className="text-[11px] font-black uppercase text-slate-700 tracking-widest">
                      {item.tienda}
                    </span>
                  </div>
                  {item.precio_valor === stats.min && (
                    <span className="bg-orange-500 text-white text-[10px] font-black px-4 py-2 rounded-2xl uppercase italic tracking-tighter animate-bounce">
                      Referencia Mínima
                    </span>
                  )}
                </div>
                
                <h3 className="font-black text-slate-800 text-xl mb-6 leading-tight min-h-[60px] group-hover:text-[#00338d] transition-colors">
                  {item.nombre}
                </h3>

                {/* Comparador de Margen ICA */}
                {miPrecio && item.precio_valor > 0 && (
                  <div className={`p-5 rounded-[2rem] flex flex-col gap-2 ${esGanador ? 'bg-emerald-500/10 text-emerald-700' : 'bg-rose-500/10 text-rose-700'}`}>
                    <div className="flex items-center justify-between font-black text-xs uppercase tracking-widest">
                      <span className="flex items-center gap-2">
                        {esGanador ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        {esGanador ? "Estás ganando por" : "Estás perdiendo por"}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black font-mono">
                        ${Math.abs(diferenciaPesos).toLocaleString('es-CL')}
                      </span>
                      <span className="text-[10px] font-bold">CLP</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-end justify-between pt-8 mt-8 border-t border-slate-100">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase font-black mb-1 tracking-widest flex items-center gap-1">
                    Precio Publicado <Info size={12} className="opacity-50" />
                  </span>
                  <div className="flex items-baseline gap-1">
                    <p className="text-4xl font-black text-slate-900 tracking-tighter font-mono italic">
                       {item.precio_valor > 0 ? item.precio_formateado : "COTIZAR"}
                    </p>
                  </div>
                </div>
                <a 
                  href={item.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-slate-900 text-white p-5 rounded-2xl hover:bg-orange-500 transition-all shadow-xl hover:shadow-orange-200 flex items-center gap-2 group/btn"
                >
                  <span className="hidden group-hover/btn:block text-xs font-black uppercase tracking-widest">Ver tienda</span>
                  <ExternalLink size={20} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Subcomponente para tarjetas de métricas
function AnalyticCard({ label, value, icon, sub }: { label: string, value: string, icon: React.ReactNode, sub: string }) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">
        {icon} {label}
      </div>
      <p className="text-4xl font-black text-slate-900 italic font-mono mb-1">{value}</p>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{sub}</p>
    </div>
  );
}