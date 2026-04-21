// app/api/obuma/clientes/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`📡 API Route - Obteniendo cliente ID: ${id}`);
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID no proporcionado' },
        { status: 400 }
      );
    }
    
    // Llamar a Obuma
    const obumaUrl = `${process.env.OBUMA_API_URL}/clientes.findById.json/${id}`;
    console.log(`📡 URL: ${obumaUrl}`);
    
    const response = await fetch(obumaUrl, {
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
      }
    });
    
    console.log(`📡 Response status: ${response.status}`);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Cliente no encontrado (${response.status})` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log("📦 Datos recibidos:", JSON.stringify(data).substring(0, 300));
    
    // Extraer cliente (la API devuelve directamente el objeto)
    const clienteRaw = data;
    
    // Verificar que tenemos datos
    if (!clienteRaw || !clienteRaw.cliente_id) {
      return NextResponse.json(
        { error: 'Cliente no encontrado en respuesta' },
        { status: 404 }
      );
    }
    
    // Formatear respuesta
    const cliente = {
      id: clienteRaw.cliente_id,
      rut: clienteRaw.cliente_rut || '',
      razon_social: clienteRaw.cliente_razon_social || '',
      email: clienteRaw.cliente_email || '',
      telefono: clienteRaw.cliente_telefono || '',
      direccion: clienteRaw.cliente_direccion || '',
      comuna: clienteRaw.cliente_comuna || '',
      ciudad: clienteRaw.cliente_ciudad || '',
      estado: clienteRaw.estado === '1',
      es_extranjero: clienteRaw.cliente_extranjero === '1',
      extranjero_id: clienteRaw.cliente_extranjero_id || '',
      contactos: [],
      direcciones: []
    };
    
    console.log(`✅ Cliente encontrado: ${cliente.razon_social}`);
    
    return NextResponse.json({
      success: true,
      cliente: cliente
    });
    
  } catch (error: any) {
    console.error("❌ Error:", error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    console.log(`📡 Actualizando cliente ${id}:`, body);
    
    const payload = {
      cliente_id: id,
      cliente_razon_social: body.razon_social,
      cliente_email: body.email,
      cliente_telefono: body.telefono || '',
      cliente_direccion: body.direccion || '',
      cliente_comuna: body.comuna || '',
      cliente_ciudad: body.ciudad || '',
      estado: body.estado ? '1' : '0'
    };
    
    const response = await fetch(`${process.env.OBUMA_API_URL}/clientes.update.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    
    if (!response.ok || result.success === false) {
      return NextResponse.json(
        { error: result.message || 'Error al actualizar' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cliente actualizado exitosamente'
    });
    
  } catch (error: any) {
    console.error("❌ Error en PUT:", error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}