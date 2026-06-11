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
  FileText, Zap, Bookmark, FolderOpen, Save,
  MapPin, Building2
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
  es_local_region?: boolean;
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
  numero: number | string;
  nombre: string;
  cantidad: number;
  valor_civa: number;
  link_referencia: string;
  conversion: string;
  _fila?: number;
}

interface BusquedaGuardada {
  id: string;
  nombre: string;
  nombre_archivo: string;
  id_proyecto: string;
  total_productos: number;
  con_resultados: number;
  avg_match: number;
  created_at: string;
}

interface LocalProveedor {
  nombre: string;
  tipo: 'ferreteria' | 'materiales' | 'otro';
  direccion: string;
  telefono: string | null;
  sitio_web: string | null;
  rating: number | null;
  total_reviews: number | null;
  horario: string | null;
  maps_url: string | null;
}

interface ResultadoLocalProducto {
  tienda: string;
  nombre: string;
  precio_valor: number | null;
  precio_formateado: string;
  link: string;
  tipo: 'ferreteria' | 'materiales' | 'cadena' | 'otro';
  es_mapa: boolean;
  direccion?: string;
  telefono?: string | null;
  maps_url?: string | null;
  rating?: number | null;
  rubro?: string;
}

const NOTA_LOCALES_DEFAULT = 'Tiendas físicas en la región según su rubro — confirma stock y precio por teléfono antes de visitar.';

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

