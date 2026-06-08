// app/api/georeferencia/route.ts
// Georreferencia de locales comerciales usando Overpass API (OpenStreetMap) + Nominatim
// 100% gratuito, sin API key, sin límite de créditos
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

// Mapeo de regiones chilenas a nombres Nominatim
const REGION_NOMINATIM: Record<string, string> = {
  'Arica y Parinacota': 'Región de Arica y Parinacota, Chile',
  'Tarapacá':           'Región de Tarapacá, Chile',
  'Antofagasta':        'Región de Antofagasta, Chile',
  'Atacama':            'Región de Atacama, Chile',
  'Coquimbo':           'Región de Coquimbo, Chile',
  'Valparaíso':         'Región de Valparaíso, Chile',
  'Metropolitana':      'Región Metropolitana de Santiago, Chile',
  "O'Higgins":          "Región del Libertador General Bernardo O'Higgins, Chile",
  'Maule':              'Región del Maule, Chile',
  'Ñuble':              'Región de Ñuble, Chile',
  'Biobío':             'Región del Biobío, Chile',
  'La Araucanía':       'Región de La Araucanía, Chile',
  'Los Ríos':           'Región de Los Ríos, Chile',
  'Los Lagos':          'Región de Los Lagos, Chile',
  'Aysén':              'Región de Aysén del General Carlos Ibáñez del Campo, Chile',
  'Magallanes':         'Región de Magallanes y de la Antártica Chilena, Chile',
};

// Tags OSM por categoría
const CATEGORY_TAGS: Record<string, string[][]> = {
  todo: [
    ['shop','hardware'],['shop','doityourself'],['shop','building_materials'],
    ['shop','electrical'],['shop','tools'],['shop','paint'],['shop','timber'],
    ['shop','plumber'],['shop','wholesale'],['shop','trade'],
    ['craft','electrician'],['craft','carpenter'],['craft','plumber'],
    ['industrial','fabricacion'],
  ],
  grandes: [
    ['shop','doityourself'],['shop','hardware'],
  ],
  ferreterias: [
    ['shop','hardware'],
  ],
  materiales: [
    ['shop','building_materials'],['shop','timber'],['craft','carpenter'],
  ],
  electrica: [
    ['shop','electrical'],['craft','electrician'],
  ],
  herramientas: [
    ['shop','tools'],
  ],
  pinturas: [
    ['shop','paint'],
  ],
  mayoristas: [
    ['shop','wholesale'],['shop','trade'],['office','wholesale'],
  ],
  plomeria: [
    ['shop','plumber'],['craft','plumber'],
  ],
};

const TIPO_POR_TAG: Record<string, string> = {
  'shop=doityourself':       'grande',
  'shop=hardware':           'ferreteria',
  'shop=building_materials': 'materiales',
  'shop=electrical':         'electrica',
  'craft=electrician':       'electrica',
  'shop=tools':              'herramientas',
  'shop=paint':              'pinturas',
  'shop=timber':             'maderas',
  'craft=carpenter':         'maderas',
  'shop=wholesale':          'mayorista',
  'shop=trade':              'mayorista',
  'office=wholesale':        'mayorista',
  'shop=plumber':            'plomeria',
  'craft=plumber':           'plomeria',
};

export interface GeoLocal {
  id: string;
  nombre: string;
  tipo: string;
  direccion: string;
  telefono: string | null;
  web: string | null;
  email: string | null;
  horario: string | null;
  lat: number;
  lng: number;
  maps_url: string;
}

