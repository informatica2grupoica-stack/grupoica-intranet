// app/api/obuma/clientes/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`📡 Buscando cliente ID: ${id}`);
    
    // Llamar a Obuma
    const obumaUrl = `${process.env.OBUMA_API_URL}/clientes.findById.json/${id}`;
    console.log(`📡 URL: ${obumaUrl}`);
    
    const response = await fetch(obumaUrl, {
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
      }
    });
    
    const data = await response.json();
    console.log("📦 Respuesta completa:", JSON.stringify(data, null, 2));
    
    // Verificar si hay error
    if (data.result?.result === "0") {
      return NextResponse.json(
        { 
          error: data.result?.result_detail || 'Cliente no encontrado',
          code: data.result?.result,
          detail: data.result?.result_detail
        },
        { status: 404 }
      );
    }
    
    // Extraer cliente (la respuesta puede venir en diferentes formatos)
    let clienteData = null;
    
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      clienteData = data.data[0];
    } else if (data.cliente_id) {
      clienteData = data;
    } else if (data.cliente) {
      clienteData = data.cliente;
    }
    
    if (!clienteData || !clienteData.cliente_id) {
      return NextResponse.json(
        { error: 'Cliente no encontrado en respuesta', raw: data },
        { status: 404 }
      );
    }
    
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