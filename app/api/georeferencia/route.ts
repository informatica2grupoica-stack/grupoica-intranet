// app/api/georeferencia/route.ts
// Georreferencia de locales comerciales usando Overpass API (OpenStreetMap)
// 100% gratuito, sin API key, sin límite de créditos
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

// Coordenadas de la capital de cada región chilena
// Radio de búsqueda: 60km (cubre la ciudad capital y zonas cercanas)
const REGION_COORDS: Record<string, { lat: number; lng: number; radio: number }> = {
  'Arica y Parinacota': { lat: -18.4746, lng: -70.2979, radio: 40000 },
  'Tarapacá':           { lat: -20.2133, lng: -70.1503, radio: 40000 },
  'Antofagasta':        { lat: -23.6509, lng: -70.3975, radio: 50000 },
  'Atacama':            { lat: -27.3668, lng: -70.3323, radio: 50000 },
  'Coquimbo':           { lat: -29.9533, lng: -71.3395, radio: 60000 },
  'Valparaíso':         { lat: -33.0458, lng: -71.6197, radio: 80000 },
  'Metropolitana':      { lat: -33.4569, lng: -70.6483, radio: 80000 },
  "O'Higgins":          { lat: -34.1703, lng: -70.7442, radio: 60000 },
  'Maule':              { lat: -35.4264, lng: -71.6554, radio: 70000 },
  'Ñuble':              { lat: -36.6067, lng: -72.1034, radio: 60000 },
  'Biobío':             { lat: -36.8201, lng: -73.0444, radio: 70000 },
  'La Araucanía':       { lat: -38.7359, lng: -72.5904, radio: 70000 },
  'Los Ríos':           { lat: -39.8142, lng: -73.2459, radio: 60000 },
  'Los Lagos':          { lat: -41.4693, lng: -72.9424, radio: 70000 },
  'Aysén':              { lat: -45.5712, lng: -72.0664, radio: 50000 },
  'Magallanes':         { lat: -53.1638, lng: -70.9171, radio: 60000 },
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

async function queryOverpass(lat: number, lng: number, radio: number, tags: string[][]): Promise<any[]> {
  const around = `around:${radio},${lat},${lng}`;

  const tagLines = tags.map(([k, v]) =>
    `  node["${k}"="${v}"](${around});\n  way["${k}"="${v}"](${around});`
  ).join('\n');

  const query = `[out:json][timeout:20];
(
${tagLines}
);
out center body qt 300;`;

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
  const sp        = req.nextUrl.searchParams;
  const region    = sp.get('region')?.trim() || '';
  const categoria = (sp.get('categoria') || 'todo').toLowerCase();
  const busqueda  = sp.get('q')?.trim() || '';

  if (!region) return NextResponse.json({ error: 'Falta región' }, { status: 400 });

  // 1. Obtener coordenadas de la capital regional
  const coords = REGION_COORDS[region];
  if (!coords) return NextResponse.json({ error: `No se encontró la región "${region}"` }, { status: 404 });

  // 2. Obtener tags para la categoría
  const tags = CATEGORY_TAGS[categoria] || CATEGORY_TAGS.todo;

  // 3. Consultar Overpass con radio alrededor de la capital
  const elements = await queryOverpass(coords.lat, coords.lng, coords.radio, tags);

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
