// app/api/buscar-producto-local/route.ts
// Busca tiendas físicas en una región de Chile que podrían vender un producto.
//
// IMPORTANTE: Serper /search con `location` NO filtra resultados a sitios de esa
// región — solo ajusta el ranking de Google. Tiendas nacionales (Falabella, Sodimac,
// Treck, etc.) aparecen igual sin importar la región, y su precio/stock es el mismo
// en toda la web. Por eso esta API NO devuelve resultados "orgánicos web" — solo
// negocios físicos reales obtenidos vía Serper /maps (Google Maps Places), que sí
// están geolocalizados en la región solicitada.
//
// Limitación: Maps no expone catálogo/stock por producto, así que no se puede
// confirmar si el local tiene el producto específico — se devuelve como referencia
// de "dónde preguntar" según el rubro del producto.
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

const NOTA_DISCLAIMER =
  'Tiendas físicas ubicadas en la región que, por su rubro, podrían vender este tipo de producto. ' +
  'Google Maps no expone catálogo ni stock — confirma disponibilidad y precio por teléfono antes de visitar.';

// ─── Utilidades ───────────────────────────────────────────────────────────────

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
 * Determina el rubro de tienda más relevante para el producto,
 * usado como query en la búsqueda de mapas. Cada categoría apunta
 * al tipo de comercio físico real donde se vende ese producto en Chile
 * (no todo es ferretería).
 */
function categoriaParaMaps(producto: string): string {
  const n = producto.toLowerCase();

  // EPP / seguridad industrial
  if (/lente.*seguridad|antiparra|guante|casco|zapato.*seguridad|bota.*seguridad|arnes|chaleco.*reflectante|tap[oó]n.*o[ií]do|respirador|mascarilla|epp|seguridad industrial/.test(n))
    return 'implementos de seguridad industrial EPP';

  // Aseo y limpieza
  if (/aseo|limpieza|detergente|desinfectante|escoba|trapero|basurero|papel higi[eé]nico|jab[oó]n|cloro|bolsa.*basura|desengrasante|cera.*piso/.test(n))
    return 'distribuidora de artículos de aseo y limpieza';

  // Baño / sanitarios (artefactos terminados, no tubería)
  if (/inodoro|lavamanos|tina|ducha|grifer[ií]a|toallero|espejo.*baño|accesorios.*baño|wc\b|bid[eé]/.test(n))
    return 'tienda de artículos sanitarios y baño';

  // Jardinería
  if (/jard[ií]n|pasto|fertilizante|maceta|regadera|tijera.*podar|manguera.*riego|semilla|abono|tierra de hoja|cortac[eé]sped/.test(n))
    return 'vivero y artículos de jardinería';

  // Maquinaria pesada / industrial / arriendo
  if (/retroexcavadora|minicargador|gr[uú]a|compactador|pavimentadora|generador.*el[eé]ctrico|motobomba|montacargas|rodillo.*compactador|placa.*compactadora/.test(n))
    return 'maquinaria industrial y arriendo de equipos';

  // Oficina / papelería
  if (/papel\b|l[aá]piz|lapicera|carpeta|archivador|cuaderno|oficina|impresora|t[oó]ner|cinta.*adhesiva.*oficina/.test(n))
    return 'librería y artículos de oficina';

  // Ropa y calzado de trabajo (no EPP específico)
  if (/zapatilla|zapato\b|pantal[oó]n|polera|chaqueta|ropa.*trabajo|uniforme|overol/.test(n))
    return 'tienda de ropa y calzado de trabajo';

  // Pinturas
  if (/pintura|esmalte|anticorrosivo|latex|barniz|sellador|impermeabilizante/.test(n)) return 'pinturas materiales construcción';

  // Maderas
  if (/madera|pino|mdf|osb|tabla|terciado/.test(n)) return 'maderería materiales construcción';

  // Eléctrico
  if (/cable|conduit|tablero|interruptor|foco|led|enchufe|el[eé]ctric/.test(n)) return 'materiales eléctricos ferretería';

  // Plomería / tubería
  if (/tubo|pvc|codo|copla|sif[oó]n|v[aá]lvula|llave.*paso|sanitari/.test(n)) return 'materiales plomería ferretería';

  // Aceros y metales
  if (/fierro|acero|angular|perfil|malla|pletina|barra/.test(n)) return 'aceros y metales ferretería';

  // Herramientas eléctricas
  if (/taladro|amoladora|sierra|esmeril|compresor|soldadora|atornillador|lijadora/.test(n)) return 'herramientas eléctricas ferretería';

  // Tornillería y fijaciones
  if (/tornillo|perno|tuerca|golilla|clavo|tarugo|remache|bisagra/.test(n)) return 'tornillería y fijaciones ferretería';

  return 'ferretería materiales construcción';
}

function buildMapsUrl(nombre: string, direccion: string): string | null {
  const q = [nombre, direccion].filter(Boolean).join(' ').trim();
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
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
        q: `${categoria} ${region}, Chile`,
        gl: 'cl',
        hl: 'es',
        num: 10,
      }),
    });
    clearTimeout(tid);
    if (!res.ok) return [];
    const data = await res.json();
    const places: any[] = data.places || [];

    return places.slice(0, 6).map((p: any) => {
      const nombre = (p.title || '').trim();
      const direccion = (p.address || '').trim();
      return {
        tienda: nombre,
        nombre,
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

  const resultados = await buscarMaps(producto, region);
  const maps_link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${categoriaParaMaps(producto)} ${region}, Chile`)}`;

  return NextResponse.json({
    producto,
    region,
    resultados,
    maps_link,
    nota: NOTA_DISCLAIMER,
    total: resultados.length,
  });
}
