// app/(dashboard)/buscador-productos/page.tsx
'use client';

import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Search, ExternalLink, Loader2, BarChart3,
  Trash2, ChevronRight, CheckCircle2, AlertCircle, X, Sparkles,
  Download, FileSpreadsheet, AlertTriangle, ShoppingBag,
  Upload, Eye, EyeOff, Zap, Tag, Ruler, Info, ChevronDown, ChevronUp
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

type NivelMatching = 'exacto' | 'alto' | 'parcial' | 'bajo' | 'nulo';

interface MatchingData {
  porcentaje: number;
  nivel: NivelMatching;
  razon: string;
  penalizaciones?: string[];
  bonificaciones?: string[];
}

interface ProductoResultado {
  tienda: string;
  nombre: string;
  precio_valor: number;
  precio_formateado: string;
  link: string;
  canal: string;
  busqueda_original: string;
  score?: number;
  nivel_concordancia?: string;
  medidas_encontradas?: string;
  specs_encontradas?: string[];
  palabras_comunes?: string[];
  palabras_faltantes?: string[];
  conflicto_medidas?: boolean;
  matching?: MatchingData;
  _descartado?: boolean;
}

interface AnalisisProducto {
  nombre_original: string;
  nombre_normalizado: string;
  categoria: string;
  palabras_clave: string[];
  medidas: {
    tiene_medidas: boolean;
    detalle: Record<string, unknown>;
    texto_legible: string;
  };
  especificaciones_tecnicas: string[];
  unidades_relevantes: string[];
  es_accesorio: boolean;
  marca_detectada: string | null;
  tipo_producto: {
    maquinaria_pesada: boolean;
    herramienta_electrica: boolean;
    material_construccion: boolean;
    articulo_pequeno: boolean;
    pintura_quimico: boolean;
    senaletica_vial: boolean;
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
  analisis_producto?: AnalisisProducto;
  calidad_resultados?: string;
  observacion_ia?: string;
  categoria?: string;
  tiempo_ms?: number;
  usado_ia?: boolean;
}

interface ProductoExcel {
  numero: number;
  nombre: string;
  cantidad: number;
  valor_civa: number;
  link_referencia: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE COLORES / ESTILO
// ─────────────────────────────────────────────────────────────────────────────

const matchColor = (pct: number) => {
  if (pct >= 90) return { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200', header: 'bg-emerald-50/60' };
  if (pct >= 70) return { bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500', border: 'border-sky-200', header: 'bg-sky-50/60' };
  if (pct >= 50) return { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200', header: 'bg-amber-50/60' };
  if (pct >= 25) return { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200', header: 'bg-orange-50/60' };
  return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', border: 'border-red-200', header: 'bg-red-50/60' };
};

const nivelLabel = (nivel: string) => {
  const map: Record<string, string> = {
    exacto: 'EXACTO', alto: 'ALTO', parcial: 'PARCIAL', bajo: 'BAJO', nulo: 'NULO'
  };
  return map[nivel] || nivel.toUpperCase();
};

const calidadConfig = (calidad: string) => {
  if (calidad === 'buena') return { label: 'Calidad buena', cls: 'bg-emerald-100 text-emerald-700' };
  if (calidad === 'media') return { label: 'Calidad media', cls: 'bg-amber-100 text-amber-700' };
  return { label: 'Calidad baja', cls: 'bg-red-100 text-red-700' };
};

const tipoProdLabel = (tp: AnalisisProducto['tipo_producto']) => {
  if (tp.maquinaria_pesada) return '🏗️ Maquinaria';
  if (tp.herramienta_electrica) return '🔧 Herramienta';
  if (tp.material_construccion) return '🧱 Material';
  if (tp.articulo_pequeno) return '🔩 Art. pequeño';
  if (tp.pintura_quimico) return '🎨 Pintura';
  if (tp.senaletica_vial) return '🚧 Señalética';
  return '📦 General';
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES
// ─────────────────────────────────────────────────────────────────────────────

const Toast = ({ message, type, onClose }: { message: string; type: string; onClose: () => void }) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl
    animate-in slide-in-from-right-8 duration-300
    ${type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800'
      : type === 'warning' ? 'bg-amber-50/95 border-amber-200 text-amber-800'
      : 'bg-red-50/95 border-red-200 text-red-800'}`}>
    {type === 'success' ? <CheckCircle2 size={16} /> : type === 'warning' ? <AlertTriangle size={16} /> : <AlertCircle size={16} />}
    <p className="text-[11px] font-black uppercase tracking-wider leading-none">{message}</p>
    <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 transition-opacity"><X size={13} /></button>
  </div>
);

const BadgeMatch = ({ pct, nivel }: { pct: number; nivel: string }) => {
  const c = matchColor(pct);
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {pct}% {nivelLabel(nivel)}
    </span>
  );
};

// Panel de análisis colapsable
const PanelAnalisis = ({ analisis, calidad, observacion, usadoIA }: {
  analisis?: AnalisisProducto;
  calidad?: string;
  observacion?: string;
  usadoIA?: boolean;
}) => {
  const [abierto, setAbierto] = useState(false);
  if (!analisis) return null;

  const cq = calidad ? calidadConfig(calidad) : null;

  return (
    <div className="border-t border-slate-100">
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between px-6 py-2.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Zap size={10} /> Análisis IA
          </span>
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
            {tipoProdLabel(analisis.tipo_producto)}
          </span>
          {cq && <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${cq.cls}`}>{cq.label}</span>}
          {usadoIA && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-600">DeepSeek</span>}
        </div>
        {abierto ? <ChevronUp size={13} className="text-slate-300" /> : <ChevronDown size={13} className="text-slate-300" />}
      </button>

      {abierto && (
        <div className="px-6 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {analisis.palabras_clave.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1 mb-1.5"><Tag size={8} /> Palabras clave</p>
              <div className="flex flex-wrap gap-1">
                {analisis.palabras_clave.slice(0, 6).map(p => (
                  <span key={p} className="text-[8px] bg-white border rounded px-1.5 py-0.5 text-slate-600">{p}</span>
                ))}
              </div>
            </div>
          )}
          {analisis.medidas.tiene_medidas && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1 mb-1.5"><Ruler size={8} /> Medidas</p>
              <p className="text-[9px] font-bold text-slate-700">{analisis.medidas.texto_legible}</p>
            </div>
          )}
          {analisis.especificaciones_tecnicas.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1 mb-1.5"><Info size={8} /> Specs</p>
              <div className="flex flex-wrap gap-1">
                {analisis.especificaciones_tecnicas.slice(0, 4).map(s => (
                  <span key={s} className="text-[8px] bg-white border rounded px-1.5 py-0.5 text-slate-600">{s}</span>
                ))}
              </div>
            </div>
          )}
          {observacion && (
            <div className="bg-violet-50 rounded-xl p-3">
              <p className="text-[8px] font-black text-violet-400 uppercase mb-1.5">Observación IA</p>
              <p className="text-[9px] text-violet-700 leading-relaxed">{observacion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Modal previsualización Excel
const ModalPrevisualizacion = ({ productos, onClose, onConfirm }: { productos: ProductoExcel[]; onClose: () => void; onConfirm: () => void }) => {
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
                    {['ITEM', 'DETALLE', 'CANTIDAD', 'VALOR C/IVA', 'LINK'].map(h => (
                      <th key={h} className={`px-4 py-3 text-[9px] font-black text-slate-400 uppercase ${h === 'CANTIDAD' || h === 'VALOR C/IVA' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productos.slice(0, 50).map((prod, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs font-bold text-slate-600">{prod.numero}</td>
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-md truncate">{prod.nombre}</td>
                      <td className="px-4 py-3 text-xs text-right text-slate-600">{prod.cantidad}</td>
                      <td className="px-4 py-3 text-xs text-right font-bold text-emerald-600">${prod.valor_civa?.toLocaleString('es-CL') || 0}</td>
                      <td className="px-4 py-3 text-[9px] text-blue-500 truncate max-w-[150px]">
                        {prod.link_referencia ? <a href={prod.link_referencia} target="_blank" rel="noopener noreferrer" className="hover:underline">Ver link</a> : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {productos.length > 50 && <p className="text-center text-[9px] text-slate-400 mt-4">+ {productos.length - 50} productos adicionales</p>}
            </div>
          )}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-5 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-xs font-black uppercase text-slate-400 hover:bg-slate-100 transition-all">Cancelar</button>
          <button onClick={onConfirm} className="px-8 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all flex items-center gap-2">
            <Sparkles size={14} /> Iniciar Búsqueda con IA
          </button>
        </div>
      </div>
    </div>
  );
};

const ModalExportacion = ({ onConfirm, onCancel, totalItems }: { onConfirm: () => void; onCancel: () => void; totalItems: number }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
      <div className="p-6 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><FileSpreadsheet size={32} className="text-blue-600" /></div>
        <h3 className="text-lg font-bold text-slate-800">Exportar Todos los Resultados</h3>
        <p className="text-sm text-slate-500 mt-2">Se exportarán <strong className="text-blue-600">{totalItems}</strong> productos con TODOS sus resultados y datos de matching IA.</p>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"><Download size={16} /> Exportar</button>
        </div>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function MonitorMasivoICA() {
  const [inputManual, setInputManual] = useState('');
  const [inputMasivo, setInputMasivo] = useState('');
  const [itemsLista, setItemsLista] = useState<ItemLista[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [buscandoUno, setBuscandoUno] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string }[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Excel
  const [productosExcel, setProductosExcel] = useState<ProductoExcel[]>([]);
  const [mostrarPrevisualizacion, setMostrarPrevisualizacion] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [pestanaSeleccionada, setPestanaSeleccionada] = useState('COSTEO');
  const [pestanasDisponibles, setPestanasDisponibles] = useState<string[]>([]);
  const [archivoExcel, setArchivoExcel] = useState<File | null>(null);

  // ── Toasts ─────────────────────────────────────────────────────────────────

  const notify = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  // ── Parseo lista manual ────────────────────────────────────────────────────

  const parsearLista = (texto: string) => {
    return texto.split('\n').filter(l => l.trim()).map((linea, i) => {
      const m = linea.match(/^(\d+)[\s\t]+(.+)/);
      return m ? { numero: m[1], nombre: m[2].trim() } : { numero: String(i + 1), nombre: linea.trim() };
    }).filter(x => x.nombre);
  };

  // ── Excel ──────────────────────────────────────────────────────────────────

  const cargarExcel = (file: File) => {
    setArchivoExcel(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      setPestanasDisponibles(workbook.SheetNames);
      let sheet = pestanaSeleccionada;
      if (!workbook.SheetNames.includes(sheet)) { sheet = workbook.SheetNames[0]; setPestanaSeleccionada(sheet); }
      procesarPestanaExcel(workbook, sheet);
    };
    reader.onerror = () => notify('Error al leer el archivo Excel', 'error');
    reader.readAsArrayBuffer(file);
  };

  const procesarPestanaExcel = (workbook: XLSX.WorkBook, sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    if (!jsonData.length) { notify(`La pestaña "${sheetName}" está vacía`, 'warning'); return; }

    let headerRowIndex = -1;
    const headers: string[] = [];
    for (let i = 0; i < Math.min(15, jsonData.length); i++) {
      const row = jsonData[i];
      if (row?.some((c: any) => ['ITEM', 'DETALLE', 'CANTIDAD'].some(k => String(c || '').toUpperCase().includes(k)))) {
        headerRowIndex = i;
        row.forEach((c: any, j: number) => { headers[j] = String(c || '').trim(); });
        break;
      }
    }
    if (headerRowIndex === -1) { notify('No se encontraron encabezados válidos', 'error'); return; }

    let colItem = -1, colDetalle = -1, colCantidad = -1, colValorCIVA = -1, colLink = -1;
    headers.forEach((h, i) => {
      const u = h.toUpperCase();
      if (u.includes('ITEM')) colItem = i;
      else if (u.includes('DETALLE')) colDetalle = i;
      else if (u.includes('CANTIDAD')) colCantidad = i;
      else if (u.includes('VALOR') && u.includes('IVA')) colValorCIVA = i;
      else if (u.includes('LINK')) colLink = i;
    });

    const items: ProductoExcel[] = [];
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row?.length) continue;
      const detalle = colDetalle >= 0 ? String(row[colDetalle] || '').trim() : '';
      if (!detalle || ['TOTAL', 'VERDADERO', 'COSTEADO'].some(k => detalle.toUpperCase().includes(k))) continue;

      let valorCIVA = 0;
      if (colValorCIVA >= 0 && row[colValorCIVA] != null && row[colValorCIVA] !== '') {
        const raw = row[colValorCIVA];
        valorCIVA = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[$. ]/g, '').replace(',', '.')) || 0;
      }

      items.push({
        numero: colItem >= 0 ? Number(row[colItem]) || i : i,
        nombre: detalle,
        cantidad: colCantidad >= 0 ? Number(row[colCantidad]) || 1 : 1,
        valor_civa: valorCIVA,
        link_referencia: colLink >= 0 ? String(row[colLink] || '').trim() : ''
      });
    }

    if (!items.length) { notify('No se encontraron productos válidos', 'error'); return; }
    setProductosExcel(items);
    setMostrarPrevisualizacion(true);
    setShowModal(true);
    notify(`✅ ${items.length} productos cargados desde "${sheetName}"`, 'success');
  };

  const cambiarPestana = (sheetName: string) => {
    setPestanaSeleccionada(sheetName);
    if (archivoExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        procesarPestanaExcel(XLSX.read(data, { type: 'array' }), sheetName);
      };
      reader.readAsArrayBuffer(archivoExcel);
    }
  };

  // ── Búsqueda con analizar-con-ia ──────────────────────────────────────────

  const buscarProducto = async (nombre: string, numero: string, minimo = 9): Promise<ItemLista> => {
    try {
      const res = await fetch('/api/analizar-con-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto: nombre, numero_item: numero, minimo_requerido: minimo })
      });

      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);

      const data = await res.json();

      // analizar-con-ia ya devuelve resultados reordenados + matching integrado
      // pero el matching.porcentaje puede no venir — lo inferimos del score_python si falta
      const resultados: ProductoResultado[] = (data.resultados || []).map((r: any) => ({
        ...r,
        matching: r.matching ?? {
          porcentaje: r.score ?? 50,
          nivel: r.nivel_concordancia === 'exacta' ? 'exacto'
            : r.nivel_concordancia === 'alta' ? 'alto'
            : r.nivel_concordancia === 'parcial' ? 'parcial'
            : r.nivel_concordancia === 'baja' ? 'bajo' : 'nulo',
          razon: r.conflicto_medidas ? 'Conflicto de medidas' : `Score Python: ${r.score ?? 0}`,
          penalizaciones: [],
          bonificaciones: []
        }
      }));

      const mejorMatch = resultados[0] || undefined;

      return {
        numero: data.numero_item || numero,
        nombre: data.producto || nombre,
        resultados,
        total_encontrados: resultados.length,
        suficientes: resultados.length >= minimo,
        deficit: Math.max(0, minimo - resultados.length),
        procesando: false,
        mejor_match: mejorMatch,
        analisis_producto: data.analisis_producto,
        calidad_resultados: data.calidad_resultados,
        observacion_ia: data.observacion_ia,
        categoria: data.categoria,
        tiempo_ms: data.tiempo_ms,
        usado_ia: !data.from_cache
      };
    } catch (err: any) {
      return {
        numero, nombre, resultados: [], total_encontrados: 0,
        suficientes: false, deficit: minimo, procesando: false, error: err.message
      };
    }
  };

  const buscarUno = async () => {
    if (!inputManual.trim() || buscandoUno) return;
    setBuscandoUno(true);
    const m = inputManual.trim().match(/^(\d+)\s+(.+)/);
    const numero = m ? m[1] : String(itemsLista.length + 1);
    const nombre = m ? m[2] : inputManual.trim();

    notify(`Buscando: ${nombre}`, 'success');
    const resultado = await buscarProducto(nombre, numero, 9);

    setItemsLista(prev => {
      const existe = prev.some(i => i.numero === resultado.numero);
      return existe ? prev.map(i => i.numero === resultado.numero ? resultado : i) : [...prev, resultado];
    });

    notify(
      resultado.suficientes ? `✅ ${nombre}: ${resultado.total_encontrados} resultados` : `⚠️ ${nombre}: Solo ${resultado.total_encontrados}/9`,
      resultado.suficientes ? 'success' : 'warning'
    );
    setInputManual('');
    setBuscandoUno(false);
  };

  const iniciarBarrido = async (productos: { numero: string; nombre: string }[]) => {
    if (!productos.length) { notify('No hay productos para buscar', 'error'); return; }

    setProcesando(true);
    setItemsLista([]);
    setProgreso({ actual: 0, total: productos.length });
    abortControllerRef.current = new AbortController();

    for (let i = 0; i < productos.length; i++) {
      if (abortControllerRef.current?.signal.aborted) break;
      const { numero, nombre } = productos[i];
      setProgreso({ actual: i + 1, total: productos.length });

      setItemsLista(prev => [...prev, {
        numero, nombre, resultados: [], total_encontrados: 0, suficientes: false, deficit: 9, procesando: true
      }]);

      const resultado = await buscarProducto(nombre, numero, 9);
      setItemsLista(prev => prev.map(p => p.numero === numero ? resultado : p));
      await new Promise(r => setTimeout(r, 600));
    }

    setProcesando(false);
    abortControllerRef.current = null;
    notify('Barrido completado ✅', 'success');
  };

  const iniciarBarridoManual = () => iniciarBarrido(parsearLista(inputMasivo));
  const iniciarBarridoExcel = () => iniciarBarrido(productosExcel.map(p => ({ numero: String(p.numero), nombre: p.nombre })));
  const cancelarBarrido = () => { abortControllerRef.current?.abort(); notify('Cancelando...', 'warning'); };

  // ── Exportaciones ─────────────────────────────────────────────────────────

  const exportarCSV = () => {
    const rows = ['ITEM;Producto Buscado;Mejor Match;Tienda;Precio;Link;Matching%;Nivel;Razón;Calidad'];
    itemsLista.forEach(item => {
      const mm = item.mejor_match;
      rows.push(mm
        ? `${item.numero};${item.nombre};${mm.nombre};${mm.tienda};${mm.precio_formateado};${mm.link};${mm.matching?.porcentaje}%;${mm.matching?.nivel};${mm.matching?.razon};${item.calidad_resultados || ''}`
        : `${item.numero};${item.nombre};SIN RESULTADOS;;;;;0%;nulo;;`
      );
    });
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.setAttribute('download', `mejor_match_${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
    URL.revokeObjectURL(a.href);
    notify('✅ CSV exportado (mejor match)', 'success');
  };

  const exportarExcel = () => {
    const exportData: any[] = [];
    itemsLista.forEach(item => {
      if (!item.resultados.length) {
        exportData.push({ ITEM: item.numero, BUSCADO: item.nombre, N_RESULTADO: 0, TIENDA: 'SIN RESULTADOS', ENCONTRADO: '', PRECIO: '', LINK: '', MATCH_PCT: '0%', NIVEL: 'nulo', RAZON: '', CALIDAD: '', CATEGORIA: '' });
      } else {
        item.resultados.forEach((r, idx) => {
          exportData.push({
            ITEM: item.numero, BUSCADO: item.nombre, N_RESULTADO: idx + 1,
            TIENDA: r.tienda, ENCONTRADO: r.nombre, PRECIO: r.precio_formateado,
            LINK: r.link, MATCH_PCT: `${r.matching?.porcentaje || 0}%`,
            NIVEL: r.matching?.nivel || '', RAZON: r.matching?.razon || '',
            CALIDAD: item.calidad_resultados || '', CATEGORIA: item.categoria || '',
            MEDIDAS: r.medidas_encontradas || '', CONFLICTO_MEDIDAS: r.conflicto_medidas ? 'SÍ' : 'NO',
            SCORE_PYTHON: r.score || 0
          });
        });
      }
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
    XLSX.writeFile(wb, `resultados_ia_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExportModal(false);
    notify('✅ Excel exportado con todos los resultados', 'success');
  };

  const limpiarLista = () => {
    if (!itemsLista.length) return;
    if (confirm('¿Eliminar todos los resultados?')) {
      setItemsLista([]); setProductosExcel([]); setMostrarPrevisualizacion(false);
      setShowModal(false); setArchivoExcel(null); setPestanasDisponibles([]);
      notify('Lista limpiada', 'error');
    }
  };

  // ── Estadísticas ───────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = itemsLista.length;
    const completos = itemsLista.filter(i => i.suficientes).length;
    const totalRes = itemsLista.reduce((s, i) => s + i.resultados.length, 0);
    const conMatch = itemsLista.filter(i => i.mejor_match?.matching?.porcentaje);
    const promMatch = conMatch.length
      ? Math.round(conMatch.reduce((s, i) => s + (i.mejor_match?.matching?.porcentaje || 0), 0) / conMatch.length)
      : 0;
    const exactos = itemsLista.filter(i => (i.mejor_match?.matching?.porcentaje || 0) >= 90).length;
    const altos = itemsLista.filter(i => { const p = i.mejor_match?.matching?.porcentaje || 0; return p >= 70 && p < 90; }).length;
    return { total, completos, totalRes, promMatch, exactos, altos };
  }, [itemsLista]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f7f8fc] font-sans">

      {/* Modales */}
      {showModal && productosExcel.length > 0 && (
        <ModalPrevisualizacion
          productos={productosExcel}
          onClose={() => setShowModal(false)}
          onConfirm={() => { setShowModal(false); iniciarBarridoExcel(); }}
        />
      )}
      {showExportModal && (
        <ModalExportacion totalItems={itemsLista.length} onConfirm={exportarExcel} onCancel={() => setShowExportModal(false)} />
      )}

      {/* Toasts */}
      <div className="fixed top-24 right-6 z-50 flex flex-col gap-2.5">
        {toasts.map(t => (
          <Toast key={t.id} {...t} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
        ))}
      </div>

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-8 py-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1500px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 text-white p-2.5 rounded-2xl shadow-xl"><BarChart3 size={22} /></div>
            <div>
              <h1 className="font-black text-xl tracking-tight text-slate-900">
                MONITOR <span className="text-orange-600">ICA</span>
                <span className="text-[9px] bg-violet-600 text-white px-2 py-0.5 rounded-full ml-2 align-middle">Reranking IA v2</span>
              </h1>
              <p className="text-[9px] text-slate-400">Análisis semántico · Reranking DeepSeek · Score por tipo de producto</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 md:w-96 flex items-center bg-slate-100/60 border border-slate-200 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-orange-500/20">
              <Search size={15} className="text-slate-400 shrink-0" />
              <input
                className="bg-transparent py-3 px-3 text-xs outline-none w-full font-bold text-slate-700 placeholder:text-slate-400"
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

            <button onClick={exportarCSV} disabled={!itemsLista.length}
              className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-2xl transition-all shadow-sm disabled:opacity-40"
              title="Exportar CSV (mejor match)"><Download size={18} /></button>

            <button onClick={() => setShowExportModal(true)} disabled={!itemsLista.length}
              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-2xl transition-all shadow-sm disabled:opacity-40"
              title="Exportar Excel (todos los resultados)"><FileSpreadsheet size={18} /></button>

            <button onClick={limpiarLista} disabled={!itemsLista.length}
              className="bg-white border border-slate-200 p-3 rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm disabled:opacity-40">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ── Sidebar ── */}
        <div className="lg:col-span-3">
          <div className="bg-white p-6 rounded-3xl border shadow-xl sticky top-32 space-y-4">
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 font-black text-[10px] uppercase text-slate-400">
                <div className={`w-2 h-2 rounded-full ${procesando ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`} />
                Barrido de Precios
              </label>
              {procesando && <button onClick={cancelarBarrido} className="text-[9px] font-black text-red-500 hover:text-red-700">Cancelar</button>}
            </div>

            {/* Cargar Excel */}
            <div>
              <button onClick={() => document.getElementById('excel-input')?.click()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all">
                <Upload size={14} /> Cargar Excel
              </button>
              <input id="excel-input" type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => e.target.files?.[0] && cargarExcel(e.target.files[0])} />
            </div>

            {/* Selector de pestañas */}
            {pestanasDisponibles.length > 1 && (
              <div className="p-3 bg-slate-50 rounded-xl">
                <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">📑 Pestaña</label>
                <select value={pestanaSeleccionada} onChange={e => cambiarPestana(e.target.value)}
                  className="w-full p-2 bg-white rounded-xl text-[10px] font-medium border">
                  {pestanasDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}

            {/* Previsualización resumida */}
            {mostrarPrevisualizacion && productosExcel.length > 0 && !showModal && (
              <div className="p-3 bg-slate-50 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-slate-500">📊 Excel cargado</span>
                  <span className="text-[8px] text-emerald-600">{productosExcel.length} productos</span>
                </div>
                <div className="max-h-28 overflow-y-auto text-[9px] space-y-0.5">
                  {productosExcel.slice(0, 5).map(p => <div key={p.numero} className="truncate text-slate-600">{p.numero}. {p.nombre.substring(0, 40)}</div>)}
                  {productosExcel.length > 5 && <div className="text-slate-400">+ {productosExcel.length - 5} más</div>}
                </div>
                <button onClick={() => setShowModal(true)} className="w-full mt-2 bg-indigo-600 text-white py-2 rounded-lg text-[9px] font-black flex items-center justify-center gap-1.5">
                  <Eye size={11} /> Ver detalles
                </button>
                <button onClick={iniciarBarridoExcel} disabled={procesando}
                  className="w-full mt-1.5 bg-orange-600 text-white py-2 rounded-lg text-[9px] font-black flex items-center justify-center gap-1.5 disabled:opacity-50">
                  <Sparkles size={11} /> Buscar desde Excel
                </button>
              </div>
            )}

            {/* Lista manual */}
            <textarea
              className="w-full h-52 bg-slate-50 border rounded-2xl p-4 text-[11px] font-mono text-slate-600 outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
              placeholder={"Pega tu lista:\n1\tLetrero de obra\n2\tMadera Pino 2\"x3\"\n3\tAnticorrosivo"}
              value={inputMasivo}
              onChange={e => setInputMasivo(e.target.value)}
              disabled={procesando}
            />

            <button onClick={iniciarBarridoManual} disabled={procesando || !inputMasivo.trim()}
              className="w-full bg-slate-900 hover:bg-orange-600 text-white py-4 rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-3 shadow-lg transition-all disabled:bg-slate-200 disabled:text-slate-400">
              {procesando
                ? <><Loader2 className="animate-spin" size={16} /><span>PROCESANDO {progreso.actual}/{progreso.total}</span></>
                : <><Sparkles size={15} /><span>Iniciar Barrido IA</span></>
              }
            </button>

            {/* Estadísticas */}
            {itemsLista.length > 0 && (
              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2.5 text-center">
                {[
                  { label: 'Items', value: stats.total, cls: '' },
                  { label: 'Resultados', value: stats.totalRes, cls: '' },
                  { label: 'Match prom.', value: `${stats.promMatch}%`, cls: 'bg-violet-50 text-violet-700' },
                  { label: 'Exactos ≥90%', value: stats.exactos, cls: 'bg-emerald-50 text-emerald-700' },
                ].map(s => (
                  <div key={s.label} className={`rounded-2xl p-3 ${s.cls || 'bg-slate-50'}`}>
                    <p className="text-[8px] text-slate-400 uppercase">{s.label}</p>
                    <p className="font-black text-lg">{s.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Resultados ── */}
        <div className="lg:col-span-9 space-y-5 pb-20">
          {itemsLista.length === 0 ? (
            <div className="h-[55vh] flex flex-col items-center justify-center text-center gap-5">
              <div className="bg-white p-10 rounded-3xl shadow-2xl border border-slate-100">
                <ShoppingBag size={64} strokeWidth={1} className="text-orange-400 opacity-20" />
              </div>
              <div>
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.4em] mb-1">Lista vacía</p>
                <p className="text-slate-300 text-xs">Carga un Excel o pega una lista con formato "1&Tab;Nombre del producto"</p>
              </div>
            </div>
          ) : (
            itemsLista.map((item, idx) => {
              const mm = item.mejor_match;
              const pct = mm?.matching?.porcentaje || 0;
              const nivel = mm?.matching?.nivel || 'nulo';
              const c = matchColor(pct);

              return (
                <div key={idx} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${c.border}`}>

                  {/* Cabecera del item */}
                  <div className={`px-6 py-4 border-b flex flex-wrap justify-between items-center gap-3 ${item.procesando ? 'bg-orange-50/40' : c.header}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm shrink-0 ${c.bg} ${c.text}`}>
                        {item.numero}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-sm text-slate-800 truncate max-w-lg">{item.nombre}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {item.procesando ? (
                            <span className="text-[9px] font-black text-orange-500 flex items-center gap-1">
                              <Loader2 size={10} className="animate-spin" /> ANALIZANDO CON IA...
                            </span>
                          ) : (
                            <>
                              <BadgeMatch pct={pct} nivel={nivel} />
                              {mm && <span className="text-[9px] text-slate-400 font-bold">{mm.tienda} · {mm.precio_formateado}</span>}
                              {mm?.matching?.razon && (
                                <span className="text-[9px] text-slate-300 italic truncate max-w-xs">{mm.matching.razon}</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.tiempo_ms && !item.procesando && (
                        <span className="text-[8px] text-slate-300">{item.tiempo_ms}ms</span>
                      )}
                      {item.resultados.length > 0 && !item.procesando && (
                        <div className="text-[9px] text-slate-500 bg-white/70 px-3 py-1 rounded-full font-bold border">
                          Mejor precio: {
                            (() => {
                              const min = Math.min(...item.resultados.map(r => r.precio_valor || Infinity));
                              return min !== Infinity ? `$${min.toLocaleString('es-CL')}` : 'N/D';
                            })()
                          }
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tabla de resultados */}
                  {!item.procesando && item.resultados.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50/60">
                          <tr className="text-[9px] uppercase text-slate-400 font-black tracking-widest">
                            <th className="px-5 py-3">#</th>
                            <th className="px-5 py-3">Tienda</th>
                            <th className="px-5 py-3">Producto</th>
                            <th className="px-5 py-3 text-right">Precio</th>
                            <th className="px-5 py-3 text-center">Score Python</th>
                            <th className="px-5 py-3 text-center">Match IA</th>
                            <th className="px-5 py-3 text-center">Link</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {item.resultados.slice(0, 12).map((r, ridx) => {
                            const mc = matchColor(r.matching?.porcentaje || 0);
                            const descartado = (r as any)._descartado;
                            return (
                              <tr key={ridx} className={`transition-all ${descartado ? 'opacity-40 bg-red-50/30' : 'hover:bg-slate-50/70'}`}>
                                <td className="px-5 py-3.5 text-[10px] font-black text-slate-300">{String(ridx + 1).padStart(2, '0')}</td>
                                <td className="px-5 py-3.5">
                                  <span className="font-black text-slate-800 text-xs block">{r.tienda}</span>
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase italic">{r.canal || 'WEB'}</span>
                                </td>
                                <td className="px-5 py-3.5 max-w-xs">
                                  <p className="text-xs text-slate-600 leading-snug line-clamp-2">{r.nombre}</p>
                                  {r.medidas_encontradas && (
                                    <span className={`text-[8px] mt-0.5 inline-block px-1 rounded ${r.conflicto_medidas ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                      📐 {r.medidas_encontradas}
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  <span className="text-sm font-black text-slate-900">{r.precio_formateado}</span>
                                </td>
                                <td className="px-5 py-3.5 text-center">
                                  {r.score != null && (
                                    <span className="text-[9px] font-bold text-slate-400">{r.score}</span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-center">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <BadgeMatch pct={r.matching?.porcentaje || 0} nivel={r.matching?.nivel || 'nulo'} />
                                    {r.matching?.razon && (
                                      <span className="text-[7px] text-slate-300 max-w-[120px] text-center leading-tight">{r.matching.razon}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-center">
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
                      {item.resultados.length > 12 && (
                        <div className="px-5 py-2.5 text-center text-[9px] text-slate-400 border-t">
                          + {item.resultados.length - 12} resultados adicionales
                        </div>
                      )}
                    </div>
                  )}

                  {/* Panel análisis IA (colapsable) */}
                  {!item.procesando && (
                    <PanelAnalisis
                      analisis={item.analisis_producto}
                      calidad={item.calidad_resultados}
                      observacion={item.observacion_ia}
                      usadoIA={item.usado_ia}
                    />
                  )}

                  {/* Sin resultados */}
                  {!item.procesando && item.resultados.length === 0 && (
                    <div className="px-6 py-8 text-center">
                      <AlertCircle size={24} className="mx-auto text-red-300 mb-2" />
                      <p className="text-xs text-slate-400">{item.error || 'No se encontraron resultados para este producto'}</p>
                      <p className="text-[9px] text-slate-300 mt-1">Verifica el nombre o intenta con términos más generales</p>
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