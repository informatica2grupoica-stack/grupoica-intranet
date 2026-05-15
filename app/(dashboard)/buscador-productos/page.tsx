// app/(dashboard)/buscador-productos/page.tsx
'use client';

import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Search, ExternalLink, Loader2, BarChart3,
  Trash2, ChevronRight, CheckCircle2, AlertCircle, X, Sparkles,
  Download, FileSpreadsheet, AlertTriangle, ShoppingBag,
  Upload, Eye, EyeOff, Settings, ChevronDown, ChevronUp
} from 'lucide-react';

// --- COMPONENTE DE ALERTA MODERNA (TOAST) ---
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'warning'; onClose: () => void }) => (
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

// --- MODAL DE PREVISUALIZACIÓN EXCEL ---
const ModalPrevisualizacion = ({ productos, onClose, onConfirm }: { productos: ProductoExcel[]; onClose: () => void; onConfirm: () => void }) => {
  const [mostrarJson, setMostrarJson] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase italic">
              📊 Previsualización Excel - Pestaña COSTEO
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
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase">ITEM</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase">DETALLE</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">CANTIDAD</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">VALOR C/IVA</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase">LINK REFERENCIA</th>
                    </tr>  
                  
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productos.slice(0, 50).map((prod: ProductoExcel, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-bold text-slate-600">{prod.numero}</td>
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-md truncate">{prod.nombre}</td>
                      <td className="px-4 py-3 text-xs text-right text-slate-600">{prod.cantidad}</td>
                      <td className="px-4 py-3 text-xs text-right font-bold text-emerald-600">
                        ${prod.valor_civa?.toLocaleString('es-CL') || 0}
                      </td>
                      <td className="px-4 py-3 text-[9px] text-blue-500 truncate max-w-[150px]">
                        {prod.link_referencia ? (
                          <a href={prod.link_referencia} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            Ver link
                          </a>
                        ) : '—'}
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
            Cancelar
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

// --- MODAL DE EXPORTACIÓN ---
const ModalExportacion = ({ onConfirm, onCancel, totalItems }: { onConfirm: () => void; onCancel: () => void; totalItems: number }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
      <div className="p-6 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileSpreadsheet size={32} className="text-blue-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Exportar Todos los Resultados</h3>
        <p className="text-sm text-slate-500 mt-2">
          Se exportarán <strong className="text-blue-600">{totalItems}</strong> productos con TODOS sus resultados encontrados.
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          Cada producto puede tener múltiples opciones de precios.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
            <Download size={16} /> Exportar
          </button>
        </div>
      </div>
    </div>
  </div>
);

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
  const [inputManual, setInputManual] = useState<string>("");
  const [inputMasivo, setInputMasivo] = useState<string>("");
  const [itemsLista, setItemsLista] = useState<ItemLista[]>([]);
  const [procesando, setProcesando] = useState<boolean>(false);
  const [buscandoUno, setBuscandoUno] = useState<boolean>(false);
  const [progreso, setProgreso] = useState<{ actual: number; total: number }>({ actual: 0, total: 0 });
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'warning' }>>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Estados para Excel
  const [productosExcel, setProductosExcel] = useState<ProductoExcel[]>([]);
  const [mostrarPrevisualizacion, setMostrarPrevisualizacion] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [pestanaSeleccionada, setPestanaSeleccionada] = useState<string>('COSTEO');
  const [pestanasDisponibles, setPestanasDisponibles] = useState<string[]>([]);
  const [archivoExcel, setArchivoExcel] = useState<File | null>(null);

  // NUEVOS ESTADOS PARA CONTEXTO PERSONALIZADO
  const [contextoPersonalizado, setContextoPersonalizado] = useState<string>("");
  const [mostrarContexto, setMostrarContexto] = useState<boolean>(false);
  const [usarIAContexto, setUsarIAContexto] = useState<boolean>(true);
  const [enriqueciendo, setEnriqueciendo] = useState<boolean>(false);

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

  // NUEVA FUNCIÓN: Enriquecer consulta con IA
  const enriquecerConsulta = async (producto: string, contexto: string): Promise<string> => {
    if (!contexto.trim() || !usarIAContexto) {
      return producto;
    }

    try {
      setEnriqueciendo(true);
      const response = await fetch('/api/enriquecer-consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto, contexto })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.usado_ia && data.consulta_optimizada) {
          console.log(`🤖 IA optimizó: "${producto}" → "${data.consulta_optimizada}"`);
          return data.consulta_optimizada;
        }
      }
    } catch (error) {
      console.warn("Error enriqueciendo consulta:", error);
    } finally {
      setEnriqueciendo(false);
    }
    return producto;
  };

  // Cargar Excel desde archivo
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

  // Procesar pestaña específica del Excel
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

    // Buscar la fila de encabezados
    const headers: string[] = [];
    let headerRowIndex = -1;

    for (let i = 0; i < Math.min(15, jsonData.length); i++) {
      const row = jsonData[i] as any[];
      if (row && row.length > 0) {
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
      else if (header === "VALOR C/IVA" || header.includes("VALOR C/IVA") || header === "VALOR C IVA" || header === "VALOR C/ IVA") colValorCIVA = i;
      else if (header === "LINK 1" || header.includes("LINK")) colLink = i;
    }

    console.log(`📌 Mapeo de columnas:`);
    console.log(`   - ITEM: columna ${colItem}`);
    console.log(`   - DETALLE: columna ${colDetalle}`);
    console.log(`   - CANTIDAD: columna ${colCantidad}`);
    console.log(`   - VALOR C/IVA: columna ${colValorCIVA}`);

    const items: ProductoExcel[] = [];

    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!row || row.length === 0) continue;

      const detalle = colDetalle >= 0 ? (row[colDetalle] || "").toString().trim() : "";
      const itemNum = colItem >= 0 ? (row[colItem] || i) : i;
      const cantidad = colCantidad >= 0 ? Number(row[colCantidad]) || 1 : 1;
      const linkRef = colLink >= 0 ? (row[colLink] || "").toString().trim() : "";

      let valorCIVA = 0;
      if (colValorCIVA >= 0) {
        const rawValue = row[colValorCIVA];
        if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
          if (typeof rawValue === 'number') {
            valorCIVA = rawValue;
          } else if (typeof rawValue === 'string') {
            let cleaned = rawValue.replace(/[$.]/g, '').trim();
            cleaned = cleaned.replace(',', '.');
            valorCIVA = parseFloat(cleaned) || 0;
          } else {
            valorCIVA = Number(rawValue) || 0;
          }
        }
      }

      if (!detalle || detalle === "" || detalle === "TOTAL" || detalle.includes("VERDADERO") || detalle.includes("COSTEADO")) {
        continue;
      }

      items.push({
        numero: Number(itemNum),
        nombre: detalle,
        cantidad: Number(cantidad) || 1,
        valor_civa: valorCIVA,
        link_referencia: linkRef
      });
    }

    console.log(`\n✅ TOTAL PRODUCTOS CARGADOS: ${items.length}`);

    if (items.length === 0) {
      console.error("❌ No se encontraron productos válidos en el Excel");
      notify(`No se encontraron productos válidos en la pestaña "${sheetName}"`, "error");
      return;
    }

    console.log("\n📋 RESUMEN DE PRODUCTOS CARGADOS:");
    items.slice(0, 10).forEach((item: ProductoExcel, idx: number) => {
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

  const confirmarBusquedaExcel = () => {
    setShowModal(false);
    iniciarBarridoExcel();
  };

  // 🔥 FUNCIÓN PRINCIPAL MODIFICADA - Con enriquecimiento de contexto
  const buscarProductoRobusto = async (producto: string, numero: string, minimo: number = 9): Promise<ItemLista> => {
    try {
      // 🔥 ENRIQUECER CONSULTA CON CONTEXTO PERSONALIZADO
      let consultaFinal = producto;
      if (contextoPersonalizado.trim()) {
        consultaFinal = await enriquecerConsulta(producto, contextoPersonalizado);
      }
      
      console.log(`🔍 [${numero}] Buscando: ${consultaFinal}`);
      if (contextoPersonalizado && consultaFinal !== producto) {
        console.log(`📝 Contexto aplicado: "${contextoPersonalizado}"`);
        console.log(`✨ Consulta optimizada: "${consultaFinal}"`);
      }
      
      // 1. Llamar a Python para obtener resultados
      const res = await fetch(`/python/busqueda-robusta?producto=${encodeURIComponent(consultaFinal)}&numero=${numero}&minimo=${minimo}`);
      
      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
      
      const data = await res.json();
      const resultadosRaw = data.resultados || [];
      const analisisProducto = data.analisis_producto || null;
      
      console.log(`📊 Python devolvió: ${resultadosRaw.length} resultados`);
      if (analisisProducto) {
        console.log(`📋 Categoría detectada: ${analisisProducto.categoria}`);
        console.log(`📏 Medidas: ${analisisProducto.medidas?.texto_legible || 'ninguna'}`);
      }
      
      // 2. Si hay resultados y tenemos DeepSeek, llamar a analizar-con-ia
      let resultadosFinales = resultadosRaw;
      let mejorMatch = null;
      let calidadResultados = 'media';
      let observacionIA = '';
      
      if (resultadosRaw.length > 3 && process.env.NEXT_PUBLIC_USE_IA !== 'false') {
        try {
          console.log(`🤖 Llamando a analizar-con-ia para: ${producto}`);
          
          const iaRes = await fetch('/api/analizar-con-ia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              producto: producto,
              numero_item: numero,
              minimo_requerido: minimo,
              resultados_raw: resultadosRaw,
              analisis_producto: analisisProducto
            })
          });
          
          if (iaRes.ok) {
            const iaData = await iaRes.json();
            if (iaData.success && iaData.resultados) {
              resultadosFinales = iaData.resultados;
              mejorMatch = iaData.resultados[0];
              calidadResultados = iaData.calidad_resultados || 'media';
              observacionIA = iaData.observacion_ia || '';
              console.log(`✅ IA aplicada: ${resultadosFinales.length} resultados ordenados`);
              console.log(`📊 Calidad: ${calidadResultados}, Observación: ${observacionIA}`);
            }
          } else {
            console.warn(`⚠️ analizar-con-ia respondió con error: ${iaRes.status}`);
          }
        } catch (iaError) {
          console.warn(`⚠️ Error llamando a analizar-con-ia:`, iaError);
        }
      }
      
      // 3. Transformar al formato que espera el frontend
      const resultadosConMatch: ProductoResultado[] = resultadosFinales.map((r: any) => {
        let nivel: NivelMatching = 'bajo';
        let porcentaje = r.score || r.porcentaje || 0;
        
        if (porcentaje >= 85) nivel = 'exacto';
        else if (porcentaje >= 60) nivel = 'parcial';
        
        return {
          tienda: r.tienda,
          nombre: r.nombre,
          precio_valor: r.precio_valor || r.precio_con_iva || 0,
          precio_formateado: r.precio_formateado || `$${(r.precio_valor || r.precio_con_iva || 0).toLocaleString('es-CL')}`,
          link: r.link || r.url,
          canal: r.canal || r.fuente || 'web',
          busqueda_original: producto,
          matching: r.matching || {
            porcentaje: porcentaje,
            nivel: nivel,
            razon: r.etiqueta_concordancia || r.razon || (porcentaje >= 85 ? 'Alta coincidencia' : porcentaje >= 60 ? 'Coincidencia parcial' : 'Baja coincidencia')
          }
        };
      });
      
      resultadosConMatch.sort((a, b) => (b.matching?.porcentaje || 0) - (a.matching?.porcentaje || 0));
      
      return {
        numero: data.numero_item || numero,
        nombre: data.producto || producto,
        resultados: resultadosConMatch,
        total_encontrados: resultadosConMatch.length,
        suficientes: resultadosConMatch.length >= minimo,
        deficit: Math.max(0, minimo - resultadosConMatch.length),
        procesando: false,
        mejor_match: mejorMatch ? {
          tienda: mejorMatch.tienda,
          nombre: mejorMatch.nombre,
          precio_valor: mejorMatch.precio_valor || mejorMatch.precio_con_iva || 0,
          precio_formateado: mejorMatch.precio_formateado,
          link: mejorMatch.link || mejorMatch.url,
          canal: mejorMatch.canal || mejorMatch.fuente || 'web',
          busqueda_original: producto,
          matching: {
            porcentaje: mejorMatch.score || mejorMatch.porcentaje || 0,
            nivel: (mejorMatch.score || mejorMatch.porcentaje || 0) >= 85 ? 'exacto' : (mejorMatch.score || mejorMatch.porcentaje || 0) >= 60 ? 'parcial' : 'bajo',
            razon: mejorMatch.etiqueta_concordancia || ''
          }
        } : (resultadosConMatch[0] || undefined)
      };
      
    } catch (error: any) {
      console.error(`Error buscando ${producto}:`, error);
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
    if (contextoPersonalizado) {
      console.log(`📝 Contexto activo: "${contextoPersonalizado}"`);
    }

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

    console.log("\n🚀 INICIANDO BARRIDO DESDE TEXTO");
    if (contextoPersonalizado) {
      console.log(`📝 Contexto activo: "${contextoPersonalizado}"`);
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

  // Exportar a CSV (SOLO mejor match)
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
    link.setAttribute('download', `mejor_match_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    URL.revokeObjectURL(link.href);

    notify("✅ Exportación CSV completada - Solo mejor match por producto", 'success');
  };

  // Exportar Excel con TODOS los resultados
  const exportarTodosResultados = () => {
    const exportData: any[] = [];

    itemsLista.forEach(item => {
      if (item.resultados.length === 0) {
        exportData.push({
          ITEM_ORIGINAL: item.numero,
          PRODUCTO_BUSCADO: item.nombre,
          'N°_RESULTADO': 0,
          TIENDA: 'SIN RESULTADOS',
          PRODUCTO_ENCONTRADO: 'No se encontraron resultados',
          PRECIO: '-',
          LINK: '-',
          COINCIDENCIA: '0%',
          NIVEL: 'sin_coincidencia'
        });
      } else {
        item.resultados.forEach((resultado, idx) => {
          exportData.push({
            ITEM_ORIGINAL: item.numero,
            PRODUCTO_BUSCADO: item.nombre,
            'N°_RESULTADO': idx + 1,
            TIENDA: resultado.tienda,
            PRODUCTO_ENCONTRADO: resultado.nombre,
            PRECIO: resultado.precio_formateado,
            LINK: resultado.link,
            COINCIDENCIA: `${resultado.matching?.porcentaje || 0}%`,
            NIVEL: resultado.matching?.nivel || 'bajo'
          });
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Todos_los_resultados');
    XLSX.writeFile(wb, `todos_resultados_${new Date().toISOString().split('T')[0]}.xlsx`);

    setShowExportModal(false);
    notify("✅ Exportación Excel completada - Todos los resultados", 'success');
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

  const getMatchingColor = (porcentaje: number = 0): string => {
    if (porcentaje >= 85) return 'bg-emerald-100 text-emerald-700';
    if (porcentaje >= 60) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  const getMatchingIcon = (porcentaje: number = 0): string => {
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

      {/* Modal de previsualización Excel */}
      {showModal && productosExcel.length > 0 && (
        <ModalPrevisualizacion
          productos={productosExcel}
          onClose={() => setShowModal(false)}
          onConfirm={confirmarBusquedaExcel}
        />
      )}

      {/* Modal de confirmación exportación */}
      {showExportModal && (
        <ModalExportacion
          totalItems={itemsLista.length}
          onConfirm={exportarTodosResultados}
          onCancel={() => setShowExportModal(false)}
        />
      )}

      {/* Toasts */}
      <div className="fixed top-24 right-6 z-50 flex flex-col gap-3">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
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
                <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full ml-2">Analizador IA</span>
              </h1>
              <p className="text-[9px] text-slate-400">Mínimo 9 resultados • Contexto IA • Colores por coincidencia</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 md:w-96 flex items-center bg-slate-100/50 border border-slate-200 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-orange-500/20">
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

            {/* Botón CSV - solo mejor match */}
            <button
              onClick={exportarACSV}
              disabled={itemsLista.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-2xl transition-all shadow-sm disabled:opacity-50"
              title="Exportar CSV (solo mejor match por producto)"
            >
              <Download size={18} />
            </button>

            {/* Botón Excel - todos los resultados */}
            <button
              onClick={() => setShowExportModal(true)}
              disabled={itemsLista.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-2xl transition-all shadow-sm disabled:opacity-50"
              title="Exportar Excel (todos los resultados)"
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
          <div className="bg-white p-6 rounded-3xl border shadow-xl sticky top-32">
            <div className="flex justify-between items-center mb-5">
              <label className="flex items-center gap-3 font-black text-[10px] uppercase text-slate-400">
                <div className={`w-2 h-2 rounded-full ${procesando ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                Barrido de Precios
              </label>
              {procesando && <button onClick={cancelarBarrido} className="text-[9px] font-black text-red-500">Cancelar</button>}
            </div>

            {/* ========================================== */}
            {/* CONTEXTO PERSONALIZADO (NUEVO) */}
            {/* ========================================== */}
            <div className="mb-4">
              <button
                onClick={() => setMostrarContexto(!mostrarContexto)}
                className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Settings size={14} className="text-slate-500" />
                  <span className="text-[9px] font-black uppercase text-slate-600">Contexto personalizado</span>
                </div>
                {mostrarContexto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              {mostrarContexto && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl space-y-3 animate-in slide-in-from-top duration-200">
                  <label className="text-[8px] font-black text-slate-400 uppercase block">
                    📝 Describe el contexto de tu búsqueda:
                  </label>
                  <textarea
                    value={contextoPersonalizado}
                    onChange={(e) => setContextoPersonalizado(e.target.value)}
                    placeholder="Ej: solo productos de fierro y madera, materiales de construcción, maquinaria pesada, artículos de ferretería..."
                    className="w-full h-20 p-2 bg-white border border-slate-200 rounded-lg text-[10px] resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-[9px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={usarIAContexto}
                        onChange={(e) => setUsarIAContexto(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Usar IA para optimizar la consulta
                    </label>
                    {contextoPersonalizado && (
                      <button
                        onClick={() => setContextoPersonalizado("")}
                        className="text-[9px] text-red-500 hover:text-red-700"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  
                  {contextoPersonalizado && (
                    <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-[8px] text-blue-600 font-black uppercase">Contexto activo</p>
                      <p className="text-[9px] text-blue-700 mt-0.5 line-clamp-2">{contextoPersonalizado}</p>
                    </div>
                  )}
                  
                  {enriqueciendo && (
                    <div className="flex items-center justify-center gap-2 text-[9px] text-blue-600">
                      <Loader2 size={12} className="animate-spin" />
                      Optimizando consulta con IA...
                    </div>
                  )}
                </div>
              )}
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
                <p className="text-[7px] text-slate-400 mt-1">Selecciona "COSTEO" para tu archivo</p>
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
                  {productosExcel.slice(0, 5).map((p: ProductoExcel) => <div key={p.numero} className="truncate">{p.numero}. {p.nombre.substring(0, 40)}</div>)}
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

            <textarea
              className="w-full h-[250px] bg-slate-50 border rounded-3xl p-5 text-[11px] font-mono text-slate-600 outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
              placeholder="Pega aquí tu lista con formato:&#10;1	Letrero de obra&#10;2	Madera Pino 2&quot;x3&quot;&#10;3	Anticorrosivo"
              value={inputMasivo}
              onChange={e => setInputMasivo(e.target.value)}
              disabled={procesando}
            />

            <button
              onClick={iniciarBarrido}
              disabled={procesando || !inputMasivo.trim()}
              className="w-full mt-4 bg-slate-900 hover:bg-orange-600 text-white py-4 rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-3 shadow-lg transition-all disabled:bg-slate-200"
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
              <div className="bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 mb-8">
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
                  <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                    <div className={`px-6 py-4 border-b flex flex-wrap justify-between items-center gap-3 ${item.procesando ? 'bg-orange-50/30' :
                      matchPorcentaje >= 85 ? 'bg-emerald-50/50' :
                        matchPorcentaje >= 60 ? 'bg-amber-50/50' :
                          item.resultados.length > 0 ? 'bg-red-50/50' : 'bg-slate-50/50'
                      }`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${matchPorcentaje >= 85 ? 'bg-emerald-100 text-emerald-700' :
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

                      {item.resultados.length > 0 && !item.procesando && (
                        <div className="text-[9px] text-slate-400 bg-white/50 px-2 py-1 rounded-full">
                          💰 Mejor precio: {Math.min(...item.resultados.map(r => r.precio_valor || Infinity)) !== Infinity ?
                            `$${Math.min(...item.resultados.map(r => r.precio_valor || Infinity)).toLocaleString('es-CL')}` : 'N/A'}
                        </div>
                      )}
                    </div>

                    {!item.procesando && item.resultados.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50/50">
                            <tr className="text-[9px] uppercase text-slate-400 font-black tracking-widest">
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
                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase italic">
                                      {result.canal || 'WEB'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <p className="text-xs font-medium text-slate-600 leading-tight max-w-md line-clamp-2">
                                      {result.nombre}
                                    </p>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <span className="text-sm font-black text-slate-900">
                                      {result.precio_formateado}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={`text-[9px] font-black px-2 py-1 rounded-full ${getMatchingColor(matchPct)}`}>
                                      {getMatchingIcon(matchPct)} {matchPct}%
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <a
                                      href={result.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all"
                                    >
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
                        <p className="text-[9px] text-slate-300 mt-1">Verifica el nombre o intenta con términos más generales</p>
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