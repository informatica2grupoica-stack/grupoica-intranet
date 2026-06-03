// app/api/obuma/diagnostico-campos/route.ts — devuelve muestra de 2 registros para inspeccionar campos
import { NextRequest, NextResponse } from 'next/server';

const ENDPOINTS: Record<string, string> = {
  oc: 'comprasOc.list.json',
  compras: 'compras.list.json',
  dte: 'comprasDte.list.json',
  pagos: 'comprasPagos.list.json',
};

export async function GET(request: NextRequest) {
  const tipo = request.nextUrl.searchParams.get('tipo') || 'oc';
  const ep = ENDPOINTS[tipo] || ENDPOINTS.oc;
  try {
    const res = await fetch(`${process.env.OBUMA_API_URL}/${ep}`, {
      headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' },
      cache: 'no-store',
    });
    const json = await res.json();
    const rows = json.data || json.docs || (Array.isArray(json) ? json : [json]);
    const muestra = rows.slice(0, 2);
    return NextResponse.json({
      endpoint: ep,
      total: rows.length,
      campos_primer_registro: muestra[0] ? Object.keys(muestra[0]) : [],
      muestra,
      raw_top_keys: Object.keys(json),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
