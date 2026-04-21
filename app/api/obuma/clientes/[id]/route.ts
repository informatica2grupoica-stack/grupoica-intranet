// app/api/obuma/clientes/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`📡 API GET /api/obuma/clientes/${id}`);
    
    const obumaUrl = `${process.env.OBUMA_API_URL}/clientes.findById.json/${id}`;
    console.log(`📡 Llamando a Obuma: ${obumaUrl}`);
    
    const response = await fetch(obumaUrl, {
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
      }
    });
    
    const data = await response.json();
    console.log("📦 Respuesta completa:", JSON.stringify(data, null, 2));
    
    // Verificar si la respuesta indica error
    if (data.result?.result === "0") {
      console.log("❌ Obuma devolvió error:", data.result?.result_detail);
      return NextResponse.json(
        { error: data.result?.result_detail || 'Cliente no encontrado' },
        { status: 404 }
      );
    }
    
    // Extraer cliente de data.data (es un array)
    let clienteData = null;
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      clienteData = data.data[0];
    } else if (data.cliente) {
      clienteData = data.cliente;
    } else if (data.cliente_id) {
      clienteData = data;
    }
    
    if (!clienteData || !clienteData.cliente_id) {
      console.log("❌ No se pudo extraer cliente de la respuesta");
      return NextResponse.json(
        { error: 'Cliente no encontrado', raw: data },
        { status: 404 }
      );
    }
    
    // Formatear respuesta
    const cliente = {
      id: clienteData.cliente_id,
      rut: clienteData.cliente_rut || '',
      razon_social: clienteData.cliente_razon_social || '',
      email: clienteData.cliente_email || '',
      telefono: clienteData.cliente_telefono || '',
      direccion: clienteData.cliente_direccion || '',
      comuna: clienteData.cliente_comuna || '',
      ciudad: clienteData.cliente_ciudad || '',
      estado: clienteData.estado === '1',
      es_extranjero: clienteData.cliente_extranjero === '1',
      extranjero_id: clienteData.cliente_extranjero_id || '',
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
    
    console.log(`📡 API PUT /api/obuma/clientes/${id}`, body);
    
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
        { error: result.message || 'Error al actualizar cliente' },
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