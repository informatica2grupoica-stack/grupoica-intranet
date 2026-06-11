// lib/excel/costeo.ts
// Helpers compartidos para leer Excels "COSTEO" (una pestaña) y "por LÍNEAS"
// (varias hojas LINEA1, LINEA2, ... con la misma estructura de columnas pero
// numeración de ítems independiente por hoja).
import * as XLSX from 'xlsx';

export interface ProductoExcel {
  numero: number | string;
  nombre: string;
  cantidad: number;
  valor_civa: number;
  link_referencia: string;
  conversion: string;
  _fila?: number;
  _hoja?: string;
  _itemOriginal?: string;
}

export interface ColsDetectadas {
  headerRow: number;
  colItem: number;
  colValor: number;
  colLink: number;
}

interface ColsCompletas extends ColsDetectadas {
  colDetalle: number;
  colCantidad: number;
  colConversion: number;
}

// Palabras que indican una fila administrativa (no es un producto)
export const ADMIN_WORDS = ['TOTAL','VERDADERO','COSTEADO','SUBTOTAL','ENTREGA','SOLICITA','FICHA','CIUDAD','REGION','REGIÓN','OBSERVACI','NOTA:','NOTA ','PLAZO','CONTRATO','DIRECCIÓN','DIRECCION'];

// ── Detecta la fila de encabezado y las columnas relevantes ────────────────────
export function detectarColumnas(jsonData: any[][]): ColsCompletas | null {
  for (let i = 0; i < Math.min(20, jsonData.length); i++) {
    const row = jsonData[i];
    if (!row) continue;
    if (row.some((c: any) => ['ITEM', 'DETALLE', 'CANTIDAD'].includes(String(c || '').toUpperCase().trim()))) {
      let colItem = -1, colDetalle = -1, colCantidad = -1, colValor = -1, colLink = -1, colConversion = -1;
      row.forEach((c: any, j: number) => {
        const h = String(c || '').toUpperCase().trim();
        if (h === 'ITEM' || h.includes('ITEM')) colItem = j;
        else if (h.includes('DETALLE')) colDetalle = j;
        else if (h.includes('CANTIDAD')) colCantidad = j;
        else if (h.includes('VALOR') && h.includes('IVA')) colValor = j;
        else if (h.includes('CONVERSION')) colConversion = j;
        else if (h.includes('LINK')) colLink = j;
      });
      return { headerRow: i, colItem, colDetalle, colCantidad, colValor, colLink, colConversion };
    }
  }
  return null;
}

// "LINEA1" → "L1", "Linea 12" → "L12"
function etiquetaCorta(hoja: string): string {
  const m = hoja.match(/(\d+)/);
  return m ? `L${m[1]}` : hoja;
}

// ── Extrae los ítems de producto de una hoja ya con columnas detectadas ────────
export function extraerItems(jsonData: any[][], cols: ColsCompletas, opts?: { hoja?: string }): ProductoExcel[] {
  const { headerRow, colItem, colDetalle, colCantidad, colValor, colLink, colConversion } = cols;
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
    const numero: number | string = opts?.hoja
      ? `${etiquetaCorta(opts.hoja)}-${numeroRaw}`
      : (isNaN(Number(numeroRaw)) ? numeroRaw : Number(numeroRaw));

    items.push({
      numero,
      nombre: detalle,
      cantidad: colCantidad >= 0 ? Number(row[colCantidad]) || 1 : 1,
      valor_civa: valorCIVA,
      link_referencia: colLink >= 0 ? String(row[colLink] || '').trim() : '',
      conversion: conversion || 'unidad',
      _fila: i,
      ...(opts?.hoja ? { _hoja: opts.hoja, _itemOriginal: numeroRaw } : {}),
    });
  }

  return items;
}

// ── Detecta hojas "LINEA1", "LINEA2", ... ordenadas numéricamente ──────────────
export function detectarHojasLineas(wb: XLSX.WorkBook): string[] {
  return wb.SheetNames
    .filter(n => /^l[ií]neas?\s*\d+/i.test(n))
    .sort((a, b) => {
      const na = parseInt((a.match(/(\d+)/) || ['0'])[0], 10);
      const nb = parseInt((b.match(/(\d+)/) || ['0'])[0], 10);
      return na - nb;
    });
}

// ── Procesa una sola pestaña (formato COSTEO) ──────────────────────────────────
export function procesarHojaCosteo(wb: XLSX.WorkBook, sheetName: string): { items: ProductoExcel[]; cols: ColsDetectadas } | null {
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;
  const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  if (!jsonData.length) return null;
  const cols = detectarColumnas(jsonData);
  if (!cols) return null;
  const items = extraerItems(jsonData, cols);
  return { items, cols: { headerRow: cols.headerRow, colItem: cols.colItem, colValor: cols.colValor, colLink: cols.colLink } };
}

// ── Procesa varias hojas LINEAn y junta todos los ítems en una sola lista ──────
export function procesarHojasLineas(wb: XLSX.WorkBook, hojas: string[]): { items: ProductoExcel[]; colsPorHoja: Record<string, ColsDetectadas> } {
  const items: ProductoExcel[] = [];
  const colsPorHoja: Record<string, ColsDetectadas> = {};

  for (const hoja of hojas) {
    const ws = wb.Sheets[hoja];
    if (!ws) continue;
    const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
    if (!jsonData.length) continue;
    const cols = detectarColumnas(jsonData);
    if (!cols) continue;
    items.push(...extraerItems(jsonData, cols, { hoja }));
    colsPorHoja[hoja] = { headerRow: cols.headerRow, colItem: cols.colItem, colValor: cols.colValor, colLink: cols.colLink };
  }

  return { items, colsPorHoja };
}
