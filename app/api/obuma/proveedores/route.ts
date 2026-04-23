// app/api/obuma/proveedores/route.ts
import { NextRequest, NextResponse } from 'next/server';

const OBUMA_API_URL = process.env.OBUMA_API_URL || 'https://api.obuma.cl/v1.0';
const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

export async function GET() {
  console.log('🔍 Iniciando petición a API de Obuma');
  console.log('📡 URL:', `${OBUMA_API_URL}/proveedores.list.json`);
  console.log('🔑 Token configurado:', !!OBUMA_API_TOKEN);
  
  // Validar token
  if (!OBUMA_API_TOKEN) {
    console.error('❌ Error: OBUMA_API_TOKEN no configurado');
    return NextResponse.json(
      { error: 'API token no configurado en el servidor' },
      { status: 500 }
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout

    const response = await fetch(`${OBUMA_API_URL}/proveedores.list.json`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OBUMA_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('📦 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      throw new Error(`API respondió con status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Datos recibidos correctamente');
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('❌ Error en GET /api/obuma/proveedores:', error.message);
    
    // Mensaje de error más descriptivo
    let errorMessage = 'Error al obtener la lista de proveedores';
    if (error.name === 'AbortError') {
      errorMessage = 'La API de Obuma no respondió a tiempo';
    } else if (error.message.includes('fetch')) {
      errorMessage = 'No se pudo conectar con la API de Obuma';
    }
    
    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!OBUMA_API_TOKEN) {
      return NextResponse.json(
        { error: 'API token no configurado en el servidor' },
        { status: 500 }
      );
    }

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
        'Authorization': `Bearer ${OBUMA_API_TOKEN}`,
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
  } catch (error) {
    console.error('Error en POST /api/obuma/proveedores:', error);
    return NextResponse.json(
      { error: 'Error al crear el proveedor' },
      { status: 500 }
    );
  }
}