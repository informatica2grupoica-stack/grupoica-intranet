import { NextResponse, NextRequest } from 'next/server';

// Interfaz para cliente enriquecido
interface ClienteEnriquecido {
  id: string;
  rut: string;
  razon_social: string;
  email: string;
  telefono: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  estado: boolean;
  es_extranjero: boolean;
  extranjero_id: string;
  created_at?: string;
  contactos: any[];
  direcciones: any[];
  total_contactos: number;
  total_direcciones: number;
}

// Interfaz para estadísticas
interface Estadisticas {
  total_clientes: number;
  clientes_activos: number;
  clientes_inactivos: number;
  total_contactos: number;
  total_direcciones: number;
}

// Caché simple en memoria
let cache: {
  data: any;
  timestamp: number;
  filtro: string;
} | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const page = searchParams.get('page') || '1';
  const filter = searchParams.get('filter') || searchParams.get('search') || '';
  const limit = searchParams.get('limit') || '100';
  const estado = searchParams.get('estado') || 'todos';
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Verificar caché
  const cacheKey = `${estado}-${filter}-${page}`;
  if (!forceRefresh && cache && cache.filtro === cacheKey && (Date.now() - cache.timestamp) < CACHE_DURATION) {
    console.log("📦 Usando caché de clientes");
    return NextResponse.json(cache.data);
  }

  const obumaUrl = new URL(`${process.env.OBUMA_API_URL}/clientes.list.json`);
  obumaUrl.searchParams.append('page', page);
  obumaUrl.searchParams.append('limit', limit);
  
  if (filter) {
    obumaUrl.searchParams.append('cliente_razon_social', filter.trim());
  }
  
  if (estado === 'activo') {
    obumaUrl.searchParams.append('estado', '1');
  } else if (estado === 'inactivo') {
    obumaUrl.searchParams.append('estado', '0');
  }

  try {
    console.log("📡 Consultando Obuma clientes...");
    
    // 1. Obtener clientes
    const response = await fetch(obumaUrl.toString(), {
      method: 'GET',
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      },
      next: { revalidate: 60 }
    });

    if (!response.ok) {
      throw new Error(`Error de Obuma: ${response.status}`);
    }

    const data = await response.json();
    let clientes = data.data || data.clientes || [];

    if (clientes.length === 0) {
      const emptyResponse = {
        success: true,
        data: [],
        stats: {
          total_clientes: 0,
          clientes_activos: 0,
          clientes_inactivos: 0,
          total_contactos: 0,
          total_direcciones: 0
        }
      };
      return NextResponse.json(emptyResponse);
    }

    // 2. Obtener contactos y direcciones en PARALELO
    console.log("📡 Obteniendo contactos y direcciones en paralelo...");
    
    const [contactosAll, direccionesAll] = await Promise.all([
      fetch(`${process.env.OBUMA_API_URL}/clientesContactos.listAll.json`, {
        headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
      }).then(res => res.ok ? res.json() : { data: [] }).catch(() => ({ data: [] })),
      fetch(`${process.env.OBUMA_API_URL}/clientesDirecciones.listAll.json`, {
        headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
      }).then(res => res.ok ? res.json() : { data: [] }).catch(() => ({ data: [] }))
    ]);

    const contactosList = contactosAll.data || contactosAll.contactos || [];
    const direccionesList = direccionesAll.data || direccionesAll.direcciones || [];

    // Crear mapas rápidos por cliente_id
    const contactosPorCliente = new Map<string, any[]>();
    contactosList.forEach((c: any) => {
      const clienteId = c.rel_cliente_id;
      if (clienteId) {
        if (!contactosPorCliente.has(clienteId)) {
          contactosPorCliente.set(clienteId, []);
        }
        contactosPorCliente.get(clienteId)!.push(c);
      }
    });

    const direccionesPorCliente = new Map<string, any[]>();
    direccionesList.forEach((d: any) => {
      const clienteId = d.rel_cliente_id;
      if (clienteId) {
        if (!direccionesPorCliente.has(clienteId)) {
          direccionesPorCliente.set(clienteId, []);
        }
        direccionesPorCliente.get(clienteId)!.push(d);
      }
    });

    // 3. Enriquecer clientes usando los mapas
    const clientesEnriquecidos: ClienteEnriquecido[] = clientes.map((cliente: any) => {
      const contactos = contactosPorCliente.get(cliente.cliente_id) || [];
      const direcciones = direccionesPorCliente.get(cliente.cliente_id) || [];
      
      return {
        id: cliente.cliente_id,
        rut: cliente.cliente_rut || '',
        razon_social: cliente.cliente_razon_social || 'Sin nombre',
        email: cliente.cliente_email || '',
        telefono: cliente.cliente_telefono || '',
        direccion: cliente.cliente_direccion || '',
        comuna: cliente.cliente_comuna || '',
        ciudad: cliente.cliente_ciudad || '',
        estado: cliente.estado === '1' || cliente.estado === 1,
        es_extranjero: cliente.cliente_extranjero === '1',
        extranjero_id: cliente.cliente_extranjero_id || '',
        created_at: cliente.created_at,
        contactos: contactos.slice(0, 3),
        direcciones: direcciones.slice(0, 2),
        total_contactos: contactos.length,
        total_direcciones: direcciones.length
      };
    });

    // 4. Calcular estadísticas (con tipos correctos)
    const stats: Estadisticas = {
      total_clientes: clientesEnriquecidos.length,
      clientes_activos: clientesEnriquecidos.filter((c: ClienteEnriquecido) => c.estado).length,
      clientes_inactivos: clientesEnriquecidos.filter((c: ClienteEnriquecido) => !c.estado).length,
      total_contactos: clientesEnriquecidos.reduce((sum: number, c: ClienteEnriquecido) => sum + c.total_contactos, 0),
      total_direcciones: clientesEnriquecidos.reduce((sum: number, c: ClienteEnriquecido) => sum + c.total_direcciones, 0)
    };

    const responseData = {
      success: true,
      data: clientesEnriquecidos,
      stats: stats,
      pagination: {
        current_page: data.pagination?.current_page || parseInt(page),
        last_page: data.pagination?.last_page || 1,
        per_page: data.pagination?.per_page || parseInt(limit),
        total: data.pagination?.total || clientesEnriquecidos.length
      },
      timestamp: new Date().toISOString()
    };

    // Guardar en caché
    cache = {
      data: responseData,
      timestamp: Date.now(),
      filtro: cacheKey
    };

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error("❌ Error en Listado Clientes Obuma:", error.message);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al conectar con la API de Obuma', 
        details: error.message,
        data: [],
        stats: {
          total_clientes: 0,
          clientes_activos: 0,
          clientes_inactivos: 0,
          total_contactos: 0,
          total_direcciones: 0
        }
      },
      { status: 500 }
    );
  }
}