// app/api/obuma/maestros/route.ts — datos maestros: bancos, monedas, unidades, sucursales, bodegas, formas de pago
import { NextRequest, NextResponse } from 'next/server';

const ENDPOINTS: Record<string, string> = {
  bancos: 'pg-bancos.list.json',
  monedas: 'pg-monedas.list.json',
  unidades: 'pg-unidadesMedida.list.json',
  regiones: 'pg-regiones.list.json',
  comunas: 'pg-comunas.list.json',
  sucursales: 'empresaSucursales.list.json',
  bodegas: 'empresaBodegas.list.json',
  formas_pago: 'empresaFormasDePago.list.json',
  listas_precio: 'empresaListasDePrecio.list.json',
  canales_venta: 'empresaCanalesDeVenta.list.json',
};

export async function GET(request: NextRequest) {
  try {
    const tipo = request.nextUrl.searchParams.get('tipo') || 'sucursales';
    const ep = ENDPOINTS[tipo];
    if (!ep) return NextResponse.json({ error: `Tipo "${tipo}" no válido. Opciones: ${Object.keys(ENDPOINTS).join(', ')}` }, { status: 400 });

    const extraParams: Record<string,string> = {};
    const paisId = request.nextUrl.searchParams.get('pais_id');
    if (paisId) extraParams.pais_id = paisId;
    const qs = new URLSearchParams(extraParams).toString();

    const res = await fetch(`${process.env.OBUMA_API_URL}/${ep}${qs?`?${qs}`:''}`, {
      headers: { 'access-token': process.env.OBUMA_API_TOKEN||'' }, cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json({ tipo, data: data.data || data.docs || (Array.isArray(data) ? data : []) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
