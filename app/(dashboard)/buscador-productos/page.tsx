"use client";

import { useState, useMemo } from 'react';
import { 
  Search, ExternalLink, Loader2, BarChart3, Globe, 
  Trash2, ChevronRight, CheckCircle2, AlertCircle, X, Sparkles
} from 'lucide-react';

// --- COMPONENTE DE ALERTA MODERNA (TOAST) ---
const Toast = ({ message, type, onClose }: any) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-right-8 duration-300 ${
    type === 'success' 
      ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800' 
      : 'bg-orange-50/90 border-orange-200 text-orange-800'
  }`}>
    {type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
    <p className="text-[11px] font-black uppercase tracking-wider leading-none">{message}</p>
    <button onClick={onClose} className="ml-2 hover:opacity-50 transition-opacity">
      <X size={14} />
    </button>
  </div>
);

export default function MonitorMasivoICA() {
  const [inputManual, setInputManual] = useState("");
  const [inputMasivo, setInputMasivo] = useState("");
  const [lista, setLista] = useState<any[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [buscandoUno, setBuscandoUno] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [toasts, setToasts] = useState<any[]>([]);

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const resultadosAgrupados = useMemo(() => {
    const grupos: { [key: string]: any[] } = {};
    lista.forEach(item => {
      const key = item.busqueda_original || "Manual";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(item);
    });
    return Object.keys(grupos).sort().map(key => ({
      nombre: key,
      items: grupos[key].sort((a, b) => (a.precio_valor || Infinity) - (b.precio_valor || Infinity))
    }));
  }, [lista]);

  // --- LÓGICA DE REFINADO CON IA + GUARDADO AUTOMÁTICO ---
  const filtrarConInteligencia = async (terminoBusqueda: string, resultadosRaw: any[]) => {
    try {
      const candidatos = resultadosRaw.filter(r => r.precio_valor > 0).slice(0, 35);
      if (candidatos.length === 0) return [];

      // Esta llamada ahora hace TODO: Filtra con IA y guarda en Supabase
      const resIA = await fetch("/api/analizar-con-ia", { 
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto: terminoBusqueda,
          resultados: candidatos
        })
      });
      
      const data = await resIA.json();
      
      // Mapeamos para el frontend incluyendo los nuevos campos para la tabla
      return (data.filtrados || []).map((item: any) => ({
        ...item,
        precio_formateado: `$${(item.precio_valor || 0).toLocaleString('es-CL')}`,
        busqueda_original: terminoBusqueda,
        canal: item.canal || "WEB",
        imagen: item.imagen || "",
        sku: item.sku || ""
      }));
    } catch (e) {
      console.error("Error en Refinado IA:", e);
      return []; 
    }
  };

  const buscarProducto = async (queryActual: string) => {
    try {
      // 1. Buscamos en el script de Python (Flask)
      const res = await fetch(`/python/index?producto=${encodeURIComponent(queryActual)}&origen=${encodeURIComponent(queryActual)}`);
      const dataCruda = await res.json();
      
      if (Array.isArray(dataCruda) && dataCruda.length > 0) {
        // 2. Filtramos con IA y Guardamos en DB (Todo en una sola llamada)
        const dataRefinada = await filtrarConInteligencia(queryActual, dataCruda);
        
        if (dataRefinada.length > 0) {
          setLista(prev => [...dataRefinada, ...prev]);
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Error en búsqueda:", e);
      return false;
    }
  };

  const buscarUno = async () => {
    if (!inputManual.trim() || buscandoUno) return;
    setBuscandoUno(true);
    notify(`BUSCANDO: ${inputManual.toUpperCase()}`, 'success');
    
    const exito = await buscarProducto(inputManual.trim());
    if (exito) {
      notify(`PRODUCTO REGISTRADO Y GUARDADO`, 'success');
      setInputManual("");
    } else {
      notify(`SIN RESULTADOS RELEVANTES`, 'error');
    }
    setBuscandoUno(false);
  };

  const iniciarBarrido = async () => {
    const productos = inputMasivo.split('\n').map(p => p.trim()).filter(p => p.length > 2);
    if (productos.length === 0) return;

    setProcesando(true);
    setProgreso({ actual: 0, total: productos.length });
    notify(`INICIANDO BARRIDO DE ${productos.length} PRODUCTOS`, 'success');

    for (let i = 0; i < productos.length; i++) {
      const pActual = productos[i];
      setProgreso({ actual: i + 1, total: productos.length });
      
      await buscarProducto(pActual);
      
      // Respiro para evitar bloqueos
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    
    setProcesando(false);
    setInputMasivo(""); 
    notify("BARRIDO COMPLETADO: DATOS ACTUALIZADOS EN DB", 'success');
  };

  // --- EL RESTO DEL RENDER QUEDA IGUAL (SIN CAMBIOS EN EL JSX) ---
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-orange-100">
      
      <div className="fixed top-24 right-6 z-50 flex flex-col gap-3">
        {toasts.map(t => (
          <Toast key={t.id} {...t} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
        ))}
      </div>

      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-8 py-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1500px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 text-white p-2.5 rounded-2xl shadow-xl">
              <BarChart3 size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tight text-slate-900 leading-none">
                MONITOR <span className="text-orange-600">ICA</span> 
                <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full ml-2 font-black tracking-widest uppercase">DeepSeek AI Active</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex-1 md:w-80 flex items-center bg-slate-100/50 border border-slate-200 rounded-2xl px-4 focus-within:ring-4 focus-within:ring-orange-500/10 focus-within:bg-white focus-within:border-orange-500 transition-all">
              <Search size={16} className="text-slate-400" />
              <input 
                className="bg-transparent py-3 px-3 text-xs outline-none w-full font-bold text-slate-700 placeholder:text-slate-400"
                placeholder="Buscar artículo específico..."
                value={inputManual}
                onChange={e => setInputManual(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarUno()}
              />
              <button 
                onClick={buscarUno}
                disabled={buscandoUno || !inputManual.trim()}
                className="bg-slate-900 text-white p-1.5 rounded-xl hover:bg-orange-600 transition-all disabled:bg-slate-200"
              >
                {buscandoUno ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              </button>
            </div>
            <button 
              onClick={() => { setLista([]); notify("LISTA LIMPIADA", "error"); }} 
              className="bg-white border border-slate-200 p-3 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl sticky top-32">
            <label className="flex items-center gap-3 mb-5 font-black text-[10px] uppercase text-slate-400 tracking-[0.2em]">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
              Barrido de Precios
            </label>
            <textarea 
              className="w-full h-[400px] bg-slate-50 border border-slate-100 rounded-3xl p-5 text-[11px] font-bold text-slate-600 outline-none focus:bg-white focus:ring-4 focus:ring-orange-500/5 transition-all resize-none shadow-inner"
              placeholder="Pega aquí tu lista de productos (uno por línea)..."
              value={inputMasivo}
              onChange={e => setInputMasivo(e.target.value)}
              disabled={procesando}
            />
            <button 
              onClick={iniciarBarrido}
              disabled={procesando || !inputMasivo.trim()}
              className="w-full mt-6 bg-slate-900 hover:bg-orange-600 text-white py-5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.15em] flex items-center justify-center gap-3 shadow-2xl transition-all disabled:bg-slate-200"
            >
              {procesando ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>ANALIZANDO {progreso.actual}/{progreso.total}</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Sincronizar Masivo</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="lg:col-span-9 space-y-8 pb-20">
          {resultadosAgrupados.length === 0 ? (
            <div className="h-[50vh] flex flex-col items-center justify-center text-center">
              <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border border-slate-50 mb-8">
                <Globe size={64} strokeWidth={1} className="text-orange-500 opacity-20" />
              </div>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.4em]">Sin datos en esta sesión</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8">
              {resultadosAgrupados.map((grupo, idx) => (
                <div key={idx} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-500">
                  <div className="bg-slate-50/50 px-8 py-5 border-b border-slate-100 flex justify-between items-center group-hover:bg-orange-50/30 transition-colors">
                    <div className="flex items-center gap-5">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md font-black text-orange-600 text-xs border border-slate-100">
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <h3 className="font-black text-sm uppercase tracking-tight text-slate-800">
                        {grupo.nombre}
                      </h3>
                    </div>
                    <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-3 py-1.5 rounded-full uppercase border border-emerald-200">
                      Sincronizado
                    </span>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[9px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-50">
                          <th className="px-8 py-4">Tienda</th>
                          <th className="px-8 py-4">Producto</th>
                          <th className="px-8 py-4 text-right">Precio</th>
                          <th className="px-8 py-4 text-center">Link</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {grupo.items.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50/80 transition-all">
                            <td className="px-8 py-5">
                              <span className="font-black text-slate-900 text-xs block truncate w-32">{item.tienda}</span>
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase italic">
                                {item.canal}
                              </span>
                            </td>
                            <td className="px-8 py-5">
                              <p className="text-xs font-bold text-slate-600 leading-tight max-w-sm line-clamp-1">
                                {item.nombre}
                              </p>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <span className="text-sm font-black text-slate-900 italic">
                                {item.precio_formateado}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-center">
                              <a 
                                href={item.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                              >
                                <ExternalLink size={14} />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}