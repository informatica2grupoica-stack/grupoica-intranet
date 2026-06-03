// app/api/obuma/ventas/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campos = ['id_dcto_desde','tipo_dcto','folio_dcto','fecha','fecha_desde','fecha_hasta',
      'cliente','total','vendedor','sucursal','bodega','estado','forma_pago','canal_venta','mes','ano'];
    const filtros: Record<string,string> = {};
    campos.forEach(c => { const v = searchParams.get(c); if (v) filtros[c] = v; });
    const qs = new URLSearchParams(filtros).toString();
    const res = await fetch(`${process.env.OBUMA_API_URL}/ventas.list.json${qs?`?${qs}`:''}`, {
      headers: { 'access-token': process.env.OBUMA_API_TOKEN||'' }, cache: 'no-store',
    });
    const data = await res.json();
    if (data.success === false || data.status === false)
      return NextResponse.json({ error: data.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
