// app/api/indicadores/route.ts
// Indicadores económicos de Chile: UF, UTM, Dólar, Euro — fuente: mindicador.cl
import { NextResponse } from 'next/server';

const BASE = 'https://mindicador.cl/api';
const CACHE_TTL = 3600; // 1 hora

interface Indicador {
  codigo: string;
  nombre: string;
  valor: number;
  valorAnterior: number;
  variacion: number;       // % cambio respecto a ayer
  variacionAbs: number;    // diferencia absoluta
  fecha: string;
  tendencia: 'alza' | 'baja' | 'igual';
}

async function fetchIndicador(codigo: string): Promise<{ hoy: number; ayer: number; fecha: string }> {
  const res = await fetch(`${BASE}/${codigo}`, { next: { revalidate: CACHE_TTL } });
  if (!res.ok) throw new Error(`Error fetching ${codigo}: ${res.status}`);
  const data = await res.json();
  const serie: { fecha: string; valor: number }[] = data.serie || [];
  // serie[0] = más reciente, serie[1] = anterior
  const hoy  = serie[0]?.valor  ?? 0;
  const ayer = serie[1]?.valor  ?? hoy;
  const fecha = serie[0]?.fecha ?? new Date().toISOString();
  return { hoy, ayer, fecha };
}

function construirIndicador(
  codigo: string, nombre: string, hoy: number, ayer: number, fecha: string
): Indicador {
  const variacionAbs = hoy - ayer;
  const variacion = ayer !== 0 ? Number(((variacionAbs / ayer) * 100).toFixed(2)) : 0;
  const tendencia: Indicador['tendencia'] = variacionAbs > 0 ? 'alza' : variacionAbs < 0 ? 'baja' : 'igual';
  return { codigo, nombre, valor: hoy, valorAnterior: ayer, variacion, variacionAbs: Number(variacionAbs.toFixed(2)), fecha, tendencia };
}

export async function GET() {
  try {
    const [dolarData, ufData, utmData, euroData] = await Promise.allSettled([
      fetchIndicador('dolar'),
      fetchIndicador('uf'),
      fetchIndicador('utm'),
      fetchIndicador('euro'),
    ]);

    const get = (r: PromiseSettledResult<{ hoy: number; ayer: number; fecha: string }>, fallback: { hoy: number; ayer: number; fecha: string }) =>
      r.status === 'fulfilled' ? r.value : fallback;

    const now = new Date().toISOString();
    const d = get(dolarData, { hoy: 0, ayer: 0, fecha: now });
    const u = get(ufData,    { hoy: 0, ayer: 0, fecha: now });
    const m = get(utmData,   { hoy: 0, ayer: 0, fecha: now });
    const e = get(euroData,  { hoy: 0, ayer: 0, fecha: now });

    return NextResponse.json({
      dolar: construirIndicador('dolar', 'Dólar',  d.hoy, d.ayer, d.fecha),
      uf:    construirIndicador('uf',    'UF',     u.hoy, u.ayer, u.fecha),
      utm:   construirIndicador('utm',   'UTM',    m.hoy, m.ayer, m.fecha),
      euro:  construirIndicador('euro',  'Euro',   e.hoy, e.ayer, e.fecha),
      actualizado: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': `s-maxage=${CACHE_TTL}, stale-while-revalidate` },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
