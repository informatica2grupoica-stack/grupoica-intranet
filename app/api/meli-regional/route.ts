// app/api/meli-regional/route.ts
// Busca productos en MercadoLibre Chile usando OAuth Client Credentials
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CLIENT_ID     = process.env.MELI_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.MELI_CLIENT_SECRET || '';

// Cache del token en memoria del proceso (válido 6h, renovamos a las 5h)
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const ahora = Date.now();
  if (cachedToken && cachedToken.expiresAt > ahora) return cachedToken.value;

  const r = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!r.ok) throw new Error(`ML OAuth error ${r.status}`);
  const data = await r.json();
  cachedToken = {
    value:     data.access_token,
    expiresAt: ahora + (data.expires_in - 600) * 1000, // renovar 10 min antes
  };
  return cachedToken.value;
}

// Aliases de nombre de región tal como los devuelve ML en seller_address.state.name
const ALIASES_REGION: Record<string, string[]> = {
  'Metropolitana':      ['Región Metropolitana', 'Metropolitana', 'Metropolitan'],
  'Valparaíso':         ['Valparaíso', 'Valparaiso'],
  'Biobío':             ['Biobío', 'Bio-Bio', 'Bío-Bío', 'Biobio'],
  'La Araucanía':       ['Araucanía', 'La Araucanía', 'Araucania'],
  'Los Lagos':          ['Los Lagos'],
  'Maule':              ['Maule'],
  "O'Higgins":          ["O'Higgins", 'Libertador General'],
  'Coquimbo':           ['Coquimbo'],
  'Antofagasta':        ['Antofagasta'],
  'Tarapacá':           ['Tarapacá', 'Tarapaca'],
  'Atacama':            ['Atacama'],
  'Ñuble':              ['Ñuble', 'Nuble'],
  'Los Ríos':           ['Los Ríos', 'Los Rios'],
  'Aysén':              ['Aysén', 'Aysen'],
  'Magallanes':         ['Magallanes'],
  'Arica y Parinacota': ['Arica y Parinacota', 'Arica'],
};

export interface MeliItem {
  id: string;
  titulo: string;
  precio: number;
  imagen: string | null;
  link: string;
  condicion: string;
  vendedor_estado: string;
  vendedor_ciudad: string;
  cantidad: number;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q      = sp.get('q')?.trim() || '';
  const region = sp.get('region')?.trim() || '';

  if (!q) return NextResponse.json({ error: 'Falta parámetro q' }, { status: 400 });
  if (!CLIENT_ID || !CLIENT_SECRET)
    return NextResponse.json({ error: 'Credenciales ML no configuradas' }, { status: 503 });

  try {
    const token = await getToken();

    const url = `https://api.mercadolibre.com/sites/MLC/search?q=${encodeURIComponent(q)}&limit=50&condition=new&sort=price_asc`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!r.ok) throw new Error(`ML search error ${r.status}`);

    const data = await r.json();
    let results: any[] = data.results || [];

    if (region) {
      const aliases = ALIASES_REGION[region] || [region];
      results = results.filter((item: any) => {
        const estado = item.seller_address?.state?.name || '';
        return aliases.some(a => estado.toLowerCase().includes(a.toLowerCase()));
      });
    }

    const items: MeliItem[] = results.slice(0, 48).map((item: any) => ({
      id:              item.id || '',
      titulo:          item.title || '',
      precio:          item.price || 0,
      imagen:          item.thumbnail?.replace('I.jpg', 'O.jpg') || null,
      link:            item.permalink || '',
      condicion:       item.condition === 'new' ? 'Nuevo' : 'Usado',
      vendedor_estado: item.seller_address?.state?.name || '',
      vendedor_ciudad: item.seller_address?.city?.name || '',
      cantidad:        item.available_quantity || 0,
    }));

    return NextResponse.json({ items, total: items.length, filtrado_por: region || null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
