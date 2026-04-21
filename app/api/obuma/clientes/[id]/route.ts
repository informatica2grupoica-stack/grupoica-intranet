// app/api/obuma/clientes/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`📡 API GET /api/obuma/clientes/${id}`);
    
    // Construir URL de Obuma
    const obumaUrl = `${process.env.OBUMA_API_URL}/clientes.findById.json/${id}`;
    console.log(`📡 Llamando a Obuma: ${obumaUrl}`);
    
    const response = await fetch(obumaUrl, {
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
      }
    });
    
    console.log(`📡 Respuesta Obuma status: ${response.status}`);
    
    const data = await response.json();
    
    // 🔍 LOG COMPLETO - Ver qué devuelve Obuma exactamente
    console.log("📦 RESPUESTA COMPLETA DE OBUMA:");
    console.log(JSON.stringify(data, null, 2));
    
    // Verificar si la respuesta tiene éxito
    if (data.success === false || data.status === false) {
      console.log("❌ Obuma devolvió error:", data.message);
      return NextResponse.json(
        { error: data.message || 'Cliente no encontrado en Obuma' },
        { status: 404 }
      );
    }
    
    // La API de Obuma puede devolver los datos en diferentes formatos
    let clienteData = null;
    
    if (data.data) {
      clienteData = data.data;
    } else if (data.cliente) {
      clienteData = data.cliente;
    } else if (data.cliente_id) {
      clienteData = data;
    } else if (Array.isArray(data) && data.length > 0) {
      clienteData = data[0];
    }
    
    if (!clienteData || !clienteData.cliente_id) {
      console.log("❌ No se pudo extraer cliente de la respuesta");
      return NextResponse.json(
        { error: 'Cliente no encontrado en respuesta', raw: data },
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