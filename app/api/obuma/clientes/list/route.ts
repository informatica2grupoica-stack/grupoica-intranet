import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const page = searchParams.get('page') || '1';
  const filter = searchParams.get('filter') || searchParams.get('search') || '';
  const limit = searchParams.get('limit') || '100';
  const estado = searchParams.get('estado') || 'activo';

  const obumaUrl = new URL(`${process.env.OBUMA_API_URL}/clientes.list.json`);
  obumaUrl.searchParams.append('page', page);
  obumaUrl.searchParams.append('limit', limit);
  
  if (filter) {
    obumaUrl.searchParams.append('cliente_razon_social', filter.trim());
  }
  
  if (estado !== 'todos') {
    obumaUrl.searchParams.append('estado', estado === 'activo' ? '1' : '0');
  }

  try {
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
    const clientes = data.data || data.clientes || [];

    // Enriquecer clientes con información adicional
    const clientesEnriquecidos = await Promise.all(clientes.map(async (cliente: any) => {
      // Obtener contactos del cliente
      let contactos = [];
      try {
        const contactosRes = await fetch(`${process.env.OBUMA_API_URL}/clientesContactos.list.json/${cliente.cliente_id}`, {
          headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
        });
        const contactosData = await contactosRes.json();
        contactos = contactosData.data || contactosData.contactos || [];
      } catch (error) {
        console.warn(`Error obteniendo contactos del cliente ${cliente.cliente_id}:`, error);
      }

      // Obtener direcciones del cliente
      let direcciones = [];
      try {
        const direccionesRes = await fetch(`${process.env.OBUMA_API_URL}/clientesDirecciones.list.json/${cliente.cliente_id}`, {
          headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
        });
        const direccionesData = await direccionesRes.json();
        direcciones = direccionesData.data || direccionesData.direcciones || [];
      } catch (error) {
        console.warn(`Error obteniendo direcciones del cliente ${cliente.cliente_id}:`, error);
      }

      return {
        id: cliente.cliente_id,
        rut: cliente.cliente_rut,
        razon_social: cliente.cliente_razon_social,
        email: cliente.cliente_email,
        telefono: cliente.cliente_telefono || '',
        direccion: cliente.cliente_direccion || '',
        comuna: cliente.cliente_comuna || '',
        ciudad: cliente.cliente_ciudad || '',
        estado: cliente.estado === '1',
        es_extranjero: cliente.cliente_extranjero === '1',
        extranjero_id: cliente.cliente_extranjero_id || '',
        created_at: cliente.created_at,
        contactos: contactos,
        direcciones: direcciones,
        total_contactos: contactos.length,
        total_direcciones: direcciones.length
      };
    }));

    const stats = {
      total_clientes: clientesEnriquecidos.length,
      clientes_activos: clientesEnriquecidos.filter(c => c.estado).length,
      clientes_inactivos: clientesEnriquecidos.filter(c => !c.estado).length,
      total_contactos: clientesEnriquecidos.reduce((sum, c) => sum + c.total_contactos, 0),
      total_direcciones: clientesEnriquecidos.reduce((sum, c) => sum + c.total_direcciones, 0)
    };

    return NextResponse.json({
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
    });

  } catch (error: any) {
    console.error("Error en Listado Clientes Obuma:", error.message);
    return NextResponse.json(
      { success: false, error: 'Error al conectar con la API de Obuma', details: error.message },
      { status: 500 }
    );
  }
}