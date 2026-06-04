'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import {
  Search, ExternalLink, Loader2, BarChart3,
  Trash2, ChevronRight, CheckCircle2, AlertCircle, X,
  Download, FileSpreadsheet, ShoppingBag,
  Upload, Eye, Settings, ChevronDown, ChevronUp,
  TrendingDown, TrendingUp, Minus, RefreshCw, Sparkles,
  FileText, Zap
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ProductoResultado {
  tienda: string;
  nombre: string;
  precio_valor: number;
  precio_formateado: string;
  link: string;
  canal: string;
  score?: number;
  unidad_detectada?: string;
  alerta_unidad?: boolean;
  matching?: { porcentaje: number; nivel: string; razon: string };
}

type ModoOrden = 'match' | 'precio';

interface ItemLista {
  numero: string;
  nombre: string;
  conversion?: string;
  resultados: ProductoResultado[];
  total_encontrados: number;
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
  conversion: string;
  _fila?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) => v > 0 ? `$${v.toLocaleString('es-CL')}` : '—';

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

// ─── Sistema de Notificaciones ───────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
  leaving?: boolean;
}

const TOAST_CONFIG: Record<ToastType, {
  bg: string; border: string; text: string; bar: string;
  icon: React.ReactNode; label: string;
}> = {
  success: {
    bg: 'bg-gradient-to-r from-emerald-500 to-emerald-600',
    border: 'border-emerald-400/30',
    text: 'text-white',
    bar: 'bg-white/30',
    icon: <CheckCircle2 size={20} className="text-white" />,
    label: 'Éxito',
  },
  error: {
    bg: 'bg-gradient-to-r from-red-500 to-red-600',
    border: 'border-red-400/30',
    text: 'text-white',
    bar: 'bg-white/30',
    icon: <AlertCircle size={20} className="text-white" />,
    label: 'Error',
  },
  warning: {
    bg: 'bg-gradient-to-r from-amber-400 to-orange-500',
    border: 'border-amber-400/30',
    text: 'text-white',
    bar: 'bg-white/30',
    icon: <AlertCircle size={20} className="text-white" />,
    label: 'Aviso',
  },
  info: {
    bg: 'bg-gradient-to-r from-blue-500 to-blue-600',
    border: 'border-blue-400/30',
    text: 'text-white',
    bar: 'bg-white/30',
    icon: <Sparkles size={20} className="text-white" />,
    label: 'Info',
  },
};