// Extrae un nombre legible del nombre de archivo Excel
function extraerNombreProyecto(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')    // quitar extensión
    .replace(/[_-]+/g, ' ')    // guiones/underscores → espacios
    .replace(/\s{2,}/g, ' ')
    .trim();
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
      <div className="shrink-0 mt-0.5 p-1.5 rounded-xl bg-white/15">
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${cfg.text} opacity-75 mb-0.5`}>
          {cfg.label}
        </p>
        <p className={`text-sm font-medium leading-snug ${cfg.text}`}>
          {item.message}
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className={`shrink-0 mt-0.5 p-1 rounded-lg bg-white/10 hover:bg-white/25 transition-colors ${cfg.text} opacity-70 hover:opacity-100`}
      >
        <X size={14} />
      </button>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
        <div
          className={`h-full ${cfg.bar} toast-progress-bar`}
          style={{ animationDuration: `${dur}ms` }}
        />
      </div>
    </div>
  );
};

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

// ─── Banner PDF animado ───────────────────────────────────────────────────────
const BannerPdf = ({ onCargarPdf, cargandoBases, basesOk }: {
  onCargarPdf: (f: File) => void;
  cargandoBases: boolean;
  basesOk: boolean;
}) => {
  const refInput = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);

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
    <div className={`mx-5 mb-4 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
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
            : 'border-blue-200 bg-gradient-to-r from-violet-50 to-blue-50 hover:border-blue-400 hover:from-violet-100 hover:to-blue-100 cursor-pointer'
          }`}
      >
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
        {/* Barra de progreso indeterminada — animación real definida en globals.css */}
        {cargandoBases && (
          <div className="mt-2.5 h-1 rounded-full bg-violet-100 overflow-hidden">
            <div className="h-full bg-violet-400 rounded-full animate-indeterminate" />
          </div>
        )}
      </button>
    </div>
  );
};

// ─── Modal Preview Excel ──────────────────────────────────────────────────────
const ModalPreview = ({ productos, onClose, onConfirm, onCargarPdf, cargandoBases, basesOk, contexto, setContexto }: {
  productos: ProductoExcel[];
  onClose: () => void;
  onConfirm: () => void;
  onCargarPdf: (f: File) => void;
  cargandoBases: boolean;
  basesOk: boolean;
  contexto: string;
  setContexto: (c: string) => void;
}) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4 border-b">
        <div>
          <h2 className="font-bold text-slate-800 text-base">Configurar búsqueda — Excel COSTEO</h2>
          <p className="text-xs text-slate-400 mt-0.5">{productos.length} productos · PDF bases · Contexto</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
      </div>

      {/* Paso 1: PDF bases */}
      <div className="px-5 pt-3">
        <BannerPdf onCargarPdf={onCargarPdf} cargandoBases={cargandoBases} basesOk={basesOk} />
      </div>

      {/* Paso 2: Contexto */}
      <div className="px-5 py-3 border-b border-slate-100">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1.5">
            🏷️ Contexto del rubro
          </label>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {['ferretería construcción','señalética vial','pinturas y químicos','maderas','EPP seguridad','agrícola'].map(t => (
              <button key={t} onClick={() => setContexto(contexto === t ? '' : t)}
                className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${contexto === t ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'border-slate-200 text-slate-500 hover:border-[#2563EB] hover:text-[#2563EB]'}`}>
                {t}
              </button>
            ))}
          </div>
          <textarea value={contexto} onChange={e => setContexto(e.target.value)}
            placeholder="O escribe el contexto libre..."
            className="w-full h-10 p-2 border border-slate-200 rounded-lg text-xs resize-none outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
        </div>
      </div>

      {/* Paso 3: Vista previa de productos */}
      <div className="overflow-auto flex-1 px-5 py-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Vista previa de productos ({productos.length})</p>
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
                    !p.conversion || p.conversion === 'unidad' ? 'bg-slate-100 text-slate-400' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
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

      {/* Footer */}
      <div className="flex justify-between items-center gap-3 px-5 py-3 border-t bg-slate-50 rounded-b-2xl">
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          {contexto && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">🏷️ {contexto.slice(0, 20)}</span>}
          {basesOk && <span className="text-[#2563EB] font-bold">✅ Bases PDF cargadas</span>}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="px-6 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-sm">
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

// ─── Modal: Guardar búsqueda ──────────────────────────────────────────────────
const SaveSearchModal = ({ onClose, onSave, nombreDefault }: {
  onClose: () => void;
  onSave: (nombre: string) => Promise<void>;
  nombreDefault: string;
}) => {
  const [nombre, setNombre] = useState(nombreDefault);
  const [guardando, setGuardando] = useState(false);

  const handleSave = async () => {
    if (!nombre.trim() || guardando) return;
    setGuardando(true);
    await onSave(nombre.trim());
    setGuardando(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-5 border-b">
          <div>
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Bookmark size={16} className="text-emerald-600" /> Guardar búsqueda
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Se guardará en la base de datos para acceso futuro</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nombre del proyecto</p>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Ej: Proyecto Señalética Hospital Sur"
              autoFocus
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            />
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            El nombre se extrajo automáticamente del archivo Excel. Puedes modificarlo antes de guardar. Este nombre se usará como ID del proyecto en la base de datos.
          </p>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!nombre.trim() || guardando}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Panel: Búsquedas guardadas ───────────────────────────────────────────────
const SavedSearchesPanel = ({
  busquedas,
  cargando,
  onClose,
  onCargar,
  onEliminar,
}: {
  busquedas: BusquedaGuardada[];
  cargando: boolean;
  onClose: () => void;
  onCargar: (id: string) => void;
  onEliminar: (id: string) => void;
}) => (
  <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
      <div className="flex justify-between items-center p-5 border-b">
        <div>
          <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <FolderOpen size={16} className="text-emerald-600" /> Búsquedas guardadas
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{cargando ? 'Cargando...' : `${busquedas.length} búsqueda${busquedas.length !== 1 ? 's' : ''}`}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
      </div>
      <div className="overflow-auto flex-1 p-4">
        {cargando ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="text-emerald-600 animate-spin" />
          </div>
        ) : busquedas.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Bookmark size={36} className="mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-slate-500">No hay búsquedas guardadas</p>
            <p className="text-xs mt-1">Realiza una búsqueda y guárdala con el botón <strong>Guardar</strong></p>
          </div>
        ) : (
          <div className="space-y-2">
            {busquedas.map(b => (
              <div key={b.id} className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <FileSpreadsheet size={18} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{b.nombre}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-slate-500">
                      {b.total_productos} productos · {b.con_resultados} con resultados · {b.avg_match}% match
                    </span>
                    <span className="text-[10px] text-slate-300">
                      {new Date(b.created_at).toLocaleDateString('es-CL', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {b.nombre_archivo && (
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">📄 {b.nombre_archivo}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onCargar(b.id)}
                    className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Restaurar
                  </button>
                  <button
                    onClick={() => onEliminar(b.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

// ─── Modal de confirmación de limpieza ────────────────────────────────────────
const ConfirmLimpiarModal = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
      <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Trash2 size={22} className="text-red-600" />
      </div>
      <h3 className="font-bold text-slate-800 text-base mb-1">¿Limpiar todos los resultados?</h3>
      <p className="text-sm text-slate-500 mb-6">
        Se eliminarán los productos cargados y sus resultados de búsqueda. Esta acción no se puede deshacer.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
        >
          Limpiar todo
        </button>
      </div>
    </div>
  </div>
);

const IVA = 1.19;

// ─── Helpers base64 ↔ File (para guardar/restaurar el Excel original) ─────────

/** Convierte un File del navegador a string base64 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result = "data:application/...;base64,XXXX"  → solo queremos XXXX
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Reconstruye un File desde un string base64 */
function base64ToFile(base64: string, filename: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File(
    [bytes],
    filename || 'COSTEO.xlsx',
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  );
}

// ─── Regiones de Chile ────────────────────────────────────────────────────────
const REGIONES_CHILE = [
  { value: 'Arica y Parinacota', label: 'Arica y Parinacota', abbr: 'XV' },
  { value: 'Tarapacá', label: 'Tarapacá', abbr: 'I' },
  { value: 'Antofagasta', label: 'Antofagasta', abbr: 'II' },
  { value: 'Atacama', label: 'Atacama', abbr: 'III' },
  { value: 'Coquimbo', label: 'Coquimbo', abbr: 'IV' },
  { value: 'Valparaíso', label: 'Valparaíso', abbr: 'V' },
  { value: 'Metropolitana', label: 'Metropolitana', abbr: 'RM' },
  { value: "O'Higgins", label: "O'Higgins", abbr: 'VI' },
  { value: 'Maule', label: 'Maule', abbr: 'VII' },
  { value: 'Ñuble', label: 'Ñuble', abbr: 'XVI' },
  { value: 'Biobío', label: 'Biobío', abbr: 'VIII' },
  { value: 'La Araucanía', label: 'La Araucanía', abbr: 'IX' },
  { value: 'Los Ríos', label: 'Los Ríos', abbr: 'XIV' },
  { value: 'Los Lagos', label: 'Los Lagos', abbr: 'X' },
  { value: 'Aysén', label: 'Aysén', abbr: 'XI' },
  { value: 'Magallanes', label: 'Magallanes', abbr: 'XII' },
];

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
  const [colsExcel, setColsExcel] = useState<{ headerRow: number; colItem: number; colValor: number; colLink: number } | null>(null);

  const [contexto, setContexto]           = useState('');
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [seleccion, setSeleccion]         = useState<Map<string, ProductoResultado>>(new Map());
  const [ordenItem, setOrdenItem]         = useState<Map<string, ModoOrden>>(new Map());
  const [menuDescarga, setMenuDescarga]   = useState(false);

  // ─── Nuevos estados: guardar/cargar búsquedas ────────────────────────────────
  const [nombreProyecto, setNombreProyecto]           = useState('');
  const [showGuardar, setShowGuardar]                 = useState(false);
  const [showCargar, setShowCargar]                   = useState(false);
  const [busquedasGuardadas, setBusquedasGuardadas]   = useState<BusquedaGuardada[]>([]);
  const [cargandoGuardadas, setCargandoGuardadas]     = useState(false);
  const [confirmLimpiar, setConfirmLimpiar]           = useState(false);

  // ─── Georeferencia ───────────────────────────────────────────────────────────
  const [region, setRegion]                           = useState('');
  const [localesRegion, setLocalesRegion]             = useState<LocalProveedor[]>([]);
  const [buscandoLocales, setBuscandoLocales]         = useState(false);
  const [mostrarLocales, setMostrarLocales]           = useState(false);

  // ─── Búsqueda de productos en tiendas locales por región ─────────────────────
  const [resultadosLocales, setResultadosLocales]     = useState<Map<string, ResultadoLocalProducto[]>>(new Map());
  const [mapsLinksLocales, setMapsLinksLocales]       = useState<Map<string, string>>(new Map());
  const [notaLocales, setNotaLocales]                 = useState('');
  const [buscandoLocalesProductos, setBuscandoLocalesProductos] = useState(false);

  // Restaurar automáticamente si venimos desde la página de búsquedas guardadas
  useEffect(() => {
    const id = sessionStorage.getItem('restaurar_busqueda');
    if (!id) return;
    sessionStorage.removeItem('restaurar_busqueda');
    restaurarBusquedaById(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recibir ítems enviados desde el módulo de Viabilidad
  useEffect(() => {
    const raw = sessionStorage.getItem('viabilidad_items_excel');
    if (!raw) return;
    sessionStorage.removeItem('viabilidad_items_excel');
    try {
      const items = JSON.parse(raw) as ProductoExcel[];
      if (items.length) {
        setProductosExcel(items);
        setShowModal(true);
        notify(`${items.length} ítems recibidos desde Viabilidad`, 'success');
      }
    } catch { /* ignorar */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ordena los resultados de un item según el modo elegido (match o precio)
  const resultadosOrdenados = useCallback((item: ItemLista): ProductoResultado[] => {
    const modo = ordenItem.get(item.numero) || 'match';
    const arr = [...item.resultados];
    if (modo === 'precio') {
      arr.sort((a, b) => (a.precio_valor || Infinity) - (b.precio_valor || Infinity));
    } else {
      arr.sort((a, b) => (b.matching?.porcentaje ?? 0) - (a.matching?.porcentaje ?? 0));
    }
    // Deduplicar por proveedor: máx 1 resultado por tienda por ítem
    // "Sodimac" y "sodimac.cl" → mismo proveedor
    const normT = (t: string) =>
      (t || '').toLowerCase()
        .replace(/\s+(s\.?a\.?|spa|ltda?\.?|limitada|store|chile)\s*$/i, '')
        .replace(/\.(cl|com|net|org)\s*$/i, '')
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 25);
    const tiendasVistas = new Set<string>();
    return arr.filter(r => {
      const key = normT(r.tienda || '');
      if (!key || tiendasVistas.has(key)) return false;
      tiendasVistas.add(key);
      return true;
    }).slice(0, 5); // máx 5 por ítem (ahorro Serper)
  }, [ordenItem]);

  // ─── Notify ──────────────────────────────────────────────────────────────────
  const closeToast = useCallback((id: number) => {
    setToasts(p => p.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 370);
  }, []);

  const notify = useCallback((message: string, type: ToastType = 'success', duration = 4500) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p.slice(-4), { id, message, type, duration }]);
    setTimeout(() => closeToast(id), duration);
  }, [closeToast]);

  // ─── Buscar proveedores locales por región ────────────────────────────────────
  const buscarLocales = useCallback(async (regionActual: string) => {
    if (!regionActual) { setLocalesRegion([]); return; }
    setBuscandoLocales(true);
    try {
      const res = await fetch(`/api/buscar-locales?region=${encodeURIComponent(regionActual)}&tipo=todos`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLocalesRegion(data.locales || []);
      if ((data.locales || []).length > 0) setMostrarLocales(true);
      notify(`${data.total || 0} proveedores locales encontrados en ${regionActual}`, 'info');
    } catch (e: any) {
      notify(`No se pudo cargar proveedores locales: ${e.message}`, 'warning');
      setLocalesRegion([]);
    } finally {
      setBuscandoLocales(false);
    }
  }, [notify]);

  const cambiarRegion = useCallback((nuevaRegion: string) => {
    setRegion(nuevaRegion);
    if (nuevaRegion) {
      buscarLocales(nuevaRegion);
    } else {
      setLocalesRegion([]);
      setMostrarLocales(false);
      setResultadosLocales(new Map());
      setMapsLinksLocales(new Map());
    }
  }, [buscarLocales]);

  // ─── Buscar productos del Excel en tiendas físicas de la región ───────────────
  const buscarProductosEnLocales = useCallback(async () => {
    if (!region || !itemsLista.length) return;
    setBuscandoLocalesProductos(true);
    notify(`Buscando en tiendas locales de ${region}...`, 'info');

    const sem = crearSemaforo(2);
    const nuevosLocales = new Map<string, ResultadoLocalProducto[]>();
    const nuevosMaps = new Map<string, string>();
    let nota = '';

    const itemsConResultados = itemsLista.filter(i => !i.procesando && i.resultados.length > 0);

    await Promise.all(
      itemsConResultados.map(item =>
        sem(async () => {
          try {
            const res = await fetch(
              `/api/buscar-producto-local?producto=${encodeURIComponent(item.nombre)}&region=${encodeURIComponent(region)}`
            );
            if (res.ok) {
              const data = await res.json();
              if (data.resultados?.length > 0) nuevosLocales.set(item.numero, data.resultados);
              if (data.maps_link) nuevosMaps.set(item.numero, data.maps_link);
              if (data.nota && !nota) nota = data.nota;
            }
          } catch { /* continúa con los demás */ }
        })
      )
    );

    setResultadosLocales(nuevosLocales);
    setMapsLinksLocales(nuevosMaps);
    setNotaLocales(nota || NOTA_LOCALES_DEFAULT);
    setBuscandoLocalesProductos(false);
    const totalCon = nuevosLocales.size;
    notify(
      totalCon > 0
        ? `Locales: ${totalCon} de ${itemsConResultados.length} productos con resultados en ${region}`
        : `Sin resultados locales específicos en ${region} — las ferreterías del panel lateral siguen disponibles`,
      totalCon > 0 ? 'success' : 'warning'
    );
  }, [region, itemsLista, notify]);

  // ─── Parsear lista texto ──────────────────────────────────────────────────────
  const parsearLista = (texto: string) =>
    texto.split('\n').filter(l => l.trim()).reduce<{ numero: string; nombre: string }[]>((acc, l) => {
      const m = l.match(/^(\d+)[\s\t]+(.+)/);
      if (m) acc.push({ numero: m[1], nombre: m[2].trim() });
      else if (!l.trim().match(/^\d+$/)) acc.push({ numero: String(acc.length + 1), nombre: l.trim() });
      return acc;
    }, []);

  // ─── Cargar BASES (PDF) ────────────────────────────────────────────────────────
  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const cargarBases = async (file: File) => {
    if (cargandoBases) return;
    setCargandoBases(true);
    setBasesInfo(null);
    notify('Subiendo bases y leyendo con IA (puede tardar ~30s)...', 'success');
    try {
      const urlRes = await fetch('/api/bases-upload-url', { method: 'POST' });
      const u = await urlRes.json();
      if (!urlRes.ok || !u.token) throw new Error(u.error || 'No se pudo preparar la subida');

      const { error: upErr } = await supabase.storage.from(u.bucket).uploadToSignedUrl(u.path, u.token, file);
      if (upErr) throw new Error(`Error subiendo PDF: ${upErr.message}`);

      const itemsExcelPayload = productosExcel.map(pe => ({ numero: String(pe.numero), detalle: pe.nombre }));
      const leerRes = await fetch('/api/leer-bases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: u.bucket, path: u.path, itemsExcel: itemsExcelPayload }),
      });
      const data = await leerRes.json();
      if (!leerRes.ok || !data.ok) throw new Error(data.error || 'No se pudo leer el PDF');

      const itemsBases = data.items || [];
      const enriquecidos: Array<{ numero: string; busqueda: string; agregado: string }> = data.enriquecidos || [];

      const mapa = new Map<string, string>();
      const detalleOriginal = new Map(productosExcel.map(pe => [String(pe.numero), pe.nombre]));
      const filasModal = enriquecidos
        .filter(e => e.busqueda)
        .map(e => {
          mapa.set(e.numero, e.busqueda);
          return {
            item: e.numero,
            nombre: detalleOriginal.get(e.numero) || '',
            especificaciones: e.busqueda,
            cantidad: e.agregado || '',
            unidad: '',
            _excel: e.agregado ? e.numero : undefined,
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
    // Auto-extraer nombre de proyecto desde el nombre del archivo
    setNombreProyecto(extraerNombreProyecto(file.name));

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
        setColsExcel({ headerRow: i, colItem, colValor, colLink });
        break;
      }
    }

    if (headerRow === -1) { notify('No se encontraron encabezados en el Excel', 'error'); return; }

    // Palabras que indican una fila administrativa (no es un producto)
    const ADMIN_WORDS = ['TOTAL','VERDADERO','COSTEADO','SUBTOTAL','ENTREGA','SOLICITA','FICHA','CIUDAD','REGION','REGIÓN','OBSERVACI','NOTA:','NOTA ','PLAZO','CONTRATO','DIRECCIÓN','DIRECCION'];

    const items: ProductoExcel[] = [];
    for (let i = headerRow + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || !row.length) continue;
      const detalle = colDetalle >= 0 ? String(row[colDetalle]||'').trim() : '';
      if (!detalle) continue;
      // Filtrar filas administrativas (notas, totales, condiciones de entrega, etc.)
      if (ADMIN_WORDS.some(s => detalle.toUpperCase().includes(s))) continue;
      // Filtrar frases largas sin número de ítem válido (son notas del documento)
      const itemRaw = colItem >= 0 ? String(row[colItem]||'').trim() : '';
      if (!itemRaw && detalle.split(' ').length > 6) continue; // frase larga sin ítem → nota
      const conversion = colConversion >= 0 ? String(row[colConversion]||'').trim().toLowerCase() : 'unidad';
      let valorCIVA = 0;
      if (colValor >= 0 && row[colValor] != null) {
        const raw = row[colValor];
        valorCIVA = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[$\.]/g,'').replace(',','.')) || 0;
      }
      // Número de ítem: soporta numérico (4), decimal (4.1) y alfanumérico (C2, B)
      // Usar String siempre para evitar NaN con prefijos tipo "B", "C2", "B SC"
      const numeroRaw = itemRaw || String(i - headerRow);
      const numero = isNaN(Number(numeroRaw)) ? numeroRaw : Number(numeroRaw);
      items.push({
        numero: numero as number,
        nombre: detalle,
        cantidad: colCantidad >= 0 ? Number(row[colCantidad])||1 : 1,
        valor_civa: valorCIVA,
        link_referencia: colLink >= 0 ? String(row[colLink]||'').trim() : '',
        conversion: conversion || 'unidad',
        _fila: i,
      });
    }

    if (!items.length) { notify('No se encontraron productos', 'error'); return; }
    setProductosExcel(items);
    setShowModal(true);
    if (!basesInfo) setPreguntarBases(true);
    notify(`${items.length} productos desde "${sheetName}"`, 'success');
  };

  const cambiarPestana = (s: string) => {
    setSheetNameActual(s);
    if (workbook) procesarPestana(workbook, s);
  };

  // ─── Búsqueda de un producto ──────────────────────────────────────────────────
  const buscarProducto = useCallback(async (
    producto: string,
    numero: string,
    conversion = 'unidad'
  ): Promise<ItemLista> => {
    try {
      const mejorada = especPorItem.get(String(numero));
      const productoBuscar = mejorada ? mejorada.slice(0, 200) : producto;

      const ctxParam = contexto.trim() ? `&contexto=${encodeURIComponent(contexto.trim())}` : '';
      const regionParam = region.trim() ? `&region=${encodeURIComponent(region.trim())}` : '';
      const url = `/api/buscar-productos?producto=${encodeURIComponent(productoBuscar)}&numero=${encodeURIComponent(numero)}&minimo=5&conversion=${encodeURIComponent(conversion)}${ctxParam}${regionParam}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw = data.resultados || [];

      // Reranking IA con entidades detectadas
      let final = raw;
      if (raw.length > 3) {
        try {
          const ir = await fetch('/api/analizar-con-ia', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              producto,
              numero_item: numero,
              minimo_requerido: 5,
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
  }, [especPorItem, contexto, region]);

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

  // ─── Selección de resultado por modo ─────────────────────────────────────────
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
      const precios = res.map(r => r.precio_valor).filter(p => p > 0).sort((a, b) => a - b);
      const mediana = precios[Math.floor(precios.length / 2)] || 0;
      const candidatos = res.filter(r =>
        r.precio_valor > 0 && !r.alerta_unidad &&
        (mediana === 0 || r.precio_valor <= mediana * 2)
      );
      const pool = candidatos.length ? candidatos : res;
      return [...pool].sort((a, b) => (b.matching?.porcentaje ?? 0) - (a.matching?.porcentaje ?? 0))[0];
    }
    return [...res].sort((a, b) => (b.matching?.porcentaje ?? 0) - (a.matching?.porcentaje ?? 0))[0];
  };

  // ─── Exportar MISMO Excel ─────────────────────────────────────────────────────
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
    notify(`Generando Excel (${nombreModo[modo] || modo})...`, 'info');

    try {
      const fd = new FormData();
      fd.append('file', archivoExcel, archivoExcel.name);
      fd.append('sheetName', sheetNameActual);
      fd.append('seleccionados', JSON.stringify(seleccionados));
      fd.append('modo', modo);
      if (colsExcel) fd.append('cols', JSON.stringify(colsExcel));

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

  const descargarXlsx = (wb: import('xlsx').WorkBook, filename: string) => {
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

  // ─── Limpiar (con modal de confirmación) ──────────────────────────────────────
  const limpiar = () => {
    if (itemsLista.length) setConfirmLimpiar(true);
  };

  const confirmarLimpiar = () => {
    setItemsLista([]);
    setProductosExcel([]);
    setWorkbook(null);
    setShowModal(false);
    setArchivoExcel(null);
    setPestanas([]);
    setSeleccion(new Map());
    setNombreProyecto('');
    setConfirmLimpiar(false);
  };

  // ─── Guardar búsqueda en Supabase ─────────────────────────────────────────────
  const guardarBusqueda = async (nombre: string) => {
    try {
      // Convertir el Excel original a base64 para poder restaurar la exportación
      let excel_base64: string | null = null;
      if (archivoExcel) {
        try {
          excel_base64 = await fileToBase64(archivoExcel);
        } catch {
          // Si falla la conversión, continuar sin el Excel — la exportación COSTEO
          // no estará disponible al restaurar pero el resto sí.
        }
      }

      const payload = {
        nombre,
        nombre_archivo: archivoExcel?.name || '',
        id_proyecto: nombre,
        items_excel: productosExcel,
        items_lista: itemsLista.map(item => ({
          ...item,
          resultados: item.resultados.slice(0, 10),
        })),
        seleccion: Object.fromEntries(seleccion),
        total_productos: stats.total,
        con_resultados: stats.con,
        avg_match: stats.avgPct,
        excel_base64,
        cols_excel: colsExcel,
        sheet_name: sheetNameActual,
        region: region || null,
        contexto: contexto || null,
      };

      const res = await fetch('/api/busquedas-guardadas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
        notify(`Error al guardar: ${err.error}`, 'error');
        return;
      }

      notify(`Búsqueda "${nombre}" guardada exitosamente`, 'success');
    } catch (e: any) {
      notify(`Error al guardar: ${e.message}`, 'error');
    }
  };

  // ─── Cargar lista de búsquedas guardadas ──────────────────────────────────────
  const cargarBusquedas = async () => {
    setCargandoGuardadas(true);
    try {
      const res = await fetch('/api/busquedas-guardadas');
      if (!res.ok) throw new Error('Error al cargar búsquedas');
      const data = await res.json();
      setBusquedasGuardadas(data.busquedas || []);
    } catch (e: any) {
      notify(`Error al cargar búsquedas: ${e.message}`, 'error');
    } finally {
      setCargandoGuardadas(false);
    }
  };

  // ─── Aplicar datos de una búsqueda restaurada al estado del componente ────────
  // Función interna compartida por restaurarBusquedaById y restaurarBusqueda.
  const aplicarBusquedaRestaurada = (b: any) => {
    setProductosExcel(b.items_excel || []);
    setItemsLista(b.items_lista || []);
    setNombreProyecto(b.nombre);

    // Restaurar selección manual
    if (b.seleccion && typeof b.seleccion === 'object') {
      setSeleccion(new Map(Object.entries(b.seleccion)) as Map<string, ProductoResultado>);
    }

    // ── Restaurar el Excel original → habilita los 4 modos de exportación COSTEO ──
    if (b.excel_base64) {
      try {
        const file = base64ToFile(b.excel_base64, b.nombre_archivo || 'COSTEO.xlsx');
        setArchivoExcel(file);
      } catch {
        // Si falla la decodificación, continuar sin el archivo Excel.
        // Los 4 primeros modos de exportar quedarán desactivados, pero
        // "Resumen mejor resultado" y "Lista completa" funcionarán igual.
        setArchivoExcel(null);
      }
    } else {
      setArchivoExcel(null);
    }

    // Restaurar posición de columnas y nombre de pestaña
    if (b.cols_excel) setColsExcel(b.cols_excel);
    if (b.sheet_name) setSheetNameActual(b.sheet_name);

    // Restaurar región y contexto
    if (b.region) cambiarRegion(b.region); else cambiarRegion('');
    if (b.contexto != null) setContexto(b.contexto);
  };

  // ─── Restaurar por ID directo (desde sessionStorage — página de búsquedas) ───
  const restaurarBusquedaById = async (id: string) => {
    notify('Restaurando búsqueda guardada...', 'info');
    try {
      const res = await fetch(`/api/busquedas-guardadas/${id}`);
      if (!res.ok) throw new Error('No se pudo cargar la búsqueda');
      const data = await res.json();
      aplicarBusquedaRestaurada(data.busqueda);
      const tieneExcel = !!data.busqueda?.excel_base64;
      notify(
        `"${data.busqueda.nombre}" restaurado — ${(data.busqueda.items_lista || []).length} productos${tieneExcel ? ' · exportación Excel habilitada ✓' : ''}`,
        'success'
      );
    } catch (e: any) {
      notify(`Error al restaurar: ${e.message}`, 'error');
    }
  };

  // ─── Restaurar desde el panel lateral (botón "Restaurar" en Mis búsquedas) ────
  const restaurarBusqueda = async (id: string) => {
    setCargandoGuardadas(true);
    try {
      const res = await fetch(`/api/busquedas-guardadas/${id}`);
      if (!res.ok) throw new Error('No se pudo cargar la búsqueda');
      const data = await res.json();
      aplicarBusquedaRestaurada(data.busqueda);
      setShowCargar(false);
      const tieneExcel = !!data.busqueda?.excel_base64;
      notify(
        `"${data.busqueda.nombre}" restaurado — ${(data.busqueda.items_lista || []).length} productos${tieneExcel ? ' · exportación Excel habilitada ✓' : ''}`,
        'success'
      );
    } catch (e: any) {
      notify(`Error al restaurar: ${e.message}`, 'error');
    } finally {
      setCargandoGuardadas(false);
    }
  };

  // ─── Eliminar una búsqueda guardada ──────────────────────────────────────────
  const eliminarBusqueda = async (id: string) => {
    try {
      const res = await fetch(`/api/busquedas-guardadas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setBusquedasGuardadas(prev => prev.filter(b => b.id !== id));
      notify('Búsqueda eliminada', 'info');
    } catch (e: any) {
      notify(`Error al eliminar: ${e.message}`, 'error');
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
      {/* Modales */}
      {showModal && productosExcel.length > 0 && (
        <ModalPreview
          productos={productosExcel}
          onClose={() => setShowModal(false)}
          onConfirm={iniciarExcel}
          onCargarPdf={cargarBases}
          cargandoBases={cargandoBases}
          basesOk={!!basesInfo}
          contexto={contexto}
          setContexto={setContexto}
        />
      )}
      {showBasesModal && basesItems.length > 0 && (
        <ModalBases items={basesItems} onClose={() => setShowBasesModal(false)} />
      )}
      {showGuardar && (
        <SaveSearchModal
          onClose={() => setShowGuardar(false)}
          onSave={guardarBusqueda}
          nombreDefault={nombreProyecto}
        />
      )}
      {showCargar && (
        <SavedSearchesPanel
          busquedas={busquedasGuardadas}
          cargando={cargandoGuardadas}
          onClose={() => setShowCargar(false)}
          onCargar={restaurarBusqueda}
          onEliminar={eliminarBusqueda}
        />
      )}
      {confirmLimpiar && (
        <ConfirmLimpiarModal
          onConfirm={confirmarLimpiar}
          onCancel={() => setConfirmLimpiar(false)}
        />
      )}

      <ToastContainer toasts={toasts} onClose={closeToast} />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#111827] p-2 rounded-lg"><BarChart3 size={20} className="text-white" /></div>
            <div>
              <h1 className="font-bold text-slate-900 text-base leading-tight">
                MONITOR <span className="text-[#2563EB]">ICA</span>
                <span className="ml-2 text-[9px] bg-[#2563EB] text-white px-1.5 py-0.5 rounded font-bold">IA + Scrapers</span>
              </h1>
              <p className="text-[10px] text-slate-400">Sodimac · Easy · Construmart · Imperial · MercadoLibre</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Búsqueda rápida */}
            <div className="flex items-center border border-slate-200 rounded-lg px-3 gap-2 focus-within:ring-2 focus-within:ring-[#2563EB]/25 bg-white">
              <Search size={14} className="text-slate-400" />
              <input
                className="py-2.5 text-sm outline-none w-64 bg-transparent placeholder:text-slate-400 text-slate-700"
                placeholder="Buscar producto... (ej: Anticorrosivo)"
                value={inputManual}
                onChange={e => setInputManual(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarUno()}
              />
              <button onClick={buscarUno} disabled={buscandoUno || !inputManual.trim()}
                className="bg-slate-900 text-white px-2 py-1 rounded text-xs disabled:bg-slate-200 hover:bg-[#2563EB] transition-colors">
                {buscandoUno ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
              </button>
            </div>

            {/* Guardar búsqueda actual */}
            {itemsLista.length > 0 && !procesando && (
              <button
                onClick={() => setShowGuardar(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                title="Guardar búsqueda en base de datos"
              >
                <Bookmark size={14} /> Guardar
              </button>
            )}

            {/* Mis búsquedas guardadas */}
            <button
              onClick={() => { cargarBusquedas(); setShowCargar(true); }}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors"
              title="Ver búsquedas guardadas"
            >
              <FolderOpen size={14} /> Mis búsquedas
            </button>

            {/* Menú de descargas */}
            <div className="relative">
              <button onClick={() => setMenuDescarga(v => !v)} disabled={!itemsLista.length}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-[#111827] hover:bg-[#1E293B] disabled:bg-slate-200 text-white rounded-lg text-xs font-semibold transition-colors">
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
                      { modo: 'mejor_match', label: 'Mejor coincidencia', desc: 'El de mayor % match por ítem', icon: <CheckCircle2 size={14} className="text-emerald-600" /> },
                      { modo: 'menor_precio', label: 'Menor precio', desc: 'El más barato por ítem', icon: <TrendingDown size={14} className="text-[#2563EB]" /> },
                      { modo: 'equilibrado', label: 'Equilibrado', desc: 'Mejor match sin outliers ni alertas', icon: <Sparkles size={14} className="text-violet-600" /> },
                      { modo: 'manual', label: 'Selección manual', desc: 'Lo que marcaste con el check', icon: <Eye size={14} className="text-[#2563EB]" /> },
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
                      <Download size={14} className="text-[#2563EB] mt-0.5" />
                      <span>
                        <span className="block text-xs font-semibold text-slate-700">Lista completa</span>
                        <span className="block text-[10px] text-slate-400">Todos los resultados de cada producto</span>
                      </span>
                    </button>
                    {archivoExcel ? (
                      <div className="px-3 py-2 bg-emerald-50 border-t border-emerald-100 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <p className="text-[10px] text-emerald-700 font-medium">Excel listo — formato COSTEO original habilitado</p>
                      </div>
                    ) : (
                      <div className="px-3 py-2 bg-amber-50 border-t border-amber-100">
                        <p className="text-[10px] text-amber-700">
                          Sin Excel original — sube el archivo o guarda la búsqueda con Excel cargado para habilitar estas opciones
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <button onClick={limpiar} disabled={!itemsLista.length}
              className="p-2.5 border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 hover:border-red-200 disabled:opacity-40 transition-colors"
              title="Limpiar resultados">
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
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Cargar Excel COSTEO</p>
            <button onClick={() => document.getElementById('excel-input')?.click()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
              <Upload size={15} /> Subir Excel
            </button>
            <input id="excel-input" type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => e.target.files?.[0] && cargarExcel(e.target.files[0])} />

            {/* Nombre proyecto auto-extraído */}
            {nombreProyecto && (
              <div className="mt-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                <p className="text-[10px] text-emerald-700 font-medium truncate" title={nombreProyecto}>
                  📁 {nombreProyecto}
                </p>
              </div>
            )}

            {preguntarBases && !basesInfo && (
              <div className="mt-3 p-3 bg-violet-50 border border-blue-200 rounded-lg">
                <p className="text-[11px] text-violet-800 font-medium mb-2">
                  💡 ¿Tienes el PDF de las bases? Súbelo para que la IA busque <b>exacto lo que piden</b> (medidas, marcas, specs).
                </p>
              </div>
            )}

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
                <p className="text-[10px] text-slate-400 font-medium mb-1">Pestaña:</p>
                <select value={sheetNameActual} onChange={e => cambiarPestana(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg text-xs p-2 bg-white outline-none focus:ring-2 focus:ring-[#2563EB]/20">
                  {pestanas.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            )}

            {productosExcel.length > 0 && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-600 font-medium">{productosExcel.length} productos</span>
                  <button onClick={() => setShowModal(true)} className="text-[10px] text-[#2563EB] hover:underline flex items-center gap-1">
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
                  className="mt-2 w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-slate-200 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                  <Sparkles size={12} /> Buscar todos
                </button>
              </div>
            )}
          </div>

          {/* Búsqueda masiva texto */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Lista manual</p>
            <textarea
              className="w-full h-32 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-600 outline-none focus:ring-2 focus:ring-[#2563EB]/20 resize-none"
              placeholder={`1\tLetrero de obra\n2\tMadera Pino 2"x3"\n3\tAnticorrosivo`}
              value={inputMasivo} onChange={e => setInputMasivo(e.target.value)} disabled={procesando}
            />
            {/* Región rápida para lista */}
            <div className="mt-2 flex flex-wrap gap-1">
              {['Valparaíso','Metropolitana','Biobío','Aysén','Maule'].map(r => (
                <button key={r} onClick={() => cambiarRegion(region === r ? '' : r)}
                  className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${region === r ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'border-slate-200 text-slate-400 hover:border-[#2563EB] hover:text-[#2563EB]'}`}>
                  📍 {r}
                </button>
              ))}
            </div>
            <button onClick={iniciarTexto} disabled={procesando || !inputMasivo.trim()}
              className="mt-2 w-full bg-slate-900 hover:bg-[#2563EB] disabled:bg-slate-200 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
              {procesando ? <><Loader2 size={15} className="animate-spin" /> {progreso.actual}/{progreso.total}</> : <><Search size={15} /> Iniciar barrido</>}
            </button>
            {procesando && (
              <div className="mt-2">
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-[#2563EB] h-1.5 rounded-full transition-all" style={{ width: `${progreso.total ? (progreso.actual/progreso.total)*100 : 0}%` }} />
                </div>
                <button onClick={cancelar} className="mt-1 text-xs text-red-500 hover:text-red-700 w-full text-center">Cancelar</button>
              </div>
            )}
          </div>

          {/* Georeferencia — Región de búsqueda */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className={region ? 'text-emerald-600' : 'text-slate-400'} />
                  <span className="text-xs font-semibold text-slate-600">Región de búsqueda</span>
                  {region && <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />}
                </div>
                {region && (
                  <button onClick={() => cambiarRegion('')} className="text-[10px] text-red-500 hover:text-red-700 transition-colors">
                    Quitar
                  </button>
                )}
              </div>

              {/* Selector de región */}
              <select
                value={region}
                onChange={e => cambiarRegion(e.target.value)}
                className="w-full border border-slate-200 rounded-lg text-xs p-2 bg-white outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700"
              >
                <option value="">🌎 Todo Chile (sin filtro)</option>
                {REGIONES_CHILE.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.abbr} — {r.label}
                  </option>
                ))}
              </select>

              {/* Chips de regiones frecuentes */}
              <div className="flex flex-wrap gap-1 mt-2">
                {['Valparaíso', 'Metropolitana', 'Biobío', 'Aysén'].map(r => (
                  <button
                    key={r}
                    onClick={() => cambiarRegion(region === r ? '' : r)}
                    className={`text-[9px] px-2 py-1 rounded-full border transition-colors ${
                      region === r
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-slate-200 text-slate-500 hover:border-emerald-400 hover:text-emerald-600'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Info cuando hay región activa */}
              {region && (
                <div className="mt-2 px-2.5 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <p className="text-[10px] text-emerald-700 font-medium">
                    📍 Las búsquedas incluirán <b>{region}</b> como contexto geográfico
                  </p>
                </div>
              )}

              {/* Botón búsqueda en tiendas físicas locales */}
              {region && itemsLista.filter(i => i.resultados.length > 0).length > 0 && (
                <button
                  onClick={buscarProductosEnLocales}
                  disabled={buscandoLocalesProductos}
                  className="mt-2 w-full bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  {buscandoLocalesProductos
                    ? <><Loader2 size={13} className="animate-spin" /> Buscando en locales…</>
                    : <><Building2 size={13} /> Buscar en tiendas de {region}</>}
                </button>
              )}
            </div>

            {/* Panel de proveedores locales */}
            {region && (
              <div className="border-t border-slate-100">
                <button
                  onClick={() => setMostrarLocales(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Building2 size={13} className="text-slate-400" />
                    <span className="text-[11px] font-semibold text-slate-600">
                      Proveedores locales
                      {localesRegion.length > 0 && (
                        <span className="ml-1.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          {localesRegion.length}
                        </span>
                      )}
                    </span>
                  </div>
                  {buscandoLocales
                    ? <Loader2 size={13} className="animate-spin text-slate-400" />
                    : mostrarLocales
                    ? <ChevronUp size={13} className="text-slate-400" />
                    : <ChevronDown size={13} className="text-slate-400" />
                  }
                </button>

                {mostrarLocales && !buscandoLocales && (
                  <div className="px-3 pb-3 space-y-2 max-h-72 overflow-y-auto">
                    {localesRegion.length === 0 ? (
                      <p className="text-[10px] text-slate-400 text-center py-3">Sin proveedores encontrados</p>
                    ) : (
                      localesRegion.map((local, i) => (
                        <div key={i} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-slate-800 truncate">{local.nombre}</p>
                              <p className="text-[9px] text-slate-500 truncate mt-0.5">{local.direccion}</p>
                            </div>
                            <span className={`shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                              local.tipo === 'ferreteria'
                                ? 'bg-amber-100 text-amber-700'
                                : local.tipo === 'materiales'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {local.tipo === 'ferreteria' ? '🔧 Ferr.' : local.tipo === 'materiales' ? '🧱 Mat.' : '📦 Otro'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            {local.rating && (
                              <span className="text-[9px] text-amber-600 font-medium">⭐ {local.rating} ({local.total_reviews})</span>
                            )}
                            {local.telefono && (
                              <a href={`tel:${local.telefono}`} className="text-[9px] text-blue-600 hover:underline">📞 Llamar</a>
                            )}
                            {local.maps_url && (
                              <a href={local.maps_url} target="_blank" rel="noreferrer" className="text-[9px] text-emerald-600 hover:underline">📍 Maps</a>
                            )}
                            {local.sitio_web && (
                              <a href={local.sitio_web} target="_blank" rel="noreferrer" className="text-[9px] text-slate-600 hover:underline">🌐 Web</a>
                            )}
                          </div>
                          {local.horario && (
                            <p className="text-[8px] text-slate-400 mt-1">🕐 {local.horario}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Indicador compacto de configuración activa */}
          {(region || contexto) && (
            <div className="bg-[#EFF6FF] border border-[#2563EB]/20 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {region && <span className="font-bold text-[#1D4ED8]">📍 {region}</span>}
                {contexto && <span className="text-[#2563EB] font-medium">🏷️ {contexto.slice(0, 18)}</span>}
              </div>
              <button onClick={() => { setContexto(''); cambiarRegion(''); }} className="text-[10px] text-slate-400 hover:text-red-500">✕</button>
            </div>
          )}

          {/* Estadísticas */}
          {itemsLista.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Resumen</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Total', val: stats.total, color: 'text-slate-900' },
                  { label: 'Con resultados', val: stats.con, color: 'text-emerald-700' },
                  { label: 'Sin resultados', val: stats.sin, color: stats.sin > 0 ? 'text-red-600' : 'text-slate-400' },
                  { label: 'Match prom.', val: `${stats.avgPct}%`, color: 'text-[#1D4ED8]' },
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
              <button
                onClick={() => { cargarBusquedas(); setShowCargar(true); }}
                className="mt-4 flex items-center gap-2 text-xs text-slate-500 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 px-4 py-2 rounded-lg transition-colors"
              >
                <FolderOpen size={14} /> Ver búsquedas guardadas
              </button>
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
                    item.procesando ? 'bg-emerald-50/60 border-emerald-100'
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
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded uppercase flex-shrink-0">{item.conversion}</span>
                          )}
                        </div>
                        {item.procesando ? (
                          <span className="text-[10px] text-[#2563EB] flex items-center gap-1 mt-0.5">
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
                        {/* Toggle: Mejor match / Menor precio */}
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
                          {resultadosOrdenados(item).slice(0, 10).map((r, i) => {
                            const isSel = seleccion.get(item.numero) === r || (!seleccion.has(item.numero) && i === 0 && r === item.mejor_match);
                            const pctR = r.matching?.porcentaje ?? 0;
                            const precioWeb = r.precio_valor || 0;
                            const diff = ref > 0 ? precioWeb - ref : null;
                            return (
                              <tr key={i} className={`hover:bg-slate-50/60 transition-colors ${isSel ? 'bg-emerald-50/40' : ''}`}>
                                <td className="px-3 py-3 text-center">
                                  <button
                                    onClick={() => setSeleccion(prev => { const m = new Map(prev); m.get(item.numero)===r ? m.delete(item.numero) : m.set(item.numero, r); return m; })}
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSel ? 'bg-[#2563EB] border-[#2563EB] text-white' : 'border-slate-300 hover:border-[#2563EB]'}`}
                                  >
                                    {isSel && <CheckCircle2 size={11} />}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-[10px] text-slate-300 font-mono">{String(i+1).padStart(2,'0')}</td>
                                <td className="px-4 py-3">
                                  <span className="text-sm font-medium text-slate-800 block leading-tight">{r.tienda}</span>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[9px] text-slate-400 uppercase">{r.canal}</span>
                                    {r.es_local_region && region && (
                                      <span className="text-[8px] font-bold bg-[#EFF6FF] text-[#2563EB] px-1.5 py-0.5 rounded-full border border-[#2563EB]/20">
                                        📍 Local
                                      </span>
                                    )}
                                  </div>
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

                  {/* Tiendas físicas locales de la región (referencia, no garantiza stock) */}
                  {!item.procesando && (resultadosLocales.get(item.numero)?.length || mapsLinksLocales.get(item.numero)) && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin size={11} className="text-amber-600" />
                          Tiendas físicas a consultar · {region}
                          {resultadosLocales.get(item.numero)?.length
                            ? <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold">{resultadosLocales.get(item.numero)!.length}</span>
                            : null}
                        </span>
                        {mapsLinksLocales.get(item.numero) && (
                          <a
                            href={mapsLinksLocales.get(item.numero)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-semibold flex-shrink-0"
                          >
                            <ExternalLink size={10} /> Ver más en Maps
                          </a>
                        )}
                      </div>
                      {notaLocales && (
                        <p className="text-[9px] text-slate-400 mb-2 leading-snug">{notaLocales}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {(resultadosLocales.get(item.numero) || []).map((local, li) => (
                          <div
                            key={li}
                            className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg border bg-amber-50 border-amber-100 text-amber-800"
                          >
                            <span>📍</span>
                            <span className="font-semibold">{local.tienda}</span>
                            {local.rubro && (
                              <span className="text-[8px] uppercase tracking-wide bg-amber-100 text-amber-600 px-1 py-0.5 rounded">
                                {local.rubro}
                              </span>
                            )}
                            {local.direccion && (
                              <span className="text-[9px] opacity-60 max-w-[140px] truncate">{local.direccion}</span>
                            )}
                            {local.rating != null && (
                              <span className="text-[9px] text-amber-600">⭐ {local.rating}</span>
                            )}
                            {local.telefono && (
                              <a href={`tel:${local.telefono}`} className="text-[9px] text-blue-600 hover:underline">
                                📞 {local.telefono}
                              </a>
                            )}
                            {local.maps_url && (
                              <a
                                href={local.maps_url}
                                target="_blank"
                                rel="noreferrer"
                                className="opacity-50 hover:opacity-100 ml-0.5"
                              >
                                <ExternalLink size={9} />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
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
                      <button
                        onClick={() => buscarProducto(item.nombre, item.numero, item.conversion).then(r => setItemsLista(prev => prev.map(p => p.numero===item.numero ? r : p)))}
                        className="ml-auto text-xs text-[#2563EB] hover:text-[#3730A3] flex items-center gap-1 flex-shrink-0"
                      >
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
