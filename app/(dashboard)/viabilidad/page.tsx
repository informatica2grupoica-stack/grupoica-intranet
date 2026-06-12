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
  ClipboardList, Users, Gavel, Download, Calculator,
} from 'lucide-react';
import { confirmar } from '@/components/ui/Confirm';
import {
  type ProductoExcel, type ColsDetectadas,
  detectarHojasLineas, procesarHojaCosteo, procesarHojasLineas,
} from '@/lib/excel/costeo';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ItemViabilidad {
  item: string;
  nombre: string;
  especificaciones: string;
  cantidad: string;
  unidad: string;
  linea?: string;
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

interface ItemResultadoBuscador {
  numero: string;
  nombre: string;
  precio: number;
  cantidad: number;
  tienda: string;
  link: string;
  match: number;
  seleccionManual?: boolean;
  hoja?: string;
  itemOriginal?: string;
}

interface ItemAltoRiesgo {
  numero: string;
  nombre: string;
  motivo: string;
  match: number;
  hoja?: string;
  itemOriginal?: string;
}

interface ResultadosBuscador {
  items: ItemResultadoBuscador[];
  itemsAltoRiesgo?: ItemAltoRiesgo[];
  totalConIva: number;
  totalNeto: number;
  totalItems: number;
  itemsConPrecio: number;
  formato?: 'costeo' | 'lineas';
  colsPorHoja?: Record<string, ColsDetectadas>;
  fecha: string;
}

// Convierte montos en formato chileno ("$5.000.000", "5.000.000,50") a número
function parsearMontoCLP(str: string): number {
  if (!str) return 0;
  const limpio = String(str).replace(/[^\d,.-]/g, '');
  if (!limpio) return 0;
  const normalizado = limpio.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalizado);
  return isNaN(n) ? 0 : n;
}

const ACCEPT_DOCS = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';

const MIME_POR_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

// Formatos que aún no se pueden analizar (PowerPoint, etc.) — se rechazan con un aviso.
const EXTENSIONES_NO_SOPORTADAS = ['ppt', 'pptx'];

function mimeDeArchivo(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return MIME_POR_EXT[ext] || 'application/octet-stream';
}

