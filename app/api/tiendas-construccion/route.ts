// app/api/tiendas-construccion/route.ts
// Busca tiendas de construcción, eléctrica y herramientas en Chile via Serper /maps
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SERPER_KEY = process.env.SERPER_API_KEY || '';

export interface TiendaItem {
  nombre: string;
  categoria: string;
  direccion: string;
  telefono: string | null;
  sitio_web: string | null;
  rating: number | null;
  reviews: number | null;
  horario: string | null;
  maps_url: string | null;
  tipo: 'ferreteria' | 'materiales' | 'electrica' | 'herramientas' | 'grande' | 'otro';
  lat: number | null;
  lng: number | null;
}

type Categoria = 'ferreteria' | 'materiales' | 'electrica' | 'herramientas' | 'grandes' | 'todo';

const QUERIES: Record<Categoria, string[]> = {
  ferreteria:   ['ferretería'],
  materiales:   ['materiales de construcción'],
  electrica:    ['materiales eléctricos electricidad industrial'],
  herramientas: ['tienda herramientas construcción'],
  grandes:      ['Sodimac', 'Easy tienda', 'Imperial ferretería', 'Construmart'],
  todo:         ['ferretería', 'materiales construcción', 'materiales eléctricos', 'herramientas'],
};

function clasificar(nombre: string, categoria: string | undefined): TiendaItem['tipo'] {
  const t = (nombre + ' ' + (categoria || '')).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (['sodimac','easy','imperial','construmart','homecenter'].some(g => t.includes(g))) return 'grande';
  if (t.includes('ferret')) return 'ferreteria';
  if (t.includes('electric') || t.includes('electro')) return 'electrica';
  if (t.includes('herramienta')) return 'herramientas';
  if (t.includes('material') || t.includes('construc') || t.includes('madera') || t.includes('acero')) return 'materiales';
  return 'otro';
}

function mapsUrl(nombre: string, direccion: string): string | null {
  const q = [nombre, direccion].filter(Boolean).join(' ').trim();
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

async function serperMaps(query: string, region: string): Promise<any[]> {
  if (!SERPER_KEY) return [];
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch('https://google.serper.dev/maps', {
      method: 'POST',
      headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ q: `${query} ${region} Chile`, gl: 'cl', hl: 'es', num: 10 }),
    });
    clearTimeout(tid);
    if (!r.ok) return [];
    const data = await r.json();
    return data.places || [];
  } catch {
    return [];
  } finally {
    clearTimeout(tid);
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const region = sp.get('region')?.trim() || '';
  const cat = (sp.get('categoria') || 'todo').trim().toLowerCase() as Categoria;

  if (!region) return NextResponse.json({ region: '', total: 0, tiendas: [] });
  if (!SERPER_KEY) return NextResponse.json({ error: 'SERPER_API_KEY no configurada' }, { status: 503 });

  const queries = QUERIES[cat] ?? QUERIES.todo;

  const placesRaw = (await Promise.allSettled(
    queries.map(q => serperMaps(q, region))
  )).flatMap(r => r.status === 'fulfilled' ? r.value : []);

  // Deduplicar por nombre normalizado
  const vistos = new Set<string>();
  const tiendas: TiendaItem[] = [];
  for (const p of placesRaw) {
    const nombre = (p.title || '').trim();
    const key = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!nombre || vistos.has(key)) continue;
    vistos.add(key);
    const direccion = (p.address || '').trim();
    tiendas.push({
      nombre,
      categoria: p.category || '',
      direccion,
      telefono: p.phoneNumber?.trim() || null,
      sitio_web: p.website?.trim() || null,
      rating: typeof p.rating === 'number' ? p.rating : null,
      reviews: typeof p.ratingCount === 'number' ? p.ratingCount : null,
      horario: p.hours?.trim() || null,
      maps_url: mapsUrl(nombre, direccion),
      tipo: clasificar(nombre, p.category),
      lat: typeof p.latitude === 'number' ? p.latitude : null,
      lng: typeof p.longitude === 'number' ? p.longitude : null,
    });
    if (tiendas.length >= 30) break;
  }

  // Ordenar: grandes primero, luego por rating
  tiendas.sort((a, b) => {
    if (a.tipo === 'grande' && b.tipo !== 'grande') return -1;
    if (b.tipo === 'grande' && a.tipo !== 'grande') return 1;
    return (b.rating || 0) - (a.rating || 0);
  });

  return NextResponse.json({ region, categoria: cat, total: tiendas.length, tiendas });
}
