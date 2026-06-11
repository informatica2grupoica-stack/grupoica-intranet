'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toast';
import {
  FileSearch, Upload, FileText, FileSpreadsheet, X, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Sparkles, Send, Save,
  Calendar, Building2, MapPin, Percent, ShieldCheck, Package,
  Bookmark, Trash2, ExternalLink, RefreshCw, ChevronDown, Wallet,
  ClipboardList, Users, Gavel,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ProductoExcel {
  numero: number | string;
  nombre: string;
  cantidad: number;
  valor_civa: number;
  link_referencia: string;
  conversion: string;
  _fila?: number;
}

interface ItemViabilidad {
  item: string;
  nombre: string;
  especificaciones: string;
  cantidad: string;
  unidad: string;
}

interface FormaEvaluacion {
  criterio_economico: string;
  criterio_tecnico: string;
  programa: string;
  requisitos_formales: string;
}

interface AnalisisViabilidad {
  id_proceso: string;
  descripcion_proyecto: string;
  cliente: string;
  presupuesto_con_iva: string;
  fecha_cierre: string;
  fecha_adjudicacion: string;
  productos_criticos: string;
  tipo_productos: string;
  proyecto_suma_alzada: string;
  proyecto_por_linea: string;
  proveedores_sugeridos: string;
  lugar_entrega: string;
  multas: string;
  plazo_aceptacion_oc: string;
  garantias: string;
  forma_evaluacion: FormaEvaluacion;
  proyecto_viable: string;
  justificacion_viabilidad: string;
  observaciones: string;
}

interface ResultadoAnalisis {
  analisis: AnalisisViabilidad;
  items: ItemViabilidad[];
  total: number;
}

interface AnalisisGuardado {
  id: string;
  nombre: string;
  id_proceso: string;
  cliente: string;
  proyecto_viable: string;
  created_at: string;
  user_id: string;
  user_email: string;
  user_nombre: string;
}

const ACCEPT_DOCS = '.pdf,.jpg,.jpeg,.png';

const MIME_POR_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

// Extensiones que Gemini NO puede leer directamente (Office) — se rechazan con un aviso.
const EXTENSIONES_NO_SOPORTADAS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

function mimeDeArchivo(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return MIME_POR_EXT[ext] || 'application/octet-stream';
}

// ─── Helpers de UI ─────────────────────────────────────────────────────────────
const Campo = ({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) => (
  <div className="bg-slate-50 rounded-xl p-3">
    <p className="text-[9px] text-slate-400 uppercase tracking-wide font-bold mb-1 flex items-center gap-1">
      {Icon && <Icon size={10} />} {label}
    </p>
    <p className="text-sm font-semibold text-slate-700 break-words">{value || '—'}</p>
  </div>
);

const PorcentajeBadge = ({ label, value }: { label: string; value: string }) => (
  <div className="flex-1 min-w-[100px] bg-white border border-slate-200 rounded-xl p-3 text-center">
    <p className="text-lg font-black text-[#2563EB] leading-none">{value || '—'}</p>
    <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-wide font-bold">{label}</p>
  </div>
);

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ViabilidadPage() {
  const router = useRouter();

  // Excel COSTEO
  const [archivoExcel, setArchivoExcel] = useState<File | null>(null);
  const [productosExcel, setProductosExcel] = useState<ProductoExcel[]>([]);

  // Documentos de la licitación
  const [documentos, setDocumentos] = useState<File[]>([]);

  // Análisis
  const [analizando, setAnalizando] = useState(false);
  const [pasoActual, setPasoActual] = useState('');
  const [resultado, setResultado] = useState<ResultadoAnalisis | null>(null);
  const [nombreProyecto, setNombreProyecto] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Análisis guardados
  const [guardados, setGuardados] = useState<AnalisisGuardado[]>([]);
  const [cargandoGuardados, setCargandoGuardados] = useState(true);
  const [mostrarGuardados, setMostrarGuardados] = useState(false);

  const inputExcelRef = useRef<HTMLInputElement>(null);
  const inputDocsRef = useRef<HTMLInputElement>(null);

  // ─── Cargar análisis guardados ─────────────────────────────────────────────
  const cargarGuardados = useCallback(async () => {
    setCargandoGuardados(true);
    try {
      const res = await fetch('/api/viabilidad');
      if (res.ok) {
        const data = await res.json();
        setGuardados(data.analisis ?? []);
      }
    } catch { /* silencioso */ }
    setCargandoGuardados(false);
  }, []);

  useEffect(() => { cargarGuardados(); }, [cargarGuardados]);

  // ─── Cargar Excel COSTEO ─────────────────────────────────────────────────────
  const cargarExcel = (file: File) => {
    setArchivoExcel(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames.includes('COSTEO') ? 'COSTEO' : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (!jsonData.length) { toast('Pestaña vacía', 'warning'); return; }

        let headerRow = -1;
        let colItem = -1, colDetalle = -1, colCantidad = -1, colValor = -1, colLink = -1, colConversion = -1;

        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
          const row = jsonData[i];
          if (!row) continue;
          if (row.some((c: any) => ['ITEM', 'DETALLE', 'CANTIDAD'].includes(String(c || '').toUpperCase().trim()))) {
            headerRow = i;
            row.forEach((c: any, j: number) => {
              const h = String(c || '').toUpperCase().trim();
              if (h === 'ITEM' || h.includes('ITEM')) colItem = j;
              else if (h.includes('DETALLE')) colDetalle = j;
              else if (h.includes('CANTIDAD')) colCantidad = j;
              else if (h.includes('VALOR') && h.includes('IVA')) colValor = j;
              else if (h.includes('CONVERSION')) colConversion = j;
              else if (h.includes('LINK')) colLink = j;
            });
            break;
          }
        }

        if (headerRow === -1) { toast('No se encontraron encabezados en el Excel', 'error'); return; }

        const ADMIN_WORDS = ['TOTAL', 'VERDADERO', 'COSTEADO', 'SUBTOTAL', 'ENTREGA', 'SOLICITA', 'FICHA', 'CIUDAD', 'REGION', 'REGIÓN', 'OBSERVACI', 'NOTA:', 'NOTA ', 'PLAZO', 'CONTRATO', 'DIRECCIÓN', 'DIRECCION'];

        const items: ProductoExcel[] = [];
        for (let i = headerRow + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row.length) continue;
          const detalle = colDetalle >= 0 ? String(row[colDetalle] || '').trim() : '';
          if (!detalle) continue;
          if (ADMIN_WORDS.some(s => detalle.toUpperCase().includes(s))) continue;
          const itemRaw = colItem >= 0 ? String(row[colItem] || '').trim() : '';
          if (!itemRaw && detalle.split(' ').length > 6) continue;
          const conversion = colConversion >= 0 ? String(row[colConversion] || '').trim().toLowerCase() : 'unidad';
          let valorCIVA = 0;
          if (colValor >= 0 && row[colValor] != null) {
            const raw = row[colValor];
            valorCIVA = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[$.]/g, '').replace(',', '.')) || 0;
          }
          const numeroRaw = itemRaw || String(i - headerRow);
          const numero = isNaN(Number(numeroRaw)) ? numeroRaw : Number(numeroRaw);
          items.push({
            numero: numero as number,
            nombre: detalle,
            cantidad: colCantidad >= 0 ? Number(row[colCantidad]) || 1 : 1,
            valor_civa: valorCIVA,
            link_referencia: colLink >= 0 ? String(row[colLink] || '').trim() : '',
            conversion: conversion || 'unidad',
            _fila: i,
          });
        }

        if (!items.length) { toast('No se encontraron productos en el Excel', 'error'); return; }
        setProductosExcel(items);
        if (!nombreProyecto.trim()) {
          setNombreProyecto(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim());
        }
        toast(`${items.length} ítems detectados en "${sheetName}"`, 'success');
      } catch (err: any) {
        toast(`Error leyendo Excel: ${err.message}`, 'error');
      }
    };
    reader.onerror = () => toast('Error al leer el archivo Excel', 'error');
    reader.readAsArrayBuffer(file);
  };

  // ─── Manejo de documentos ────────────────────────────────────────────────────
  const agregarDocumentos = (files: FileList | File[]) => {
    const todos = Array.from(files);

    // Filtrar archivos de lock/temporales de Office (~$archivo.doc)
    const sinLocks = todos.filter(f => !f.name.startsWith('~$'));

    // Rechazar formatos que Gemini no puede analizar (Word, Excel, PowerPoint)
    const nuevos = sinLocks.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return !EXTENSIONES_NO_SOPORTADAS.includes(ext);
    });
    const rechazados = sinLocks.length - nuevos.length;
    if (rechazados > 0) {
      toast(`${rechazados} archivo(s) Word/Excel/PowerPoint no se pueden analizar con IA y fueron omitidos. Usa el cargador de Excel COSTEO para la planilla.`, 'warning');
    }

    setDocumentos(prev => {
      const combinados = [...prev, ...nuevos];
      if (combinados.length > 10) {
        toast('Máximo 10 documentos por análisis', 'warning');
        return combinados.slice(0, 10);
      }
      return combinados;
    });
  };

  const quitarDocumento = (idx: number) => {
    setDocumentos(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── Subir un documento a Storage ────────────────────────────────────────────
  const subirDocumento = async (file: File) => {
    const mimeType = mimeDeArchivo(file);
    const urlRes = await fetch('/api/viabilidad-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mimeType }),
    });
    const u = await urlRes.json();
    if (!urlRes.ok || !u.token) throw new Error(u.error || `No se pudo preparar la subida de "${file.name}"`);

    const { error } = await supabase.storage.from(u.bucket).uploadToSignedUrl(u.path, u.token, file);
    if (error) throw new Error(`Error subiendo "${file.name}": ${error.message}`);

    return { bucket: u.bucket, path: u.path, mimeType, nombre: file.name };
  };

  // ─── Analizar viabilidad ─────────────────────────────────────────────────────
  const analizar = async () => {
    if (!documentos.length) { toast('Sube al menos un documento de la licitación', 'warning'); return; }
    setAnalizando(true);
    setResultado(null);
    try {
      setPasoActual(`Subiendo ${documentos.length} documento(s)...`);
      const archivos = [];
      for (let i = 0; i < documentos.length; i++) {
        setPasoActual(`Subiendo documento ${i + 1} de ${documentos.length}: ${documentos[i].name}`);
        archivos.push(await subirDocumento(documentos[i]));
      }

      setPasoActual('Analizando con IA (puede tardar 1-2 minutos)...');
      const itemsExcelPayload = productosExcel.map(p => ({ numero: String(p.numero), detalle: p.nombre }));
      const res = await fetch('/api/viabilidad-analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivos, itemsExcel: itemsExcelPayload }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo analizar la documentación');

      setResultado({ analisis: data.analisis, items: data.items || [], total: data.total || 0 });
      if (!nombreProyecto.trim() && data.analisis?.descripcion_proyecto) {
        setNombreProyecto(data.analisis.descripcion_proyecto.slice(0, 150));
      }
      toast(`Análisis completo: ${data.total} ítems detectados`, 'success');
    } catch (e: any) {
      toast(`Error: ${e.message}`, 'error');
    } finally {
      setAnalizando(false);
      setPasoActual('');
    }
  };

  // ─── Enviar ítems al buscador de productos ──────────────────────────────────
  const enviarABuscador = () => {
    if (!resultado?.items.length) { toast('No hay ítems para enviar', 'warning'); return; }

    const mapaExcel = new Map(productosExcel.map(p => [String(p.numero), p]));

    const items: ProductoExcel[] = resultado.items.map((it, idx) => {
      const ref = mapaExcel.get(it.item);
      const cantidad = parseFloat(it.cantidad) || ref?.cantidad || 1;
      return {
        numero: it.item || String(idx + 1),
        nombre: it.nombre || ref?.nombre || '',
        cantidad,
        valor_civa: ref?.valor_civa || 0,
        link_referencia: ref?.link_referencia || '',
        conversion: ref?.conversion || (it.unidad ? it.unidad.toLowerCase() : 'unidad'),
      };
    }).filter(p => p.nombre);

    if (!items.length) { toast('No se pudieron preparar los ítems', 'error'); return; }

    sessionStorage.setItem('viabilidad_items_excel', JSON.stringify(items));
    toast(`Enviando ${items.length} ítems al buscador...`, 'success');
    router.push('/buscador-productos');
  };

  // ─── Guardar análisis ────────────────────────────────────────────────────────
  const guardarAnalisis = async () => {
    if (!resultado) return;
    if (!nombreProyecto.trim()) { toast('Asigna un nombre al análisis', 'warning'); return; }
    setGuardando(true);
    try {
      const res = await fetch('/api/viabilidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreProyecto.trim(),
          id_proceso: resultado.analisis.id_proceso,
          cliente: resultado.analisis.cliente,
          proyecto_viable: resultado.analisis.proyecto_viable,
          analisis: resultado.analisis,
          items: resultado.items,
          items_excel: productosExcel,
          archivos: documentos.map(d => ({ nombre: d.name })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar');
      toast('Análisis guardado', 'success');
      cargarGuardados();
    } catch (e: any) {
      toast(`Error guardando: ${e.message}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  // ─── Abrir / eliminar análisis guardado ─────────────────────────────────────
  const abrirGuardado = async (id: string) => {
    try {
      const res = await fetch(`/api/viabilidad/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar');
      const a = data.analisis;
      setResultado({ analisis: a.analisis, items: a.items || [], total: (a.items || []).length });
      setProductosExcel(a.items_excel || []);
      setNombreProyecto(a.nombre || '');
      setMostrarGuardados(false);
      toast('Análisis cargado', 'success');
    } catch (e: any) {
      toast(`Error: ${e.message}`, 'error');
    }
  };

  const eliminarGuardado = async (id: string) => {
    const res = await fetch(`/api/viabilidad/${id}`, { method: 'DELETE' });
    if (res.ok) setGuardados(prev => prev.filter(g => g.id !== id));
  };

  const a = resultado?.analisis;
  const viable = a?.proyecto_viable?.trim().toUpperCase();

  return (
    <div className="space-y-6">

      {/* ─── Carga de archivos ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#2563EB]/10 flex items-center justify-center">
            <FileSearch size={18} className="text-[#2563EB]" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm">Análisis de Viabilidad</h2>
            <p className="text-[11px] text-slate-400">Sube los documentos de la licitación y la IA extraerá los datos clave</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Excel COSTEO */}
          <div>
            <p className="text-[11px] font-bold text-slate-600 mb-2 flex items-center gap-1.5">
              <FileSpreadsheet size={13} className="text-emerald-600" /> Excel COSTEO (opcional)
            </p>
            <input
              ref={inputExcelRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => e.target.files?.[0] && cargarExcel(e.target.files[0])}
            />
            <button
              onClick={() => inputExcelRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 rounded-xl py-4 text-xs font-semibold text-slate-500 hover:text-emerald-700 transition-colors"
            >
              <Upload size={14} />
              {archivoExcel ? archivoExcel.name : 'Subir Excel COSTEO'}
            </button>
            {productosExcel.length > 0 && (
              <p className="text-[10px] text-emerald-600 mt-1.5 flex items-center gap-1">
                <CheckCircle2 size={11} /> {productosExcel.length} ítems detectados
              </p>
            )}
          </div>

          {/* Documentos de la licitación */}
          <div>
            <p className="text-[11px] font-bold text-slate-600 mb-2 flex items-center gap-1.5">
              <FileText size={13} className="text-[#2563EB]" /> Documentos de la licitación
            </p>
            <input
              ref={inputDocsRef}
              type="file"
              accept={ACCEPT_DOCS}
              multiple
              className="hidden"
              onChange={e => e.target.files && agregarDocumentos(e.target.files)}
            />
            <button
              onClick={() => inputDocsRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-[#2563EB]/40 hover:bg-blue-50/50 rounded-xl py-4 text-xs font-semibold text-slate-500 hover:text-[#2563EB] transition-colors"
            >
              <Upload size={14} /> Bases, anexos, formularios... (solo PDF e imágenes — Excel COSTEO va arriba)
            </button>
          </div>
        </div>

        {/* Lista de documentos */}
        {documentos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {documentos.map((doc, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-[11px] font-medium px-2.5 py-1.5 rounded-lg">
                <FileText size={12} className="text-slate-400" />
                {doc.name}
                <button onClick={() => quitarDocumento(idx)} className="text-slate-400 hover:text-red-500">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Nombre del proyecto */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Nombre del proceso/proyecto (para guardar el análisis)"
            value={nombreProyecto}
            onChange={e => setNombreProyecto(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#2563EB]/20 text-slate-700 placeholder:text-slate-400"
          />
        </div>

        {/* Botón analizar */}
        <button
          onClick={analizar}
          disabled={analizando || !documentos.length}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm py-3 rounded-xl transition-colors"
        >
          {analizando ? (
            <><Loader2 size={16} className="animate-spin" /> {pasoActual || 'Analizando...'}</>
          ) : (
            <><Sparkles size={16} /> Analizar viabilidad con IA</>
          )}
        </button>
      </div>

      {/* ─── Resultados ─────────────────────────────────────────────────────── */}
      {a && (
        <div className="space-y-4">

          {/* Encabezado + veredicto */}
          <div className={`rounded-2xl border shadow-sm p-5 ${
            viable === 'SI' ? 'bg-emerald-50 border-emerald-200' :
            viable === 'NO' ? 'bg-red-50 border-red-200' :
            'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-black text-slate-800 text-base leading-tight">{a.descripcion_proyecto || nombreProyecto || 'Análisis de licitación'}</h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                  <Building2 size={12} /> {a.cliente || '—'}
                  {a.id_proceso && <span className="font-mono bg-white/60 px-1.5 py-0.5 rounded text-[10px]">ID: {a.id_proceso}</span>}
                </p>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded-xl ${
                viable === 'SI' ? 'bg-emerald-500 text-white' :
                viable === 'NO' ? 'bg-red-500 text-white' :
                'bg-slate-300 text-slate-700'
              }`}>
                {viable === 'SI' ? <CheckCircle2 size={14} /> : viable === 'NO' ? <XCircle size={14} /> : <AlertTriangle size={14} />}
                {viable === 'SI' ? 'Viable' : viable === 'NO' ? 'No viable' : 'Sin evaluar'}
              </span>
            </div>
            {a.justificacion_viabilidad && (
              <p className="text-sm text-slate-600 mt-3 bg-white/60 rounded-xl p-3">{a.justificacion_viabilidad}</p>
            )}
          </div>

          {/* Datos generales */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <ClipboardList size={13} /> Datos del proceso
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              <Campo label="Presupuesto c/IVA" value={a.presupuesto_con_iva} icon={Wallet} />
              <Campo label="Fecha de cierre" value={a.fecha_cierre} icon={Calendar} />
              <Campo label="Fecha de adjudicación" value={a.fecha_adjudicacion} icon={Calendar} />
              <Campo label="Lugar de entrega" value={a.lugar_entrega} icon={MapPin} />
              <Campo label="Plazo aceptación OC" value={a.plazo_aceptacion_oc} />
              <Campo label="Garantías" value={a.garantias} icon={ShieldCheck} />
              <Campo label="Tipo de productos" value={a.tipo_productos} icon={Package} />
              <Campo label="Productos críticos" value={a.productos_criticos} />
              <Campo label="Suma alzada" value={a.proyecto_suma_alzada} />
              <Campo label="Por línea" value={a.proyecto_por_linea} />
              <Campo label="Proveedores sugeridos" value={a.proveedores_sugeridos} icon={Users} />
              <Campo label="Multas" value={a.multas} icon={Gavel} />
            </div>
          </div>

          {/* Forma de evaluación */}
          {a.forma_evaluacion && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Percent size={13} /> Forma de evaluación
              </h4>
              <div className="flex flex-wrap gap-2.5">
                <PorcentajeBadge label="Económico" value={a.forma_evaluacion.criterio_economico} />
                <PorcentajeBadge label="Técnico" value={a.forma_evaluacion.criterio_tecnico} />
                <PorcentajeBadge label="Programa" value={a.forma_evaluacion.programa} />
                <PorcentajeBadge label="Req. Formales" value={a.forma_evaluacion.requisitos_formales} />
              </div>
            </div>
          )}

          {/* Observaciones */}
          {a.observaciones && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">Observaciones</p>
              <p className="text-sm text-amber-800">{a.observaciones}</p>
            </div>
          )}

          {/* Ítems detectados */}
          {resultado!.items.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Package size={13} /> Ítems detectados ({resultado!.items.length})
                </h4>
              </div>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400 uppercase text-[10px] tracking-wide border-b border-slate-100">
                      <th className="py-2 pr-3 font-bold">Item</th>
                      <th className="py-2 pr-3 font-bold">Nombre</th>
                      <th className="py-2 pr-3 font-bold">Especificaciones</th>
                      <th className="py-2 pr-3 font-bold text-right">Cantidad</th>
                      <th className="py-2 font-bold">Unidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado!.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 pr-3 font-mono text-slate-500">{it.item}</td>
                        <td className="py-2 pr-3 font-semibold text-slate-700">{it.nombre}</td>
                        <td className="py-2 pr-3 text-slate-500 max-w-[320px]">{it.especificaciones}</td>
                        <td className="py-2 pr-3 text-right text-slate-700">{it.cantidad}</td>
                        <td className="py-2 text-slate-500">{it.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={enviarABuscador}
              disabled={!resultado!.items.length}
              className="flex-1 min-w-[200px] flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-slate-300 text-white font-bold text-sm py-3 rounded-xl transition-colors"
            >
              <Send size={15} /> Enviar ítems al buscador de productos
            </button>
            <button
              onClick={guardarAnalisis}
              disabled={guardando}
              className="flex-1 min-w-[160px] flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors"
            >
              {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar análisis
            </button>
          </div>
        </div>
      )}

      {/* ─── Análisis guardados ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <button onClick={() => setMostrarGuardados(v => !v)} className="w-full flex items-center justify-between">
          <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide flex items-center gap-1.5">
            <Bookmark size={13} /> Análisis guardados ({guardados.length})
          </h4>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${mostrarGuardados ? 'rotate-180' : ''}`} />
        </button>

        {mostrarGuardados && (
          <div className="mt-4">
            {cargandoGuardados ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-[#2563EB]" />
              </div>
            ) : guardados.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Aún no hay análisis guardados.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {guardados.map(g => (
                  <div key={g.id} className="border border-slate-200 rounded-xl p-3 hover:border-slate-300 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-sm font-bold text-slate-700 truncate" title={g.nombre}>{g.nombre}</p>
                      {g.proyecto_viable && (
                        <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          g.proyecto_viable.toUpperCase() === 'SI' ? 'bg-emerald-100 text-emerald-700' :
                          g.proyecto_viable.toUpperCase() === 'NO' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
                        }`}>{g.proyecto_viable}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mb-2">{g.cliente || '—'}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => abrirGuardado(g.id)}
                        className="flex-1 py-1.5 text-[11px] font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg flex items-center justify-center gap-1"
                      >
                        <ExternalLink size={11} /> Abrir
                      </button>
                      <button
                        onClick={() => eliminarGuardado(g.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg border border-slate-200"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={cargarGuardados}
              className="mt-3 text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <RefreshCw size={11} /> Actualizar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
