// app/api/obuma/compras-dte/xml/route.ts — proxy para obtener XML de DTE desde S3
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'url requerida' }, { status: 400 });

  // Solo permitir URLs de obuma-cl S3 para seguridad
  if (!url.includes('obuma-cl.s3') && !url.includes('obuma.cl')) {
    return NextResponse.json({ error: 'URL no permitida' }, { status: 403 });
  }

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });

    const xml = await res.text();
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
