// app/(dashboard)/buscador-productos/page.tsx
'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Search, ExternalLink, Loader2, BarChart3,
  Trash2, ChevronRight, CheckCircle2, AlertCircle, X, Sparkles,
  Download, FileSpreadsheet, AlertTriangle, ShoppingBag,
  Upload, Eye, EyeOff, Settings, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'warning'; onClose: () => void }) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-right-8 duration-300 ${
    type === 'success' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
    : type === 'warning' ? 'bg-amber-50/90 border-amber-200 text-amber-800'
    : 'bg-orange-50/90 border-orange-200 text-orange-800'
  }`}>
    {type === 'success' ? <CheckCircle2 size={18} /> : type === 'warning' ? <AlertTriangle size={18} /> : <AlertCircle size={18} />}
    <p className="text-[11px] font-black uppercase tracking-wider leading-none">{message}</p>
    <button onClick={onClose} className="ml-2 hover:opacity-50 transition-opacity"><X size={14} /></button>
  </div>
);

// ─── Modal Previsualización ────────────────────────────────────────────────────
const ModalPrevisualizacion = ({
  productos, onClose, onConfirm
}: { productos: ProductoExcel[]; onClose: () => void; onConfirm: () => void }) => {
  const [mostrarJson, setMostrarJson] = useState(false);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase italic">📊 Previsualización Excel — Pestaña COSTEO</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{productos.length} productos cargados</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setMostrarJson(!mostrarJson)} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-2xl transition-all">
              {mostrarJson ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-2xl transition-all"><X size={18} /></button>
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
                  {productos.slice(0, 50).map((prod, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-bold text-slate-600">{prod.numero}</td>
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-md truncate">{prod.nombre}</td>
                      <td className="px-4 py-3 text-xs text-right text-slate-600">{prod.cantidad}</td>
                      <td className="px-4 py-3 text-xs text-right font-bold text-emerald-600">
                        {prod.valor_civa > 0 ? `$${prod.valor_civa.toLocaleString('es-CL')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[9px] text-blue-500 truncate max-w-[150px]">
                        {prod.link_referencia
                          ? <a href={prod.link_referencia} target="_blank" rel="noopener noreferrer" className="hover:underline">Ver link</a>
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {productos.length > 50 && (
                <p className="text-center text-[9px] text-slate-400 mt-4">+ {productos.length - 50} productos adicionales</p>
              )}
            </div>
          )}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-5 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-xs font-black uppercase text-slate-400 hover:bg-slate-100 transition-all">Cancelar</button>
          <button onClick={onConfirm} className="px-8 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all flex items-center gap-2">
            <Sparkles size={14} /> Iniciar Búsqueda ({productos.length} productos)
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Tipos ────────────────────────────────────────────────────────────────────
type NivelMatching = 'exacto' | 'parcial' | 'bajo';

interface ProductoResultado {
  tienda: string;
  nombre: string;
  precio_valor: number;
  precio_neto?: number;
  precio_formateado: string;
  link: string;
  canal: string;
  busqueda_original: string;
  score?: number;
  matching?: { porcentaje: number; nivel: NivelMatching; razon: string };
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
  // posición en el sheet original para el export
  _fila?: number;
}

// ─── Semáforo de concurrencia ─────────────────────────────────────────────────
function crearSemaforo(limite: number) {
  let activos = 0;
  const cola: Array<() => void> = [];
  return async function<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const ejecutar = async () => {
        activos++;
        try { resolve(await fn()); }
        catch (e) { reject(e); }
        finally {
          activos--;
          if (cola.length > 0) cola.shift()!();
        }
      };
      if (activos < limite) ejecutar();
      else cola.push(ejecutar);
    });
  };
}

const IVA = 1.19;

