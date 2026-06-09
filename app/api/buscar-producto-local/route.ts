// app/api/buscar-producto-local/route.ts
// Busca un producto específico en tiendas físicas locales de una región de Chile.
// Combina:
//   1. Serper /search (orgánico) con location → precios web de tiendas .cl en la región
//   2. Serper /maps → tiendas locales (ferreterías, materiales) con dirección y teléfono
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SERPER_KEY = process.env.SERPER_API_KEY || '';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ResultadoLocalProducto {
  tienda: string;
  nombre: string;
  precio_valor: number | null;
  precio_formateado: string;
  link: string;
  tipo: 'ferreteria' | 'materiales' | 'cadena' | 'otro';
  es_mapa: boolean;
  direccion?: string;
  telefono?: string | null;
  maps_url?: string | null;
  rating?: number | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CADENAS = ['sodimac', 'easy', 'construmart', 'imperial', 'homecenter', 'falabella', 'paris', 'boltec'];

// ─── Utilidades ───────────────────────────────────────────────────────────────

function limpiarPrecio(raw: unknown): number | null {
  const s = String(raw ?? '').replace(/[^\d]/g, '');
  if (!s) return null;
  const p = parseInt(s, 10);
  return p >= 500 && p <= 500_000_000 ? p : null;
}

function clasificarTienda(texto: string): ResultadoLocalProducto['tipo'] {
  const t = texto.toLowerCase();
  if (CADENAS.some((c) => t.includes(c))) return 'cadena';
  if (t.includes('ferret')) return 'ferreteria';
  if (
    t.includes('material') ||
    t.includes('construc') ||
    t.includes('madera') ||
    t.includes('acero') ||
    t.includes('pintura')
  )
    return 'materiales';
  return 'otro';
}

/**
 * Determina la categoría de tienda más probable para el producto,
 * usada como query en la búsqueda de mapas.
 */
function categoriaParaMaps(producto: string): string {
  const n = producto.toLowerCase();
  if (/pintura|esmalte|anticorrosivo|latex|barniz|sellador/.test(n)) return 'pinturas materiales construcción';
  if (/madera|pino|mdf|osb|tabla|terciado/.test(n)) return 'maderería materiales construcción';
  if (/cable|conduit|tablero|interruptor|foco|led|enchufe/.test(n)) return 'eléctrica materiales construcción';
  if (/tubo|pvc|codo|copla|sifon|válvula|llave paso/.test(n)) return 'materiales plomería ferretería';
  if (/fierro|acero|angular|perfil|malla/.test(n)) return 'acero metales ferretería construcción';
  return 'ferretería materiales construcción';
}

function buildMapsUrl(nombre: string, direccion: string): string | null {
  const q = [nombre, direccion].filter(Boolean).join(' ').trim();
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

// ─── Búsqueda orgánica con location ──────────────────────────────────────────

async function buscarOrganico(producto: string, region: string): Promise<ResultadoLocalProducto[]> {
  if (!SERPER_KEY) return [];
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        q: `${producto} precio comprar ${region} Chile`,
        gl: 'cl',
        hl: 'es',
        location: `${region}, Chile`,
        num: 10,
      }),
    });
    clearTimeout(tid);
    if (!res.ok) return [];
    const data = await res.json();
    const organic: any[] = data.organic || [];
    const results: ResultadoLocalProducto[] = [];

    for (const item of organic) {
      const link: string = item.link || '';
      if (!link) continue;
      const linkL = link.toLowerCase();
      const isCL =
        linkL.includes('.cl') ||
        linkL.includes('mercadolibre') ||
        CADENAS.some((c) => linkL.includes(c));
      if (!isCL) continue;

      const titulo = (item.title || '').replace(/\s*[\|–—]\s*.*$/, '').trim();
      if (titulo.length < 4) continue;

      const snippet: string = item.snippet || '';
      const pm = (snippet + ' ' + titulo).match(/\$\s*([\d\.,]{3,})/);
      const precioVal = pm ? limpiarPrecio(pm[1].replace(/\./g, '').replace(',', '.')) : null;

      const domMatch = link.match(/https?:\/\/(?:www\.)?([^/]+)/);
      const tienda =
        domMatch?.[1]?.replace(/\.cl$|\.com$/, '')?.slice(0, 40) || 'Web';

      results.push({
        tienda,
        nombre: titulo.slice(0, 150),
        precio_valor: precioVal,
        precio_formateado: precioVal ? `$${precioVal.toLocaleString('es-CL')}` : 'Consultar',
        link,
        tipo: clasificarTienda(tienda + ' ' + linkL),
        es_mapa: false,
      });

      if (results.length >= 5) break;
    }
    return results;
  } catch {
    return [];
  }
}

// ─── Búsqueda en mapas (tiendas locales) ─────────────────────────────────────

async function buscarMaps(producto: string, region: string): Promise<ResultadoLocalProducto[]> {
  if (!SERPER_KEY) return [];
  try {
    const categoria = categoriaParaMaps(producto);
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch('https://google.serper.dev/maps', {
      method: 'POST',
      headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        q: `${categoria} ${region}`,
        gl: 'cl',
        hl: 'es',
        num: 10,
      }),
    });
    clearTimeout(tid);
    if (!res.ok) return [];
    const data = await res.json();
    const places: any[] = data.places || [];

    return places.slice(0, 5).map((p: any) => {
      const nombre = (p.title || '').trim();
      const direccion = (p.address || '').trim();
      return {
        tienda: nombre,
        nombre: `${nombre}`,
        precio_valor: null,
        precio_formateado: 'Consultar presencialmente',
        link: p.website || '',
        tipo: clasificarTienda((nombre + ' ' + (p.category || '')).toLowerCase()),
        es_mapa: true,
        direccion,
        telefono: p.phoneNumber?.trim() || null,
        maps_url: buildMapsUrl(nombre, direccion),
        rating: typeof p.rating === 'number' ? p.rating : null,
      } satisfies ResultadoLocalProducto;
    });
  } catch {
    return [];
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const producto = (sp.get('producto') || '').trim();
  const region = (sp.get('region') || '').trim();

  if (!producto || !region) {
    return NextResponse.json({ resultados: [], maps_link: null, total: 0 });
  }

  if (!SERPER_KEY) {
    return NextResponse.json({
      error: 'SERPER_API_KEY no configurada',
      resultados: [],
      maps_link: null,
      total: 0,
    });
  }

  const [organico, mapas] = await Promise.all([
    buscarOrganico(producto, region),
    buscarMaps(producto, region),
  ]);

  const resultados = [...organico, ...mapas];
  const maps_link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${producto} ${region}`)}`;

  return NextResponse.json({
    producto,
    region,
    resultados,
    maps_link,
    total: resultados.length,
    total_organico: organico.length,
    total_mapas: mapas.length,
  });
}
