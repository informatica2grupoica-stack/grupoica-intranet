// app/api/meli-regional/route.ts
// Busca productos en MercadoLibre Chile, filtrados por región del vendedor
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Aliases de nombres de región como los devuelve la API de ML
const ALIASES_REGION: Record<string, string[]> = {
  'Metropolitana':       ['Región Metropolitana de Santiago', 'Metropolitana', 'Metropolitan'],
  'Valparaíso':          ['Valparaíso', 'Valparaiso'],
  'Biobío':              ['Biobío', 'Bio-Bio', 'Bío-Bío', 'Biobio'],
  'La Araucanía':        ['Araucanía', 'La Araucanía', 'Araucania'],
  'Los Lagos':           ['Los Lagos'],
  'Maule':               ['Maule'],
  "O'Higgins":           ["O'Higgins", 'Libertador General'],
  'Coquimbo':            ['Coquimbo'],
  'Antofagasta':         ['Antofagasta'],
  'Tarapacá':            ['Tarapacá', 'Tarapaca'],
  'Atacama':             ['Atacama'],
  'Ñuble':               ['Ñuble', 'Nuble'],
  'Los Ríos':            ['Los Ríos', 'Los Rios'],
  'Aysén':               ['Aysén', 'Aysen'],
  'Magallanes':          ['Magallanes'],
  'Arica y Parinacota':  ['Arica y Parinacota', 'Arica'],
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
  const q = sp.get('q')?.trim() || '';
  const region = sp.get('region')?.trim() || '';

  if (!q) return NextResponse.json({ error: 'Falta parámetro q' }, { status: 400 });

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 12000);
  try {
    // ML Chile API — no requiere API key para búsquedas básicas
    const url = `https://api.mercadolibre.com/sites/MLC/search?q=${encodeURIComponent(q)}&limit=50&condition=new&sort=price_asc`;
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!r.ok) return NextResponse.json({ error: `MercadoLibre API ${r.status}` }, { status: 502 });

    const data = await r.json();
    let results: any[] = data.results || [];

    // Filtrar por región si se especificó
    if (region) {
      const aliases = ALIASES_REGION[region] || [region];
      results = results.filter((item: any) => {
        const estado = item.seller_address?.state?.name || '';
        return aliases.some(a => estado.toLowerCase().includes(a.toLowerCase()));
      });
    }

    const items: MeliItem[] = results.slice(0, 24).map((item: any) => ({
      id: item.id || '',
      titulo: item.title || '',
      precio: item.price || 0,
      imagen: item.thumbnail?.replace('I.jpg', 'O.jpg') || null,
      link: item.permalink || '',
      condicion: item.condition === 'new' ? 'Nuevo' : 'Usado',
      vendedor_estado: item.seller_address?.state?.name || '',
      vendedor_ciudad: item.seller_address?.city?.name || '',
      cantidad: item.available_quantity || 0,
    }));

    return NextResponse.json({ items, total: items.length, filtrado_por: region || null });
  } catch {
    return NextResponse.json({ error: 'Error de conexión' }, { status: 500 });
  } finally {
    clearTimeout(tid);
  }
}
