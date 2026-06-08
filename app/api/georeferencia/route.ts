// app/api/georeferencia/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

export async function GET(req: NextRequest) {
  const sp      = req.nextUrl.searchParams;
  const keyword = sp.get('q')?.trim() || '';
  const region  = sp.get('region')?.trim() || '';
  const comuna  = sp.get('comuna')?.trim() || '';

  if (!keyword) return NextResponse.json({ error: 'Ingresa una búsqueda' }, { status: 400 });

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Servicio no configurado' }, { status: 500 });

  // "ferreterías Viña del Mar Valparaíso Chile"
  const query = [keyword, comuna, region, 'Chile'].filter(Boolean).join(' ');

  try {
    const r = await fetch('https://google.serper.dev/maps', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'cl', hl: 'es', num: 20 }),
    });

    if (!r.ok) return NextResponse.json({ error: `Error al consultar (${r.status})` }, { status: 502 });

    const data = await r.json();
    const places = (data.places || [])
      .filter((p: any) => p.latitude && p.longitude)
      .map((p: any, i: number) => ({
        id:          p.cid || p.placeId || `place_${i}`,
        nombre:      p.title || 'Sin nombre',
        categoria:   p.category || '',
        direccion:   p.address || '',
        telefono:    p.phone   || null,
        web:         p.website || null,
        rating:      p.rating      ?? null,
        ratingCount: p.ratingCount ?? null,
        lat:         p.latitude,
        lng:         p.longitude,
        maps_url: p.cid
          ? `https://www.google.com/maps?cid=${p.cid}`
          : `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`,
      }));

    return NextResponse.json({ query, total: places.length, places });
  } catch {
    return NextResponse.json({ error: 'Error de conexión con el servidor' }, { status: 500 });
  }
}
