// app/api/obuma/proveedores/route.ts
import { NextRequest, NextResponse } from 'next/server';

const OBUMA_API_URL = process.env.OBUMA_API_URL || 'https://api.obuma.cl/v1.0';
const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

// GET: Listar todos los proveedores
export async function GET() {
  try {
    if (!OBUMA_API_TOKEN) {
      return NextResponse.json(
        { error: 'API token no configurado' },
        { status: 500 }
      );
    }

    const response = await fetch(`${OBUMA_API_URL}/proveedores.list.json`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OBUMA_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error al obtener proveedores: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error en GET /api/obuma/proveedores:', error);
    return NextResponse.json(
      { error: 'Error al obtener la lista de proveedores' },
      { status: 500 }
    );
  }
}

// POST: Crear un nuevo proveedor
export async function POST(request: NextRequest) {
  try {
    if (!OBUMA_API_TOKEN) {
      return NextResponse.json(
        { error: 'API token no configurado' },
        { status: 500 }
      );
    }

    const body = await request.json();

    // Validar campos requeridos
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