async function getBbox(region: string): Promise<[number,number,number,number] | null> {
  const q = REGION_NOMINATIM[region] || `${region}, Chile`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&featuretype=boundary`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'GrupoICA-Intranet/1.0 (contacto@grupoica.cl)' },
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (!data[0]?.boundingbox) return null;
    const [s, n, w, e] = data[0].boundingbox.map(Number);
    return [s, w, n, e]; // south, west, north, east
  } catch {
    return null;
  }
}

async function queryOverpass(bbox: [number,number,number,number], tags: string[][]): Promise<any[]> {
  const [s, w, n, e] = bbox;
  const bboxStr = `${s},${w},${n},${e}`;

  const tagLines = tags.map(([k, v]) =>
    `  node["${k}"="${v}"](${bboxStr});\n  way["${k}"="${v}"](${bboxStr});`
  ).join('\n');

  const query = `[out:json][timeout:30][bbox:${bboxStr}];
(
${tagLines}
);
out center body qt 200;`;

  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!r.ok) return [];
    const data = await r.json();
    return data.elements || [];
  } catch {
    return [];
  }
}

function detectarTipo(tags: Record<string, string>): string {
  for (const [tagK, tagV] of Object.entries(tags)) {
    const key = `${tagK}=${tagV}`;
    if (TIPO_POR_TAG[key]) return TIPO_POR_TAG[key];
  }
  // Detectar grandes tiendas por nombre
  const nombre = (tags.name || '').toLowerCase();
  if (['sodimac','easy','imperial','construmart','homecenter','chilemat','baumart'].some(g => nombre.includes(g)))
    return 'grande';
  return 'otro';
}

function mapsUrl(lat: number, lng: number, nombre: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nombre)}&query=${lat},${lng}`;
}

export async function GET(req: NextRequest) {
  const sp       = req.nextUrl.searchParams;
  const region   = sp.get('region')?.trim() || '';
  const categoria = (sp.get('categoria') || 'todo').toLowerCase();
  const busqueda = sp.get('q')?.trim() || '';

  if (!region) return NextResponse.json({ error: 'Falta región' }, { status: 400 });

  // 1. Obtener bbox de la región
  const bbox = await getBbox(region);
  if (!bbox) return NextResponse.json({ error: `No se encontró la región "${region}"` }, { status: 404 });

  // 2. Obtener tags para la categoría
  const tags = CATEGORY_TAGS[categoria] || CATEGORY_TAGS.todo;

  // 3. Consultar Overpass
  const elements = await queryOverpass(bbox, tags);

  // 4. Normalizar resultados
  const vistos = new Set<string>();
  const locales: GeoLocal[] = [];

  for (const el of elements) {
    const t = el.tags || {};
    const nombre = t.name || t['name:es'] || '';
    if (!nombre) continue;

    // Coordenadas: node tiene lat/lon, way tiene center
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!lat || !lng) continue;

    // Deduplicar por nombre+coordenada aproximada
    const key = `${nombre.toLowerCase()}_${lat.toFixed(3)}_${lng.toFixed(3)}`;
    if (vistos.has(key)) continue;
    vistos.add(key);

    // Filtrar por búsqueda de texto si aplica
    if (busqueda && !nombre.toLowerCase().includes(busqueda.toLowerCase())) continue;

    const direccion = [
      t['addr:street'],
      t['addr:housenumber'],
      t['addr:city'],
    ].filter(Boolean).join(', ');

    locales.push({
      id:       `${el.type}/${el.id}`,
      nombre,
      tipo:     detectarTipo(t),
      direccion,
      telefono: t.phone || t['contact:phone'] || null,
      web:      t.website || t['contact:website'] || null,
      email:    t.email || t['contact:email'] || null,
      horario:  t.opening_hours || null,
      lat,
      lng,
      maps_url: mapsUrl(lat, lng, nombre),
    });

    if (locales.length >= 200) break;
  }

  // Ordenar: grandes primero, luego alfabético
  locales.sort((a, b) => {
    if (a.tipo === 'grande' && b.tipo !== 'grande') return -1;
    if (b.tipo === 'grande' && a.tipo !== 'grande') return 1;
    return a.nombre.localeCompare(b.nombre);
  });

  return NextResponse.json({
    region,
    categoria,
    total: locales.length,
    locales,
  });
}
