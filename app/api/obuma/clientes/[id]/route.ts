// app/api/obuma/clientes/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`📡 Obteniendo cliente ID: ${id}`);
    
    // Construir URL de Obuma
    const obumaUrl = `${process.env.OBUMA_API_URL}/clientes.findById.json/${id}`;
    console.log(`📡 URL: ${obumaUrl}`);
    
    const response = await fetch(obumaUrl, {
      method: 'GET',
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ Error HTTP: ${response.status}`);
      return NextResponse.json(
        { error: `Cliente no encontrado (${response.status})` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log("📦 Datos recibidos:", JSON.stringify(data).substring(0, 500));
    
    // La API devuelve los datos directamente en el objeto raíz
    const cliente = data;
    
    if (!cliente || !cliente.cliente_id) {
      console.error("❌ Cliente no encontrado en la respuesta");
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }
    
    // Formatear respuesta
    const clienteFormateado = {
      id: cliente.cliente_id,
      rut: cliente.cliente_rut || '',
      razon_social: cliente.cliente_razon_social || '',
      email: cliente.cliente_email || '',
      telefono: cliente.cliente_telefono || '',
      direccion: cliente.cliente_direccion || '',
      comuna: cliente.cliente_comuna || '',
      ciudad: cliente.cliente_ciudad || '',
      estado: cliente.estado === '1' || cliente.estado === 1,
      es_extranjero: cliente.cliente_extranjero === '1',
      extranjero_id: cliente.cliente_extranjero_id || '',
      created_at: cliente.created_at,
      contactos: [],
      direcciones: []
    };
    
    // Obtener contactos (opcional, si no funciona, ignorar)
    try {
      const contactosRes = await fetch(`${process.env.OBUMA_API_URL}/clientesContactos.list.json/${id}`, {
        headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
      });
      if (contactosRes.ok) {
        const contactosData = await contactosRes.json();
        clienteFormateado.contactos = contactosData.data || contactosData.contactos || [];
      }
    } catch (error) {
      console.warn("Error obteniendo contactos:", error);
    }
    
    // Obtener direcciones (opcional)
    try {
      const direccionesRes = await fetch(`${process.env.OBUMA_API_URL}/clientesDirecciones.list.json/${id}`, {
        headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
      });
      if (direccionesRes.ok) {
        const direccionesData = await direccionesRes.json();
        clienteFormateado.direcciones = direccionesData.data || direccionesData.direcciones || [];
      }
    } catch (error) {
      console.warn("Error obteniendo direcciones:", error);
    }
    
    console.log(`✅ Cliente encontrado: ${clienteFormateado.razon_social}`);
    
    return NextResponse.json({
      success: true,
      cliente: clienteFormateado
    });
    
  } catch (error: any) {
    console.error("❌ Error en GET cliente:", error);
    return NextResponse.json(
      { error: 'Error al obtener cliente', details: error.message },
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
    
    const payload: any = {
      cliente_id: id,
      cliente_rut: body.rut || '',
      cliente_razon_social: body.razon_social,
      cliente_email: body.email,
      cliente_telefono: body.telefono || '',
      cliente_direccion: body.direccion || '',
      cliente_comuna: body.comuna || '',
      cliente_ciudad: body.ciudad || '',
      estado: body.estado ? '1' : '0'
    };
    
    if (body.es_extranjero) {
      payload.cliente_extranjero = '1';
      payload.cliente_extranjero_id = body.extranjero_id || '';
    }
    
    const response = await fetch(`${process.env.OBUMA_API_URL}/clientes.update.json`, {
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
        { error: result.message || 'Error al actualizar cliente' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cliente actualizado exitosamente'
    });
    
  } catch (error: any) {
    console.error("❌ Error en PUT cliente:", error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}