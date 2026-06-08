// app/api/mercado-publico/route.ts
// Busca licitaciones en mercadopublico.cl usando Serper organic (site:)
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SERPER_KEY = process.env.SERPER_API_KEY || '';

export interface LicitacionItem {
  titulo: string;
  snippet: string;
  link: string;
  fecha: string | null;
  codigo: string | null;
}

function extraerCodigo(link: string): string | null {
  // URLs como: ...ficha?qs=...&CodigoLicitacion=1234567-8-LP24
  const m = link.match(/CodigoLicitacion=([^&]+)/i) || link.match(/codigo=([^&]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get('q')?.trim() || '';
  const region = sp.get('region')?.trim() || '';

  if (!q) return NextResponse.json({ error: 'Falta parámetro q' }, { status: 400 });
  if (!SERPER_KEY) return NextResponse.json({ error: 'SERPER_API_KEY no configurada' }, { status: 503 });

  const query = `${q}${region ? ' ' + region : ''} licitacion site:mercadopublico.cl`;

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ q: query, gl: 'cl', hl: 'es', num: 20 }),
    });
    clearTimeout(tid);
    if (!r.ok) return NextResponse.json({ error: `Serper error ${r.status}` }, { status: 502 });

    const data = await r.json();
    const organicos: any[] = data.organic || [];

    const items: LicitacionItem[] = organicos
      .filter((i: any) => (i.link || '').includes('mercadopublico.cl'))
      .map((i: any) => ({
        titulo: (i.title || '').replace(/ - Mercado Público$/, '').trim(),
        snippet: i.snippet || '',
        link: i.link || '',
        fecha: i.date || null,
        codigo: extraerCodigo(i.link || ''),
      }));

    return NextResponse.json({ items, total: items.length, region: region || null });
  } catch {
    return NextResponse.json({ error: 'Error de conexión' }, { status: 500 });
  } finally {
    clearTimeout(tid);
  }
}
