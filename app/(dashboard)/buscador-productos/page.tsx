"use client";

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx'; 
import { 
  Search, ExternalLink, Loader2, Target, 
  TrendingDown, LineChart, BarChart3, 
  Globe, FileUp, Play, ClipboardList, Trash2
} from 'lucide-react';

export default function MonitorMasivoICA() {
  const [input, setInput] = useState("");
  const [inputMasivo, setInputMasivo] = useState(""); // Nuevo: para pegar columna de Excel
  const [miPrecio, setMiPrecio] = useState<number | "">("");
  const [lista, setLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [colaProductos, setColaProductos] = useState<string[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });

  // Lógica de métricas
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

  // FUNCIÓN: Procesar el texto pegado (Copia/Pega directo)
  const iniciarBarridoTexto = async () => {
    if (!inputMasivo.trim() || procesando) return;

    const productos = inputMasivo
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 2);

    if (productos.length === 0) return;

    setProcesando(true);
    setProgreso({ actual: 0, total: productos.length });

    for (let i = 0; i < productos.length; i++) {
      const producto = productos[i];
      setProgreso(prev => ({ ...prev, actual: i + 1 }));

      try {
        const res = await fetch(`/api/index?producto=${encodeURIComponent(producto)}&origen=${encodeURIComponent(producto)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setLista(prev => [...data, ...prev]);
          }
        }
      } catch (error) {
        console.error(`Error buscando: ${producto}`, error);
      }
    }
    setProcesando(false);
    setInputMasivo(""); 
  };

  // FUNCIÓN: Leer archivo Excel (Tu lógica original mejorada)
  const manejarExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        const nombres: string[] = data.map(fila => {
          const llaves = Object.keys(fila);
          const col = llaves.find(k => {
            const norm = k.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return norm.includes("detalle") || norm.includes("producto") || norm.includes("nombre");
          });
          return col ? String(fila[col]).trim() : null;
        }).filter((n): n is string => !!n && n !== "");

        if (nombres.length > 0) {
          setColaProductos(nombres);
          setProgreso({ actual: 0, total: nombres.length });
        }
      } catch (err) {
        alert("Error al leer el archivo Excel.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const iniciarBarridoExcel = async () => {
    if (colaProductos.length === 0 || procesando) return;
    setProcesando(true);
    for (let i = 0; i < colaProductos.length; i++) {
      const p = colaProductos[i];
      setProgreso(prev => ({ ...prev, actual: i + 1 }));
      try {
        const res = await fetch(`/api/index?producto=${encodeURIComponent(p)}&origen=${encodeURIComponent(p)}`);
        const data = await res.json();
        if (Array.isArray(data)) setLista(prev => [...data, ...prev]);
      } catch (e) {}
    }
    setProcesando(false);
    setColaProductos([]);
  };

  const limpiarResultados = () => setLista([]);

  return (
    <div className="p-0 bg-[#f1f5f9] min-h-screen text-slate-800 font-sans antialiased">
      
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-orange-500 text-white p-2 rounded-lg shadow-orange-200 shadow-lg">
              <BarChart3 size={20} strokeWidth={3} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">
                RADAR <span className="text-orange-600">ICA</span> PRO
              </h1>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Inteligencia de Mercado</p>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <button 
              onClick={limpiarResultados}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase text-slate-400 hover:text-rose-600 transition-colors"
            >
              <Trash2 size={14} /> Limpiar Todo
            </button>
            <div className="h-6 w-[1px] bg-slate-200"></div>
            <label className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl cursor-pointer hover:bg-white transition-all text-[10px] font-bold uppercase tracking-wider">
              <FileUp size={14} /> Cargar Archivo
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={manejarExcel} />
            </label>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* PANEL IZQUIERDO: ENTRADA DE DATOS */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* CAJA DE TEXTO PARA PEGAR DESDE EXCEL */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-900">
              <ClipboardList className="text-orange-500" size={20} />
              <h2 className="font-bold text-xs uppercase tracking-widest">Pegar desde Excel</h2>
            </div>
            
            <textarea 
              className="w-full h-64 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none transition-all resize-none"
              placeholder="Copia la columna de tu Excel y pégala aquí..."
              value={inputMasivo}
              onChange={(e) => setInputMasivo(e.target.value)}
              disabled={procesando}
            />

            <button 
              onClick={colaProductos.length > 0 ? iniciarBarridoExcel : iniciarBarridoTexto}
              disabled={procesando || (!inputMasivo.trim() && colaProductos.length === 0)}
              className="w-full mt-4 bg-slate-900 text-white py-4 rounded-xl font-bold uppercase text-xs tracking-[2px] flex items-center justify-center gap-2 hover:bg-orange-600 disabled:bg-slate-200 transition-all shadow-lg"
            >
              {procesando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Buscando {progreso.actual} de {progreso.total}
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" />
                  {colaProductos.length > 0 ? `Procesar Excel (${colaProductos.length})` : "Iniciar Barrido Masivo"}
                </>
              )}
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Target className="text-orange-500" size={18} />
              <span className="font-bold text-[10px] uppercase tracking-widest">Tu Precio de Venta (Opcional)</span>
            </div>
            <input 
              type="number"
              className="w-full bg-slate-50 border border-slate-200 py-3 px-4 rounded-xl font-bold text-lg outline-none focus:border-orange-500"
              placeholder="$ 0"
              value={miPrecio}
              onChange={e => setMiPrecio(e.target.value ? Number(e.target.value) : "")}
            />
          </div>
        </div>

        {/* PANEL DERECHO: RESULTADOS */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* MÉTRICAS */}
          {lista.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Mínimo Mercado" value={`$${stats.min.toLocaleString('es-cl')}`} color="emerald" icon={<TrendingDown size={14}/>} />
              <StatCard label="Precio Promedio" value={`$${stats.avg.toLocaleString('es-cl')}`} color="blue" icon={<LineChart size={14}/>} />
              <StatCard label="Total Hallazgos" value={stats.count} color="slate" icon={<Globe size={14}/>} />
            </div>
          )}

          {/* TABLA */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-[2px] text-[9px]">
                    <th className="p-4">Producto Original / Fuente</th>
                    <th className="p-4">Descripción Encontrada</th>
                    <th className="p-4 text-right">Precio Ref.</th>
                    <th className="p-4 text-center">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lista.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4">
                        <p className="font-black text-slate-400 text-[9px] uppercase mb-1 truncate max-w-[120px]">
                          {item.busqueda_original}
                        </p>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold text-[9px] border border-slate-200 group-hover:bg-white group-hover:border-orange-200 group-hover:text-orange-600 transition-all">
                          {item.tienda}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-700 leading-tight">{item.nombre.substring(0, 75)}...</p>
                        <p className="text-[9px] font-bold text-blue-500 uppercase mt-1 tracking-tighter">{item.canal}</p>
                      </td>
                      <td className="p-4 text-right font-black text-slate-900 text-sm italic">
                        {item.precio_formateado}
                      </td>
                      <td className="p-4 text-center">
                        <a href={item.link} target="_blank" className="text-slate-300 hover:text-orange-500 transition-all inline-block hover:scale-125">
                          <ExternalLink size={16} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {procesando && lista.length === 0 && (
                <div className="p-20 text-center">
                  <Loader2 className="animate-spin mx-auto text-orange-500 mb-4" size={40} />
                  <p className="text-slate-400 font-bold animate-pulse uppercase tracking-[4px] text-[10px]">Analizando Mercado en Vivo...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: any) {
  const colors: any = {
    emerald: "border-emerald-200 text-emerald-600 bg-emerald-50/30",
    blue: "border-blue-200 text-blue-600 bg-blue-50/30",
    slate: "border-slate-200 text-slate-500 bg-slate-50/30"
  };
  return (
    <div className={`p-6 rounded-2xl border shadow-sm ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1 font-bold text-[9px] uppercase tracking-widest opacity-70">
        {icon} {label}
      </div>
      <p className="text-2xl font-black text-slate-900 italic">{value}</p>
    </div>
  );
}