// ─── Helpers base64 ↔ File (para conservar el Excel original entre navegaciones) ──
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function base64ToFile(base64: string, filename: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File(
    [bytes],
    filename || 'COSTEO.xlsx',
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  );
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
  const [colsExcel, setColsExcel] = useState<ColsDetectadas | null>(null);
  const [sheetName, setSheetName] = useState('COSTEO');

  // Formato del Excel: COSTEO (una pestaña) o LÍNEAS (varias hojas LINEAn)
  const [formatoExcel, setFormatoExcel] = useState<'costeo' | 'lineas'>('costeo');
  const [colsExcelPorHoja, setColsExcelPorHoja] = useState<Record<string, ColsDetectadas> | null>(null);
  const [eleccionFormato, setEleccionFormato] = useState<{ wb: XLSX.WorkBook; hojasLineas: string[]; totalItemsLineas: number } | null>(null);

  // Documentos de la licitación
  const [documentos, setDocumentos] = useState<File[]>([]);

  // Análisis
  const [analizando, setAnalizando] = useState(false);
  const [pasoActual, setPasoActual] = useState('');
  const [resultado, setResultado] = useState<ResultadoAnalisis | null>(null);
  const [nombreProyecto, setNombreProyecto] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Resultados del buscador de productos (handoff de vuelta) y veredicto final
  const [resultadosBuscador, setResultadosBuscador] = useState<ResultadosBuscador | null>(null);
  const [calculandoVeredicto, setCalculandoVeredicto] = useState(false);
  const [descargandoExcel, setDescargandoExcel] = useState(false);
  const [descargandoPlantilla, setDescargandoPlantilla] = useState<'costeo' | 'lineas' | null>(null);

  // Análisis guardados
  const [guardados, setGuardados] = useState<AnalisisGuardado[]>([]);
  const [cargandoGuardados, setCargandoGuardados] = useState(true);
  const [mostrarGuardados, setMostrarGuardados] = useState(false);

  const inputExcelRef = useRef<HTMLInputElement>(null);
  const inputDocsRef = useRef<HTMLInputElement>(null);
  const archivoBase64Ref = useRef<{ file: File; base64: string } | null>(null);

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

  // Recibir resultados enviados desde el buscador de productos
  useEffect(() => {
    const raw = sessionStorage.getItem('viabilidad_resultados_buscador');
    if (!raw) return;
    sessionStorage.removeItem('viabilidad_resultados_buscador');
    try {
      const data = JSON.parse(raw) as ResultadosBuscador;
      if (data?.items?.length) {
        setResultadosBuscador(data);
        toast(`${data.itemsConPrecio} de ${data.totalItems} ítems con precio recibidos del buscador`, 'success');
      }
    } catch { /* ignorar */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restaurar el análisis/Excel que estaban en pantalla antes de ir al buscador
  useEffect(() => {
    const raw = sessionStorage.getItem('viabilidad_estado');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.resultado) setResultado(data.resultado);
      if (data.productosExcel) setProductosExcel(data.productosExcel);
      if (data.nombreProyecto) setNombreProyecto(data.nombreProyecto);
      if (data.colsExcel) setColsExcel(data.colsExcel);
      if (data.sheetName) setSheetName(data.sheetName);
      if (data.formatoExcel) setFormatoExcel(data.formatoExcel);
      if (data.colsExcelPorHoja) setColsExcelPorHoja(data.colsExcelPorHoja);
      if (data.archivoBase64 && data.archivoNombre) {
        const file = base64ToFile(data.archivoBase64, data.archivoNombre);
        archivoBase64Ref.current = { file, base64: data.archivoBase64 };
        setArchivoExcel(file);
      }
    } catch { /* ignorar */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Conserva el análisis/Excel en sessionStorage entre navegaciones ───────
  const obtenerArchivoBase64 = useCallback(async (): Promise<string | null> => {
    if (!archivoExcel) return null;
    if (archivoBase64Ref.current?.file === archivoExcel) return archivoBase64Ref.current.base64;
    const base64 = await fileToBase64(archivoExcel);
    archivoBase64Ref.current = { file: archivoExcel, base64 };
    return base64;
  }, [archivoExcel]);

  const persistirEstado = useCallback(async () => {
    if (!resultado) { sessionStorage.removeItem('viabilidad_estado'); return; }
    const archivoBase64 = await obtenerArchivoBase64();
    sessionStorage.setItem('viabilidad_estado', JSON.stringify({
      resultado, productosExcel, nombreProyecto, colsExcel, sheetName,
      formatoExcel, colsExcelPorHoja,
      archivoBase64, archivoNombre: archivoExcel?.name || null,
    }));
  }, [resultado, productosExcel, nombreProyecto, colsExcel, sheetName, formatoExcel, colsExcelPorHoja, archivoExcel, obtenerArchivoBase64]);

  useEffect(() => {
    const t = setTimeout(() => { persistirEstado(); }, 400);
    return () => clearTimeout(t);
  }, [persistirEstado]);

  // ─── Cargar Excel COSTEO ─────────────────────────────────────────────────────
  const procesarPestanaCosteo = (wb: XLSX.WorkBook, sheet: string, file: File) => {
    const resultado = procesarHojaCosteo(wb, sheet);
    if (!resultado) { toast('No se encontraron encabezados en el Excel', 'error'); return; }
    if (!resultado.items.length) { toast('No se encontraron productos en el Excel', 'error'); return; }

    setFormatoExcel('costeo');
    setColsExcelPorHoja(null);
    setProductosExcel(resultado.items);
    setSheetName(sheet);
    setColsExcel(resultado.cols);
    if (!nombreProyecto.trim()) {
      setNombreProyecto(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim());
    }
    toast(`${resultado.items.length} ítems detectados en "${sheet}"`, 'success');
  };

  const cargarExcel = (file: File) => {
    setArchivoExcel(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });

        const hojasLineas = detectarHojasLineas(wb);
        if (hojasLineas.length > 0) {
          const { items } = procesarHojasLineas(wb, hojasLineas);
          setEleccionFormato({ wb, hojasLineas, totalItemsLineas: items.length });
          return;
        }

        const sheet = wb.SheetNames.includes('COSTEO') ? 'COSTEO' : wb.SheetNames[0];
        procesarPestanaCosteo(wb, sheet, file);
      } catch (err: any) {
        toast(`Error leyendo Excel: ${err.message}`, 'error');
      }
    };
    reader.onerror = () => toast('Error al leer el archivo Excel', 'error');
    reader.readAsArrayBuffer(file);
  };

  // ─── Elección de formato: COSTEO (una pestaña) vs LÍNEAS (varias hojas) ───────
  const elegirFormatoLineas = () => {
    if (!eleccionFormato) return;
    const { wb, hojasLineas } = eleccionFormato;
    const { items, colsPorHoja } = procesarHojasLineas(wb, hojasLineas);
    if (!items.length) { toast('No se encontraron productos en las hojas LÍNEA', 'error'); setEleccionFormato(null); return; }

    setFormatoExcel('lineas');
    setColsExcelPorHoja(colsPorHoja);
    setColsExcel(null);
    setProductosExcel(items);
    if (!nombreProyecto.trim() && archivoExcel) {
      setNombreProyecto(archivoExcel.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim());
    }
    setEleccionFormato(null);
    toast(`${items.length} productos desde ${hojasLineas.length} hojas (${hojasLineas.join(', ')})`, 'success');
  };

  const elegirFormatoCosteo = () => {
    if (!eleccionFormato || !archivoExcel) return;
    const { wb, hojasLineas } = eleccionFormato;
    const sheet = wb.SheetNames.find(s => !hojasLineas.includes(s) && /costeo/i.test(s)) || wb.SheetNames[0];
    setEleccionFormato(null);
    procesarPestanaCosteo(wb, sheet, archivoExcel);
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
      toast(`${rechazados} archivo(s) PowerPoint no se pueden analizar con IA y fueron omitidos.`, 'warning');
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
      const itemsExcelPayload = productosExcel.map(p => ({ numero: String(p.numero), detalle: p.nombre, cantidad: p.cantidad, unidad: p.conversion }));
      const res = await fetch('/api/viabilidad-analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivos, itemsExcel: itemsExcelPayload }),
      });
      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.status === 504 || !res.ok
            ? 'El servidor tardó demasiado o falló procesando los documentos. Intenta con menos documentos o documentos más livianos.'
            : 'Respuesta inesperada del servidor'
        );
      }
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
  const enviarABuscador = async () => {
    if (!resultado?.items.length) { toast('No hay ítems para enviar', 'warning'); return; }

    const mapaExcel = new Map(productosExcel.map(p => [String(p.numero), p]));

    const items: ProductoExcel[] = resultado.items.map((it, idx) => {
      const ref = mapaExcel.get(it.item);
      // La cantidad real del Excel manda — la IA solo completa si el Excel no la trae
      // (de lo contrario la IA puede devolver "1" por defecto y subestimar el costo total)
      const cantidad = ref?.cantidad || parseFloat(it.cantidad) || 1;
      return {
        numero: it.item || String(idx + 1),
        nombre: it.nombre || ref?.nombre || '',
        cantidad,
        valor_civa: ref?.valor_civa || 0,
        link_referencia: ref?.link_referencia || '',
        conversion: ref?.conversion || (it.unidad ? it.unidad.toLowerCase() : 'unidad'),
        ...(ref?._hoja ? { _hoja: ref._hoja, _itemOriginal: ref._itemOriginal } : {}),
      };
    }).filter(p => p.nombre);

    if (!items.length) { toast('No se pudieron preparar los ítems', 'error'); return; }

    sessionStorage.setItem('viabilidad_items_excel', JSON.stringify(items));

    // Pasar también el Excel original (para habilitar las descargas en formato COSTEO allá)
    if (archivoExcel) {
      try {
        const archivoBase64 = await obtenerArchivoBase64();
        sessionStorage.setItem('viabilidad_excel_archivo', JSON.stringify({
          base64: archivoBase64, nombre: archivoExcel.name, cols: colsExcel, sheetName,
          formato: formatoExcel, ...(formatoExcel === 'lineas' && colsExcelPorHoja ? { colsPorHoja: colsExcelPorHoja } : {}),
        }));
      } catch { /* si falla, igual se envían los ítems */ }
    }

    // Conservar el análisis actual para mostrarlo al volver desde el buscador
    await persistirEstado();

    toast(`Enviando ${items.length} ítems al buscador...`, 'success');
    router.push('/buscador-productos');
  };

  // ─── Limpiar todo: estado + sessionStorage (empieza un análisis desde cero) ─
  const limpiarTodo = async () => {
    if (!(await confirmar({
      titulo: '¿Limpiar todo el análisis?',
      descripcion: 'Se borrará el análisis actual, el Excel cargado, los documentos y los resultados del buscador. Los análisis guardados no se tocan.',
      confirmText: 'Limpiar todo',
      danger: true,
    }))) return;

    for (const k of ['viabilidad_estado', 'viabilidad_resultados_buscador', 'viabilidad_items_excel', 'viabilidad_excel_archivo']) {
      sessionStorage.removeItem(k);
    }
    setArchivoExcel(null); setProductosExcel([]); setColsExcel(null); setSheetName('COSTEO');
    setFormatoExcel('costeo'); setColsExcelPorHoja(null); setEleccionFormato(null);
    setDocumentos([]); setResultado(null); setNombreProyecto('');
    setResultadosBuscador(null);
    archivoBase64Ref.current = null;
    veredictoAutoRef.current = false;
    toast('Análisis limpiado — puedes empezar uno nuevo', 'success');
  };

  // ─── Calcular veredicto final (cruza presupuesto + costo real del buscador) ─
  const calcularVeredicto = async () => {
    if (!resultado || !resultadosBuscador) return;
    setCalculandoVeredicto(true);
    try {
      const res = await fetch('/api/viabilidad-veredicto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analisis: resultado.analisis,
          costoTotalConIva: resultadosBuscador.totalConIva,
          costoTotalNeto: resultadosBuscador.totalNeto,
          totalItems: resultadosBuscador.totalItems,
          itemsConPrecio: resultadosBuscador.itemsConPrecio,
          itemsAltoRiesgo: resultadosBuscador.itemsAltoRiesgo || [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo calcular el veredicto');

      setResultado(prev => prev ? {
        ...prev,
        analisis: {
          ...prev.analisis,
          proyecto_viable: data.proyecto_viable,
          justificacion_viabilidad: data.justificacion_viabilidad,
          observaciones: data.observaciones,
          ...(data.productos_criticos ? { productos_criticos: data.productos_criticos } : {}),
        },
      } : prev);
      toast('Veredicto final actualizado', 'success');
    } catch (e: any) {
      toast(`Error: ${e.message}`, 'error');
    } finally {
      setCalculandoVeredicto(false);
    }
  };

  // Al volver del buscador con resultados (y ya teniendo un análisis), calcular
  // el veredicto final automáticamente una sola vez.
  const veredictoAutoRef = useRef(false);
  useEffect(() => {
    if (veredictoAutoRef.current) return;
    if (resultado && resultadosBuscador) {
      veredictoAutoRef.current = true;
      calcularVeredicto();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado, resultadosBuscador]);

  // ─── Descargar Excel completo (COSTEO con precios + pestaña Análisis) ───────
  const descargarExcelCompleto = async () => {
    if (!archivoExcel) { toast('Sube el Excel COSTEO primero', 'warning'); return; }
    if (!resultado) { toast('Analiza la documentación primero', 'warning'); return; }
    setDescargandoExcel(true);
    try {
      const formato = resultadosBuscador?.formato || formatoExcel;

      const fd = new FormData();
      fd.append('file', archivoExcel, archivoExcel.name);
      fd.append('modo', 'viabilidad');
      fd.append('formato', formato);
      fd.append('analisis', JSON.stringify(resultado.analisis));
      if (formato === 'lineas') {
        const colsPorHoja = resultadosBuscador?.colsPorHoja || colsExcelPorHoja;
        if (colsPorHoja) fd.append('colsPorHoja', JSON.stringify(colsPorHoja));
      } else {
        fd.append('sheetName', sheetName);
        if (colsExcel) fd.append('cols', JSON.stringify(colsExcel));
      }
      if (resultadosBuscador?.items.length) fd.append('seleccionados', JSON.stringify(resultadosBuscador.items));

      const res = await fetch('/api/exportar-excel', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || 'No se pudo generar el Excel');
      }

      const blob = await res.blob();
      const nombreLimpio = (nombreProyecto || 'proyecto').replace(/[^\w-]+/g, '_');
      const filename = `Viabilidad_${nombreLimpio}_${new Date().toISOString().split('T')[0]}.xlsx`;
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: filename,
      });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast('Excel descargado', 'success');
    } catch (e: any) {
      toast(`Error: ${e.message}`, 'error');
    } finally {
      setDescargandoExcel(false);
    }
  };

  // ─── Descargar plantilla en blanco rellenada (sin necesitar Excel propio) ──────
  const descargarPlantilla = async (formato: 'costeo' | 'lineas') => {
    if (!resultado) { toast('Analiza la documentación primero', 'warning'); return; }
    setDescargandoPlantilla(formato);
    try {
      const fd = new FormData();
      fd.append('usarPlantilla', 'true');
      fd.append('modo', 'viabilidad');
      fd.append('formato', formato);
      fd.append('analisis', JSON.stringify(resultado.analisis));
      fd.append('itemsBases', JSON.stringify(resultado.items));
      if (resultadosBuscador?.items.length) fd.append('seleccionados', JSON.stringify(resultadosBuscador.items));

      const res = await fetch('/api/exportar-excel', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || 'No se pudo generar el Excel');
      }

      const blob = await res.blob();
      const nombreLimpio = (nombreProyecto || 'proyecto').replace(/[^\w-]+/g, '_');
      const sufijo = formato === 'lineas' ? 'lineas' : 'costeo';
      const filename = `Viabilidad_${nombreLimpio}_${sufijo}_${new Date().toISOString().split('T')[0]}.xlsx`;
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: filename,
      });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast('Excel descargado', 'success');
    } catch (e: any) {
      toast(`Error: ${e.message}`, 'error');
    } finally {
      setDescargandoPlantilla(null);
    }
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
  const presupuesto = a ? parsearMontoCLP(a.presupuesto_con_iva) : 0;
  const margenPct = (presupuesto > 0 && resultadosBuscador)
    ? ((presupuesto - resultadosBuscador.totalConIva) / presupuesto) * 100
    : null;

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
          {(resultado || archivoExcel || documentos.length > 0 || resultadosBuscador) && (
            <button
              onClick={limpiarTodo}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-100 transition-colors"
              title="Borrar el análisis actual y empezar desde cero"
            >
              <Trash2 size={13} /> Limpiar todo
            </button>
          )}
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

            {/* Elección de formato: COSTEO (una pestaña) vs LÍNEAS (varias hojas) */}
            {eleccionFormato && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                <p className="text-[11px] text-amber-800 font-medium">
                  Este Excel tiene hojas {eleccionFormato.hojasLineas.join(', ')}. ¿Cómo quieres procesarlo?
                </p>
                <button onClick={elegirFormatoLineas}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg text-xs font-semibold transition-colors">
                  Procesar por LÍNEAS ({eleccionFormato.hojasLineas.length} hojas, {eleccionFormato.totalItemsLineas} ítems)
                </button>
                <button onClick={elegirFormatoCosteo}
                  className="w-full bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 py-2 rounded-lg text-xs font-semibold transition-colors">
                  Procesar solo una pestaña (COSTEO)
                </button>
              </div>
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
              <Upload size={14} /> Bases, anexos, formularios... (PDF, Word, Excel, imágenes)
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
                {a.presupuesto_con_iva && (
                  <p className="mt-2 inline-flex items-center gap-1.5 bg-white/70 rounded-lg px-2.5 py-1.5 text-xs">
                    <Wallet size={13} className="text-slate-500" />
                    <span className="text-slate-500">Presupuesto disponible:</span>
                    <span className="font-black text-slate-800">
                      {a.presupuesto_con_iva}{presupuesto > 0 ? ` (≈ $${presupuesto.toLocaleString('es-CL')})` : ''}
                    </span>
                  </p>
                )}
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

          {/* Resumen financiero (resultados del buscador de productos) */}
          {resultadosBuscador && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Wallet size={13} /> Resumen financiero (buscador de productos)
              </h4>
              <div className="flex flex-wrap gap-2.5">
                <div className="flex-1 min-w-[140px] bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-slate-700 leading-none">
                    {presupuesto > 0 ? `$${presupuesto.toLocaleString('es-CL')}` : '—'}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-wide font-bold">Presupuesto c/IVA</p>
                </div>
                <div className="flex-1 min-w-[140px] bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-slate-700 leading-none">
                    ${resultadosBuscador.totalConIva.toLocaleString('es-CL')}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-wide font-bold">Costo real c/IVA</p>
                </div>
                <div className={`flex-1 min-w-[140px] rounded-xl p-3 text-center ${
                  margenPct === null ? 'bg-slate-50' : margenPct >= 0 ? 'bg-emerald-50' : 'bg-red-50'
                }`}>
                  <p className={`text-lg font-black leading-none ${
                    margenPct === null ? 'text-slate-700' : margenPct >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {margenPct !== null ? `${margenPct.toFixed(1)}%` : '—'}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-wide font-bold">Margen</p>
                </div>
                <div className="flex-1 min-w-[140px] bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-slate-700 leading-none">
                    {resultadosBuscador.itemsConPrecio}/{resultadosBuscador.totalItems}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-wide font-bold">Ítems con precio</p>
                </div>
              </div>
              <button
                onClick={calcularVeredicto}
                disabled={calculandoVeredicto}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors"
              >
                {calculandoVeredicto ? <Loader2 size={15} className="animate-spin" /> : <Calculator size={15} />}
                Calcular veredicto final con IA
              </button>
            </div>
          )}

          {/* Ítems de alto riesgo de búsqueda (baja confianza de match / sin resultados) */}
          {!!resultadosBuscador?.itemsAltoRiesgo?.length && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm p-5">
              <h4 className="font-bold text-amber-800 text-xs uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <AlertTriangle size={13} /> Ítems de alto riesgo de búsqueda ({resultadosBuscador.itemsAltoRiesgo.length})
              </h4>
              <p className="text-[11px] text-amber-700 mb-3">
                Coincidencias poco confiables — revisar manualmente la ficha técnica antes de cotizar.
              </p>
              <div className="space-y-1.5">
                {resultadosBuscador.itemsAltoRiesgo.map(it => (
                  <div key={it.numero} className="flex items-start gap-2 bg-white/70 rounded-xl px-3 py-2 text-xs">
                    <span className="font-mono font-bold text-amber-700 shrink-0">#{it.numero}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-700 truncate">{it.nombre}</p>
                      <p className="text-amber-700 mt-0.5">{it.motivo}{it.match > 0 ? ` (match ${it.match}%)` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
          {resultado!.items.length > 0 && (() => {
            const hayLineas = resultado!.items.some(it => it.linea);
            const totalLineas = hayLineas
              ? new Set(resultado!.items.map(it => (it.linea || '').match(/(\d+)/)?.[1] || '1')).size
              : 0;
            return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Package size={13} /> Ítems detectados ({resultado!.items.length})
                </h4>
                {hayLineas && (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-full px-2.5 py-1">
                    Licitación por líneas — {totalLineas} línea{totalLineas !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400 uppercase text-[10px] tracking-wide border-b border-slate-100">
                      <th className="py-2 pr-3 font-bold">Item</th>
                      {hayLineas && <th className="py-2 pr-3 font-bold">Línea</th>}
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
                        {hayLineas && (
                          <td className="py-2 pr-3">
                            {it.linea ? (
                              <span className="inline-block text-[10px] font-bold bg-indigo-50 text-indigo-600 rounded px-1.5 py-0.5 whitespace-nowrap">
                                {it.linea}
                              </span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                        )}
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
            );
          })()}

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
            <button
              onClick={descargarExcelCompleto}
              disabled={descargandoExcel || !archivoExcel}
              title={!archivoExcel ? 'Sube el Excel COSTEO para habilitar la descarga' : undefined}
              className="flex-1 min-w-[200px] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm py-3 rounded-xl transition-colors"
            >
              {descargandoExcel ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Descargar Excel completo (COSTEO + Análisis)
            </button>
          </div>

          {/* Plantillas en blanco — generadas desde las bases, sin necesitar Excel propio */}
          <div className="flex flex-wrap gap-3 mt-3">
            <button
              onClick={() => descargarPlantilla('costeo')}
              disabled={descargandoPlantilla !== null}
              title={resultadosBuscador?.items.length ? 'Incluye precios y links del buscador' : 'Sin precios — pásalo por el buscador para incluirlos'}
              className="flex-1 min-w-[200px] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-sm py-3 rounded-xl transition-colors"
            >
              {descargandoPlantilla === 'costeo' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Descargar plantilla COSTEO {resultadosBuscador?.items.length ? '(con precios)' : '(sin precios)'}
            </button>
            <button
              onClick={() => descargarPlantilla('lineas')}
              disabled={descargandoPlantilla !== null}
              title={resultadosBuscador?.items.length ? 'Incluye precios y links del buscador' : 'Sin precios — pásalo por el buscador para incluirlos'}
              className="flex-1 min-w-[200px] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-sm py-3 rounded-xl transition-colors"
            >
              {descargandoPlantilla === 'lineas' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Descargar plantilla por LÍNEAS {resultadosBuscador?.items.length ? '(con precios)' : '(sin precios)'}
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