const Toast = ({ item, onClose }: { item: ToastItem; onClose: () => void }) => {
  const cfg = TOAST_CONFIG[item.type];
  const dur = item.duration ?? 4500;

  return (
    <div
      className={`${item.leaving ? 'toast-leave' : 'toast-enter'} relative flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-2xl border ${cfg.bg} ${cfg.border} overflow-hidden w-[360px] max-w-[calc(100vw-2rem)] cursor-pointer select-none`}
      onClick={onClose}
      role="alert"
    >
      {/* Icono */}
      <div className="shrink-0 mt-0.5 p-1.5 rounded-xl bg-white/15">
        {cfg.icon}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${cfg.text} opacity-75 mb-0.5`}>
          {cfg.label}
        </p>
        <p className={`text-sm font-medium leading-snug ${cfg.text}`}>
          {item.message}
        </p>
      </div>

      {/* Botón cerrar */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className={`shrink-0 mt-0.5 p-1 rounded-lg bg-white/10 hover:bg-white/25 transition-colors ${cfg.text} opacity-70 hover:opacity-100`}
      >
        <X size={14} />
      </button>

      {/* Barra de progreso */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
        <div
          className={`h-full ${cfg.bar} toast-progress-bar`}
          style={{ animationDuration: `${dur}ms` }}
        />
      </div>
    </div>
  );
};

// Contenedor global de toasts (fuera del flujo del documento)
const ToastContainer = ({ toasts, onClose }: { toasts: ToastItem[]; onClose: (id: number) => void }) => (
  <div className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3 items-end pointer-events-none">
    {toasts.map((t) => (
      <div key={t.id} className="pointer-events-auto">
        <Toast item={t} onClose={() => onClose(t.id)} />
      </div>
    ))}
  </div>
);

// ─── Badge de match ───────────────────────────────────────────────────────────
const MatchBadge = ({ pct }: { pct: number }) => {
  const color = pct >= 85 ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : pct >= 60 ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-red-100 text-red-700 border-red-200';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {pct >= 85 ? '●' : pct >= 60 ? '◑' : '○'} {pct}%
    </span>
  );
};

// ─── Banner PDF animado (dentro del Modal Preview) ───────────────────────────
type EstadoPdf = 'idle' | 'cargando' | 'ok' | 'error';

const BannerPdf = ({ onCargarPdf, cargandoBases, basesOk }: {
  onCargarPdf: (f: File) => void;
  cargandoBases: boolean;
  basesOk: boolean;
}) => {
  const refInput = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);

  // Animación de entrada con delay para que el modal cargue primero
  useEffect(() => { const t = setTimeout(() => setVisible(true), 400); return () => clearTimeout(t); }, []);

  if (basesOk) {
    return (
      <div className="mx-5 mb-4 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-emerald-800">Bases cargadas — los nombres se buscarán con las especificaciones correctas</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">Gemini leyó el PDF y completó las descripciones de tus ítems</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mx-5 mb-4 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
    >
      <input
        ref={refInput}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onCargarPdf(f); e.target.value = ''; }}
      />
      <button
        onClick={() => !cargandoBases && refInput.current?.click()}
        disabled={cargandoBases}
        className={`w-full group relative overflow-hidden rounded-xl border-2 border-dashed px-4 py-3.5 text-left transition-all
          ${cargandoBases
            ? 'border-violet-300 bg-violet-50 cursor-wait'
            : 'border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 hover:border-violet-400 hover:from-violet-100 hover:to-indigo-100 cursor-pointer'
          }`}
      >
        {/* Pulso animado en el borde cuando está idle */}
        {!cargandoBases && (
          <span className="absolute inset-0 rounded-xl border-2 border-violet-400 opacity-0 group-hover:opacity-0 animate-[ping_2s_ease-in-out_infinite] pointer-events-none" style={{ animationDelay: '0.5s' }} />
        )}
        <div className="flex items-center gap-3">
          {cargandoBases ? (
            <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <Loader2 size={16} className="text-violet-600 animate-spin" />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-violet-100 group-hover:bg-violet-200 flex items-center justify-center shrink-0 transition-colors">
              <FileText size={16} className="text-violet-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {cargandoBases ? (
              <>
                <p className="text-xs font-semibold text-violet-800">Leyendo el PDF con Gemini...</p>
                <p className="text-[10px] text-violet-500 mt-0.5">Esto puede tardar hasta 30 segundos</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-violet-800">¿Tienes las bases de licitación en PDF?</p>
                  <span className="text-[9px] px-1.5 py-0.5 bg-violet-200 text-violet-700 rounded-full font-bold uppercase tracking-wide">Recomendado</span>
                </div>
                <p className="text-[10px] text-violet-600 mt-0.5">
                  Gemini lee el PDF y corrige los nombres mal escritos en tu Excel — mejora la precisión de búsqueda
                </p>
              </>
            )}
          </div>
          {!cargandoBases && (
            <div className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 shrink-0">
              <Zap size={11} />
              Cargar PDF
            </div>
          )}
        </div>
        {cargandoBases && (
          <div className="mt-2.5 h-1 rounded-full bg-violet-100 overflow-hidden">
            <div className="h-full bg-violet-400 rounded-full animate-[progress_2s_ease-in-out_infinite]"
              style={{ animation: 'pulse 1.5s ease-in-out infinite alternate', width: '60%' }} />
          </div>
        )}
      </button>
    </div>
  );
};

// ─── Modal Preview Excel ──────────────────────────────────────────────────────
const ModalPreview = ({ productos, onClose, onConfirm, onCargarPdf, cargandoBases, basesOk }: {
  productos: ProductoExcel[];
  onClose: () => void;
  onConfirm: () => void;
  onCargarPdf: (f: File) => void;
  cargandoBases: boolean;
  basesOk: boolean;
}) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
      <div className="flex justify-between items-center p-5 border-b">
        <div>
          <h2 className="font-bold text-slate-800 text-base">Vista previa — Excel COSTEO</h2>
          <p className="text-xs text-slate-400 mt-0.5">{productos.length} productos detectados</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
      </div>

      {/* Banner PDF animado */}
      <div className="pt-4">
        <BannerPdf onCargarPdf={onCargarPdf} cargandoBases={cargandoBases} basesOk={basesOk} />
      </div>

      <div className="overflow-auto flex-1 px-5 pb-2">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="pb-2 pr-4 font-semibold">ITEM</th>
              <th className="pb-2 pr-4 font-semibold">DETALLE</th>
              <th className="pb-2 pr-4 font-semibold text-center">CONV.</th>
              <th className="pb-2 pr-4 font-semibold text-right">CANT.</th>
              <th className="pb-2 font-semibold text-right">VALOR C/IVA</th>
            </tr>
          </thead>
          <tbody>
            {productos.slice(0, 60).map((p, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-2 pr-4 text-slate-500 text-xs">{p.numero}</td>
                <td className="py-2 pr-4 text-slate-800 font-medium max-w-xs truncate">{p.nombre}</td>
                <td className="py-2 pr-4 text-center">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    !p.conversion || p.conversion === 'unidad' ? 'bg-slate-100 text-slate-400' : 'bg-[#D1FAE5]/50 text-[#059669] border border-[#059669]/20'
                  }`}>{p.conversion || 'un'}</span>
                </td>
                <td className="py-2 pr-4 text-right text-slate-600 text-xs">{p.cantidad}</td>
                <td className="py-2 text-right font-semibold text-emerald-600 text-xs">
                  {p.valor_civa > 0 ? fmt(p.valor_civa) : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {productos.length > 60 && <p className="text-center text-xs text-slate-400 mt-3">+ {productos.length - 60} más</p>}
      </div>
      <div className="flex justify-between items-center gap-3 p-5 border-t">
        <p className="text-[10px] text-slate-400">
          {basesOk ? '✅ Búsqueda con corrección de nombres activada' : 'Carga el PDF para mayor precisión en los resultados'}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="px-6 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
            <Search size={15} /> Iniciar búsqueda ({productos.length})
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Modal: revisar ítems extraídos de las BASES (Gemini) ─────────────────────
const ModalBases = ({ items, onClose }: {
  items: Array<{ item: string; nombre: string; especificaciones: string; cantidad: string; unidad: string; _excel?: string }>;
  onClose: () => void;
}) => {
  const enlazados = items.filter(i => i._excel).length;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b">
          <div>
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Sparkles size={16} className="text-violet-600" /> Cómo se buscará cada ítem
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{items.length} ítems · {enlazados} completados con specs de las bases (verde)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
        </div>
        <div className="overflow-auto flex-1 p-5">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="pb-2 pr-3 font-semibold">Ítem</th>
                <th className="pb-2 pr-3 font-semibold">En tu Excel</th>
                <th className="pb-2 pr-3 font-semibold">Se buscará (mejorado por IA)</th>
                <th className="pb-2 font-semibold">Specs agregadas</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className={`border-b border-slate-50 ${it._excel ? 'bg-emerald-50/40' : ''}`}>
                  <td className="py-2 pr-3 text-slate-500 text-xs align-top">{it.item}</td>
                  <td className="py-2 pr-3 text-slate-500 text-xs max-w-[200px] align-top">{it.nombre}</td>
                  <td className="py-2 pr-3 text-slate-800 text-xs font-medium max-w-sm align-top">{it.especificaciones}</td>
                  <td className="py-2 text-xs align-top">
                    {it.cantidad
                      ? <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">+ {it.cantidad}</span>
                      : <span className="text-slate-300">ya estaba completo</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button onClick={onClose} className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition-colors">Entendido</button>
        </div>
      </div>
    </div>
  );
};

const IVA = 1.19;

export default function MonitorMasivoICA() {
  const [inputManual, setInputManual]   = useState('');
  const [inputMasivo, setInputMasivo]   = useState('');
  const [itemsLista, setItemsLista]     = useState<ItemLista[]>([]);
  const [procesando, setProcesando]     = useState(false);
  const [buscandoUno, setBuscandoUno]   = useState(false);
  const [progreso, setProgreso]         = useState({ actual: 0, total: 0 });
  const [toasts, setToasts]             = useState<ToastItem[]>([]);
  const abortRef = useRef(false);

  const [productosExcel, setProductosExcel]   = useState<ProductoExcel[]>([]);
  const [especPorItem, setEspecPorItem]       = useState<Map<string, string>>(new Map());
  const [cargandoBases, setCargandoBases]     = useState(false);
  const [basesInfo, setBasesInfo]             = useState<{ total: number } | null>(null);
  const [basesItems, setBasesItems]           = useState<Array<{ item: string; nombre: string; especificaciones: string; cantidad: string; unidad: string; _excel?: string }>>([]);
  const [showBasesModal, setShowBasesModal]   = useState(false);
  const [preguntarBases, setPreguntarBases]   = useState(false);
  const [sheetNameActual, setSheetNameActual] = useState('COSTEO');
  const [showModal, setShowModal]             = useState(false);
  const [pestanas, setPestanas]               = useState<string[]>([]);
  const [archivoExcel, setArchivoExcel]       = useState<File | null>(null);
  const [workbook, setWorkbook]               = useState<XLSX.WorkBook | null>(null);

  const [contexto, setContexto]         = useState('');
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [seleccion, setSeleccion]       = useState<Map<string, ProductoResultado>>(new Map());
  const [ordenItem, setOrdenItem]       = useState<Map<string, ModoOrden>>(new Map());
  const [menuDescarga, setMenuDescarga] = useState(false);

  // Ordena los resultados de un item según el modo elegido (match o precio)
  const resultadosOrdenados = useCallback((item: ItemLista): ProductoResultado[] => {
    const modo = ordenItem.get(item.numero) || 'match';
    const arr = [...item.resultados];
    if (modo === 'precio') {
      arr.sort((a, b) => (a.precio_valor || Infinity) - (b.precio_valor || Infinity));
    } else {
      arr.sort((a, b) => (b.matching?.porcentaje ?? 0) - (a.matching?.porcentaje ?? 0));
    }
    return arr;
  }, [ordenItem]);

  // ─── Notify ──────────────────────────────────────────────────────────────────
  const closeToast = useCallback((id: number) => {
    // Marcar como "saliendo" para activar animación de salida
    setToasts(p => p.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 370);
  }, []);

  const notify = useCallback((message: string, type: ToastType = 'success', duration = 4500) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p.slice(-4), { id, message, type, duration }]); // máx 5 toasts
    setTimeout(() => closeToast(id), duration);
  }, [closeToast]);

  // ─── Parsear lista texto ──────────────────────────────────────────────────────
  const parsearLista = (texto: string) =>
    texto.split('\n').filter(l => l.trim()).reduce<{ numero: string; nombre: string }[]>((acc, l) => {
      const m = l.match(/^(\d+)[\s\t]+(.+)/);
      if (m) acc.push({ numero: m[1], nombre: m[2].trim() });
      else if (!l.trim().match(/^\d+$/)) acc.push({ numero: String(acc.length + 1), nombre: l.trim() });
      return acc;
    }, []);

  // ─── Cargar BASES (PDF) → Gemini extrae specs → match con ítems del Excel ─────
  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const cargarBases = async (file: File) => {
    if (cargandoBases) return;
    setCargandoBases(true);
    setBasesInfo(null);
    notify('Subiendo bases y leyendo con IA (puede tardar ~30s)...', 'success');
    try {
      // 1) URL firmada de subida
      const urlRes = await fetch('/api/bases-upload-url', { method: 'POST' });
      const u = await urlRes.json();
      if (!urlRes.ok || !u.token) throw new Error(u.error || 'No se pudo preparar la subida');

      // 2) Subir el PDF directo a Supabase Storage (sin límite de Vercel)
      const { error: upErr } = await supabase.storage.from(u.bucket).uploadToSignedUrl(u.path, u.token, file);
      if (upErr) throw new Error(`Error subiendo PDF: ${upErr.message}`);

      // 3) Gemini lee el PDF + los ítems del Excel y COMPLETA lo que falta a cada uno
      const itemsExcelPayload = productosExcel.map(pe => ({ numero: String(pe.numero), detalle: pe.nombre }));
      const leerRes = await fetch('/api/leer-bases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: u.bucket, path: u.path, itemsExcel: itemsExcelPayload }),
      });
      const data = await leerRes.json();
      if (!leerRes.ok || !data.ok) throw new Error(data.error || 'No se pudo leer el PDF');

      const itemsBases = data.items || [];
      const enriquecidos: Array<{ numero: string; busqueda: string; agregado: string }> = data.enriquecidos || [];

      // 4) Construir el mapa numero → búsqueda mejorada (lo que se usará al cotizar)
      const mapa = new Map<string, string>();
      const detalleOriginal = new Map(productosExcel.map(pe => [String(pe.numero), pe.nombre]));
      const filasModal = enriquecidos
        .filter(e => e.busqueda)
        .map(e => {
          mapa.set(e.numero, e.busqueda);
          return {
            item: e.numero,
            nombre: detalleOriginal.get(e.numero) || '',
            especificaciones: e.busqueda,        // búsqueda mejorada
            cantidad: e.agregado || '',          // qué se completó
            unidad: '',
            _excel: e.agregado ? e.numero : undefined, // verde si se completó algo
          };
        });

      setEspecPorItem(mapa);
      setBasesItems(filasModal.length ? filasModal : itemsBases);
      setBasesInfo({ total: itemsBases.length });
      setShowBasesModal(true);
      const completados = enriquecidos.filter(e => e.agregado).length;
      notify(`Bases leídas: ${itemsBases.length} ítems · ${completados} ítems completados con specs`, 'success');
    } catch (e: any) {
      notify(`Error con las bases: ${e.message}`, 'error');
    } finally {
      setCargandoBases(false);
    }
  };

  // ─── Cargar Excel ─────────────────────────────────────────────────────────────
  const cargarExcel = (file: File) => {
    setArchivoExcel(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      setWorkbook(wb);
      setPestanas(wb.SheetNames);
      const sheet = wb.SheetNames.includes('COSTEO') ? 'COSTEO' : wb.SheetNames[0];
      setSheetNameActual(sheet);
      procesarPestana(wb, sheet);
    };
    reader.onerror = () => notify('Error al leer el archivo Excel', 'error');
    reader.readAsArrayBuffer(file);
  };

  const procesarPestana = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
    if (!jsonData.length) { notify('Pestaña vacía', 'warning'); return; }

    let headerRow = -1;
    let colItem = -1, colDetalle = -1, colCantidad = -1, colValor = -1, colLink = -1, colConversion = -1;

    for (let i = 0; i < Math.min(20, jsonData.length); i++) {
      const row = jsonData[i];
      if (!row) continue;
      if (row.some((c: any) => ['ITEM','DETALLE','CANTIDAD'].includes(String(c||'').toUpperCase().trim()))) {
        headerRow = i;
        row.forEach((c: any, j: number) => {
          const h = String(c||'').toUpperCase().trim();
          if (h === 'ITEM' || h.includes('ITEM')) colItem = j;
          else if (h.includes('DETALLE')) colDetalle = j;
          else if (h.includes('CANTIDAD')) colCantidad = j;
          else if (h.includes('VALOR') && h.includes('IVA')) colValor = j;
          else if (h.includes('CONVERSION')) colConversion = j;
          else if (h.includes('LINK')) colLink = j;
        });
        console.log(`📌 Headers fila ${i+1} | ITEM:${colItem} DETALLE:${colDetalle} CANT:${colCantidad} VALOR:${colValor} CONV:${colConversion}`);
        break;
      }
    }

    if (headerRow === -1) { notify('No se encontraron encabezados en el Excel', 'error'); return; }

    const items: ProductoExcel[] = [];
    for (let i = headerRow + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || !row.length) continue;
      const detalle = colDetalle >= 0 ? String(row[colDetalle]||'').trim() : '';
      if (!detalle || ['TOTAL','VERDADERO','COSTEADO','SUBTOTAL'].some(s => detalle.toUpperCase().includes(s))) continue;
      const conversion = colConversion >= 0 ? String(row[colConversion]||'').trim().toLowerCase() : 'unidad';
      let valorCIVA = 0;
      if (colValor >= 0 && row[colValor] != null) {
        const raw = row[colValor];
        valorCIVA = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[$\.]/g,'').replace(',','.')) || 0;
      }
      items.push({
        numero: colItem >= 0 ? Number(row[colItem]) : i - headerRow,
        nombre: detalle,
        cantidad: colCantidad >= 0 ? Number(row[colCantidad])||1 : 1,
        valor_civa: valorCIVA,
        link_referencia: colLink >= 0 ? String(row[colLink]||'').trim() : '',
        conversion: conversion || 'unidad',
        _fila: i,
      });
    }

    if (!items.length) { notify('No se encontraron productos', 'error'); return; }
    console.log(`✅ ${items.length} productos cargados`);
    setProductosExcel(items);
    setShowModal(true);
    if (!basesInfo) setPreguntarBases(true); // ofrecer reforzar con el PDF de bases
    notify(`${items.length} productos desde "${sheetName}"`, 'success');
  };

  const cambiarPestana = (s: string) => {
    setSheetNameActual(s);
    if (workbook) procesarPestana(workbook, s);
  };

  // ─── Búsqueda un producto ─────────────────────────────────────────────────────
  const buscarProducto = async (
    producto: string,
    numero: string,
    conversion = 'unidad'
  ): Promise<ItemLista> => {
    try {
      // Si Gemini generó una búsqueda mejorada para este ítem (con las bases), usarla
      const mejorada = especPorItem.get(String(numero));
      const productoBuscar = mejorada ? mejorada.slice(0, 200) : producto;

      // El backend hace la expansión inteligente con IA (términos vagos → variantes)
      // usando el contexto del rubro. Pasamos el producto + specs de bases + contexto.
      const ctxParam = contexto.trim() ? `&contexto=${encodeURIComponent(contexto.trim())}` : '';
      const url = `/api/buscar-productos?producto=${encodeURIComponent(productoBuscar)}&numero=${encodeURIComponent(numero)}&minimo=15&conversion=${encodeURIComponent(conversion)}${ctxParam}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw = data.resultados || [];
      console.log(`📊 [${numero}] Python: ${raw.length} resultados`);

      // Reranking IA con entidades detectadas (mejora precisión cuando hay marca/modelo/SKU)
      let final = raw;
      if (raw.length > 3) {
        try {
          const ir = await fetch('/api/analizar-con-ia', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              producto,
              numero_item: numero,
              minimo_requerido: 15,
              resultados_raw: raw,
              analisis_producto: data.analisis_producto,
              entidades_detectadas: data.entidades_detectadas || null,
            }),
          });
          if (ir.ok) {
            const id = await ir.json();
            if (id.success && id.resultados?.length > 0) final = id.resultados;
          }
        } catch { /* usar orden del búsqueda */ }
      }

      const resultados: ProductoResultado[] = final.map((r: any) => {
        // Usar confianza_ia si disponible, sino score base
        const pct = r.confianza_ia ?? r.score ?? r.porcentaje ?? r.matching?.porcentaje ?? 0;
        return {
          tienda: r.tienda || '',
          nombre: r.nombre || '',
          precio_valor: r.precio_valor ?? r.precio_con_iva ?? 0,
          precio_formateado: r.precio_formateado || fmt(r.precio_valor ?? r.precio_con_iva ?? 0),
          link: r.link || r.url || '',
          canal: r.canal || r.fuente || 'web',
          score: pct,
          unidad_detectada: r.unidad_detectada || '',
          alerta_unidad: !!r.alerta_unidad,
          matching: {
            porcentaje: pct,
            nivel: pct >= 85 ? 'exacto' : pct >= 60 ? 'parcial' : 'bajo',
            razon: r.motivo_ia || r.etiqueta_concordancia || '',
          },
        };
      }).sort((a: any, b: any) => (b.matching?.porcentaje ?? 0) - (a.matching?.porcentaje ?? 0));

      return {
        numero: String(data.numero_item || numero),
        nombre: String(data.producto || producto),
        conversion,
        resultados,
        total_encontrados: resultados.length,
        procesando: false,
        mejor_match: resultados[0],
      };
    } catch (err: any) {
      return { numero, nombre: producto, conversion, resultados: [], total_encontrados: 0, procesando: false, error: err.message };
    }
  };

  // ─── Búsqueda individual ──────────────────────────────────────────────────────
  const buscarUno = async () => {
    if (!inputManual.trim() || buscandoUno) return;
    setBuscandoUno(true);
    const m = inputManual.trim().match(/^(\d+)\s+(.+)/);
    const numero = m ? m[1] : String(itemsLista.length + 1);
    const nombre = m ? m[2] : inputManual.trim();
    const r = await buscarProducto(nombre, numero);
    setItemsLista(prev => {
      const existe = prev.some(i => i.numero === r.numero);
      return existe ? prev.map(i => i.numero === r.numero ? r : i) : [...prev, r];
    });
    if (r.resultados.length > 0) notify(`${r.total_encontrados} resultados para "${nombre}"`, 'success');
    else notify(`Sin resultados para "${nombre}"`, 'warning');
    setBuscandoUno(false);
    setInputManual('');
  };

  // ─── Barrido masivo ───────────────────────────────────────────────────────────
  const iniciarBarrido = async (items: { numero: string; nombre: string; conversion?: string }[]) => {
    if (!items.length) { notify('No hay productos', 'error'); return; }
    setProcesando(true);
    abortRef.current = false;
    setItemsLista(items.map(i => ({ numero: i.numero, nombre: i.nombre, conversion: i.conversion||'', resultados: [], total_encontrados: 0, procesando: true })));
    setProgreso({ actual: 0, total: items.length });

    const sem = crearSemaforo(3);
    let done = 0;
    await Promise.all(items.map(item =>
      sem(async () => {
        if (abortRef.current) return;
        const r = await buscarProducto(item.nombre, item.numero, item.conversion || 'unidad');
        done++;
        setProgreso({ actual: done, total: items.length });
        setItemsLista(prev => prev.map(p => p.numero === item.numero ? r : p));
      })
    ));
    setProcesando(false);
    notify(`Barrido completado: ${done} productos`, 'success');
  };

  const iniciarExcel = () => { setShowModal(false); iniciarBarrido(productosExcel.map(p => ({ numero: String(p.numero), nombre: p.nombre, conversion: p.conversion }))); };
  const iniciarTexto = () => iniciarBarrido(parsearLista(inputMasivo));
  const cancelar = () => { abortRef.current = true; notify('Cancelando barrido...', 'warning'); };

  // ─── Selección de resultado por modo ──────────────────────────────────────────
  const elegirPorModo = (item: ItemLista, modo: string): ProductoResultado | undefined => {
    const res = item.resultados;
    if (!res.length) return undefined;
    if (modo === 'manual') {
      return seleccion.get(item.numero) || item.mejor_match;
    }
    if (modo === 'menor_precio') {
      return [...res].filter(r => r.precio_valor > 0)
        .sort((a, b) => a.precio_valor - b.precio_valor)[0];
    }
    if (modo === 'equilibrado') {
      // Excluir alertas de unidad y outliers de precio (> 2x la mediana)
      const precios = res.map(r => r.precio_valor).filter(p => p > 0).sort((a, b) => a - b);
      const mediana = precios[Math.floor(precios.length / 2)] || 0;
      const candidatos = res.filter(r =>
        r.precio_valor > 0 && !r.alerta_unidad &&
        (mediana === 0 || r.precio_valor <= mediana * 2)
      );
      const pool = candidatos.length ? candidatos : res;
      return [...pool].sort((a, b) => (b.matching?.porcentaje ?? 0) - (a.matching?.porcentaje ?? 0))[0];
    }
    // mejor_match (default)
    return [...res].sort((a, b) => (b.matching?.porcentaje ?? 0) - (a.matching?.porcentaje ?? 0))[0];
  };

  // ─── Exportar MISMO Excel — 100% en el navegador (SheetJS), sin servidor ──────
  const exportarMismoExcel = async (modo: string = 'manual') => {
    if (!archivoExcel) { notify('Carga un Excel primero', 'warning'); return; }
    setMenuDescarga(false);
    const seleccionados = itemsLista.flatMap(item => {
      const sel = elegirPorModo(item, modo);
      if (!sel?.precio_valor) return [];
      return [{ numero: String(item.numero), precio: sel.precio_valor, link: sel.link || '', tienda: sel.tienda || '', match: sel.matching?.porcentaje ?? 0 }];
    });
    if (!seleccionados.length) { notify('Sin resultados para exportar', 'warning'); return; }
    const nombreModo: Record<string, string> = { manual: 'seleccion', mejor_match: 'mejor-match', menor_precio: 'menor-precio', equilibrado: 'equilibrado' };
    notify(`Generando Excel (${nombreModo[modo] || modo})...`, 'success');

    try {
      // ExcelJS corre en el servidor para preservar colores, fórmulas y estilos del COSTEO original
      const fd = new FormData();
      fd.append('file', archivoExcel, archivoExcel.name);
      fd.append('sheetName', sheetNameActual);
      fd.append('seleccionados', JSON.stringify(seleccionados));
      fd.append('modo', modo);

      const res = await fetch('/api/exportar-excel', { method: 'POST', body: fd });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        notify(`Error: ${err.error || 'No se pudo generar el Excel'}`, 'error');
        return;
      }

      const filled = res.headers.get('X-Filled') || '?';
      const blob = await res.blob();
      const filename = `COSTEO_${nombreModo[modo] || modo}_${new Date().toISOString().split('T')[0]}.xlsx`;
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: filename,
      });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      notify(`${filled} ítems exportados (${nombreModo[modo] || modo}) — colores y fórmulas intactos`, 'success');
    } catch (e: any) {
      notify(`Error generando Excel: ${e.message}`, 'error');
    }
  };

  // helper: descarga un workbook XLSX como blob sin usar writeFile (evita error de fs en Next.js)
  const descargarXlsx = (wb: import('xlsx').WorkBook, filename: string) => {
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── Exportar MEJOR resultado ─────────────────────────────────────────────────
  const exportarMejor = () => {
    try {
      const rows = itemsLista.map(item => {
        const orig = productosExcel.find(p => String(p.numero) === item.numero);
        const mejor = seleccion.get(item.numero) || item.mejor_match;
        const precio = mejor?.precio_valor || 0;
        const neto = Math.round(precio / IVA);
        return {
          ITEM: item.numero, DETALLE: item.nombre, CANTIDAD: orig?.cantidad||1,
          'VALOR REF C/IVA': orig?.valor_civa||0, 'PRECIO WEB C/IVA': precio,
          'COSTO NETO UNIT': neto, 'COSTO NETO TOTAL': Math.round(neto*(orig?.cantidad||1)),
          TIENDA: mejor?.tienda||'Sin resultados', '% MATCH': `${mejor?.matching?.porcentaje??0}%`,
          LINK: mejor?.link||'',
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [8,45,10,16,18,18,18,25,10,55].map(w => ({ wch: w }));
      const wb2 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb2, ws, 'Mejor_Resultado');
      descargarXlsx(wb2, `mejor_${new Date().toISOString().split('T')[0]}.xlsx`);
      notify('Excel exportado', 'success');
    } catch (e: any) {
      notify(`Error exportando: ${e.message}`, 'error');
    }
  };

  // ─── Exportar TODOS ───────────────────────────────────────────────────────────
  const exportarTodos = () => {
    try {
      const rows: any[] = [];
      itemsLista.forEach(item => {
        if (!item.resultados.length) {
          rows.push({ ITEM: item.numero, PRODUCTO: item.nombre, '#': 0, TIENDA: 'SIN RESULTADOS', ENCONTRADO: '', PRECIO: '', LINK: '', MATCH: '0%' });
        } else {
          item.resultados.forEach((r, i) => rows.push({ ITEM: item.numero, PRODUCTO: item.nombre, '#': i+1, TIENDA: r.tienda, ENCONTRADO: r.nombre, PRECIO: fmt(r.precio_valor), LINK: r.link, MATCH: `${r.matching?.porcentaje??0}%` }));
        }
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb2 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb2, ws, 'Todos');
      descargarXlsx(wb2, `todos_${new Date().toISOString().split('T')[0]}.xlsx`);
      notify('Excel exportado', 'success');
    } catch (e: any) {
      notify(`Error exportando: ${e.message}`, 'error');
    }
  };

  const limpiar = () => {
    if (itemsLista.length && confirm('¿Limpiar todos los resultados?')) {
      setItemsLista([]); setProductosExcel([]); setWorkbook(null);
      setShowModal(false); setArchivoExcel(null); setPestanas([]); setSeleccion(new Map());
    }
  };

  const getRef = (num: string) => productosExcel.find(p => String(p.numero) === num)?.valor_civa || 0;

  const stats = useMemo(() => {
    const total = itemsLista.length;
    const con = itemsLista.filter(i => i.resultados.length > 0).length;
    const sin = itemsLista.filter(i => !i.procesando && !i.resultados.length).length;
    const pcts = itemsLista.flatMap(i => i.mejor_match?.matching?.porcentaje ? [i.mejor_match.matching.porcentaje] : []);
    const avgPct = pcts.length ? Math.round(pcts.reduce((a,b)=>a+b,0)/pcts.length) : 0;
    let ahorro = 0;
    itemsLista.forEach(item => {
      const mejor = seleccion.get(item.numero) || item.mejor_match;
      const ref = getRef(item.numero);
      if (mejor && ref > 0) {
        const qty = productosExcel.find(p => String(p.numero) === item.numero)?.cantidad || 1;
        ahorro += (ref - (mejor.precio_valor||0)) * qty;
      }
    });
    return { total, con, sin, avgPct, ahorro };
  }, [itemsLista, seleccion, productosExcel]);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {showModal && productosExcel.length > 0 && (
        <ModalPreview
          productos={productosExcel}
          onClose={() => setShowModal(false)}
          onConfirm={iniciarExcel}
          onCargarPdf={cargarBases}
          cargandoBases={cargandoBases}
          basesOk={!!basesInfo}
        />
      )}
      {showBasesModal && basesItems.length > 0 && (
        <ModalBases items={basesItems} onClose={() => setShowBasesModal(false)} />
      )}

      {/* Toasts */}
      <ToastContainer toasts={toasts} onClose={closeToast} />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#111827] p-2 rounded-lg"><BarChart3 size={20} className="text-white" /></div>
            <div>
              <h1 className="font-bold text-slate-900 text-base leading-tight">
                MONITOR <span className="text-[#059669]">ICA</span>
                <span className="ml-2 text-[9px] bg-[#059669] text-white px-1.5 py-0.5 rounded font-bold">IA + Scrapers</span>
              </h1>
              <p className="text-[10px] text-slate-400">Sodimac · Easy · Construmart · Imperial · MercadoLibre</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Búsqueda rápida */}
            <div className="flex items-center border border-slate-200 rounded-lg px-3 gap-2 focus-within:ring-2 focus-within:ring-[#059669]/25 bg-white">
              <Search size={14} className="text-slate-400" />
              <input
                className="py-2.5 text-sm outline-none w-64 bg-transparent placeholder:text-slate-400 text-slate-700"
                placeholder="Buscar producto... (ej: Anticorrosivo)"
                value={inputManual}
                onChange={e => setInputManual(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarUno()}
              />
              <button onClick={buscarUno} disabled={buscandoUno || !inputManual.trim()}
                className="bg-slate-900 text-white px-2 py-1 rounded text-xs disabled:bg-slate-200 hover:bg-[#059669] transition-colors">
                {buscandoUno ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
              </button>
            </div>

            {/* Menú de descargas */}
            <div className="relative">
              <button onClick={() => setMenuDescarga(v => !v)} disabled={!itemsLista.length}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-[#111827] hover:bg-[#1F2937] disabled:bg-slate-200 text-white rounded-lg text-xs font-semibold transition-colors">
                <Download size={14} /> Descargar Excel <ChevronDown size={13} />
              </button>
              {menuDescarga && itemsLista.length > 0 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuDescarga(false)} />
                  <div className="absolute right-0 mt-1 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Mismo formato COSTEO (fórmulas intactas)</p>
                    </div>
                    {[
                      { modo: 'mejor_match', label: 'Mejor coincidencia', desc: 'El de mayor % match por ítem', icon: <CheckCircle2 size={14} className="text-emerald-600" />, req: true },
                      { modo: 'menor_precio', label: 'Menor precio', desc: 'El más barato por ítem', icon: <TrendingDown size={14} className="text-[#059669]" />, req: true },
                      { modo: 'equilibrado', label: 'Equilibrado', desc: 'Mejor match sin outliers ni alertas', icon: <Sparkles size={14} className="text-violet-600" />, req: true },
                      { modo: 'manual', label: 'Selección manual', desc: 'Lo que marcaste con el check', icon: <Eye size={14} className="text-[#059669]" />, req: true },
                    ].map(o => (
                      <button key={o.modo} onClick={() => exportarMismoExcel(o.modo)} disabled={!archivoExcel}
                        className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50 disabled:opacity-40 text-left transition-colors border-b border-slate-50">
                        <span className="mt-0.5">{o.icon}</span>
                        <span>
                          <span className="block text-xs font-semibold text-slate-700">{o.label}</span>
                          <span className="block text-[10px] text-slate-400">{o.desc}</span>
                        </span>
                      </button>
                    ))}
                    <div className="px-3 py-2 bg-slate-50 border-y border-slate-100">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Reportes nuevos</p>
                    </div>
                    <button onClick={() => { setMenuDescarga(false); exportarMejor(); }}
                      className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors border-b border-slate-50">
                      <FileSpreadsheet size={14} className="text-emerald-600 mt-0.5" />
                      <span>
                        <span className="block text-xs font-semibold text-slate-700">Resumen mejor resultado</span>
                        <span className="block text-[10px] text-slate-400">Tabla nueva con costos y ahorro</span>
                      </span>
                    </button>
                    <button onClick={() => { setMenuDescarga(false); exportarTodos(); }}
                      className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors">
                      <Download size={14} className="text-[#059669] mt-0.5" />
                      <span>
                        <span className="block text-xs font-semibold text-slate-700">Lista completa</span>
                        <span className="block text-[10px] text-slate-400">Todos los resultados de cada producto</span>
                      </span>
                    </button>
                    {!archivoExcel && (
                      <div className="px-3 py-2 bg-amber-50 border-t border-amber-100">
                        <p className="text-[10px] text-amber-700">Sube un Excel para las 4 primeras opciones</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <button onClick={limpiar} disabled={!itemsLista.length}
              className="p-2.5 border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 hover:border-red-200 disabled:opacity-40 transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Sidebar */}
        <aside className="lg:col-span-3 space-y-4">

          {/* Cargar Excel */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-3">Cargar Excel COSTEO</label>
            <button onClick={() => document.getElementById('excel-input')?.click()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
              <Upload size={15} /> Subir Excel
            </button>
            <input id="excel-input" type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => e.target.files?.[0] && cargarExcel(e.target.files[0])} />

            {/* Prompt: ofrecer reforzar con el PDF tras cargar el Excel */}
            {preguntarBases && !basesInfo && (
              <div className="mt-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                <p className="text-[11px] text-violet-800 font-medium mb-2">
                  💡 ¿Tienes el PDF de las bases? Súbelo para que la IA busque <b>exacto lo que piden</b> (medidas, marcas, specs).
                </p>
              </div>
            )}

            {/* Subir bases PDF (Gemini lee las especificaciones) */}
            <button onClick={() => document.getElementById('bases-input')?.click()}
              disabled={cargandoBases}
              className={`mt-2 w-full ${preguntarBases && !basesInfo ? 'ring-2 ring-violet-300' : ''} bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors`}>
              {cargandoBases ? <><Loader2 size={15} className="animate-spin" /> Leyendo bases…</> : <><Sparkles size={15} /> {basesInfo ? 'Cambiar bases (PDF)' : 'Subir bases (PDF) — opcional'}</>}
            </button>
            <input id="bases-input" type="file" accept="application/pdf,.pdf" className="hidden"
              onChange={e => e.target.files?.[0] && cargarBases(e.target.files[0])} />
            {basesInfo && (
              <div className="mt-2 flex items-center justify-between text-[10px] text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-2 py-1.5">
                <span>📄 {basesInfo.total} ítems · {especPorItem.size} enlazados</span>
                <button onClick={() => setShowBasesModal(true)} className="font-bold underline hover:text-violet-900 flex items-center gap-1">
                  <Eye size={11} /> Ver ítems
                </button>
              </div>
            )}

            {pestanas.length > 1 && (
              <div className="mt-3">
                <label className="text-[10px] text-slate-400 font-medium block mb-1">Pestaña:</label>
                <select value={sheetNameActual} onChange={e => cambiarPestana(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg text-xs p-2 bg-white outline-none focus:ring-2 focus:ring-[#059669]/20">
                  {pestanas.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            )}

            {productosExcel.length > 0 && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-600 font-medium">{productosExcel.length} productos</span>
                  <button onClick={() => setShowModal(true)} className="text-[10px] text-[#059669] hover:underline flex items-center gap-1">
                    <Eye size={11} /> Ver
                  </button>
                </div>
                <div className="space-y-0.5 max-h-24 overflow-y-auto">
                  {productosExcel.slice(0, 5).map(p => (
                    <div key={p.numero} className="text-[10px] text-slate-500 truncate">{p.numero}. {p.nombre}</div>
                  ))}
                  {productosExcel.length > 5 && <div className="text-[10px] text-slate-400">+{productosExcel.length-5} más</div>}
                </div>
                <button onClick={() => iniciarBarrido(productosExcel.map(p => ({ numero: String(p.numero), nombre: p.nombre, conversion: p.conversion })))}
                  disabled={procesando}
                  className="mt-2 w-full bg-[#059669] hover:bg-[#047857] disabled:bg-slate-200 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                  <Sparkles size={12} /> Buscar todos
                </button>
              </div>
            )}
          </div>

          {/* Búsqueda masiva texto */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-3">Lista manual</label>
            <textarea
              className="w-full h-40 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-600 outline-none focus:ring-2 focus:ring-[#059669]/20 resize-none"
              placeholder={`1\tLetrero de obra\n2\tMadera Pino 2"x3"\n3\tAnticorrosivo`}
              value={inputMasivo} onChange={e => setInputMasivo(e.target.value)} disabled={procesando}
            />
            <button onClick={iniciarTexto} disabled={procesando || !inputMasivo.trim()}
              className="mt-2 w-full bg-slate-900 hover:bg-[#059669] disabled:bg-slate-200 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
              {procesando ? <><Loader2 size={15} className="animate-spin" /> {progreso.actual}/{progreso.total}</> : <><Search size={15} /> Iniciar barrido</>}
            </button>
            {procesando && (
              <div className="mt-2">
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-[#059669] h-1.5 rounded-full transition-all" style={{ width: `${progreso.total ? (progreso.actual/progreso.total)*100 : 0}%` }} />
                </div>
                <button onClick={cancelar} className="mt-1 text-xs text-red-500 hover:text-red-700 w-full text-center">Cancelar</button>
              </div>
            )}
          </div>

          {/* Configuración de búsqueda */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button onClick={() => setMostrarConfig(!mostrarConfig)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <Settings size={14} className="text-slate-500" />
                <span className="text-xs font-semibold text-slate-600">Contexto de búsqueda</span>
                {contexto && <span className="w-2 h-2 rounded-full bg-[#D1FAE5]/500 inline-block" />}
              </div>
              {mostrarConfig ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
            </button>
            {mostrarConfig && (
              <div className="px-4 pb-4 border-t border-slate-100">
                <div className="flex flex-wrap gap-1 my-3">
                  {['ferretería construcción','señalética vial','pinturas y químicos','maderas'].map(t => (
                    <button key={t} onClick={() => setContexto(t)}
                      className={`text-[9px] px-2 py-1 rounded-full border transition-colors ${contexto===t ? 'bg-[#059669] text-white border-[#059669]' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <textarea value={contexto} onChange={e => setContexto(e.target.value)}
                  placeholder="Describe el contexto de los productos..."
                  className="w-full h-14 p-2 border border-slate-200 rounded-lg text-xs resize-none outline-none focus:ring-2 focus:ring-[#059669]/20" />
                {contexto && <button onClick={() => setContexto('')} className="text-[10px] text-red-500 mt-1">Limpiar</button>}
              </div>
            )}
          </div>

          {/* Estadísticas */}
          {itemsLista.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Resumen</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Total', val: stats.total, color: 'text-slate-900' },
                  { label: 'Con resultados', val: stats.con, color: 'text-emerald-700' },
                  { label: 'Sin resultados', val: stats.sin, color: stats.sin > 0 ? 'text-red-600' : 'text-slate-400' },
                  { label: 'Match prom.', val: `${stats.avgPct}%`, color: 'text-[#047857]' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className={`font-bold text-xl ${s.color}`}>{s.val}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {stats.ahorro !== 0 && (
                <div className={`rounded-lg p-3 text-center ${stats.ahorro > 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                  <div className={`flex items-center justify-center gap-1 mb-1 ${stats.ahorro > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {stats.ahorro > 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                    <span className="text-[10px] font-bold uppercase">{stats.ahorro > 0 ? 'Ahorro vs COSTEO' : 'Sobrecosto'}</span>
                  </div>
                  <p className={`font-bold text-lg ${stats.ahorro > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {stats.ahorro > 0 ? '+' : ''}{Math.round(stats.ahorro).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
                  </p>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Área principal de resultados */}
        <div className="lg:col-span-9 space-y-3 pb-16">
          {itemsLista.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[55vh] text-center">
              <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 mb-6">
                <ShoppingBag size={56} strokeWidth={1.2} className="text-slate-200 mx-auto" />
              </div>
              <p className="font-semibold text-slate-400 text-sm mb-1">Lista vacía</p>
              <p className="text-slate-300 text-xs">Carga un Excel COSTEO o escribe productos en la lista manual</p>
            </div>
          ) : (
            itemsLista.map((item) => {
              const mejor = seleccion.get(item.numero) || item.mejor_match;
              const pct = mejor?.matching?.porcentaje ?? 0;
              const ref = getRef(item.numero);

              return (
                <div key={item.numero} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

                  {/* Header del item */}
                  <div className={`px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b ${
                    item.procesando ? 'bg-[#D1FAE5]/60 border-[#059669]/20'
                    : pct >= 85 ? 'bg-emerald-50 border-emerald-100'
                    : pct >= 60 ? 'bg-amber-50 border-amber-100'
                    : item.resultados.length > 0 ? 'bg-red-50 border-red-100'
                    : 'bg-slate-50 border-slate-100'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        pct >= 85 ? 'bg-emerald-600 text-white' : pct >= 60 ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-700'
                      }`}>{item.numero}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm text-slate-800 truncate max-w-xl">{item.nombre}</h3>
                          {item.conversion && item.conversion !== 'unidad' && item.conversion !== 'und' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#D1FAE5] text-[#059669] border border-[#059669]/30 rounded uppercase flex-shrink-0">{item.conversion}</span>
                          )}
                        </div>
                        {item.procesando ? (
                          <span className="text-[10px] text-[#059669] flex items-center gap-1 mt-0.5">
                            <Loader2 size={10} className="animate-spin" /> Buscando...
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {!item.error && item.resultados.length > 0 && <MatchBadge pct={pct} />}
                            {mejor && <span className="text-[10px] text-slate-500">{mejor.tienda} · <span className="font-semibold text-slate-700">{fmt(mejor.precio_valor)}</span></span>}
                            {item.error && <span className="text-[10px] text-red-600 bg-red-100 px-2 py-0.5 rounded">Error: {item.error}</span>}
                            {!item.error && !item.resultados.length && <span className="text-[10px] text-slate-400">Sin resultados</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rango de precios + comparación con ref */}
                    {item.resultados.length > 0 && !item.procesando && (
                      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                        <div className="text-[10px] text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                          Mín: <span className="font-semibold text-slate-700">{fmt(Math.min(...item.resultados.map(r => r.precio_valor||Infinity)))}</span>
                          <span className="mx-1 text-slate-300">|</span>
                          Máx: <span className="font-semibold text-slate-700">{fmt(Math.max(...item.resultados.map(r => r.precio_valor||0)))}</span>
                        </div>
                        {ref > 0 && mejor && (() => {
                          const diff = (mejor.precio_valor||0) - ref;
                          return (
                            <div className={`flex items-center gap-1 text-[10px] font-semibold px-3 py-1.5 rounded-lg border ${
                              diff < 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : diff > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                            }`}>
                              {diff < 0 ? <TrendingDown size={12} /> : diff > 0 ? <TrendingUp size={12} /> : <Minus size={12} />}
                              Ref {fmt(ref)} {diff < 0 ? `▼ ${fmt(Math.abs(diff))}` : diff > 0 ? `▲ ${fmt(diff)}` : 'igual'}
                            </div>
                          );
                        })()}
                        {/* Toggle filtro: Mejor match / Menor precio */}
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                          {([['match','Match'],['precio','Menor $']] as [ModoOrden,string][]).map(([m,label]) => {
                            const activo = (ordenItem.get(item.numero) || 'match') === m;
                            return (
                              <button key={m}
                                onClick={() => setOrdenItem(prev => { const n = new Map(prev); n.set(item.numero, m); return n; })}
                                className={`text-[10px] font-semibold px-2.5 py-1.5 transition-colors ${activo ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tabla de resultados */}
                  {!item.procesando && item.resultados.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                            <th className="px-3 py-2.5 w-8 text-center">Sel</th>
                            <th className="px-4 py-2.5">#</th>
                            <th className="px-4 py-2.5">Tienda</th>
                            <th className="px-4 py-2.5">Producto encontrado</th>
                            <th className="px-4 py-2.5 text-right">Precio c/IVA</th>
                            {ref > 0 && <th className="px-4 py-2.5 text-right">vs Ref</th>}
                            <th className="px-4 py-2.5 text-center">Match</th>
                            <th className="px-4 py-2.5 text-center w-10">Link</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {resultadosOrdenados(item).slice(0, 15).map((r, i) => {
                            const isSel = seleccion.get(item.numero) === r || (!seleccion.has(item.numero) && i === 0 && r === item.mejor_match);
                            const pctR = r.matching?.porcentaje ?? 0;
                            const precioWeb = r.precio_valor || 0;
                            const diff = ref > 0 ? precioWeb - ref : null;
                            return (
                              <tr key={i} className={`hover:bg-slate-50/60 transition-colors ${isSel ? 'bg-[#D1FAE5]/40' : ''}`}>
                                <td className="px-3 py-3 text-center">
                                  <button onClick={() => setSeleccion(prev => { const m = new Map(prev); m.get(item.numero)===r ? m.delete(item.numero) : m.set(item.numero, r); return m; })}
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSel ? 'bg-[#059669] border-[#059669] text-white' : 'border-slate-300 hover:border-[#059669]'}`}>
                                    {isSel && <CheckCircle2 size={11} />}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-[10px] text-slate-300 font-mono">{String(i+1).padStart(2,'0')}</td>
                                <td className="px-4 py-3">
                                  <span className="text-sm font-medium text-slate-800 block leading-tight">{r.tienda}</span>
                                  <span className="text-[9px] text-slate-400 uppercase">{r.canal}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-xs text-slate-600 leading-tight max-w-sm line-clamp-2">{r.nombre}</p>
                                  {r.alerta_unidad && (
                                    <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                                      <AlertCircle size={9} /> Empaque: {r.unidad_detectada} (revisar unidad)
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`font-bold text-sm ${diff !== null && diff < 0 ? 'text-emerald-700' : diff !== null && diff > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                    {fmt(precioWeb)}
                                  </span>
                                </td>
                                {ref > 0 && (
                                  <td className="px-4 py-3 text-right">
                                    {diff !== null ? (
                                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg ${diff < 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {diff < 0 ? '▼' : '▲'} {fmt(Math.abs(diff))}
                                      </span>
                                    ) : '—'}
                                  </td>
                                )}
                                <td className="px-4 py-3 text-center">
                                  <MatchBadge pct={pctR} />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {r.link ? (
                                    <a href={r.link} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:bg-[#111827] hover:text-white transition-colors">
                                      <ExternalLink size={13} />
                                    </a>
                                  ) : <span className="text-slate-200">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {item.resultados.length > 15 && (
                        <div className="text-center py-2 text-xs text-slate-400 border-t bg-slate-50">
                          + {item.resultados.length - 15} resultados más
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sin resultados */}
                  {!item.procesando && !item.resultados.length && (
                    <div className="px-5 py-6 flex items-center gap-3 text-sm text-slate-400">
                      <AlertCircle size={18} className="text-red-300 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-slate-500">Sin resultados</p>
                        <p className="text-xs">Intenta con términos más cortos o generales</p>
                      </div>
                      <button onClick={() => buscarProducto(item.nombre, item.numero, item.conversion).then(r => setItemsLista(prev => prev.map(p => p.numero===item.numero ? r : p)))}
                        className="ml-auto text-xs text-[#059669] hover:text-[#065F46] flex items-center gap-1 flex-shrink-0">
                        <RefreshCw size={13} /> Reintentar
                      </button>
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
