// app/api/meli-regional/route.ts
// Busca productos en MercadoLibre Chile usando Authorization Code (offline_access).
// Requiere MELI_REFRESH_TOKEN en env. El token se renueva automáticamente.
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CLIENT_ID     = process.env.MELI_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.MELI_CLIENT_SECRET || '';

let cachedToken: { value: string; expiresAt: number } | null = null;
let currentRefreshToken: string | null = null;

async function getToken(): Promise<string> {
  const ahora = Date.now();
  if (cachedToken && cachedToken.expiresAt > ahora) return cachedToken.value;

  const refreshToken = currentRefreshToken || process.env.MELI_REFRESH_TOKEN || '';
  if (!refreshToken) {
    throw new Error('MELI_REFRESH_TOKEN no configurado. Autoriza la app en /meli-setup');
  }

  console.log('[meli] renovando access token con refresh_token...');
  const r = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  const body = await r.json();
  if (!r.ok) {
    throw new Error(`ML OAuth refresh error ${r.status}: ${body.error || body.message || JSON.stringify(body)}`);
  }

  cachedToken = {
    value:     body.access_token,
    expiresAt: ahora + (body.expires_in - 300) * 1000,
  };
  if (body.refresh_token) currentRefreshToken = body.refresh_token;
  console.log('[meli] token renovado OK, expira en', body.expires_in, 's');
  return cachedToken.value;
}

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

export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams;
  const q      = sp.get('q')?.trim() || '';
  const region = sp.get('region')?.trim() || '';

  if (!q) return NextResponse.json({ error: 'Falta parámetro q' }, { status: 400 });

  try {
    const token = await getToken();

    const url = `https://api.mercadolibre.com/sites/MLC/search?q=${encodeURIComponent(q)}&limit=50&sort=price_asc`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('[meli] search error:', r.status, JSON.stringify(data));
      return NextResponse.json({ error: `ML error ${r.status}: ${data.message || data.error}` }, { status: 502 });
    }

    let results: any[] = data.results || [];

    if (region) {
      const aliases = ALIASES_REGION[region] || [region];
      results = results.filter((item: any) => {
        const estado = item.seller_address?.state?.name || '';
        return aliases.some(a => estado.toLowerCase().includes(a.toLowerCase()));
      });
    }

    const items = results.slice(0, 48).map((item: any) => ({
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
    console.error('[meli] error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
