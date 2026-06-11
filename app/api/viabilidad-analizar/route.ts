// app/api/viabilidad-analizar/route.ts
// Lee N documentos de una licitación con Gemini y devuelve:
//  - "analisis": campos equivalentes a la pestaña "Analisis" del Excel COSTEO
//  - "items": ítems/productos detectados (cantidad, unidad), cruzados con el Excel si se entrega
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  GEMINI_KEY,
  subirArchivoAGemini, generarConGemini, parsearJSONSeguro, type GeminiPart,
  esDocumentoOffice, extraerTextoOffice,
} from '@/lib/gemini/documentos';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ArchivoEntrada {
  bucket: string;
  path: string;
  mimeType: string;
  nombre?: string;
}

const SINONIMOS_ANALISIS: Record<string, string> = {
  analisis: 'analisis', análisis: 'analisis', resumen: 'analisis',
};

export async function POST(req: Request) {
  if (!GEMINI_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY no configurada en el servidor' }, { status: 500 });
  }

  let archivos: ArchivoEntrada[] = [];
  let itemsExcel: Array<{ numero: string; detalle: string; cantidad?: number; unidad?: string }> = [];

  try {
    const body = await req.json();
    archivos = Array.isArray(body.archivos) ? body.archivos.slice(0, 10) : [];
    itemsExcel = Array.isArray(body.itemsExcel) ? body.itemsExcel.slice(0, 150) : [];
    if (!archivos.length) return NextResponse.json({ error: 'No se recibieron documentos' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const limpiarStorage = () => {
    for (const a of archivos) {
      supabase.storage.from(a.bucket).remove([a.path]).catch(() => {});
    }
  };

  try {
    // ── 1) Descargar y subir cada documento a Gemini en paralelo ────────────
    console.log(`[viabilidad] Procesando ${archivos.length} documento(s)...`);

    const fileParts: GeminiPart[] = await Promise.all(
      archivos.map(async (a) => {
        const nombre = a.nombre || a.path;
        const { data: blob, error: dlErr } = await supabase.storage.from(a.bucket).download(a.path);
        if (dlErr || !blob) throw new Error(`No se pudo descargar "${nombre}": ${dlErr?.message || 'no encontrado'}`);
        const bytes = await blob.arrayBuffer();
        if (bytes.byteLength < 100) throw new Error(`El archivo "${nombre}" está vacío o corrupto`);
        if (bytes.byteLength > 60 * 1024 * 1024) throw new Error(`El archivo "${nombre}" supera los 60MB`);

        // Word/Excel: Gemini no los soporta como fileData → se extrae el texto y se envía como parte de texto
        if (esDocumentoOffice(a.mimeType)) {
          try {
            const texto = await extraerTextoOffice(bytes, a.mimeType, nombre);
            console.log(`[viabilidad] ✅ Texto extraído de ${nombre} (${texto.length} chars)`);
            return { text: `=== Documento: ${nombre} ===\n${texto.slice(0, 50000)}` };
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'error desconocido';
            console.warn(`[viabilidad] ⚠️ No se pudo extraer texto de ${nombre}: ${msg}`);
            return { text: `=== Documento: ${nombre} ===\n(No se pudo leer el contenido de este archivo)` };
          }
        }

        const fileUri = await subirArchivoAGemini(bytes, bytes.byteLength, a.mimeType, nombre);
        console.log(`[viabilidad] ✅ Subido a Gemini: ${nombre}`);
        return { fileData: { mimeType: a.mimeType, fileUri } };
      })
    );

    // ── 2) Prompt ─────────────────────────────────────────────────────────────
    const prompt = `Eres un experto analista de licitaciones de Mercado Público en Chile.

Te entrego ${archivos.length} documento(s) de un proceso de licitación (bases administrativas, bases técnicas, anexos, formularios, etc). Analiza TODOS los documentos en conjunto.

${itemsExcel.length ? `También tengo esta planilla de costeo (Excel) con los ítems a cotizar, incluyendo la CANTIDAD y UNIDAD/CONVERSIÓN reales (unidad, pack, kg, mm, ml, galón, tineta, etc.):
${JSON.stringify(itemsExcel.slice(0, 100).map(i => ({ numero: i.numero, detalle: i.detalle, cantidad: i.cantidad, unidad: i.unidad })), null, 2)}

Cruza esta lista con lo que encuentres en los documentos: corrige nombres y agrega especificaciones técnicas. IMPORTANTE: la "cantidad" y "unidad" de esta planilla son DATOS REALES del Excel — repítelas tal cual en cada ítem (no las reemplaces por "1" ni inventes otro valor). Solo completa cantidad/unidad desde los documentos para ítems que NO vengan en esta planilla.` : 'Si encuentras un listado de ítems/productos a cotizar dentro de los documentos, extráelo igualmente.'}

TAREA 1 — Extrae estos datos del proceso (campos de un análisis de viabilidad de licitación). Si un dato no aparece en los documentos, usa "" (string vacío) o null:

{
  "id_proceso": "número/ID de la licitación en Mercado Público",
  "descripcion_proyecto": "descripción/nombre del proyecto o licitación",
  "cliente": "nombre de la institución/organismo mandante",
  "presupuesto_con_iva": "monto del presupuesto disponible, con IVA, como texto (ej: '$5.000.000')",
  "fecha_cierre": "fecha de cierre de recepción de ofertas (DD-MM-AAAA)",
  "fecha_adjudicacion": "fecha estimada de adjudicación (DD-MM-AAAA)",
  "productos_criticos": "productos/insumos críticos o de mayor riesgo de abastecimiento",
  "tipo_productos": "rubro/categoría de los productos (ej: material eléctrico, ferretería, agrícola, etc.)",
  "proyecto_suma_alzada": "SI o NO — si la oferta es por monto total (suma alzada)",
  "proyecto_por_linea": "SI o NO — si se puede ofertar por línea/ítem individual",
  "proveedores_sugeridos": "proveedores o marcas sugeridas/mencionadas, separados por coma",
  "lugar_entrega": "comuna/dirección de entrega de los productos",
  "multas": "resumen de multas por incumplimiento o atraso",
  "plazo_aceptacion_oc": "plazo para aceptar la orden de compra (ej: '3 días hábiles')",
  "garantias": "SI o NO, y detalle de garantías exigidas (seriedad de oferta, fiel cumplimiento)",
  "forma_evaluacion": {
    "criterio_economico": "porcentaje o ponderación del criterio económico/precio (ej: '60%')",
    "criterio_tecnico": "porcentaje o ponderación del criterio técnico (ej: '20%')",
    "programa": "porcentaje o ponderación del criterio plazo/programa de entrega (ej: '10%')",
    "requisitos_formales": "porcentaje o ponderación de cumplimiento de requisitos formales (ej: '10%')"
  },
  "proyecto_viable": "SI o NO — tu evaluación de si conviene participar, según presupuesto, plazos, requisitos y complejidad",
  "justificacion_viabilidad": "explica brevemente por qué es o no viable participar",
  "observaciones": "cualquier otra observación relevante (riesgos, requisitos especiales, certificaciones exigidas, etc.)"
}

TAREA 2 — Extrae el listado de ítems/productos a cotizar. Si las bases organizan la oferta económica en LÍNEAS o LOTES (ej. "LÍNEA 1: IMPLEMENTOS DE SEGURIDAD", "LÍNEA 2: INSUMOS DE FERRETERÍA", cada una con su propia tabla de ítems), incluye en cada ítem el campo "linea" indicando a qué línea pertenece (ej. "LINEA 1", "LINEA 2"). Si las bases NO organizan los ítems por líneas/lotes, omite el campo "linea" o déjalo vacío:
{"items": [{"item": "1", "nombre": "nombre del producto", "especificaciones": "specs completas", "cantidad": "10", "unidad": "Unidades", "linea": "LINEA 1"}]}

Responde SOLO con este JSON exacto, sin texto antes ni después:
{
  "analisis": { ...campos de la TAREA 1... },
  "items": [ ...items de la TAREA 2... ]
}`;

    // ── 3) Generar con Gemini (multi-archivo) ────────────────────────────────
    console.log('[viabilidad] Generando análisis...');
    const parts: GeminiPart[] = [{ text: prompt }, ...fileParts];
    const txt = await generarConGemini(parts, 16384);

    // ── 4) Parsear ─────────────────────────────────────────────────────────────
    const parsed = parsearJSONSeguro(txt, SINONIMOS_ANALISIS);

    const analisis = (typeof parsed.analisis === 'object' && parsed.analisis !== null)
      ? parsed.analisis as Record<string, unknown>
      : {};
    const items = Array.isArray(parsed.items) ? parsed.items as Record<string, unknown>[] : [];

    if (!Object.keys(analisis).length && !items.length) {
      limpiarStorage();
      return NextResponse.json({
        error: 'Gemini no pudo extraer información de los documentos. Verifica que sean documentos de texto (no escaneados como imagen).',
        tip: 'Si los PDF son escaneados (imagen), conviértelos primero a PDF con texto (OCR).',
      }, { status: 422 });
    }

    // ── 5) Limpiar storage ────────────────────────────────────────────────────
    limpiarStorage();

    console.log(`[viabilidad] ✅ análisis con ${Object.keys(analisis).length} campos, ${items.length} ítems`);

    const formaEval = (typeof analisis.forma_evaluacion === 'object' && analisis.forma_evaluacion !== null)
      ? analisis.forma_evaluacion as Record<string, unknown>
      : {};

    return NextResponse.json({
      ok: true,
      analisis: {
        id_proceso: String(analisis.id_proceso ?? '').trim(),
        descripcion_proyecto: String(analisis.descripcion_proyecto ?? '').trim(),
        cliente: String(analisis.cliente ?? '').trim(),
        presupuesto_con_iva: String(analisis.presupuesto_con_iva ?? '').trim(),
        fecha_cierre: String(analisis.fecha_cierre ?? '').trim(),
        fecha_adjudicacion: String(analisis.fecha_adjudicacion ?? '').trim(),
        productos_criticos: String(analisis.productos_criticos ?? '').trim(),
        tipo_productos: String(analisis.tipo_productos ?? '').trim(),
        proyecto_suma_alzada: String(analisis.proyecto_suma_alzada ?? '').trim(),
        proyecto_por_linea: String(analisis.proyecto_por_linea ?? '').trim(),
        proveedores_sugeridos: String(analisis.proveedores_sugeridos ?? '').trim(),
        lugar_entrega: String(analisis.lugar_entrega ?? '').trim(),
        multas: String(analisis.multas ?? '').trim(),
        plazo_aceptacion_oc: String(analisis.plazo_aceptacion_oc ?? '').trim(),
        garantias: String(analisis.garantias ?? '').trim(),
        forma_evaluacion: {
          criterio_economico: String(formaEval.criterio_economico ?? '').trim(),
          criterio_tecnico: String(formaEval.criterio_tecnico ?? '').trim(),
          programa: String(formaEval.programa ?? '').trim(),
          requisitos_formales: String(formaEval.requisitos_formales ?? '').trim(),
        },
        proyecto_viable: String(analisis.proyecto_viable ?? '').trim(),
        justificacion_viabilidad: String(analisis.justificacion_viabilidad ?? '').trim(),
        observaciones: String(analisis.observaciones ?? '').trim(),
      },
      items: items.map((it) => ({
        item: String(it.item ?? '').trim(),
        nombre: String(it.nombre ?? '').trim(),
        especificaciones: String(it.especificaciones ?? '').trim(),
        cantidad: String(it.cantidad ?? '').trim(),
        unidad: String(it.unidad ?? '').trim(),
        linea: String(it.linea ?? '').trim(),
      })),
      total: items.length,
    });

  } catch (e: unknown) {
    limpiarStorage();
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    console.error('[viabilidad] Error crítico:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
