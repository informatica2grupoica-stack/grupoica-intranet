// app/api/obuma/proveedores/route.ts
import { NextRequest, NextResponse } from 'next/server';

const OBUMA_API_URL = process.env.OBUMA_API_URL;
const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '20';
  const search = searchParams.get('search') || '';

  if (!OBUMA_API_TOKEN) {
    console.error('❌ OBUMA_API_TOKEN no configurado');
    return NextResponse.json(
      { error: 'API token no configurado en el servidor' },
      { status: 500 }
    );
  }

  try {
    const url = new URL(`${OBUMA_API_URL}/proveedores.list.json`);
    url.searchParams.append('page', page);
    url.searchParams.append('limit', limit);
    if (search) {
      url.searchParams.append('search', search);
    }
    
    console.log('📡 Llamando a:', url.toString());
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'access-token': OBUMA_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    console.log('📦 Response status:', response.status);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('❌ Respuesta no es JSON:', text.substring(0, 200));
      return NextResponse.json(
        { error: `API respondió con: ${text.substring(0, 200)}` },
        { status: response.status }
      );
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || `Error ${response.status}`);
    }

    // Extraer proveedores y paginación
    const proveedores = data.data || data.proveedores || [];
    const pagination = data.pagination || {
      current_page: parseInt(page),
      last_page: 1,
      per_page: parseInt(limit),
      total: proveedores.length
    };

    // Calcular estadísticas
    const stats = {
      total: pagination.total || proveedores.length,
      conContacto: proveedores.filter((p: any) => p.proveedor_contacto).length,
      conEmail: proveedores.filter((p: any) => p.proveedor_email).length,
      conTelefono: proveedores.filter((p: any) => p.proveedor_telefono || p.proveedor_celular).length,
    };

    console.log('✅ Proveedores obtenidos correctamente');
    return NextResponse.json({
      success: true,
      data: proveedores,
      pagination,
      stats,
    });
  } catch (error: any) {
    console.error('❌ Error en GET /api/obuma/proveedores:', error.message);
    return NextResponse.json(
      { error: 'Error al obtener proveedores', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const OBUMA_API_URL = process.env.OBUMA_API_URL;
  const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

  if (!OBUMA_API_TOKEN) {
    return NextResponse.json(
      { error: 'API token no configurado' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    if (!body.proveedor_rut) {
      return NextResponse.json(
        { error: 'El RUT del proveedor es obligatorio' },
        { status: 400 }
      );
    }

    if (!body.proveedor_razon_social) {
      return NextResponse.json(
        { error: 'La razón social es obligatoria' },
        { status: 400 }
      );
    }

    const response = await fetch(`${OBUMA_API_URL}/proveedores.create.json`, {
      method: 'POST',
      headers: {
        'access-token': OBUMA_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Error al crear proveedor' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error en POST /api/obuma/proveedores:', error);
    return NextResponse.json(
      { error: 'Error al crear el proveedor' },
      { status: 500 }
    );
  }
}