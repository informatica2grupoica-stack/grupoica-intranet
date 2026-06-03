import { NextRequest, NextResponse } from 'next/server';
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campos = ['fecha_desde','fecha_hasta','tipo','cuenta','centro_costo','tipo_dcto',
      'folio_dcto','rut_analisis','tipo_analisis','tipo_ingreso','status','mostrar_detalle'];
    const filtros: Record<string,string> = {};
    campos.forEach(c => { const v = searchParams.get(c); if (v) filtros[c] = v; });
    const qs = new URLSearchParams(filtros).toString();
    const res = await fetch(`${process.env.OBUMA_API_URL}/contabilidad.listDiario.json${qs?`?${qs}`:''}`, {
      headers: { 'access-token': process.env.OBUMA_API_TOKEN||'' }, cache: 'no-store',
    });
    return NextResponse.json(await res.json());
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
