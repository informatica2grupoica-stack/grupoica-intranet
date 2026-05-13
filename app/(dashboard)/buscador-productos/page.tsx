// app/(dashboard)/buscador-proveedores/page.tsx
'use client';

import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Search, ExternalLink, Loader2, BarChart3, Globe, 
  Trash2, ChevronRight, CheckCircle2, AlertCircle, X, Sparkles,
  Download, FileSpreadsheet, AlertTriangle, TrendingUp, ShoppingBag,
  Upload, Crown
} from 'lucide-react';

// --- COMPONENTE DE ALERTA MODERNA (TOAST) ---
const Toast = ({ message, type, onClose }: any) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-right-8 duration-300 ${
    type === 'success' 
      ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800' 
      : type === 'warning'
      ? 'bg-amber-50/90 border-amber-200 text-amber-800'
      : 'bg-orange-50/90 border-orange-200 text-orange-800'
  }`}>
    {type === 'success' ? <CheckCircle2 size={18} /> : type === 'warning' ? <AlertTriangle size={18} /> : <AlertCircle size={18} />}
    <p className="text-[11px] font-black uppercase tracking-wider leading-none">{message}</p>
    <button onClick={onClose} className="ml-2 hover:opacity-50 transition-opacity">
      <X size={14} />
    </button>
  </div>
);

// 🔥 TIPO CORREGIDO - Definir los niveles exactos
type NivelMatching = 'exacto' | 'parcial' | 'bajo';

interface ProductoResultado {
  tienda: string;
  nombre: string;
  precio_valor: number;
  precio_formateado: string;
  link: string;
  canal: string;
  busqueda_original: string;
  matching?: {
    porcentaje: number;
    nivel: NivelMatching;  // ✅ AHORA ES DEL TIPO CORRECTO
    razon: string;
  };
}

interface ItemLista {
  numero: string;
  nombre: string;
  resultados: ProductoResultado[];
  total_encontrados: number;
  suficientes: boolean;
  deficit: number;
  procesando: boolean;
  error?: string;
  mejor_match?: ProductoResultado;
}

interface ProductoExcel {
  numero: number;
  nombre: string;
  cantidad: number;
  valor_civa: number;
  link_referencia: string;
}

export default function MonitorMasivoICA() {
  const [inputManual, setInputManual] = useState("");
  const [inputMasivo, setInputMasivo] = useState("");
  const [itemsLista, setItemsLista] = useState<ItemLista[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [buscandoUno, setBuscandoUno] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [toasts, setToasts] = useState<any[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Estados para Excel
  const [productosExcel, setProductosExcel] = useState<ProductoExcel[]>([]);
  const [mostrarPrevisualizacion, setMostrarPrevisualizacion] = useState(false);

  const notify = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // Parsear lista con formato "1\tNombre" o "1 Nombre"
  const parsearLista = (texto: string): { numero: string; nombre: string }[] => {
    const lineas = texto.split('\n').filter(line => line.trim().length > 0);
    const items: { numero: string; nombre: string }[] = [];
    
    for (const linea of lineas) {
      const match = linea.match(/^(\d+)[\s\t]+(.+)/);
      if (match) {
        items.push({
          numero: match[1],
          nombre: match[2].trim()
        });
      } else if (linea.trim().match(/^\d+$/)) {
        continue;
      } else {
        items.push({
          numero: String(items.length + 1),
          nombre: linea.trim()
        });
      }
    }
    return items;
  };

  // Procesar archivo Excel
  const procesarExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      const items: ProductoExcel[] = [];
      
      for (let i = 0; i < jsonData.length; i++) {
        const row: any = jsonData[i];
        const detalle = row.Detalle || row.detalle;
        
        if (!detalle || detalle === 'TOTAL' || String(detalle).includes('VERDADERO')) continue;
        
        const itemNum = row.ITEM || row.Item || i + 1;
        const cantidad = row.Cantidad || row.cantidad || 1;
        const valorCIVA = row["VALOR C/IVA"] || row["Valor C/IVA"] || 0;
        const linkRef = row["LINK 1"] || row["Link 1"] || "";
        
        items.push({
          numero: Number(itemNum),
          nombre: String(detalle).trim(),
          cantidad: Number(cantidad),
          valor_civa: Number(valorCIVA),
          link_referencia: linkRef
        });
      }
      
      setProductosExcel(items);
      setMostrarPrevisualizacion(true);
      notify(`✅ Cargados ${items.length} productos desde Excel`, 'success');
    };
    reader.readAsArrayBuffer(file);
  };

  // Función para hacer matching con IA (con tipado correcto)
  const aplicarMatchingIA = async (productoBuscado: string, resultados: ProductoResultado[]): Promise<{mejor_match: ProductoResultado | null, resultados_con_match: ProductoResultado[]}> => {
    if (resultados.length === 0) {
      return { mejor_match: null, resultados_con_match: resultados };
    }

    try {
      const response = await fetch('/api/matching-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_buscado: productoBuscado,
          resultados_raw: resultados
        })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          mejor_match: data.mejor_match,
          resultados_con_match: data.todos_resultados || resultados
        };
      }
    } catch (error) {
      console.warn("Error en matching IA, usando ordenamiento local");
    }

    // Fallback: ordenar localmente con tipado correcto
    const resultadosConMatch: ProductoResultado[] = resultados.map((r, idx) => {
      let nivel: NivelMatching = 'bajo';
      let porcentaje = 50;
      
      if (idx === 0) {
        nivel = 'exacto';
        porcentaje = 85;
      } else if (idx < 3) {
        nivel = 'parcial';
        porcentaje = 70;
      }
      
      return {
        ...r,
        matching: {
          porcentaje,
          nivel,
          razon: idx === 0 ? 'Mejor coincidencia por precio y relevancia' : 'Coincidencia parcial'
        }
      };
    });
    
    return {
      mejor_match: resultadosConMatch[0],
      resultados_con_match: resultadosConMatch
    };
  };

  // Buscar producto con el backend robusto y aplicar matching
  const buscarProductoRobusto = async (producto: string, numero: string, minimo: number = 9): Promise<ItemLista> => {
    try {
      const res = await fetch(`/python/busqueda-robusta?producto=${encodeURIComponent(producto)}&numero=${numero}&minimo=${minimo}`);
      
      if (!res.ok) {
        throw new Error(`Error HTTP: ${res.status}`);
      }
      
      const data = await res.json();
      const resultadosRaw = data.resultados || [];
      
      // Aplicar matching con IA
      const { mejor_match, resultados_con_match } = await aplicarMatchingIA(producto, resultadosRaw);
      
      return {
        numero: data.numero_item || numero,
        nombre: data.producto || producto,
        resultados: resultados_con_match,
        total_encontrados: resultados_con_match.length,
        suficientes: resultados_con_match.length >= minimo,
        deficit: Math.max(0, minimo - resultados_con_match.length),
        procesando: false,
        mejor_match: mejor_match || undefined
      };
    } catch (error: any) {
      console.error(`Error buscando ${producto}:`, error);
      return {
        numero,
        nombre: producto,
        resultados: [],
        total_encontrados: 0,
        suficientes: false,
        deficit: 9,
        procesando: false,
        error: error.message
      };
    }
  };

  // Búsqueda individual
  const buscarUno = async () => {
    if (!inputManual.trim() || buscandoUno) return;
    
    setBuscandoUno(true);
    notify(`Buscando: ${inputManual.trim()}`, 'success');
    
    const match = inputManual.trim().match(/^(\d+)\s+(.+)/);
    const numero = match ? match[1] : String(itemsLista.length + 1);
    const nombre = match ? match[2] : inputManual.trim();
    
    const resultado = await buscarProductoRobusto(nombre, numero, 9);
    
    const existe = itemsLista.some(item => item.numero === resultado.numero);
    if (!existe) {
      setItemsLista(prev => [...prev, resultado]);
    } else {
      setItemsLista(prev => prev.map(item => 
        item.numero === resultado.numero ? resultado : item
      ));
    }
    
    if (resultado.suficientes) {
      notify(`✅ ${nombre}: ${resultado.total_encontrados} resultados`, 'success');
      setInputManual("");
    } else {
      notify(`⚠️ ${nombre}: Solo ${resultado.total_encontrados}/9 resultados`, 'warning');
    }
    
    setBuscandoUno(false);
  };

  // Barrido desde Excel
  const iniciarBarridoExcel = async () => {
    if (productosExcel.length === 0) {
      notify("No hay productos cargados desde Excel", 'error');
      return;
    }
    
    setProcesando(true);
    setItemsLista([]);
    setProgreso({ actual: 0, total: productosExcel.length });
    notify(`Iniciando barrido de ${productosExcel.length} productos desde Excel`, 'success');
    
    abortControllerRef.current = new AbortController();
    
    for (let i = 0; i < productosExcel.length; i++) {
      if (abortControllerRef.current?.signal.aborted) {
        notify("Barrido cancelado", 'warning');
        break;
      }
      
      const prod = productosExcel[i];
      setProgreso({ actual: i + 1, total: productosExcel.length });
      
      setItemsLista(prev => [...prev, {
        numero: String(prod.numero),
        nombre: prod.nombre,
        resultados: [],
        total_encontrados: 0,
        suficientes: false,
        deficit: 9,
        procesando: true
      }]);
      
      const resultado = await buscarProductoRobusto(prod.nombre, String(prod.numero), 9);
      
      setItemsLista(prev => prev.map(p => 
        p.numero === String(prod.numero) ? resultado : p
      ));
      
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    setProcesando(false);
    abortControllerRef.current = null;
    notify("Barrido desde Excel completado", 'success');
  };

  // Barrido masivo desde texto
  const iniciarBarrido = async () => {
    const items = parsearLista(inputMasivo);
    if (items.length === 0) {
      notify("No se encontraron productos en la lista", 'error');
      return;
    }
    
    setProcesando(true);
    setItemsLista([]);
    setProgreso({ actual: 0, total: items.length });
    notify(`Iniciando barrido de ${items.length} productos`, 'success');
    
    abortControllerRef.current = new AbortController();
    
    for (let i = 0; i < items.length; i++) {
      if (abortControllerRef.current?.signal.aborted) {
        notify("Barrido cancelado", 'warning');
        break;
      }
      
      const item = items[i];
      setProgreso({ actual: i + 1, total: items.length });
      
      setItemsLista(prev => [...prev, {
        numero: item.numero,
        nombre: item.nombre,
        resultados: [],
        total_encontrados: 0,
        suficientes: false,
        deficit: 9,
        procesando: true
      }]);
      
      const resultado = await buscarProductoRobusto(item.nombre, item.numero, 9);
      
      setItemsLista(prev => prev.map(p => 
        p.numero === item.numero ? resultado : p
      ));
      
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    setProcesando(false);
    abortControllerRef.current = null;
    notify("Barrido completado", 'success');
  };

  const cancelarBarrido = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      notify("Cancelando barrido...", 'warning');
    }
  };

  // Exportar a CSV (solo mejor match)
  const exportarACSV = () => {
    const csvRows: string[] = [];
    csvRows.push('ITEM;Producto Buscado;Cantidad;Precio Referencia;Mejor Match Encontrado;Tienda;Precio Encontrado;Link;% Coincidencia');
    
    itemsLista.forEach(item => {
      const mejorMatch = item.mejor_match || item.resultados[0];
      if (mejorMatch) {
        csvRows.push(`${item.numero};${item.nombre};;;${mejorMatch.nombre};${mejorMatch.tienda};${mejorMatch.precio_formateado};${mejorMatch.link};${mejorMatch.matching?.porcentaje || 100}%`);
      } else {
        csvRows.push(`${item.numero};${item.nombre};;;SIN RESULTADOS;;;;0%`);
      }
    });
    
    const blob = new Blob(["\uFEFF" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `matching_precios_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    notify("Exportación completada (solo mejor match por producto)", 'success');
  };

  // Exportar Excel completo
  const exportarExcelCompleto = () => {
    const exportData = itemsLista.map(item => ({
      ITEM: item.numero,
      Producto_Buscado: item.nombre,
      Mejor_Match: item.mejor_match?.nombre || item.resultados[0]?.nombre || 'SIN RESULTADOS',
      Tienda: item.mejor_match?.tienda || item.resultados[0]?.tienda || '',
      Precio: item.mejor_match?.precio_formateado || item.resultados[0]?.precio_formateado || '',
      Link: item.mejor_match?.link || item.resultados[0]?.link || '',
      Coincidencia: item.mejor_match?.matching?.porcentaje || item.resultados[0]?.matching?.porcentaje || 0
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Matching');
    XLSX.writeFile(wb, `matching_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    notify("Exportación Excel completada", 'success');
  };

  const limpiarLista = () => {
    if (itemsLista.length > 0 && confirm('¿Eliminar todos los resultados?')) {
      setItemsLista([]);
      setProductosExcel([]);
      setMostrarPrevisualizacion(false);
      notify("Lista limpiada", 'error');
    }
  };

  // Obtener color según porcentaje de matching (con tipado correcto)
  const getMatchingColor = (porcentaje: number = 0) => {
    if (porcentaje >= 85) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (porcentaje >= 60) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const getMatchingIcon = (porcentaje: number = 0) => {
    if (porcentaje >= 85) return '🟢';
    if (porcentaje >= 60) return '🟡';
    return '🔴';
  };

  const estadisticas = useMemo(() => {
    const totalItems = itemsLista.length;
    const itemsCompletos = itemsLista.filter(i => i.suficientes).length;
    const itemsIncompletos = itemsLista.filter(i => !i.suficientes && i.resultados.length > 0).length;
    const itemsSinResultados = itemsLista.filter(i => i.resultados.length === 0).length;
    const totalResultados = itemsLista.reduce((sum, i) => sum + i.resultados.length, 0);
    const promedioMatching = itemsLista.filter(i => i.mejor_match?.matching?.porcentaje)
      .reduce((sum, i) => sum + (i.mejor_match?.matching?.porcentaje || 0), 0) / (itemsLista.filter(i => i.mejor_match?.matching?.porcentaje).length || 1);
    
    return { totalItems, itemsCompletos, itemsIncompletos, itemsSinResultados, totalResultados, promedioMatching: Math.round(promedioMatching) };
  }, [itemsLista]);

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
                <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full ml-2 font-black tracking-widest uppercase">Matching IA</span>
              </h1>
              <p className="text-[9px] text-slate-400 mt-1">Mínimo 9 resultados • Matching inteligente • Colores por coincidencia</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex-1 md:w-96 flex items-center bg-slate-100/50 border border-slate-200 rounded-2xl px-4 focus-within:ring-4 focus-within:ring-orange-500/10 focus-within:bg-white focus-within:border-orange-500 transition-all">
              <Search size={16} className="text-slate-400" />
              <input 
                className="bg-transparent py-3 px-3 text-xs outline-none w-full font-bold text-slate-700 placeholder:text-slate-400"
                placeholder="Ej: 25 Anticorrosivo o nombre directo..."
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
              onClick={exportarACSV}
              disabled={itemsLista.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-2xl transition-all shadow-sm disabled:opacity-50"
              title="Exportar CSV (solo mejor match)"
            >
              <Download size={18} />
            </button>
            
            <button 
              onClick={exportarExcelCompleto}
              disabled={itemsLista.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-2xl transition-all shadow-sm disabled:opacity-50"
              title="Exportar Excel completo"
            >
              <FileSpreadsheet size={18} />
            </button>
            
            <button 
              onClick={limpiarLista}
              disabled={itemsLista.length === 0}
              className="bg-white border border-slate-200 p-3 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-3">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl sticky top-32">
            <div className="flex justify-between items-center mb-5">
              <label className="flex items-center gap-3 font-black text-[10px] uppercase text-slate-400 tracking-[0.2em]">
                <div className={`w-2 h-2 rounded-full ${procesando ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                Barrido de Precios
              </label>
              {procesando && (
                <button onClick={cancelarBarrido} className="text-[9px] font-black text-red-500 hover:text-red-700">
                  Cancelar
                </button>
              )}
            </div>
            
            {/* Carga de Excel */}
            <div className="mb-4">
              <button 
                onClick={() => document.getElementById('excel-input')?.click()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <Upload size={14} />
                Cargar Excel
              </button>
              <input 
                id="excel-input" 
                type="file" 
                accept=".xlsx,.xls" 
                className="hidden" 
                onChange={(e) => e.target.files?.[0] && procesarExcel(e.target.files[0])}
              />
            </div>
            
            {/* Previsualización Excel cargado */}
            {mostrarPrevisualizacion && productosExcel.length > 0 && (
              <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-slate-500">📊 Excel cargado</span>
                  <span className="text-[8px] text-emerald-600">{productosExcel.length} productos</span>
                </div>
                <div className="max-h-32 overflow-y-auto text-[9px] space-y-1">
                  {productosExcel.slice(0, 5).map(p => (
                    <div key={p.numero} className="truncate">{p.numero}. {p.nombre.substring(0, 40)}</div>
                  ))}
                  {productosExcel.length > 5 && (
                    <div className="text-slate-400">+ {productosExcel.length - 5} más</div>
                  )}
                </div>
                <button 
                  onClick={iniciarBarridoExcel}
                  disabled={procesando}
                  className="w-full mt-3 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-2"
                >
                  <Sparkles size={12} />
                  Buscar desde Excel
                </button>
              </div>
            )}
            
            <textarea 
              className="w-full h-[250px] bg-slate-50 border border-slate-100 rounded-3xl p-5 text-[11px] font-mono text-slate-600 outline-none focus:bg-white focus:ring-4 focus:ring-orange-500/5 transition-all resize-none shadow-inner"
              placeholder="Pega aquí tu lista con formato:&#10;1	Letrero de obra&#10;2	Madera Pino 2&quot;x3&quot;&#10;3	Anticorrosivo"
              value={inputMasivo}
              onChange={e => setInputMasivo(e.target.value)}
              disabled={procesando}
            />
            
            <button 
              onClick={iniciarBarrido}
              disabled={procesando || !inputMasivo.trim()}
              className="w-full mt-4 bg-slate-900 hover:bg-orange-600 text-white py-4 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.15em] flex items-center justify-center gap-3 shadow-2xl transition-all disabled:bg-slate-200"
            >
              {procesando ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>PROCESANDO {progreso.actual}/{progreso.total}</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Iniciar Barrido</span>
                </>
              )}
            </button>
            
            {/* Estadísticas */}
            {itemsLista.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-slate-50 rounded-2xl p-3">
                    <p className="text-[9px] text-slate-400">Items</p>
                    <p className="font-black text-xl">{estadisticas.totalItems}</p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-3">
                    <p className="text-[9px] text-slate-400">Resultados</p>
                    <p className="font-black text-xl">{estadisticas.totalResultados}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-2xl p-3">
                    <p className="text-[9px] text-emerald-500">Matching promedio</p>
                    <p className="font-black text-xl text-emerald-700">{estadisticas.promedioMatching}%</p>
                  </div>
                  <div className="bg-amber-50 rounded-2xl p-3">
                    <p className="text-[9px] text-amber-500">Parciales</p>
                    <p className="font-black text-xl text-amber-700">{estadisticas.itemsIncompletos}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resultados */}
        <div className="lg:col-span-9 space-y-6 pb-20">
          {itemsLista.length === 0 ? (
            <div className="h-[50vh] flex flex-col items-center justify-center text-center">
              <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border border-slate-50 mb-8">
                <ShoppingBag size={64} strokeWidth={1} className="text-orange-500 opacity-20" />
              </div>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.4em] mb-2">Lista vacía</p>
              <p className="text-slate-300 text-xs">Carga un Excel o pega una lista con formato "1	Nombre del producto"</p>
            </div>
          ) : (
            <div className="space-y-4">
              {itemsLista.map((item, idx) => {
                const mejorMatch = item.mejor_match || item.resultados[0];
                const matchPorcentaje = mejorMatch?.matching?.porcentaje || 0;
                const matchNivel = mejorMatch?.matching?.nivel || 'bajo';
                
                return (
                  <div key={`${item.numero}-${idx}`} className="bg-white rounded-2xl border shadow-sm overflow-hidden transition-all">
                    {/* Cabecera con color según matching */}
                    <div className={`px-6 py-4 border-b flex flex-wrap justify-between items-center gap-3 ${
                      item.procesando ? 'bg-orange-50/30' : 
                      matchPorcentaje >= 85 ? 'bg-emerald-50/50' :
                      matchPorcentaje >= 60 ? 'bg-amber-50/50' : 
                      item.resultados.length > 0 ? 'bg-red-50/50' : 'bg-slate-50/50'
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${
                          matchPorcentaje >= 85 ? 'bg-emerald-100 text-emerald-700' :
                          matchPorcentaje >= 60 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {item.numero}
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-slate-800">{item.nombre}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {item.procesando ? (
                              <span className="text-[9px] font-black text-orange-500 flex items-center gap-1">
                                <Loader2 size={10} className="animate-spin" />
                                BUSCANDO...
                              </span>
                            ) : (
                              <>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${getMatchingColor(matchPorcentaje)}`}>
                                  {getMatchingIcon(matchPorcentaje)} {matchPorcentaje}% - {matchNivel === 'exacto' ? 'EXACTO' : matchNivel === 'parcial' ? 'PARCIAL' : 'BAJO'}
                                </span>
                                {mejorMatch && (
                                  <span className="text-[9px] font-black text-slate-400">
                                    Mejor: {mejorMatch.tienda} - {mejorMatch.precio_formateado}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Tabla de resultados con colores por matching */}
                    {!item.procesando && item.resultados.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-[9px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-50 bg-slate-50/50">
                              <th className="px-6 py-3">#</th>
                              <th className="px-6 py-3">Tienda</th>
                              <th className="px-6 py-3">Producto</th>
                              <th className="px-6 py-3 text-right">Precio</th>
                              <th className="px-6 py-3 text-center">Match</th>
                              <th className="px-6 py-3 text-center">Link</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {item.resultados.slice(0, 10).map((result, ridx) => {
                              const matchPct = result.matching?.porcentaje || (ridx === 0 ? 85 : ridx < 3 ? 70 : 50);
                              return (
                                <tr key={ridx} className="hover:bg-slate-50/80 transition-all">
                                  <td className="px-6 py-4 text-[10px] font-black text-slate-300">
                                    {String(ridx + 1).padStart(2, '0')}
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="font-black text-slate-800 text-xs block">{result.tienda}</span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <p className="text-xs font-medium text-slate-600 leading-tight max-w-md line-clamp-2">
                                      {result.nombre}
                                    </p>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <span className="text-sm font-black text-slate-900">{result.precio_formateado}</span>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={`text-[9px] font-black px-2 py-1 rounded-full ${getMatchingColor(matchPct)}`}>
                                      {getMatchingIcon(matchPct)} {matchPct}%
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <a href={result.link} target="_blank" className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all">
                                      <ExternalLink size={12} />
                                    </a>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {item.resultados.length > 10 && (
                          <div className="px-6 py-3 text-center text-[9px] text-slate-400 border-t">
                            + {item.resultados.length - 10} resultados adicionales
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!item.procesando && item.resultados.length === 0 && (
                      <div className="px-6 py-8 text-center">
                        <AlertCircle size={24} className="mx-auto text-red-300 mb-2" />
                        <p className="text-xs text-slate-400">No se encontraron resultados para este producto</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}