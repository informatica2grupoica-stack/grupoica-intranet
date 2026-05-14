// app/(dashboard)/buscador-proveedores/page.tsx
'use client';

import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Search, ExternalLink, Loader2, BarChart3,
  Trash2, ChevronRight, CheckCircle2, AlertCircle, X, Sparkles,
  Download, FileSpreadsheet, AlertTriangle, ShoppingBag,
  Upload, Eye, EyeOff
} from 'lucide-react';

// --- COMPONENTE DE ALERTA MODERNA (TOAST) ---
const Toast = ({ message, type, onClose }: any) => (
  <div className={`fixed top-24 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-right-8 duration-300 ${type === 'success'
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

// --- MODAL DE PREVISUALIZACIÓN ---
const ModalPrevisualizacion = ({ productos, onClose, onConfirm }: any) => {
  const [mostrarJson, setMostrarJson] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase italic">
              📊 Previsualización Excel
            </h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              {productos.length} productos cargados
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMostrarJson(!mostrarJson)}
              className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-2xl transition-all"
              title="Ver JSON"
            >
              {mostrarJson ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-2xl transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {mostrarJson ? (
            <pre className="bg-slate-900 text-slate-200 p-4 rounded-xl text-[10px] font-mono overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(productos.slice(0, 20), null, 2)}
            </pre>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase">Item</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase">Producto</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Cantidad</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Valor C/IVA</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase">Link Referencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productos.slice(0, 50).map((prod: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs font-bold text-slate-600">{prod.numero}</td>
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-md truncate">{prod.nombre}</td>
                      <td className="px-4 py-3 text-xs text-right text-slate-600">{prod.cantidad}</td>
                      <td className="px-4 py-3 text-xs text-right font-bold text-emerald-600">
                        ${prod.valor_civa.toLocaleString('es-CL')}
                      </td>
                      <td className="px-4 py-3 text-[9px] text-blue-500 truncate max-w-[150px]">
                        {prod.link_referencia || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {productos.length > 50 && (
                <p className="text-center text-[9px] text-slate-400 mt-4">
                  + {productos.length - 50} productos adicionales
                </p>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase text-slate-400 hover:bg-slate-100 transition-all"
          >
            Cerrar
          </button>
          <button
            onClick={onConfirm}
            className="px-8 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all flex items-center gap-2"
          >
            <Sparkles size={14} />
            Iniciar Búsqueda
          </button>
        </div>
      </div>
    </div>
  );
};

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
    nivel: NivelMatching;
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
  const [showModal, setShowModal] = useState(false);
  const [pestanaSeleccionada, setPestanaSeleccionada] = useState<string>('COSTEO');
  const [pestanasDisponibles, setPestanasDisponibles] = useState<string[]>([]);
  const [archivoExcel, setArchivoExcel] = useState<File | null>(null);

  const notify = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const parsearLista = (texto: string): { numero: string; nombre: string }[] => {
    const lineas = texto.split('\n').filter(line => line.trim().length > 0);
    const items: { numero: string; nombre: string }[] = [];

    for (const linea of lineas) {
      const match = linea.match(/^(\d+)[\s\t]+(.+)/);
      if (match) {
        items.push({ numero: match[1], nombre: match[2].trim() });
      } else if (!linea.trim().match(/^\d+$/)) {
        items.push({ numero: String(items.length + 1), nombre: linea.trim() });
      }
    }
    return items;
  };

  // Cargar Excel desde archivo con logs detallados
  const cargarExcel = (file: File) => {
    console.log("=".repeat(60));
    console.log("📁 CARGANDO EXCEL");
    console.log("=".repeat(60));
    console.log("📄 Nombre del archivo:", file.name);
    console.log("📏 Tamaño:", file.size, "bytes");

    setArchivoExcel(file);
    const reader = new FileReader();

    reader.onload = (e) => {
      console.log("✅ Archivo leído correctamente");
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });

      console.log("📑 Pestañas encontradas:", workbook.SheetNames);
      setPestanasDisponibles(workbook.SheetNames);

      let sheetName = pestanaSeleccionada;
      if (!workbook.SheetNames.includes(sheetName)) {
        console.warn(`⚠️ Pestaña "${sheetName}" no encontrada, usando primera disponible`);
        sheetName = workbook.SheetNames[0];
        setPestanaSeleccionada(sheetName);
      }

      console.log(`📌 Leyendo pestaña: "${sheetName}"`);
      procesarPestanaExcel(workbook, sheetName);
    };

    reader.onerror = (error) => {
      console.error("❌ Error leyendo archivo:", error);
      notify("Error al leer el archivo Excel", "error");
    };

    reader.readAsArrayBuffer(file);
  };

  // Procesar pestaña específica del Excel con logs

  // Procesar pestaña específica del Excel con logs
  const procesarPestanaExcel = (workbook: XLSX.WorkBook, sheetName: string) => {
    console.log("\n📊 PROCESANDO PESTAÑA:", sheetName);

    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`📋 Filas encontradas: ${jsonData.length}`);

    if (jsonData.length === 0) {
      console.warn("⚠️ No hay datos en esta pestaña");
      notify(`La pestaña "${sheetName}" está vacía`, "warning");
      return;
    }

    // Buscar la fila de encabezados (primera fila con datos)
    const headers: string[] = [];
    let headerRowIndex = -1;

    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i] as any[];
      if (row && row.length > 0) {
        // Buscar si esta fila contiene encabezados como "ITEM", "Detalle", etc.
        const hasHeaders = row.some(cell =>
          String(cell || "").toUpperCase().includes("ITEM") ||
          String(cell || "").toUpperCase().includes("DETALLE") ||
          String(cell || "").toUpperCase().includes("CANTIDAD")
        );
        if (hasHeaders) {
          headerRowIndex = i;
          for (let j = 0; j < row.length; j++) {
            headers[j] = String(row[j] || "").trim();
          }
          console.log("📌 Encabezados encontrados en fila", i + 1, ":", headers);
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      console.error("❌ No se encontraron encabezados en el Excel");
      notify("No se encontraron encabezados válidos en el Excel", "error");
      return;
    }

    // Mapear índices de columnas
    let colItem = -1, colDetalle = -1, colCantidad = -1, colValorCIVA = -1, colLink = -1;

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toUpperCase();
      if (header === "ITEM" || header.includes("ITEM")) colItem = i;
      else if (header === "DETALLE" || header.includes("DETALLE")) colDetalle = i;
      else if (header === "CANTIDAD" || header.includes("CANTIDAD")) colCantidad = i;
      else if (header === "VALOR C/IVA" || header.includes("VALOR C/IVA") || header === "VALOR C IVA") colValorCIVA = i;
      else if (header === "LINK 1" || header.includes("LINK")) colLink = i;
    }

    console.log(`📌 Mapeo de columnas:`);
    console.log(`   - ITEM: columna ${colItem}`);
    console.log(`   - DETALLE: columna ${colDetalle}`);
    console.log(`   - CANTIDAD: columna ${colCantidad}`);
    console.log(`   - VALOR C/IVA: columna ${colValorCIVA}`);

    const items: ProductoExcel[] = [];

    // Procesar filas de datos (después del encabezado)
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!row || row.length === 0) continue;

      const detalle = colDetalle >= 0 ? (row[colDetalle] || "").toString().trim() : "";
      const itemNum = colItem >= 0 ? (row[colItem] || i) : i;
      const cantidad = colCantidad >= 0 ? Number(row[colCantidad]) || 1 : 1;
      const valorCIVA = colValorCIVA >= 0 ? Number(row[colValorCIVA]) || 0 : 0;
      const linkRef = colLink >= 0 ? (row[colLink] || "").toString().trim() : "";

      if (!detalle || detalle === "" || detalle === "TOTAL" || detalle.includes("VERDADERO")) {
        continue;
      }

      items.push({
        numero: Number(itemNum),
        nombre: detalle,
        cantidad: Number(cantidad) || 1,
        valor_civa: Number(valorCIVA) || 0,
        link_referencia: linkRef
      });
    }

    console.log(`\n✅ TOTAL PRODUCTOS CARGADOS: ${items.length}`);

    if (items.length === 0) {
      console.error("❌ No se encontraron productos válidos en el Excel");
      notify(`No se encontraron productos válidos en la pestaña "${sheetName}"`, "error");
      return;
    }

    // Mostrar resumen de productos cargados
    console.log("\n📋 RESUMEN DE PRODUCTOS CARGADOS:");
    items.slice(0, 10).forEach((item, idx) => {
      console.log(`  ${idx + 1}. [${item.numero}] ${item.nombre.substring(0, 60)}... - Cant: ${item.cantidad} - $${item.valor_civa.toLocaleString('es-CL')}`);
    });
    if (items.length > 10) {
      console.log(`  ... y ${items.length - 10} productos más`);
    }

    setProductosExcel(items);
    setMostrarPrevisualizacion(true);
    setShowModal(true);
    notify(`✅ Cargados ${items.length} productos desde pestaña "${sheetName}"`, 'success');
  };
  // Cambiar de pestaña
  const cambiarPestana = (sheetName: string) => {
    console.log(`🔄 Cambiando a pestaña: "${sheetName}"`);
    setPestanaSeleccionada(sheetName);
    if (archivoExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        procesarPestanaExcel(workbook, sheetName);
      };
      reader.readAsArrayBuffer(archivoExcel);
    }
  };

  // Confirmar búsqueda desde el modal
  const confirmarBusquedaExcel = () => {
    setShowModal(false);
    iniciarBarridoExcel();
  };

  // Función para hacer matching con IA
  const aplicarMatchingIA = async (productoBuscado: string, resultados: ProductoResultado[]): Promise<{ mejor_match: ProductoResultado | null, resultados_con_match: ProductoResultado[] }> => {
    if (resultados.length === 0) {
      return { mejor_match: null, resultados_con_match: resultados };
    }

    try {
      const response = await fetch('/api/matching-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto_buscado: productoBuscado, resultados_raw: resultados })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          mejor_match: data.mejor_match,
          resultados_con_match: data.todos_resultados || resultados
        };
      }
    } catch (error) {
      console.warn("Error en matching IA");
    }

    // Fallback local
    const resultadosConMatch: ProductoResultado[] = resultados.map((r, idx) => {
      let nivel: NivelMatching = 'bajo';
      let porcentaje = 50;
      if (idx === 0) { nivel = 'exacto'; porcentaje = 85; }
      else if (idx < 3) { nivel = 'parcial'; porcentaje = 70; }

      return {
        ...r,
        matching: { porcentaje, nivel, razon: idx === 0 ? 'Mejor coincidencia' : 'Coincidencia parcial' }
      };
    });

    return { mejor_match: resultadosConMatch[0], resultados_con_match: resultadosConMatch };
  };

  // Buscar producto con el backend robusto
  const buscarProductoRobusto = async (producto: string, numero: string, minimo: number = 9): Promise<ItemLista> => {
    try {
      const res = await fetch(`/python/busqueda-robusta?producto=${encodeURIComponent(producto)}&numero=${numero}&minimo=${minimo}`);

      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);

      const data = await res.json();
      const resultadosRaw = data.resultados || [];
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
      console.error(error);
      return {
        numero, nombre: producto, resultados: [], total_encontrados: 0,
        suficientes: false, deficit: 9, procesando: false, error: error.message
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

    if (!existe) setItemsLista(prev => [...prev, resultado]);
    else setItemsLista(prev => prev.map(item => item.numero === resultado.numero ? resultado : item));

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

    console.log("\n🚀 INICIANDO BARRIDO DESDE EXCEL");
    console.log(`📊 Total productos: ${productosExcel.length}`);

    setProcesando(true);
    setItemsLista([]);
    setProgreso({ actual: 0, total: productosExcel.length });
    notify(`Iniciando barrido de ${productosExcel.length} productos desde Excel`, 'success');

    abortControllerRef.current = new AbortController();

    for (let i = 0; i < productosExcel.length; i++) {
      if (abortControllerRef.current?.signal.aborted) break;

      const prod = productosExcel[i];
      setProgreso({ actual: i + 1, total: productosExcel.length });

      console.log(`🔍 Buscando [${prod.numero}] ${prod.nombre.substring(0, 50)}...`);

      setItemsLista(prev => [...prev, {
        numero: String(prod.numero), nombre: prod.nombre, resultados: [],
        total_encontrados: 0, suficientes: false, deficit: 9, procesando: true
      }]);

      const resultado = await buscarProductoRobusto(prod.nombre, String(prod.numero), 9);

      console.log(`   ✅ ${resultado.resultados.length} resultados encontrados`);

      setItemsLista(prev => prev.map(p => p.numero === String(prod.numero) ? resultado : p));
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    setProcesando(false);
    abortControllerRef.current = null;
    notify("Barrido desde Excel completado", 'success');
    console.log("✅ BARRIDO COMPLETADO");
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
      if (abortControllerRef.current?.signal.aborted) break;

      const item = items[i];
      setProgreso({ actual: i + 1, total: items.length });

      setItemsLista(prev => [...prev, {
        numero: item.numero, nombre: item.nombre, resultados: [],
        total_encontrados: 0, suficientes: false, deficit: 9, procesando: true
      }]);

      const resultado = await buscarProductoRobusto(item.nombre, item.numero, 9);
      setItemsLista(prev => prev.map(p => p.numero === item.numero ? resultado : p));
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
    const csvRows = ['ITEM;Producto Buscado;Mejor Match;Tienda;Precio;Link;% Coincidencia'];
    itemsLista.forEach(item => {
      const mejorMatch = item.mejor_match || item.resultados[0];
      if (mejorMatch) {
        csvRows.push(`${item.numero};${item.nombre};${mejorMatch.nombre};${mejorMatch.tienda};${mejorMatch.precio_formateado};${mejorMatch.link};${mejorMatch.matching?.porcentaje || 100}%`);
      } else {
        csvRows.push(`${item.numero};${item.nombre};SIN RESULTADOS;;;;0%`);
      }
    });

    const blob = new Blob(["\uFEFF" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `matching_precios_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    URL.revokeObjectURL(link.href);
    notify("Exportación completada", 'success');
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
      Coincidencia: `${item.mejor_match?.matching?.porcentaje || item.resultados[0]?.matching?.porcentaje || 0}%`
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
      setShowModal(false);
      setArchivoExcel(null);
      setPestanasDisponibles([]);
      notify("Lista limpiada", 'error');
    }
  };

  const getMatchingColor = (porcentaje: number = 0) => {
    if (porcentaje >= 85) return 'bg-emerald-100 text-emerald-700';
    if (porcentaje >= 60) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
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
    const totalResultados = itemsLista.reduce((sum, i) => sum + i.resultados.length, 0);
    const promedioMatching = itemsLista.filter(i => i.mejor_match?.matching?.porcentaje)
      .reduce((sum, i) => sum + (i.mejor_match?.matching?.porcentaje || 0), 0) / (itemsLista.filter(i => i.mejor_match?.matching?.porcentaje).length || 1);

    return { totalItems, itemsCompletos, itemsIncompletos, totalResultados, promedioMatching: Math.round(promedioMatching) };
  }, [itemsLista]);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">

      {/* Modal de previsualización */}
      {showModal && productosExcel.length > 0 && (
        <ModalPrevisualizacion
          productos={productosExcel}
          onClose={() => setShowModal(false)}
          onConfirm={confirmarBusquedaExcel}
        />
      )}

      {/* Toasts */}
      <div className="fixed top-24 right-6 z-50 flex flex-col gap-3">
        {toasts.map(t => (
          <Toast key={t.id} {...t} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
        ))}
      </div>

      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-8 py-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1500px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 text-white p-2.5 rounded-2xl shadow-xl">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tight text-slate-900">MONITOR <span className="text-orange-600">ICA</span>
                <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full ml-2">Matching IA</span>
              </h1>
              <p className="text-[9px] text-slate-400">Mínimo 9 resultados • Matching inteligente • Colores por coincidencia</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100/50 border border-slate-200 rounded-2xl px-4">
              <Search size={16} className="text-slate-400" />
              <input className="bg-transparent py-3 px-3 text-xs outline-none w-64" placeholder="Ej: 25 Anticorrosivo..." value={inputManual} onChange={e => setInputManual(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarUno()} />
              <button onClick={buscarUno} disabled={buscandoUno || !inputManual.trim()} className="bg-slate-900 text-white p-1.5 rounded-xl hover:bg-orange-600">
                {buscandoUno ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              </button>
            </div>
            <button onClick={exportarACSV} disabled={itemsLista.length === 0} className="bg-emerald-600 text-white p-3 rounded-2xl disabled:opacity-50" title="Exportar CSV"><Download size={18} /></button>
            <button onClick={exportarExcelCompleto} disabled={itemsLista.length === 0} className="bg-blue-600 text-white p-3 rounded-2xl disabled:opacity-50" title="Exportar Excel"><FileSpreadsheet size={18} /></button>
            <button onClick={limpiarLista} disabled={itemsLista.length === 0} className="bg-white border p-3 rounded-2xl text-slate-400 hover:text-rose-500"><Trash2 size={18} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-3">
          <div className="bg-white p-6 rounded-3xl border shadow-xl sticky top-32">
            <div className="flex justify-between items-center mb-5">
              <label className="flex items-center gap-3 font-black text-[10px] uppercase text-slate-400">
                <div className={`w-2 h-2 rounded-full ${procesando ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                Barrido de Precios
              </label>
              {procesando && <button onClick={cancelarBarrido} className="text-[9px] font-black text-red-500">Cancelar</button>}
            </div>

            {/* Carga de Excel */}
            <div className="mb-4">
              <button onClick={() => document.getElementById('excel-input')?.click()} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                <Upload size={14} /> Cargar Excel
              </button>
              <input id="excel-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && cargarExcel(e.target.files[0])} />
            </div>

            {/* Selector de pestañas */}
            {pestanasDisponibles.length > 1 && (
              <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">📑 Pestaña del Excel:</label>
                <select value={pestanaSeleccionada} onChange={(e) => cambiarPestana(e.target.value)} className="w-full p-2 bg-white rounded-xl text-[10px] font-medium border">
                  {pestanasDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <p className="text-[7px] text-slate-400 mt-1">Selecciona la pestaña con los datos</p>
              </div>
            )}

            {/* Previsualización Excel resumida */}
            {mostrarPrevisualizacion && productosExcel.length > 0 && !showModal && (
              <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-slate-500">📊 Excel cargado</span>
                  <span className="text-[8px] text-emerald-600">{productosExcel.length} productos</span>
                </div>
                <div className="max-h-32 overflow-y-auto text-[9px] space-y-1">
                  {productosExcel.slice(0, 5).map(p => <div key={p.numero} className="truncate">{p.numero}. {p.nombre.substring(0, 40)}</div>)}
                  {productosExcel.length > 5 && <div className="text-slate-400">+ {productosExcel.length - 5} más</div>}
                </div>
                <button onClick={() => setShowModal(true)} className="w-full mt-3 bg-indigo-600 text-white py-2 rounded-lg text-[9px] font-black flex items-center justify-center gap-2">
                  <Eye size={12} /> Ver detalles
                </button>
                <button onClick={iniciarBarridoExcel} disabled={procesando} className="w-full mt-2 bg-orange-600 text-white py-2 rounded-lg text-[9px] font-black flex items-center justify-center gap-2">
                  <Sparkles size={12} /> Buscar desde Excel
                </button>
              </div>
            )}

            <textarea className="w-full h-[250px] bg-slate-50 border rounded-3xl p-5 text-[11px] font-mono outline-none resize-none" placeholder="Pega aquí tu lista:&#10;1	Letrero de obra&#10;2	Madera Pino" value={inputMasivo} onChange={e => setInputMasivo(e.target.value)} disabled={procesando} />

            <button onClick={iniciarBarrido} disabled={procesando || !inputMasivo.trim()} className="w-full mt-4 bg-slate-900 hover:bg-orange-600 text-white py-4 rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-3">
              {procesando ? <><Loader2 className="animate-spin" size={18} /> PROCESANDO {progreso.actual}/{progreso.total}</> : <><Sparkles size={16} /> Iniciar Barrido</>}
            </button>

            {/* Estadísticas */}
            {itemsLista.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-slate-50 rounded-2xl p-3"><p className="text-[9px]">Items</p><p className="font-black text-xl">{estadisticas.totalItems}</p></div>
                  <div className="bg-slate-50 rounded-2xl p-3"><p className="text-[9px]">Resultados</p><p className="font-black text-xl">{estadisticas.totalResultados}</p></div>
                  <div className="bg-emerald-50 rounded-2xl p-3"><p className="text-[9px] text-emerald-500">Matching promedio</p><p className="font-black text-xl">{estadisticas.promedioMatching}%</p></div>
                  <div className="bg-amber-50 rounded-2xl p-3"><p className="text-[9px] text-amber-500">Parciales</p><p className="font-black text-xl">{estadisticas.itemsIncompletos}</p></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resultados */}
        <div className="lg:col-span-9 space-y-6 pb-20">
          {itemsLista.length === 0 ? (
            <div className="h-[50vh] flex flex-col items-center justify-center text-center">
              <div className="bg-white p-10 rounded-3xl shadow-2xl mb-8"><ShoppingBag size={64} className="text-orange-500 opacity-20" /></div>
              <p className="text-slate-400 font-black text-[10px] uppercase mb-2">Lista vacía</p>
              <p className="text-slate-300 text-xs">Carga un Excel o pega una lista con formato "1	Nombre del producto"</p>
            </div>
          ) : (
            <div className="space-y-4">
              {itemsLista.map((item, idx) => {
                const mejorMatch = item.mejor_match || item.resultados[0];
                const matchPorcentaje = mejorMatch?.matching?.porcentaje || 0;
                const matchNivel = mejorMatch?.matching?.nivel || 'bajo';

                return (
                  <div key={idx} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className={`px-6 py-4 border-b flex flex-wrap justify-between items-center gap-3 ${item.procesando ? 'bg-orange-50/30' : matchPorcentaje >= 85 ? 'bg-emerald-50/50' : matchPorcentaje >= 60 ? 'bg-amber-50/50' : 'bg-red-50/50'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${matchPorcentaje >= 85 ? 'bg-emerald-100 text-emerald-700' : matchPorcentaje >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {item.numero}
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-slate-800">{item.nombre}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {item.procesando ? (
                              <span className="text-[9px] font-black text-orange-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> BUSCANDO...</span>
                            ) : (
                              <>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${getMatchingColor(matchPorcentaje)}`}>
                                  {getMatchingIcon(matchPorcentaje)} {matchPorcentaje}% - {matchNivel === 'exacto' ? 'EXACTO' : matchNivel === 'parcial' ? 'PARCIAL' : 'BAJO'}
                                </span>
                                {mejorMatch && <span className="text-[9px] font-black text-slate-400">Mejor: {mejorMatch.tienda} - {mejorMatch.precio_formateado}</span>}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {!item.procesando && item.resultados.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50/50">
                            <tr className="text-[9px] uppercase text-slate-400 font-black">
                              <th className="px-6 py-3">#</th><th className="px-6 py-3">Tienda</th><th className="px-6 py-3">Producto</th><th className="px-6 py-3 text-right">Precio</th><th className="px-6 py-3 text-center">Match</th><th className="px-6 py-3 text-center">Link</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {item.resultados.slice(0, 10).map((result, ridx) => {
                              const matchPct = result.matching?.porcentaje || (ridx === 0 ? 85 : ridx < 3 ? 70 : 50);
                              return (
                                <tr key={ridx} className="hover:bg-slate-50/80">
                                  <td className="px-6 py-4 text-[10px] font-black text-slate-300">{String(ridx + 1).padStart(2, '0')}</td>
                                  <td className="px-6 py-4"><span className="font-black text-slate-800 text-xs">{result.tienda}</span></td>
                                  <td className="px-6 py-4"><p className="text-xs font-medium text-slate-600 line-clamp-2">{result.nombre}</p></td>
                                  <td className="px-6 py-4 text-right"><span className="text-sm font-black text-slate-900">{result.precio_formateado}</span></td>
                                  <td className="px-6 py-4 text-center"><span className={`text-[9px] font-black px-2 py-1 rounded-full ${getMatchingColor(matchPct)}`}>{getMatchingIcon(matchPct)} {matchPct}%</span></td>
                                  <td className="px-6 py-4 text-center"><a href={result.link} target="_blank" className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white"><ExternalLink size={12} /></a></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {item.resultados.length > 10 && <div className="px-6 py-3 text-center text-[9px] text-slate-400">+ {item.resultados.length - 10} más</div>}
                      </div>
                    )}

                    {!item.procesando && item.resultados.length === 0 && (
                      <div className="px-6 py-8 text-center"><AlertCircle size={24} className="mx-auto text-red-300 mb-2" /><p className="text-xs text-slate-400">No se encontraron resultados</p></div>
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
