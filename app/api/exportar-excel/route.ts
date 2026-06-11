// app/api/exportar-excel/route.ts
// Procesa el Excel COSTEO con ExcelJS en el servidor (evita problemas de Node.js en browser)
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs/promises';

export const runtime = 'nodejs';

// ── Normaliza etiquetas de la pestaña "Analisis" para matchear sin tildes/mayúsculas ──
function normalizarEtiqueta(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnalisisViabilidad = Record<string, any>;

// ── Campos de la pestaña "Analisis": etiqueta (col A) → valor del análisis ─────
const CAMPOS_ANALISIS: Array<{ test: RegExp; valor: (a: AnalisisViabilidad) => unknown }> = [
  { test: /^id$/, valor: a => a.id_proceso },
  { test: /descripcion del proyecto/, valor: a => a.descripcion_proyecto },
  { test: /^cliente/, valor: a => a.cliente },
  { test: /presupuesto.*iva/, valor: a => a.presupuesto_con_iva },
  { test: /^fecha de cierre$/, valor: a => a.fecha_cierre },
  { test: /fecha de cierre.*pregunta/, valor: a => a.fecha_adjudicacion },
  { test: /producto.*critic/, valor: a => a.productos_criticos },
  { test: /tipo de producto/, valor: a => a.tipo_productos },
  { test: /suma alzada/, valor: a => a.proyecto_suma_alzada },
  { test: /por linea/, valor: a => a.proyecto_por_linea },
  { test: /proveedor/, valor: a => a.proveedores_sugeridos },
  { test: /lugar de entrega/, valor: a => a.lugar_entrega },
  { test: /^multas/, valor: a => a.multas },
  { test: /plazo.*ace[pt]+acion oc/, valor: a => a.plazo_aceptacion_oc },
  { test: /garantia/, valor: a => a.garantias },
  { test: /proyecto viable/, valor: a => a.proyecto_viable },
  { test: /justificacion/, valor: a => a.justificacion_viabilidad },
  { test: /observaciones/, valor: a => a.observaciones },
];

// ── Tabla "Forma de evaluación": etiqueta de fila → campo de forma_evaluacion ──
const TABLA_EVAL: Record<string, string> = {
  precio: 'criterio_economico',
  entrega: 'programa',
  'especificaciones tecnicas': 'criterio_tecnico',
  'cumplimiento de los requisitos': 'requisitos_formales',
};

// ── Convierte "60%" a 0.6 si la celda destino ya tenía un valor numérico (formato %) ──
function valorParaCelda(cell: ExcelJS.Cell, valor: unknown): unknown {
  if (typeof valor === 'string' && valor.trim().endsWith('%')) {
    const n = parseFloat(valor.replace('%', '').replace(',', '.').trim());
    if (!isNaN(n) && typeof cell.value === 'number') return n / 100;
  }
  return valor;
}

interface ColsDetectadas { headerRow: number; colItem: number; colValor: number; colLink: number; }
interface ColsPlantilla extends ColsDetectadas { colDetalle: number; colCantidad: number; colConversion: number; }
interface ItemBase { item?: string; numero?: string; nombre: string; especificaciones?: string; cantidad?: string; unidad?: string; linea?: string; }

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const sheetName = formData.get('sheetName') as string || 'COSTEO';
    const seleccionadosRaw = formData.get('seleccionados') as string | null;
    const modo = formData.get('modo') as string || 'manual';
    const colsRaw = formData.get('cols') as string | null;
    const colsPorHojaRaw = formData.get('colsPorHoja') as string | null;
    const formato = (formData.get('formato') as string) || 'costeo';
    const analisisRaw = formData.get('analisis') as string | null;
    const usarPlantilla = (formData.get('usarPlantilla') as string) === 'true';
    const itemsBasesRaw = formData.get('itemsBases') as string | null;

    if (!file && !usarPlantilla) return NextResponse.json({ error: 'Archivo no recibido' }, { status: 400 });
    if (!seleccionadosRaw && !analisisRaw && !itemsBasesRaw)
      return NextResponse.json({ error: 'Sin datos de precios, ítems ni análisis' }, { status: 400 });

    const seleccionados: Array<{ numero: string; precio: number; link: string; hoja?: string; itemOriginal?: string }> = seleccionadosRaw ? JSON.parse(seleccionadosRaw) : [];
    if (seleccionadosRaw && !seleccionados.length) return NextResponse.json({ error: 'Sin resultados para exportar' }, { status: 400 });

    const colsPorHoja: Record<string, ColsDetectadas> | null = colsPorHojaRaw ? JSON.parse(colsPorHojaRaw) : null;

    const analisis: AnalisisViabilidad | null = analisisRaw ? JSON.parse(analisisRaw) : null;
    const itemsBases: ItemBase[] = itemsBasesRaw ? JSON.parse(itemsBasesRaw) : [];

    let arrayBuf: ArrayBuffer;
    if (usarPlantilla) {
      const templateName = formato === 'lineas' ? 'lineas-base.xlsx' : 'costeo-base.xlsx';
      const buf = await fs.readFile(path.join(process.cwd(), 'lib', 'excel', 'templates', templateName));
      arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    } else {
      arrayBuf = await file!.arrayBuffer();
    }
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(arrayBuf as any);

    // ── Extrae texto plano de celda (rich text, fórmula, valor simple) ──────────
    const cellText = (cell: ExcelJS.Cell): string => {
      const v = cell.value;
      if (v == null) return '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = v as any;
      if (typeof v === 'object') {
        if ('richText' in a) return a.richText.map((r: any) => r.text ?? '').join('');
        if ('result' in a) return String(a.result ?? '');
        if ('text' in a) return String(a.text ?? '');
      }
      return String(v);
    };

    // ── Detección propia de columnas con ExcelJS (1-indexed), fallback ──────────
    const detectarColumnasHoja = (ws: ExcelJS.Worksheet): ColsPlantilla | null => {
      let headerRow = -1, colItem = -1, colValor = -1, colLink = -1, colDetalle = -1, colCantidad = -1, colConversion = -1;
      for (let rn = 1; rn <= Math.min(25, ws.rowCount); rn++) {
        const cells: string[] = [];
        ws.getRow(rn).eachCell({ includeEmpty: true }, (cell, cn) => {
          cells[cn] = cellText(cell).toUpperCase().trim();
        });
        if (cells.some(h => h && (h === 'ITEM' || h.includes('ITEM')))) {
          headerRow = rn;
          cells.forEach((h, cn) => {
            if (!h) return;
            if ((h === 'ITEM' || h.includes('ITEM')) && colItem < 0) colItem = cn;
            else if (h.includes('DETALLE') && colDetalle < 0) colDetalle = cn;
            else if (h.includes('CANTIDAD') && colCantidad < 0) colCantidad = cn;
            else if (h.includes('CONVERSION') && colConversion < 0) colConversion = cn;
            else if ((h.includes('VALOR') || h.includes('PRECIO')) && h.includes('IVA')) colValor = cn;
            else if (h.startsWith('LINK') && colLink < 0) colLink = cn;
          });
          break;
        }
      }
      if (headerRow < 0 || colItem < 0 || colValor < 0) return null;
      return { headerRow, colItem, colValor, colLink, colDetalle, colCantidad, colConversion };
    };

    // SheetJS (cliente) usa 0-indexed; ExcelJS usa 1-indexed → sumar 1 a columnas y filas
    const colsDeCliente = (cols: ColsDetectadas): ColsDetectadas => ({
      headerRow: cols.headerRow + 1,
      colItem: cols.colItem + 1,
      colValor: cols.colValor + 1,
      colLink: cols.colLink >= 0 ? cols.colLink + 1 : -1,
    });

    let filled = 0;
    let filledItems = 0;

    if (usarPlantilla) {
      // ── Plantilla en blanco: rellenar ITEM/Detalle/Cantidad/CONVERSION desde las
      // bases (itemsBases) y, si vienen, VALOR C/IVA + LINK desde el buscador ──────
      const mapaPrecios = new Map(seleccionados.map(s => [String(s.numero).trim(), s]));

      const llenarFila = (row: ExcelJS.Row, it: ItemBase, cols: ColsPlantilla) => {
        const { colDetalle, colCantidad, colConversion, colValor, colLink } = cols;
        if (colDetalle > 0) {
          row.getCell(colDetalle).value = it.especificaciones ? `${it.nombre} - ${it.especificaciones}` : it.nombre;
        }
        if (colCantidad > 0) {
          const cant = parseFloat(String(it.cantidad ?? '').replace(',', '.'));
          if (!isNaN(cant) && cant > 0) row.getCell(colCantidad).value = cant;
        }
        if (colConversion > 0 && it.unidad) row.getCell(colConversion).value = it.unidad;
        filledItems++;

        const claveGlobal = String(it.item ?? it.numero ?? '').trim();
        let precio = mapaPrecios.get(claveGlobal);
        if (!precio) precio = mapaPrecios.get(String(parseFloat(claveGlobal)));
        if (precio) {
          row.getCell(colValor).value = precio.precio;
          if (colLink > 0 && precio.link) row.getCell(colLink).value = precio.link;
          filled++;
        }
      };

      if (formato === 'lineas') {
        // Las bases pueden organizar la oferta en LÍNEAS/LOTES (cada ítem trae "linea": "LINEA N").
        // Cada hoja LINEAn de la plantilla tiene su propia numeración 1..N — se ubica cada
        // ítem según su posición relativa dentro de su línea (no por su número global de ítem).
        const porLinea = new Map<number, ItemBase[]>();
        for (const it of itemsBases) {
          const m = String(it.linea || '').match(/(\d+)/);
          const n = m ? parseInt(m[1], 10) : 1;
          if (!porLinea.has(n)) porLinea.set(n, []);
          porLinea.get(n)!.push(it);
        }

        for (const [n, items] of porLinea) {
          const ws = wb.getWorksheet(`LINEA${n}`);
          if (!ws) continue;
          const cols = detectarColumnasHoja(ws);
          if (!cols) continue;
          const { headerRow, colItem } = cols;

          for (let rn = headerRow + 1; rn <= ws.rowCount; rn++) {
            const row = ws.getRow(rn);
            const rawKey = cellText(row.getCell(colItem)).trim();
            if (!rawKey) continue;
            const idx = parseInt(rawKey, 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= items.length) continue;
            llenarFila(row, items[idx], cols);
          }
        }

      } else {
        // Formato COSTEO: una sola hoja, numeración global de ítem.
        const ws = wb.getWorksheet('COSTEO') || wb.worksheets[0];
        if (!ws) return NextResponse.json({ error: 'No se encontró la pestaña de la plantilla' }, { status: 400 });

        const cols = detectarColumnasHoja(ws);
        if (!cols) return NextResponse.json({ error: 'No se encontró columna ITEM o VALOR C/IVA en la plantilla' }, { status: 400 });
        const { headerRow, colItem } = cols;

        const mapaItems = new Map(itemsBases.map(it => [String(it.item ?? it.numero ?? '').trim(), it]));

        for (let rn = headerRow + 1; rn <= ws.rowCount; rn++) {
          const row = ws.getRow(rn);
          const rawKey = cellText(row.getCell(colItem)).trim();
          if (!rawKey) continue;

          let it = mapaItems.get(rawKey);
          if (!it) it = mapaItems.get(String(parseFloat(rawKey)));
          if (!it) continue;
          llenarFila(row, it, cols);
        }
      }

      if (!filledItems)
        return NextResponse.json({ error: 'No se encontraron filas en la plantilla para los ítems detectados' }, { status: 400 });

    } else if (formato === 'lineas' && seleccionados.length) {
      // ── Formato LÍNEAS: rellenar cada hoja LINEAn por separado ──────────────────
      const porHoja = new Map<string, typeof seleccionados>();
      for (const s of seleccionados) {
        if (!s.hoja) continue;
        if (!porHoja.has(s.hoja)) porHoja.set(s.hoja, []);
        porHoja.get(s.hoja)!.push(s);
      }

      for (const [hoja, items] of porHoja) {
        const ws = wb.getWorksheet(hoja);
        if (!ws) continue;

        const cols = colsPorHoja?.[hoja] ? colsDeCliente(colsPorHoja[hoja]) : detectarColumnasHoja(ws);
        if (!cols) continue;
        const { headerRow, colItem, colValor, colLink } = cols;

        const mapa = new Map(items.map(s => [s.itemOriginal ?? '', s]));

        for (let rn = headerRow + 1; rn <= ws.rowCount; rn++) {
          const row = ws.getRow(rn);
          const rawKey = cellText(row.getCell(colItem)).trim();
          if (!rawKey) continue;

          let dato = mapa.get(rawKey);
          if (!dato) dato = mapa.get(String(parseFloat(rawKey)));
          if (!dato) continue;

          row.getCell(colValor).value = dato.precio;
          if (colLink > 0 && dato.link) row.getCell(colLink).value = dato.link;
          filled++;
        }
      }

      if (!filled)
        return NextResponse.json({ error: 'No se encontraron ítems para rellenar — verifica que los números de ítem coincidan' }, { status: 400 });

    } else if (seleccionados.length) {
      // ── Pestaña COSTEO: rellenar precios y links ────────────────────────────────
      const ws = wb.getWorksheet(sheetName) || wb.worksheets[0];
      if (!ws) return NextResponse.json({ error: 'No se encontró la pestaña' }, { status: 400 });

      // ── Usar índices enviados por el cliente (SheetJS los detecta correctamente) ─
      let cols: ColsDetectadas | null;
      if (colsRaw) {
        // El cliente ya detectó correctamente con SheetJS — usamos esos índices
        cols = colsDeCliente(JSON.parse(colsRaw));
      } else {
        cols = detectarColumnasHoja(ws);
        if (!cols) return NextResponse.json({ error: 'No se encontró columna ITEM o VALOR C/IVA' }, { status: 400 });
      }
      const { headerRow, colItem, colValor, colLink } = cols;

      // ── Rellenar precios y links ──────────────────────────────────────────────
      const mapa = new Map(seleccionados.map(s => [s.numero, s]));

      for (let rn = headerRow + 1; rn <= ws.rowCount; rn++) {
        const row = ws.getRow(rn);
        const rawKey = cellText(row.getCell(colItem)).trim();
        if (!rawKey) continue;

        // Match directo → luego numérico (por si "4" vs "4.0")
        let dato = mapa.get(rawKey);
        if (!dato) dato = mapa.get(String(parseFloat(rawKey)));
        if (!dato) continue;

        row.getCell(colValor).value = dato.precio;
        if (colLink > 0 && dato.link) row.getCell(colLink).value = dato.link;
        filled++;
      }

      if (!filled)
        return NextResponse.json({ error: 'No se encontraron ítems para rellenar — verifica que los números de ítem coincidan' }, { status: 400 });
    }

    // ── Pestaña "Analisis": rellenar campos del análisis de viabilidad ──────────
    let filledAnalisis = 0;
    if (analisis) {
      const wsAnalisis = wb.worksheets.find(w => /an[aá]lisis/i.test(w.name));
      if (wsAnalisis) {
        let enTablaEval = false;
        for (let rn = 1; rn <= Math.min(60, wsAnalisis.rowCount); rn++) {
          const row = wsAnalisis.getRow(rn);
          const etiqueta = normalizarEtiqueta(cellText(row.getCell(1)));
          if (!etiqueta) continue;

          if (/forma de evaluacion/.test(etiqueta)) { enTablaEval = true; continue; }

          if (enTablaEval) {
            const campo = TABLA_EVAL[etiqueta];
            if (campo) {
              const valor = analisis.forma_evaluacion?.[campo];
              if (valor !== undefined && valor !== null && valor !== '') {
                const cell = row.getCell(2);
                cell.value = valorParaCelda(cell, valor) as ExcelJS.CellValue;
                filledAnalisis++;
              }
              continue;
            }
            // Si la fila ya no matchea ninguna fila de la tabla, dejamos de buscar en ella
            if (!/^(precio|entrega|especificaciones tecnicas|cumplimiento de los requisitos)/.test(etiqueta)) {
              enTablaEval = false;
            }
          }

          const campo = CAMPOS_ANALISIS.find(c => c.test.test(etiqueta));
          if (!campo) continue;
          const valor = campo.valor(analisis);
          if (valor === undefined || valor === null || valor === '') continue;
          const cell = row.getCell(2);
          cell.value = valorParaCelda(cell, valor) as ExcelJS.CellValue;
          filledAnalisis++;
        }
      }
    }

    if (!filled && !filledAnalisis && !filledItems)
      return NextResponse.json({ error: 'No se encontró información para rellenar en el Excel' }, { status: 400 });

    const out = await wb.xlsx.writeBuffer();
    const nombreModo: Record<string, string> = {
      manual: 'seleccion', mejor_match: 'mejor-match',
      menor_precio: 'menor-precio', equilibrado: 'equilibrado',
      viabilidad: 'viabilidad',
    };
    const filename = `COSTEO_${nombreModo[modo] || modo}_${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(out as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Filled': String(filled),
        'X-Filled-Analisis': String(filledAnalisis),
      },
    });

  } catch (e: any) {
    console.error('[exportar-excel]', e);
    return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: 500 });
  }
}
