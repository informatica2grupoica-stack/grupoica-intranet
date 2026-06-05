// app/api/buscar-locales/route.ts
// Busca proveedores locales (ferreterías y materiales de construcción) en Chile
// usando el endpoint /maps de Serper, filtrado por región.
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SERPER_KEY = process.env.SERPER_API_KEY || '';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoProveedor = 'ferreteria' | 'materiales' | 'otro';

type TipoBusqueda = 'ferreteria' | 'materiales' | 'todos';

interface LocalProveedor {
  nombre: string;
  tipo: TipoProveedor;
  direccion: string;
  telefono: string | null;
  sitio_web: string | null;
  rating: number | null;
  total_reviews: number | null;
  horario: string | null;
  maps_url: string | null;
}

// Forma cruda que devuelve Serper /maps
interface SerperPlace {
  title?: string;
  address?: string;
  rating?: number;
  ratingCount?: number;
  phoneNumber?: string;
  website?: string;
  category?: string;
  hours?: string;
}

interface SerperMapsResponse {
  places?: SerperPlace[];
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/**
 * Normaliza un texto a minúsculas sin acentos para comparaciones y deduplicación.
 */
function normalizar(t: string): string {
  return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/**
 * Clasifica un resultado de Serper según su campo `category`.
 * Reglas:
 *  - "ferret"                                  → 'ferreteria'
 *  - "material" | "construc" | "madera"
 *    | "acero"  | "pintura"                    → 'materiales'
 *  - cualquier otro                            → 'otro'
 */
function clasificarTipo(category: string | undefined): TipoProveedor {
  const c = normalizar(category || '');
  if (c.includes('ferret')) return 'ferreteria';
  if (
    c.includes('material') ||
    c.includes('construc') ||
    c.includes('madera') ||
    c.includes('acero') ||
    c.includes('pintura')
  )
    return 'materiales';
  return 'otro';
}

/**
 * Construye la URL de Google Maps para buscar un local por nombre y dirección.
 */
function construirMapsUrl(nombre: string, direccion: string): string | null {
  const q = [nombre, direccion].filter(Boolean).join(' ').trim();
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * Mapea un resultado crudo de Serper al formato LocalProveedor.
 */
function mapearPlace(place: SerperPlace): LocalProveedor {
  const nombre = (place.title || '').trim();
  const direccion = (place.address || '').trim();
  return {
    nombre,
    tipo: clasificarTipo(place.category),
    direccion,
    telefono: place.phoneNumber?.trim() || null,
    sitio_web: place.website?.trim() || null,
    rating: typeof place.rating === 'number' ? place.rating : null,
    total_reviews: typeof place.ratingCount === 'number' ? place.ratingCount : null,
    horario: place.hours?.trim() || null,
    maps_url: construirMapsUrl(nombre, direccion),
  };
}

// ─── Llamada a Serper /maps ───────────────────────────────────────────────────

/**
 * Ejecuta una consulta al endpoint /maps de Serper con un timeout de 12 segundos.
 * Devuelve lista vacía si la llamada falla (no lanza error).
 */
async function llamarSerperMaps(query: string): Promise<SerperPlace[]> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch('https://google.serper.dev/maps', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_KEY,
        'Content-Type': 'application/json',
      },
      signal: ctrl.signal,
      body: JSON.stringify({ q: query, gl: 'cl', hl: 'es', num: 10 }),
    });
    clearTimeout(tid);
    if (!res.ok) return [];
    const data: SerperMapsResponse = await res.json();
    return data.places || [];
  } catch {
    // Timeout o error de red: devolvemos lista vacía (el caller lo maneja)
    return [];
  } finally {
    clearTimeout(tid);
  }
}

// ─── Deduplicación ────────────────────────────────────────────────────────────

/**
 * Elimina duplicados comparando el nombre normalizado (minúsculas, sin acentos).
 * Conserva la primera aparición.
 */
function deduplicar(locales: LocalProveedor[]): LocalProveedor[] {
  const vistos = new Set<string>();
  return locales.filter((l) => {
    const clave = normalizar(l.nombre);
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const region = (sp.get('region') || '').trim();
  const tipoParam = (sp.get('tipo') || 'todos').trim().toLowerCase() as TipoBusqueda;

  // Validar parámetro tipo; si el valor no es reconocido, usar 'todos'
  const tipo: TipoBusqueda = ['ferreteria', 'materiales', 'todos'].includes(tipoParam)
    ? tipoParam
    : 'todos';

  // ── Región vacía → respuesta vacía sin error ─────────────────────────────
  if (!region) {
    return NextResponse.json({ region: '', total: 0, locales: [] });
  }

  // ── API key ausente → respuesta vacía con aviso ──────────────────────────
  if (!SERPER_KEY) {
    return NextResponse.json(
      { region, total: 0, locales: [], error: 'SERPER_API_KEY no configurada' },
    );
  }

  // ─── Construir queries según tipo ─────────────────────────────────────────

  const queryFerreteria = `ferreterías ${region} Chile`;
  const queryMateriales = `materiales de construcción ${region} Chile`;

  let placesRaw: SerperPlace[] = [];
  let errorOcurrido: string | undefined;

  try {
    if (tipo === 'ferreteria') {
      // Solo ferreterías
      placesRaw = await llamarSerperMaps(queryFerreteria);
    } else if (tipo === 'materiales') {
      // Solo materiales de construcción
      placesRaw = await llamarSerperMaps(queryMateriales);
    } else {
      // 'todos': ambas queries en paralelo con Promise.allSettled
      const [resFerreteria, resMateriales] = await Promise.allSettled([
        llamarSerperMaps(queryFerreteria),
        llamarSerperMaps(queryMateriales),
      ]);

      if (resFerreteria.status === 'fulfilled') placesRaw.push(...resFerreteria.value);
      if (resMateriales.status === 'fulfilled') placesRaw.push(...resMateriales.value);
    }
  } catch (e: unknown) {
    // Error inesperado: devolver lista vacía con campo de error (no 500)
    errorOcurrido = e instanceof Error ? e.message : 'Error desconocido al consultar Serper';
    placesRaw = [];
  }

  // ─── Mapear, deduplicar y limitar ────────────────────────────────────────

  const mapeados = placesRaw.map(mapearPlace);
  const unicos = deduplicar(mapeados);
  const locales = unicos.slice(0, 20); // máximo 20 resultados totales

  // ─── Respuesta ────────────────────────────────────────────────────────────

  const respuesta: {
    region: string;
    total: number;
    locales: LocalProveedor[];
    error?: string;
  } = {
    region,
    total: locales.length,
    locales,
  };

  if (errorOcurrido) respuesta.error = errorOcurrido;

  return NextResponse.json(respuesta);
}
