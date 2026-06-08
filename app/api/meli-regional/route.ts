// app/api/meli-regional/route.ts
// Busca productos en MercadoLibre Chile con OAuth Client Credentials.
// REQUISITO: la app debe tener el permiso "Publicación y sincronización" → Lectura
// habilitado en DevCenter, de lo contrario devuelve 403 PolicyAgent.
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CLIENT_ID     = process.env.MELI_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.MELI_CLIENT_SECRET || '';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const ahora = Date.now();
  if (cachedToken && cachedToken.expiresAt > ahora) {
    console.log('[meli] using cached token, expires in', Math.round((cachedToken.expiresAt - ahora) / 1000), 's');
    return cachedToken.value;
  }

  console.log('[meli] requesting new OAuth token for client_id:', CLIENT_ID);
  const r = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  const body = await r.json();
  console.log('[meli] token response status:', r.status, '| error:', body.error || 'none', '| token_type:', body.token_type || 'n/a');

  if (!r.ok) {
    throw new Error(`ML OAuth error ${r.status}: ${body.error || body.message || JSON.stringify(body)}`);
  }

  cachedToken = {
    value:     body.access_token,
    expiresAt: ahora + (body.expires_in - 600) * 1000,
  };
  console.log('[meli] new token obtained, prefix:', body.access_token?.slice(0, 20));
  return cachedToken.value;
}

// Aliases de región según seller_address.state.name de ML
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
  const sp     = req.nextUrl.searchParams;
  const q      = sp.get('q')?.trim() || '';
  const region = sp.get('region')?.trim() || '';

  console.log('[meli] GET q=%s region=%s', q, region);

  if (!q) return NextResponse.json({ error: 'Falta parámetro q' }, { status: 400 });
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('[meli] MELI_CLIENT_ID o MELI_CLIENT_SECRET no configurados');
    return NextResponse.json({ error: 'Credenciales ML no configuradas' }, { status: 503 });
  }

  try {
    const token = await getToken();

    const searchUrl = `https://api.mercadolibre.com/sites/MLC/search?q=${encodeURIComponent(q)}&limit=50&condition=new&sort=price_asc`;
    console.log('[meli] calling search URL:', searchUrl);

    const r = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const data = await r.json();
    console.log('[meli] search response status:', r.status, '| error:', data.error || 'none', '| blocked_by:', data.blocked_by || 'none');

    if (!r.ok) {
      // Diagnóstico específico para PolicyAgent
      if (data.blocked_by === 'PolicyAgent' || data.code === 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES') {
        console.error('[meli] PolicyAgent 403 — la app no tiene el permiso "Publicación y sincronización > Lectura" habilitado en DevCenter');
        return NextResponse.json({
          error: 'La aplicación no tiene permiso de lectura de ítems. Habilita "Publicación y sincronización → Lectura" en el DevCenter de MercadoLibre.',
          diagnostico: 'PolicyAgent 403',
          accion: 'Ir a developers.mercadolibre.cl/devcenter → tu app → Configurar → Scopes → Publicación y sincronización → Lectura',
        }, { status: 503 });
      }
      throw new Error(`ML search error ${r.status}: ${data.error || data.message || JSON.stringify(data).slice(0, 200)}`);
    }

    let results: any[] = data.results || [];
    console.log('[meli] raw results count:', results.length);

    if (region) {
      const aliases = ALIASES_REGION[region] || [region];
      results = results.filter((item: any) => {
        const estado = item.seller_address?.state?.name || '';
        return aliases.some(a => estado.toLowerCase().includes(a.toLowerCase()));
      });
      console.log('[meli] after region filter (%s): %d results', region, results.length);
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

    console.log('[meli] returning %d items', items.length);
    return NextResponse.json({ items, total: items.length, filtrado_por: region || null });

  } catch (e: any) {
    console.error('[meli] fatal error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
