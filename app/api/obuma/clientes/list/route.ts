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

// Caché simple en memoria
let cache: {
  data: any;
  timestamp: number;
  filtro: string;
} | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Función para traer todas las páginas de clientes
async function obtenerTodosLosClientes(estado: string, filter: string): Promise<any[]> {
  let todosLosClientes: any[] = [];
  let pagina = 1;
  const limitePorPagina = 200;
  let hayMas = true;

  while (hayMas) {
    const obumaUrl = new URL(`${process.env.OBUMA_API_URL}/clientes.list.json`);
    obumaUrl.searchParams.append('page', pagina.toString());
    obumaUrl.searchParams.append('limit', limitePorPagina.toString());
    
    if (filter) {
      obumaUrl.searchParams.append('cliente_razon_social', filter.trim());
    }
    
    if (estado === 'activo') {
      obumaUrl.searchParams.append('estado', '1');
    } else if (estado === 'inactivo') {
      obumaUrl.searchParams.append('estado', '0');
    }

    console.log(`📡 Consultando página ${pagina} de clientes...`);
    
    const response = await fetch(obumaUrl.toString(), {
      method: 'GET',
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error de Obuma: ${response.status}`);
    }

    const data = await response.json();
    const clientes = data.data || data.clientes || [];
    
    if (clientes.length === 0) {
      hayMas = false;
    } else {
      todosLosClientes.push(...clientes);
      console.log(`📦 Página ${pagina}: ${clientes.length} clientes (total acumulado: ${todosLosClientes.length})`);
      pagina++;
      
      // Si la página actual tiene menos del límite, es la última
      if (clientes.length < limitePorPagina) {
        hayMas = false;
      }
    }
  }

  return todosLosClientes;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const filter = searchParams.get('filter') || searchParams.get('search') || '';
  const estado = searchParams.get('estado') || 'todos';
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Verificar caché
  const cacheKey = `${estado}-${filter}`;
  if (!forceRefresh && cache && cache.filtro === cacheKey && (Date.now() - cache.timestamp) < CACHE_DURATION) {
    console.log("📦 Usando caché de clientes");
    return NextResponse.json(cache.data);
  }

  try {
    console.log("📡 Obteniendo TODOS los clientes de Obuma (paginación completa)...");
    
    // 1. Obtener TODOS los clientes (todas las páginas)
    const todosLosClientes = await obtenerTodosLosClientes(estado, filter);
    console.log(`✅ Total clientes obtenidos: ${todosLosClientes.length}`);

    if (todosLosClientes.length === 0) {
      const emptyResponse = {
        success: true,
        data: [],
        stats: {
          total_clientes: 0,
          clientes_activos: 0,
          clientes_inactivos: 0,
          total_contactos: 0,
          total_direcciones: 0
        },
        pagination: {
          current_page: 1,
          last_page: 1,
          per_page: 100,
          total: 0
        }
      };
      return NextResponse.json(emptyResponse);
    }

    // 2. Obtener contactos y direcciones en PARALELO (una sola llamada)
    console.log("📡 Obteniendo contactos y direcciones...");
    
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

    // 3. Enriquecer clientes
    const clientesEnriquecidos: ClienteEnriquecido[] = todosLosClientes.map((cliente: any) => {
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

    // 4. Estadísticas
    const stats = {
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
        current_page: 1,
        last_page: 1,
        per_page: clientesEnriquecidos.length,
        total: clientesEnriquecidos.length
      },
      timestamp: new Date().toISOString()
    };

    // Guardar en caché
    cache = {
      data: responseData,
      timestamp: Date.now(),
      filtro: cacheKey
    };

    console.log(`✅ Respuesta final: ${clientesEnriquecidos.length} clientes, ${stats.total_contactos} contactos, ${stats.total_direcciones} direcciones`);

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