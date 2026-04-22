// app/api/obuma/clientes/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server';

// Interfaz para el cliente de Obuma
interface ObumaCliente {
  cliente_id: string;
  cliente_rut?: string;
  cliente_razon_social?: string;
  cliente_email?: string;
  cliente_telefono?: string;
  cliente_direccion?: string;
  cliente_comuna?: string;
  cliente_ciudad?: string;
  estado?: string;
  cliente_extranjero?: string;
  cliente_extranjero_id?: string;
  created_at?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`📡 Buscando cliente ID: ${id}`);
    
    // Buscar en el listado (que sí funciona)
    const listUrl = `${process.env.OBUMA_API_URL}/clientes.list.json?limit=2000`;
    console.log(`📡 Buscando en listado: ${listUrl}`);
    
    const listResponse = await fetch(listUrl, {
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
      }
    });
    
    const listData = await listResponse.json();
    let clientes: ObumaCliente[] = [];
    
    if (listData.data && Array.isArray(listData.data)) {
      clientes = listData.data;
    } else if (listData.clientes && Array.isArray(listData.clientes)) {
      clientes = listData.clientes;
    }
    
    // Buscar el cliente por ID (con tipado correcto)
    const clienteData = clientes.find((c: ObumaCliente) => String(c.cliente_id) === String(id));
    
    if (!clienteData) {
      return NextResponse.json(
        { error: `Cliente ${id} no encontrado` },
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