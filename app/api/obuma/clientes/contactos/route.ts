import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clienteId = searchParams.get('cliente_id');

  if (!clienteId) {
    return NextResponse.json({ error: 'cliente_id es requerido' }, { status: 400 });
  }

  try {
    const response = await fetch(`${process.env.OBUMA_API_URL}/clientesContactos.list.json/${clienteId}`, {
      headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
    });

    const data = await response.json();
    const contactos = data.data || data.contactos || [];

    return NextResponse.json({ success: true, contactos });

  } catch (error: any) {
    console.error("Error obteniendo contactos:", error);
    return NextResponse.json(
      { error: 'Error al obtener contactos', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const payload = {
      cliente_id: body.cliente_id,
      nombre: body.nombre,
      email: body.email,
      telefono: body.telefono || '',
      cargo: body.cargo || ''
    };

    const response = await fetch(`${process.env.OBUMA_API_URL}/clientesContactos.create.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.success === false || result.status === false) {
      return NextResponse.json(
        { error: result.message || 'Error al crear contacto' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: result });

  } catch (error: any) {
    console.error("Error creando contacto:", error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}