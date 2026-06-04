// app/api/exportar-excel/route.ts
// Procesa el Excel COSTEO con ExcelJS en el servidor (evita problemas de Node.js en browser)
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const sheetName = formData.get('sheetName') as string || 'COSTEO';
    const seleccionadosRaw = formData.get('seleccionados') as string;
    const modo = formData.get('modo') as string || 'manual';

    if (!file) return NextResponse.json({ error: 'Archivo no recibido' }, { status: 400 });
    if (!seleccionadosRaw) return NextResponse.json({ error: 'Sin datos de precios' }, { status: 400 });

    const seleccionados: Array<{ numero: string; precio: number; link: string }> = JSON.parse(seleccionadosRaw);
    if (!seleccionados.length) return NextResponse.json({ error: 'Sin resultados para exportar' }, { status: 400 });

    const arrayBuf = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(arrayBuf as any);

    const ws = wb.getWorksheet(sheetName) || wb.worksheets[0];
    if (!ws) return NextResponse.json({ error: 'No se encontró la pestaña' }, { status: 400 });

    // ── Extrae texto plano de celda (rich text, fórmula, valor simple) ──────────
    const cellText = (cell: ExcelJS.Cell): string => {
      const v = cell.value;
      if (v == null) return '';
      if (typeof v === 'object') {
        if ('richText' in (v as any)) return (v as any).richText.map((r: any) => r.text ?? '').join('');
        if ('result' in (v as any)) return String((v as any).result ?? '');
        if ('text' in (v as any)) return String((v as any).text ?? '');
      }
      return String(v);
    };

    // ── Detectar fila de encabezados y columnas (1-indexado) ──────────────────
    let headerRow = -1, colItem = -1, colValor = -1, colLink = -1;

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
          else if (h.includes('VALOR') && h.includes('IVA')) colValor = cn;
          else if (h.startsWith('LINK') && colLink < 0) colLink = cn;
        });
        break;
      }
    }

    if (headerRow < 0 || colItem < 0) return NextResponse.json({ error: 'No se encontró columna ITEM' }, { status: 400 });
    if (colValor < 0) return NextResponse.json({ error: 'No se encontró columna VALOR C/IVA' }, { status: 400 });

    // ── Rellenar precios y links ──────────────────────────────────────────────
    const mapa = new Map(seleccionados.map(s => [s.numero, s]));
    let filled = 0;

    for (let rn = headerRow + 1; rn <= ws.rowCount; rn++) {
      const row = ws.getRow(rn);
      const rawKey = cellText(row.getCell(colItem)).trim();
      if (!rawKey) continue;

      // Intentar match directo, luego numérico (por si "4" vs "4.0")
      let dato = mapa.get(rawKey);
      if (!dato) {
        const numKey = String(parseFloat(rawKey));
        dato = mapa.get(numKey);
      }
      if (!dato) continue;

      row.getCell(colValor).value = dato.precio;
      if (colLink > 0 && dato.link) row.getCell(colLink).value = dato.link;
      filled++;
    }

    if (!filled) return NextResponse.json({ error: 'No se encontraron ítems para rellenar — verifica que los números de ítem coincidan' }, { status: 400 });

    const out = await wb.xlsx.writeBuffer();
    const nombreModo: Record<string, string> = {
      manual: 'seleccion', mejor_match: 'mejor-match',
      menor_precio: 'menor-precio', equilibrado: 'equilibrado',
    };
    const filename = `COSTEO_${nombreModo[modo] || modo}_${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(out as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Filled': String(filled),
      },
    });

  } catch (e: any) {
    console.error('[exportar-excel]', e);
    return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: 500 });
  }
}
