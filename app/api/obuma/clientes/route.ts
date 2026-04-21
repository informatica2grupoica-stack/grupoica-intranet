import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validaciones
    if (!body.rut && !body.es_extranjero) {
      return NextResponse.json({ error: 'El RUT es requerido' }, { status: 400 });
    }
    
    if (!body.razon_social) {
      return NextResponse.json({ error: 'La razón social es requerida' }, { status: 400 });
    }

    if (!body.email) {
      return NextResponse.json({ error: 'El email es requerido' }, { status: 400 });
    }

    const payload: any = {
      cliente_rut: body.rut || '',
      cliente_razon_social: body.razon_social,
      cliente_email: body.email,
      cliente_telefono: body.telefono || '',
      cliente_direccion: body.direccion || '',
      cliente_comuna: body.comuna || '',
      cliente_ciudad: body.ciudad || '',
      estado: '1'
    };

    if (body.es_extranjero) {
      payload.cliente_extranjero = '1';
      payload.cliente_extranjero_id = body.extranjero_id || '';
    }

    const response = await fetch(`${process.env.OBUMA_API_URL}/clientes.create.json`, {
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
        { error: result.message || 'Error al crear cliente' },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: result.data || result,
      message: 'Cliente creado exitosamente'
    });

  } catch (error: any) {
    console.error("Error creando cliente:", error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}