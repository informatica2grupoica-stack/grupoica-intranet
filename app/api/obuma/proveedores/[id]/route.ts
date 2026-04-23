// app/api/obuma/proveedores/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const OBUMA_API_URL = process.env.OBUMA_API_URL || 'https://api.obuma.cl/v1.0';
const OBUMA_API_TOKEN = process.env.OBUMA_API_TOKEN;

// GET: Obtener proveedor por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!OBUMA_API_TOKEN) {
      return NextResponse.json(
        { error: 'API token no configurado' },
        { status: 500 }
      );
    }

    const response = await fetch(`${OBUMA_API_URL}/proveedores.findById.json/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OBUMA_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error al obtener proveedor: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error en GET /api/obuma/proveedores/[id]:', error);
    return NextResponse.json(
      { error: 'Error al obtener el proveedor' },
      { status: 500 }
    );
  }
}

// POST: Actualizar proveedor
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!OBUMA_API_TOKEN) {
      return NextResponse.json(
        { error: 'API token no configurado' },
        { status: 500 }
      );
    }

    const response = await fetch(`${OBUMA_API_URL}/proveedores.update.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OBUMA_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        proveedor_id: id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Error al actualizar proveedor' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error en POST /api/obuma/proveedores/[id]:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el proveedor' },
      { status: 500 }
    );
  }
}

// DELETE: Opcional - si la API lo soporta
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Nota: La documentación no especifica un endpoint de eliminación
    return NextResponse.json(
      { error: 'La eliminación de proveedores no está implementada en la API de Obuma' },
      { status: 501 }
    );
  } catch (error) {
    console.error('Error en DELETE /api/obuma/proveedores/[id]:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el proveedor' },
      { status: 500 }
    );
  }
}