export default function MonitorMasivoICA() {
  const [inputManual, setInputManual] = useState('');
  const [inputMasivo, setInputMasivo] = useState('');
  const [itemsLista, setItemsLista] = useState<ItemLista[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [buscandoUno, setBuscandoUno] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'warning' }>>([]);
  const abortRef = useRef(false);

  // Excel state
  const [productosExcel, setProductosExcel] = useState<ProductoExcel[]>([]);
  const [workbookOriginal, setWorkbookOriginal] = useState<XLSX.WorkBook | null>(null);
  const [sheetNameActual, setSheetNameActual] = useState('COSTEO');
  const [showModal, setShowModal] = useState(false);
  const [pestanasDisponibles, setPestanasDisponibles] = useState<string[]>([]);
  const [archivoExcel, setArchivoExcel] = useState<File | null>(null);
  const [mostrarPrevisualizacion, setMostrarPrevisualizacion] = useState(false);

  // Contexto IA
  const [contextoPersonalizado, setContextoPersonalizado] = useState('');
  const [mostrarContexto, setMostrarContexto] = useState(false);
  const [usarIAContexto, setUsarIAContexto] = useState(true);

  // Selección manual
  const [seleccionManual, setSeleccionManual] = useState<Map<string, ProductoResultado>>(new Map());

  // ─── Notify ──────────────────────────────────────────────────────────────────
  const notify = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ─── Parsear lista de texto ───────────────────────────────────────────────────
  const parsearLista = (texto: string): { numero: string; nombre: string }[] => {
    return texto.split('\n')
      .filter(l => l.trim().length > 0)
      .reduce<{ numero: string; nombre: string }[]>((acc, linea) => {
        const match = linea.match(/^(\d+)[\s\t]+(.+)/);
        if (match) acc.push({ numero: match[1], nombre: match[2].trim() });
        else if (!linea.trim().match(/^\d+$/)) acc.push({ numero: String(acc.length + 1), nombre: linea.trim() });
        return acc;
      }, []);
  };

  // ─── Enriquecer consulta con IA ───────────────────────────────────────────────
  const enriquecerConsulta = async (producto: string, contexto: string): Promise<string> => {
    if (!contexto.trim() || !usarIAContexto) return producto;
    try {
      const res = await fetch('/api/enriquecer-consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto, contexto }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.usado_ia && data.consulta_optimizada) return data.consulta_optimizada;
      }
    } catch { /* usar producto original */ }
    return producto;
  };

  // ─── Selección manual ─────────────────────────────────────────────────────────
  const toggleSeleccionManual = (itemNumero: string, resultado: ProductoResultado) => {
    setSeleccionManual(prev => {
      const m = new Map(prev);
      m.get(itemNumero) === resultado ? m.delete(itemNumero) : m.set(itemNumero, resultado);
      return m;
    });
  };

  // ─── Cargar Excel ─────────────────────────────────────────────────────────────
  const cargarExcel = (file: File) => {
    setArchivoExcel(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      setWorkbookOriginal(wb);
      setPestanasDisponibles(wb.SheetNames);
      console.log('📑 Pestañas:', wb.SheetNames);

      let sheet = wb.SheetNames.includes('COSTEO') ? 'COSTEO' : wb.SheetNames[0];
      setSheetNameActual(sheet);
      procesarPestana(wb, sheet);
    };
    reader.onerror = () => notify('Error al leer el archivo Excel', 'error');
    reader.readAsArrayBuffer(file);
  };

  // ─── Procesar pestaña del Excel ───────────────────────────────────────────────
  const procesarPestana = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

    if (jsonData.length === 0) {
      notify(`La pestaña "${sheetName}" está vacía`, 'warning');
      return;
    }

    // Buscar fila de encabezados
    let headerRow = -1;
    let colItem = -1, colDetalle = -1, colCantidad = -1, colValor = -1, colLink = -1;

    for (let i = 0; i < Math.min(20, jsonData.length); i++) {
      const row = jsonData[i];
      if (!row) continue;
      const hasHeader = row.some((c: any) =>
        ['ITEM', 'DETALLE', 'CANTIDAD'].includes(String(c || '').toUpperCase().trim())
      );
      if (hasHeader) {
        headerRow = i;
        row.forEach((cell: any, j: number) => {
          const h = String(cell || '').toUpperCase().trim();
          if (h === 'ITEM' || h.includes('ITEM')) colItem = j;
          else if (h === 'DETALLE' || h.includes('DETALLE')) colDetalle = j;
          else if (h === 'CANTIDAD' || h.includes('CANTIDAD')) colCantidad = j;
          else if (h.includes('VALOR') && h.includes('IVA')) colValor = j;
          else if (h.includes('LINK')) colLink = j;
        });
        console.log(`📌 Headers fila ${i + 1} | ITEM:${colItem} DETALLE:${colDetalle} CANT:${colCantidad} VALOR:${colValor}`);
        break;
      }
    }

    if (headerRow === -1) {
      notify('No se encontraron encabezados válidos en el Excel', 'error');
      return;
    }

    const items: ProductoExcel[] = [];
    for (let i = headerRow + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0) continue;

      const detalle = colDetalle >= 0 ? String(row[colDetalle] || '').trim() : '';
      if (!detalle || ['TOTAL', 'VERDADERO', 'COSTEADO', 'SUBTOTAL'].some(s => detalle.toUpperCase().includes(s))) continue;

      const itemNum = colItem >= 0 ? row[colItem] : i - headerRow;
      const cantidad = colCantidad >= 0 ? Number(row[colCantidad]) || 1 : 1;
      const link = colLink >= 0 ? String(row[colLink] || '').trim() : '';

      let valorCIVA = 0;
      if (colValor >= 0 && row[colValor] != null && row[colValor] !== '') {
        const raw = row[colValor];
        if (typeof raw === 'number') valorCIVA = raw;
        else {
          const cleaned = String(raw).replace(/[$\.]/g, '').replace(',', '.').trim();
          valorCIVA = parseFloat(cleaned) || 0;
        }
      }

      items.push({
        numero: Number(itemNum),
        nombre: detalle,
        cantidad: Number(cantidad) || 1,
        valor_civa: valorCIVA,
        link_referencia: link,
        _fila: i,
      });
    }

    if (items.length === 0) {
      notify(`No se encontraron productos en "${sheetName}"`, 'error');
      return;
    }

    console.log(`✅ ${items.length} productos cargados`);
    setProductosExcel(items);
    setMostrarPrevisualizacion(true);
    setShowModal(true);
    notify(`✅ ${items.length} productos desde "${sheetName}"`, 'success');
  };

  const cambiarPestana = (sheetName: string) => {
    setSheetNameActual(sheetName);
    if (workbookOriginal) procesarPestana(workbookOriginal, sheetName);
  };

  // ─── Búsqueda robusta de un producto ─────────────────────────────────────────
  const buscarProductoRobusto = async (
    producto: string,
    numero: string,
    minimo: number = 15
  ): Promise<ItemLista> => {
    try {
      let consultaFinal = producto;
      if (contextoPersonalizado.trim()) {
        consultaFinal = await enriquecerConsulta(producto, contextoPersonalizado);
        if (consultaFinal !== producto) console.log(`✨ [${numero}] "${producto}" → "${consultaFinal}"`);
      }

      const res = await fetch(
        `/python/busqueda-robusta?producto=${encodeURIComponent(consultaFinal)}&numero=${encodeURIComponent(numero)}&minimo=${minimo}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const resultadosRaw = data.resultados || [];
      const analisisProducto = data.analisis_producto || null;

      console.log(`📊 [${numero}] Python: ${resultadosRaw.length} resultados`);

      let resultadosFinales = resultadosRaw;

      // Reranking con IA si hay suficientes candidatos
      if (resultadosRaw.length > 3 && process.env.NEXT_PUBLIC_USE_IA !== 'false') {
        try {
          const iaRes = await fetch('/api/analizar-con-ia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              producto,
              numero_item: numero,
              minimo_requerido: minimo,
              resultados_raw: resultadosRaw,
              analisis_producto: analisisProducto,
            }),
          });
          if (iaRes.ok) {
            const iaData = await iaRes.json();
            if (iaData.success && iaData.resultados?.length > 0) {
              resultadosFinales = iaData.resultados;
              console.log(`🤖 [${numero}] IA reranked: ${resultadosFinales.length} | calidad: ${iaData.calidad_resultados}`);
            }
          }
        } catch (e) {
          console.warn(`⚠️ [${numero}] Reranking falló, usando orden Python`);
        }
      }

      // Mapear con matching real — SIEMPRE usar el score real del backend
      const resultadosConMatch: ProductoResultado[] = resultadosFinales.map((r: any) => {
        const porcentaje = r.score ?? r.porcentaje ?? r.matching?.porcentaje ?? 0;
        const nivel: NivelMatching = porcentaje >= 85 ? 'exacto' : porcentaje >= 60 ? 'parcial' : 'bajo';
        return {
          tienda: r.tienda || '',
          nombre: r.nombre || '',
          precio_valor: r.precio_valor ?? r.precio_con_iva ?? 0,
          precio_formateado: r.precio_formateado || `$${(r.precio_valor ?? 0).toLocaleString('es-CL')}`,
          link: r.link || r.url || '',
          canal: r.canal || r.fuente || 'web',
          busqueda_original: producto,
          matching: {
            porcentaje,
            nivel,
            razon: r.etiqueta_concordancia || r.razon || (nivel === 'exacto' ? 'Alta coincidencia' : nivel === 'parcial' ? 'Coincidencia parcial' : 'Baja coincidencia'),
          },
        };
      });

      // Ordenar por porcentaje descendente
      resultadosConMatch.sort((a, b) => (b.matching?.porcentaje ?? 0) - (a.matching?.porcentaje ?? 0));

      return {
        numero: String(data.numero_item || numero),
        nombre: String(data.producto || producto),
        resultados: resultadosConMatch,
        total_encontrados: resultadosConMatch.length,
        suficientes: resultadosConMatch.length >= minimo,
        deficit: Math.max(0, minimo - resultadosConMatch.length),
        procesando: false,
        mejor_match: resultadosConMatch[0],
      };
    } catch (err: any) {
      console.error(`❌ [${numero}] ${producto}:`, err.message);
      return { numero, nombre: producto, resultados: [], total_encontrados: 0, suficientes: false, deficit: minimo, procesando: false, error: err.message };
    }
  };

  // ─── Búsqueda individual ──────────────────────────────────────────────────────
  const buscarUno = async () => {
    if (!inputManual.trim() || buscandoUno) return;
    setBuscandoUno(true);
    const match = inputManual.trim().match(/^(\d+)\s+(.+)/);
    const numero = match ? match[1] : String(itemsLista.length + 1);
    const nombre = match ? match[2] : inputManual.trim();
    notify(`Buscando: ${nombre}`, 'success');
    const resultado = await buscarProductoRobusto(nombre, numero);
    setItemsLista(prev => {
      const existe = prev.some(i => i.numero === resultado.numero);
      return existe ? prev.map(i => i.numero === resultado.numero ? resultado : i) : [...prev, resultado];
    });
    if (resultado.suficientes) { notify(`✅ ${nombre}: ${resultado.total_encontrados} resultados`, 'success'); setInputManual(''); }
    else notify(`⚠️ ${nombre}: ${resultado.total_encontrados}/15 resultados`, 'warning');
    setBuscandoUno(false);
  };

  // ─── Barrido con concurrencia x3 ──────────────────────────────────────────────
  const iniciarBarrido = async (items: { numero: string; nombre: string }[]) => {
    if (items.length === 0) { notify('No hay productos para buscar', 'error'); return; }

    setProcesando(true);
    abortRef.current = false;
    setItemsLista([]);
    setProgreso({ actual: 0, total: items.length });
    notify(`Iniciando barrido de ${items.length} productos (x3 paralelo)`, 'success');

    // Inicializar todos como "procesando"
    setItemsLista(items.map(item => ({
      numero: item.numero, nombre: item.nombre, resultados: [],
      total_encontrados: 0, suficientes: false, deficit: 15, procesando: true,
    })));

    const semaforo = crearSemaforo(3);
    let completados = 0;

    const promesas = items.map(item =>
      semaforo(async () => {
        if (abortRef.current) return;
        const resultado = await buscarProductoRobusto(item.nombre, item.numero);
        completados++;
        setProgreso({ actual: completados, total: items.length });
        setItemsLista(prev => prev.map(p => p.numero === item.numero ? resultado : p));
        console.log(`[${completados}/${items.length}] ${item.nombre.substring(0, 40)} — ${resultado.total_encontrados} resultados`);
      })
    );

    await Promise.all(promesas);
    setProcesando(false);
    notify(`Barrido completado: ${completados} productos`, 'success');
    console.log('✅ BARRIDO COMPLETADO');
  };

  const iniciarBarridoTexto = () => iniciarBarrido(parsearLista(inputMasivo));
  const iniciarBarridoExcel = () => {
    setShowModal(false);
    iniciarBarrido(productosExcel.map(p => ({ numero: String(p.numero), nombre: p.nombre })));
  };
  const cancelarBarrido = () => { abortRef.current = true; notify('Cancelando...', 'warning'); };

  // ─── Export: mismo archivo Excel con precios rellenados ──────────────────────
  const exportarMismoExcel = () => {
    if (!workbookOriginal || productosExcel.length === 0) {
      notify('Carga un Excel primero para usar esta función', 'warning');
      return;
    }

    // Clonar el workbook original
    const wbClone = XLSX.utils.book_new();
    workbookOriginal.SheetNames.forEach(name => {
      const wsOrig = workbookOriginal.Sheets[name];
      wbClone.Sheets[name] = JSON.parse(JSON.stringify(wsOrig));
      wbClone.SheetNames.push(name);
    });

    const ws = wbClone.Sheets[sheetNameActual];
    const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

    // Encontrar encabezados y última columna
    let headerRow = -1;
    let colItem = -1, colDetalle = -1;
    const maxColExistente = jsonData.reduce((max, row) => Math.max(max, (row as any[]).length), 0);

    for (let i = 0; i < Math.min(20, jsonData.length); i++) {
      const row = jsonData[i] as any[];
      if (!row) continue;
      if (row.some((c: any) => String(c || '').toUpperCase().trim() === 'ITEM')) {
        headerRow = i;
        row.forEach((cell: any, j: number) => {
          const h = String(cell || '').toUpperCase().trim();
          if (h === 'ITEM' || h.includes('ITEM')) colItem = j;
          else if (h === 'DETALLE' || h.includes('DETALLE')) colDetalle = j;
        });
        break;
      }
    }

    if (headerRow === -1) {
      notify('No se encontraron encabezados en el Excel original', 'error');
      return;
    }

    // Columnas nuevas al final
    const colWebIVA = maxColExistente;
    const colCostoNeto = maxColExistente + 1;
    const colCostoTotal = maxColExistente + 2;
    const colTienda = maxColExistente + 3;
    const colCoincidencia = maxColExistente + 4;

    // Escribir encabezados nuevos
    const toCell = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });
    ws[toCell(headerRow, colWebIVA)] = { v: 'PRECIO WEB C/IVA', t: 's' };
    ws[toCell(headerRow, colCostoNeto)] = { v: 'COSTO UNIT. NETO', t: 's' };
    ws[toCell(headerRow, colCostoTotal)] = { v: 'COSTO TOTAL NETO', t: 's' };
    ws[toCell(headerRow, colTienda)] = { v: 'TIENDA ENCONTRADA', t: 's' };
    ws[toCell(headerRow, colCoincidencia)] = { v: '% COINCIDENCIA', t: 's' };

    // Mapa de resultados por item número
    const resultadosPorItem = new Map<string, ItemLista>();
    itemsLista.forEach(item => resultadosPorItem.set(item.numero, item));

    const productosExcelPorNumero = new Map<string, ProductoExcel>();
    productosExcel.forEach(p => productosExcelPorNumero.set(String(p.numero), p));

    // Rellenar cada fila del Excel original
    for (let i = headerRow + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!row || row.length === 0) continue;
      const itemNumRaw = colItem >= 0 ? row[colItem] : null;
      if (itemNumRaw == null) continue;

      const itemNumStr = String(itemNumRaw).trim();
      const itemResult = resultadosPorItem.get(itemNumStr);
      if (!itemResult) continue;

      const prodOriginal = productosExcelPorNumero.get(itemNumStr);
      const cantidad = prodOriginal?.cantidad || 1;

      // Resultado seleccionado (manual > mejor_match > primer resultado)
      const selected = seleccionManual.get(itemNumStr) || itemResult.mejor_match || itemResult.resultados[0];
      if (!selected) continue;

      const precioWebIVA = selected.precio_valor || 0;
      const costoNeto = Math.round(precioWebIVA / IVA);
      const costoTotal = Math.round(costoNeto * cantidad);
      const porcentaje = selected.matching?.porcentaje ?? 0;

      ws[toCell(i, colWebIVA)] = { v: precioWebIVA, t: 'n', z: '"$"#,##0' };
      ws[toCell(i, colCostoNeto)] = { v: costoNeto, t: 'n', z: '"$"#,##0' };
      ws[toCell(i, colCostoTotal)] = { v: costoTotal, t: 'n', z: '"$"#,##0' };
      ws[toCell(i, colTienda)] = { v: selected.tienda, t: 's' };
      ws[toCell(i, colCoincidencia)] = { v: `${porcentaje}%`, t: 's' };
    }

    // Actualizar rango del sheet
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    range.e.c = Math.max(range.e.c, colCoincidencia);
    ws['!ref'] = XLSX.utils.encode_range(range);

    // Ajustar anchos de columnas nuevas
    const colWidths = ws['!cols'] || Array(colWebIVA).fill({ wch: 12 });
    while (colWidths.length <= colCoincidencia) colWidths.push({ wch: 12 });
    colWidths[colWebIVA] = { wch: 18 };
    colWidths[colCostoNeto] = { wch: 18 };
    colWidths[colCostoTotal] = { wch: 18 };
    colWidths[colTienda] = { wch: 22 };
    colWidths[colCoincidencia] = { wch: 14 };
    ws['!cols'] = colWidths;

    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wbClone, `COSTEO_actualizado_${fecha}.xlsx`);
    notify('✅ Excel exportado con estructura original + precios web', 'success');
  };

  // ─── Export: solo mejor resultado ────────────────────────────────────────────
  const exportarMejorResultado = () => {
    const rows = itemsLista.map(item => {
      const orig = productosExcel.find(p => String(p.numero) === item.numero);
      const mejor = seleccionManual.get(item.numero) || item.mejor_match || item.resultados[0];
      const precioWeb = mejor?.precio_valor || 0;
      const costoNeto = Math.round(precioWeb / IVA);
      return {
        'ITEM': item.numero,
        'DETALLE': item.nombre,
        'CANTIDAD': orig?.cantidad || 1,
        'VALOR C/IVA REF': orig?.valor_civa || 0,
        'PRECIO WEB C/IVA': precioWeb,
        'COSTO UNIT. NETO': costoNeto,
        'COSTO TOTAL NETO': Math.round(costoNeto * (orig?.cantidad || 1)),
        'TIENDA': mejor?.tienda || 'Sin resultados',
        '% COINCIDENCIA': `${mejor?.matching?.porcentaje ?? 0}%`,
        'LINK': mejor?.link || '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 8 }, { wch: 45 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 55 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mejor_Resultado');
    XLSX.writeFile(wb, `mejor_resultado_${new Date().toISOString().split('T')[0]}.xlsx`);
    notify('✅ Exportado mejor resultado por producto', 'success');
  };

  // ─── Export: todos los resultados ────────────────────────────────────────────
  const exportarTodos = () => {
    const rows: any[] = [];
    itemsLista.forEach(item => {
      if (item.resultados.length === 0) {
        rows.push({ ITEM: item.numero, PRODUCTO_BUSCADO: item.nombre, N_RESULTADO: 0, TIENDA: 'SIN RESULTADOS', PRODUCTO_ENCONTRADO: '', PRECIO: '', LINK: '', 'COINCIDENCIA_%': '0%' });
      } else {
        item.resultados.forEach((r, idx) => {
          rows.push({ ITEM: item.numero, PRODUCTO_BUSCADO: item.nombre, N_RESULTADO: idx + 1, TIENDA: r.tienda, PRODUCTO_ENCONTRADO: r.nombre, PRECIO: r.precio_formateado, LINK: r.link, 'COINCIDENCIA_%': `${r.matching?.porcentaje ?? 0}%` });
        });
      }
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Todos_Resultados');
    XLSX.writeFile(wb, `todos_resultados_${new Date().toISOString().split('T')[0]}.xlsx`);
    notify('✅ Exportados todos los resultados', 'success');
  };

  const limpiarLista = () => {
    if (itemsLista.length > 0 && confirm('¿Eliminar todos los resultados?')) {
      setItemsLista([]);
      setProductosExcel([]);
      setWorkbookOriginal(null);
      setMostrarPrevisualizacion(false);
      setShowModal(false);
      setArchivoExcel(null);
      setPestanasDisponibles([]);
      setSeleccionManual(new Map());
      notify('Lista limpiada', 'error');
    }
  };

  const getMatchingColor = (p = 0) => p >= 85 ? 'bg-emerald-100 text-emerald-700' : p >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  const getMatchingIcon = (p = 0) => p >= 85 ? '🟢' : p >= 60 ? '🟡' : '🔴';

  const estadisticas = useMemo(() => {
    const total = itemsLista.length;
    const completos = itemsLista.filter(i => i.suficientes).length;
    const totalResultados = itemsLista.reduce((s, i) => s + i.resultados.length, 0);
    const conMatch = itemsLista.filter(i => (i.mejor_match?.matching?.porcentaje ?? 0) > 0);
    const promedioMatching = conMatch.length > 0
      ? Math.round(conMatch.reduce((s, i) => s + (i.mejor_match?.matching?.porcentaje ?? 0), 0) / conMatch.length)
      : 0;
    const sinResultados = itemsLista.filter(i => !i.procesando && i.resultados.length === 0).length;
    return { total, completos, totalResultados, promedioMatching, sinResultados };
  }, [itemsLista]);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">

      {showModal && productosExcel.length > 0 && (
        <ModalPrevisualizacion productos={productosExcel} onClose={() => setShowModal(false)} onConfirm={iniciarBarridoExcel} />
      )}

      <div className="fixed top-24 right-6 z-50 flex flex-col gap-3">
        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />)}
      </div>

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-8 py-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1500px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 text-white p-2.5 rounded-2xl shadow-xl"><BarChart3 size={22} /></div>
            <div>
              <h1 className="font-black text-xl tracking-tight text-slate-900">
                MONITOR <span className="text-orange-600">ICA</span>
                <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full ml-2">IA + Scrapers</span>
              </h1>
              <p className="text-[9px] text-slate-400">
                Sodimac · Easy · Construmart · Imperial · MercadoLibre · x3 paralelo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Búsqueda individual */}
            <div className="flex items-center bg-slate-100/50 border border-slate-200 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-orange-500/20">
              <Search size={16} className="text-slate-400" />
              <input
                className="bg-transparent py-3 px-3 text-xs outline-none w-72 font-bold text-slate-700 placeholder:text-slate-400"
                placeholder="Ej: 25 Anticorrosivo o nombre directo..."
                value={inputManual}
                onChange={e => setInputManual(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarUno()}
              />
              <button onClick={buscarUno} disabled={buscandoUno || !inputManual.trim()}
                className="bg-slate-900 text-white p-1.5 rounded-xl hover:bg-orange-600 transition-all disabled:bg-slate-200">
                {buscandoUno ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              </button>
            </div>

            {/* Export: mismo Excel */}
            <button onClick={exportarMismoExcel} disabled={itemsLista.length === 0 || !workbookOriginal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-3 rounded-2xl transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5 text-[10px] font-black"
              title="Exportar en la misma estructura del Excel original">
              <FileSpreadsheet size={16} /> MISMO EXCEL
            </button>

            {/* Export: mejor resultado */}
            <button onClick={exportarMejorResultado} disabled={itemsLista.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-3 rounded-2xl transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5 text-[10px] font-black"
              title="Exportar mejor resultado por producto">
              <CheckCircle2 size={16} /> MEJOR
            </button>

            {/* Export: todos */}
            <button onClick={exportarTodos} disabled={itemsLista.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-3 rounded-2xl transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5 text-[10px] font-black"
              title="Exportar todos los resultados">
              <Download size={16} /> TODOS
            </button>

            <button onClick={limpiarLista} disabled={itemsLista.length === 0}
              className="bg-white border border-slate-200 p-3 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm disabled:opacity-50">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-3">
          <div className="bg-white p-6 rounded-3xl border shadow-xl sticky top-32 space-y-4">
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-3 font-black text-[10px] uppercase text-slate-400">
                <div className={`w-2 h-2 rounded-full ${procesando ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                {procesando ? `Buscando ${progreso.actual}/${progreso.total}` : 'Barrido de Precios'}
              </label>
              {procesando && (
                <button onClick={cancelarBarrido} className="text-[9px] font-black text-red-500 hover:text-red-700">Cancelar</button>
              )}
            </div>

            {/* Barra de progreso */}
            {procesando && progreso.total > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progreso.actual / progreso.total) * 100}%` }}
                />
              </div>
            )}

            {/* Contexto IA */}
            <div>
              <button
                onClick={() => setMostrarContexto(!mostrarContexto)}
                className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Settings size={14} className="text-slate-500" />
                  <span className="text-[9px] font-black uppercase text-slate-600">Contexto de búsqueda</span>
                  {contextoPersonalizado && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
                {mostrarContexto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {mostrarContexto && (
                <div className="mt-2 p-3 bg-slate-50 rounded-xl space-y-3 animate-in slide-in-from-top duration-200">
                  <label className="text-[8px] font-black text-slate-400 uppercase block">
                    📝 Describe el tipo de productos que buscas:
                  </label>

                  {/* Templates rápidos */}
                  <div className="flex flex-wrap gap-1">
                    {['ferretería construcción', 'materiales eléctricos', 'señalética vial', 'pinturas y quimicos', 'maderas y tableros'].map(tmpl => (
                      <button key={tmpl} onClick={() => setContextoPersonalizado(tmpl)}
                        className={`text-[8px] px-2 py-1 rounded-full border transition-all ${contextoPersonalizado === tmpl ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-500 hover:border-blue-400'}`}>
                        {tmpl}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={contextoPersonalizado}
                    onChange={e => setContextoPersonalizado(e.target.value)}
                    placeholder="Ej: materiales de construcción ferretería Chile..."
                    className="w-full h-16 p-2 bg-white border border-slate-200 rounded-lg text-[10px] resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                  />

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-[9px] text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={usarIAContexto} onChange={e => setUsarIAContexto(e.target.checked)} className="rounded border-slate-300" />
                      Optimizar con IA
                    </label>
                    {contextoPersonalizado && (
                      <button onClick={() => setContextoPersonalizado('')} className="text-[9px] text-red-500 hover:text-red-700">Limpiar</button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Carga Excel */}
            <div>
              <button
                onClick={() => document.getElementById('excel-input')?.click()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2"
              >
                <Upload size={14} /> Cargar Excel COSTEO
              </button>
              <input id="excel-input" type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => e.target.files?.[0] && cargarExcel(e.target.files[0])} />
            </div>

            {/* Selector pestañas */}
            {pestanasDisponibles.length > 1 && (
              <div className="p-3 bg-slate-50 rounded-xl">
                <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">📑 Pestaña del Excel:</label>
                <select value={sheetNameActual} onChange={e => cambiarPestana(e.target.value)}
                  className="w-full p-2 bg-white rounded-xl text-[10px] font-medium border">
                  {pestanasDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}

            {/* Mini preview Excel */}
            {mostrarPrevisualizacion && productosExcel.length > 0 && !showModal && (
              <div className="p-3 bg-slate-50 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-slate-500">📊 Excel cargado</span>
                  <span className="text-[8px] text-emerald-600">{productosExcel.length} productos</span>
                </div>
                <div className="max-h-28 overflow-y-auto text-[9px] space-y-0.5">
                  {productosExcel.slice(0, 6).map(p => (
                    <div key={p.numero} className="truncate text-slate-500">{p.numero}. {p.nombre.substring(0, 38)}</div>
                  ))}
                  {productosExcel.length > 6 && <div className="text-slate-400">+ {productosExcel.length - 6} más</div>}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setShowModal(true)}
                    className="flex-1 bg-slate-200 text-slate-700 py-1.5 rounded-lg text-[9px] font-black flex items-center justify-center gap-1">
                    <Eye size={11} /> Ver
                  </button>
                  <button onClick={() => iniciarBarrido(productosExcel.map(p => ({ numero: String(p.numero), nombre: p.nombre })))}
                    disabled={procesando}
                    className="flex-1 bg-orange-600 text-white py-1.5 rounded-lg text-[9px] font-black flex items-center justify-center gap-1 disabled:opacity-50">
                    <Sparkles size={11} /> Buscar
                  </button>
                </div>
              </div>
            )}

            {/* Lista de texto */}
            <textarea
              className="w-full h-52 bg-slate-50 border rounded-2xl p-4 text-[11px] font-mono text-slate-600 outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
              placeholder={`1\tLetrero de obra\n2\tMadera Pino 2"x3"\n3\tAnticorrosivo`}
              value={inputMasivo}
              onChange={e => setInputMasivo(e.target.value)}
              disabled={procesando}
            />

            <button
              onClick={iniciarBarridoTexto}
              disabled={procesando || !inputMasivo.trim()}
              className="w-full bg-slate-900 hover:bg-orange-600 text-white py-4 rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-3 shadow-lg transition-all disabled:bg-slate-200"
            >
              {procesando ? (
                <><Loader2 className="animate-spin" size={18} /> PROCESANDO {progreso.actual}/{progreso.total}</>
              ) : (
                <><Sparkles size={16} /> Iniciar Barrido</>
              )}
            </button>

            {/* Estadísticas */}
            {itemsLista.length > 0 && (
              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-50 rounded-2xl p-3">
                  <p className="text-[8px] text-slate-400">Items</p>
                  <p className="font-black text-lg">{estadisticas.total}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3">
                  <p className="text-[8px] text-slate-400">Resultados</p>
                  <p className="font-black text-lg">{estadisticas.totalResultados}</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3">
                  <p className="text-[8px] text-emerald-500">Match promedio</p>
                  <p className="font-black text-lg text-emerald-700">{estadisticas.promedioMatching}%</p>
                </div>
                <div className={`rounded-2xl p-3 ${estadisticas.sinResultados > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                  <p className={`text-[8px] ${estadisticas.sinResultados > 0 ? 'text-red-500' : 'text-slate-400'}`}>Sin resultados</p>
                  <p className={`font-black text-lg ${estadisticas.sinResultados > 0 ? 'text-red-700' : 'text-slate-700'}`}>{estadisticas.sinResultados}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resultados */}
        <div className="lg:col-span-9 space-y-4 pb-20">
          {itemsLista.length === 0 ? (
            <div className="h-[50vh] flex flex-col items-center justify-center text-center">
              <div className="bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 mb-8">
                <ShoppingBag size={64} strokeWidth={1} className="text-orange-500 opacity-20" />
              </div>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.4em] mb-2">Lista vacía</p>
              <p className="text-slate-300 text-xs">Carga un Excel COSTEO o pega una lista con "1{'\t'}Nombre del producto"</p>
            </div>
          ) : (
            itemsLista.map((item, idx) => {
              const mejor = seleccionManual.get(item.numero) || item.mejor_match || item.resultados[0];
              const pct = mejor?.matching?.porcentaje ?? 0;
              const nivel = mejor?.matching?.nivel ?? 'bajo';

              return (
                <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                  {/* Header del item */}
                  <div className={`px-6 py-4 border-b flex flex-wrap justify-between items-center gap-3 ${
                    item.procesando ? 'bg-orange-50/30'
                    : pct >= 85 ? 'bg-emerald-50/50'
                    : pct >= 60 ? 'bg-amber-50/50'
                    : item.resultados.length > 0 ? 'bg-red-50/30'
                    : 'bg-slate-50/50'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${
                        pct >= 85 ? 'bg-emerald-100 text-emerald-700'
                        : pct >= 60 ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                      }`}>
                        {item.numero}
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-slate-800">{item.nombre}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {item.procesando ? (
                            <span className="text-[9px] font-black text-orange-500 flex items-center gap-1">
                              <Loader2 size={10} className="animate-spin" /> BUSCANDO...
                            </span>
                          ) : (
                            <>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${getMatchingColor(pct)}`}>
                                {getMatchingIcon(pct)} {pct}% — {nivel === 'exacto' ? 'EXACTO' : nivel === 'parcial' ? 'PARCIAL' : 'BAJO'}
                              </span>
                              {mejor && (
                                <span className="text-[9px] font-bold text-slate-400">
                                  {mejor.tienda} · {mejor.precio_formateado}
                                </span>
                              )}
                              {seleccionManual.has(item.numero) && (
                                <span className="text-[9px] font-black text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                                  ✓ Selección manual
                                </span>
                              )}
                              {item.error && (
                                <span className="text-[9px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                  Error: {item.error}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {item.resultados.length > 0 && !item.procesando && (
                      <div className="text-[9px] text-slate-400 bg-white/60 px-3 py-1.5 rounded-full border border-slate-100">
                        💰 Mín: ${Math.min(...item.resultados.map(r => r.precio_valor || Infinity)).toLocaleString('es-CL')}
                        &nbsp;·&nbsp;
                        💰 Máx: ${Math.max(...item.resultados.map(r => r.precio_valor || 0)).toLocaleString('es-CL')}
                      </div>
                    )}
                  </div>

                  {/* Tabla de resultados */}
                  {!item.procesando && item.resultados.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50/50">
                          <tr className="text-[9px] uppercase text-slate-400 font-black tracking-widest">
                            <th className="px-3 py-3 w-10 text-center">Sel.</th>
                            <th className="px-4 py-3">#</th>
                            <th className="px-4 py-3">Tienda</th>
                            <th className="px-4 py-3">Producto encontrado</th>
                            <th className="px-4 py-3 text-right">Precio c/IVA</th>
                            <th className="px-4 py-3 text-right">Precio neto</th>
                            <th className="px-4 py-3 text-center">Match</th>
                            <th className="px-4 py-3 text-center">Link</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {item.resultados.slice(0, 15).map((r, ridx) => {
                            const isSelected = seleccionManual.get(item.numero) === r || (!seleccionManual.has(item.numero) && ridx === 0 && r === item.mejor_match);
                            const pctR = r.matching?.porcentaje ?? 0;
                            const precioNeto = Math.round((r.precio_valor || 0) / IVA);
                            return (
                              <tr key={ridx} className={`hover:bg-slate-50/80 transition-all ${isSelected ? 'bg-blue-50/30' : ''}`}>
                                <td className="px-3 py-3 text-center">
                                  <button
                                    onClick={() => toggleSeleccionManual(item.numero, r)}
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 hover:border-purple-400'}`}
                                  >
                                    {isSelected && <CheckCircle2 size={12} />}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-[10px] font-black text-slate-300">{String(ridx + 1).padStart(2, '0')}</td>
                                <td className="px-4 py-3">
                                  <span className="font-black text-slate-800 text-xs block">{r.tienda}</span>
                                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">{r.canal}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-xs font-medium text-slate-600 leading-tight max-w-sm line-clamp-2">{r.nombre}</p>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-sm font-black text-slate-900">{r.precio_formateado}</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-xs text-slate-500">${precioNeto.toLocaleString('es-CL')}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`text-[9px] font-black px-2 py-1 rounded-full ${getMatchingColor(pctR)}`}>
                                    {getMatchingIcon(pctR)} {pctR}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <a href={r.link} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all">
                                    <ExternalLink size={12} />
                                  </a>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {item.resultados.length > 15 && (
                        <div className="px-6 py-3 text-center text-[9px] text-slate-400 border-t">
                          + {item.resultados.length - 15} resultados adicionales
                        </div>
                      )}
                    </div>
                  )}

                  {!item.procesando && item.resultados.length === 0 && (
                    <div className="px-6 py-8 text-center">
                      <AlertCircle size={24} className="mx-auto text-red-300 mb-2" />
                      <p className="text-xs text-slate-400">No se encontraron resultados para este producto</p>
                      <p className="text-[9px] text-slate-300 mt-1">Intenta con términos más generales o agrega contexto</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
