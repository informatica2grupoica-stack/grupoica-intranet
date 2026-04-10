"use client";

import { useState, useMemo } from 'react';
import { 
  Search, ExternalLink, Loader2, Target, 
  BarChart3, Globe, Play, ClipboardList, Trash2, ChevronDown
} from 'lucide-react';

export default function MonitorMasivoICA() {
  const [inputManual, setInputManual] = useState("");
  const [inputMasivo, setInputMasivo] = useState("");
  const [miPrecio, setMiPrecio] = useState<number | "">("");
  const [lista, setLista] = useState<any[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });

  // --- LÓGICA DE AGRUPACIÓN Y ORDEN ---
  // Agrupamos los resultados por el nombre del producto original
  const resultadosAgrupados = useMemo(() => {
    const grupos: { [key: string]: any[] } = {};
    lista.forEach(item => {
      const key = item.busqueda_original || "Manual";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(item);
    });
    // Ordenar los grupos alfabéticamente
    return Object.keys(grupos).sort().map(key => ({
      nombre: key,
      items: grupos[key].sort((a, b) => (a.precio_valor || Infinity) - (b.precio_valor || Infinity))
    }));
  }, [lista]);

  // FUNCIÓN: Búsqueda Individual
  const buscarUno = async () => {
    if (!inputManual.trim() || procesando) return;
    setProcesando(true);
    try {
      const res = await fetch(`/api/index?producto=${encodeURIComponent(inputManual)}&origen=${encodeURIComponent(inputManual)}`);
      const data = await res.json();
      if (Array.isArray(data)) setLista(prev => [...data, ...prev]);
      setInputManual("");
    } catch (e) { console.error(e); }
    setProcesando(false);
  };

  // FUNCIÓN: Barrido Masivo
  const iniciarBarrido = async () => {
    const productos = inputMasivo.split('\n').map(p => p.trim()).filter(p => p.length > 2);
    if (productos.length === 0) return;

    setProcesando(true);
    setProgreso({ actual: 0, total: productos.length });

    for (let i = 0; i < productos.length; i++) {
      setProgreso(prev => ({ ...prev, actual: i + 1 }));
      try {
        const res = await fetch(`/api/index?producto=${encodeURIComponent(productos[i])}&origen=${encodeURIComponent(productos[i])}`);
        const data = await res.json();
        if (Array.isArray(data)) setLista(prev => [...data, ...prev]);
      } catch (e) {}
    }
    setProcesando(false);
    setInputMasivo(""); 
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      
      {/* HEADER SIMPLIFICADO */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-orange-600" size={24} />
            <h1 className="font-black text-lg tracking-tighter">RADAR ICA <span className="text-orange-600 text-sm">PRO</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* BUSCADOR INDIVIDUAL */}
            <div className="flex items-center bg-slate-100 rounded-lg px-3 border border-transparent focus-within:border-orange-500 transition-all">
              <Search size={16} className="text-slate-400" />
              <input 
                className="bg-transparent py-2 px-2 text-xs outline-none w-64 font-medium"
                placeholder="Buscar un producto solo..."
                value={inputManual}
                onChange={e => setInputManual(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarUno()}
              />
            </div>
            <button onClick={() => setLista([])} className="text-slate-400 hover:text-rose-500 p-2 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* PANEL LATERAL: ENTRADA MASIVA */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <label className="flex items-center gap-2 mb-3 font-bold text-[10px] uppercase text-slate-500 tracking-widest">
              <ClipboardList size={14} /> Pegar Lista de Excel
            </label>
            <textarea 
              className="w-full h-[500px] bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs outline-none focus:ring-1 focus:ring-orange-500 transition-all resize-none font-mono"
              placeholder="Ejemplo:&#10;Pino 2x3&#10;Saco Cemento&#10;Clavos 2 pulg"
              value={inputMasivo}
              onChange={e => setInputMasivo(e.target.value)}
            />
            <button 
              onClick={iniciarBarrido}
              disabled={procesando || !inputMasivo.trim()}
              className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-all disabled:bg-slate-200"
            >
              {procesando ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} fill="currentColor" />}
              {procesando ? `Buscando ${progreso.actual}/${progreso.total}` : "Iniciar Barrido"}
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL: RESULTADOS AGRUPADOS */}
        <div className="lg:col-span-9">
          {resultadosAgrupados.length === 0 ? (
            <div className="h-64 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400">
              <Globe size={48} strokeWidth={1} className="mb-4 opacity-20" />
              <p className="text-sm font-medium italic">Esperando datos para iniciar el rastreo...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {resultadosAgrupados.map((grupo, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-black text-[11px] uppercase tracking-wider text-slate-600 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      Producto: {grupo.nombre}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400">{grupo.items.length} opciones</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[9px] uppercase text-slate-400 border-b border-slate-100">
                        <th className="px-4 py-3">Tienda / Proveedor</th>
                        <th className="px-4 py-3">Descripción en Web</th>
                        <th className="px-4 py-3 text-right">Precio</th>
                        <th className="px-4 py-3 text-center">Ir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {grupo.items.map((item, i) => (
                        <tr key={i} className="hover:bg-orange-50/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-800">{item.tienda}</span>
                            <p className="text-[9px] text-slate-400 uppercase font-bold">{item.canal}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-medium">
                            {item.nombre.length > 80 ? item.nombre.substring(0, 80) + "..." : item.nombre}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-slate-900 italic">
                            {item.precio_formateado}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <a href={item.link} target="_blank" className="text-orange-500 hover:scale-125 inline-block transition-transform">
                              <ExternalLink size={14} />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}