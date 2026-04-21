// app/api/obuma/clientes/[id]/route.ts
import { NextResponse, NextRequest } from 'next/server';

// Interfaz para contacto
interface Contacto {
  cc_id: string;
  cc_nombres: string;
  cc_apellidos: string;
  cc_email: string;
  cc_telefono_movil: string;
  cc_cargo: string;
  cc_estado: string;
}

// Interfaz para dirección
interface Direccion {
  cd_id: string;
  cd_direccion: string;
  cd_comuna: string;
  cd_ciudad: string;
  cd_tipo: string;
}

// Obtener cliente por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`📡 Obteniendo cliente ID: ${id}`);
    
    // 1. Obtener datos del cliente
    const clienteUrl = `${process.env.OBUMA_API_URL}/clientes.findById.json/${id}`;
    console.log(`📡 URL: ${clienteUrl}`);
    
    const clienteRes = await fetch(clienteUrl, {
      headers: { 
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      }
    });
    
    if (!clienteRes.ok) {
      console.error(`❌ Error HTTP: ${clienteRes.status}`);
      return NextResponse.json(
        { error: `Error HTTP: ${clienteRes.status}` },
        { status: clienteRes.status }
      );
    }
    
    const clienteData = await clienteRes.json();
    console.log("📦 Cliente recibido:", JSON.stringify(clienteData).substring(0, 500));
    
    // La respuesta puede venir en diferentes formatos
    let cliente = null;
    if (clienteData.data) {
      cliente = clienteData.data;
    } else if (clienteData.cliente) {
      cliente = clienteData.cliente;
    } else if (clienteData.id || clienteData.cliente_id) {
      cliente = clienteData;
    } else {
      // Si es un array, tomar el primero
      const dataArray = clienteData.data || clienteData.clientes || [];
      if (Array.isArray(dataArray) && dataArray.length > 0) {
        cliente = dataArray[0];
      }
    }
    
    if (!cliente) {
      console.error("❌ Cliente no encontrado en la respuesta");
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }
    
    // 2. Obtener contactos del cliente
    let contactos: Contacto[] = [];
    try {
      const contactosRes = await fetch(`${process.env.OBUMA_API_URL}/clientesContactos.list.json/${id}`, {
        headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
      });
      if (contactosRes.ok) {
        const contactosData = await contactosRes.json();
        contactos = contactosData.data || contactosData.contactos || [];
        console.log(`📦 ${contactos.length} contactos encontrados`);
      }
    } catch (error) {
      console.warn("Error obteniendo contactos:", error);
    }
    
    // 3. Obtener direcciones del cliente
    let direcciones: Direccion[] = [];
    try {
      const direccionesRes = await fetch(`${process.env.OBUMA_API_URL}/clientesDirecciones.list.json/${id}`, {
        headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
      });
      if (direccionesRes.ok) {
        const direccionesData = await direccionesRes.json();
        direcciones = direccionesData.data || direccionesData.direcciones || [];
        console.log(`📦 ${direcciones.length} direcciones encontradas`);
      }
    } catch (error) {
      console.warn("Error obteniendo direcciones:", error);
    }
    
    // 4. Construir respuesta
    const clienteFormateado = {
      id: cliente.cliente_id || cliente.id,
      rut: cliente.cliente_rut || '',
      razon_social: cliente.cliente_razon_social || '',
      email: cliente.cliente_email || '',
      telefono: cliente.cliente_telefono || '',
      direccion: cliente.cliente_direccion || '',
      comuna: cliente.cliente_comuna || '',
      ciudad: cliente.cliente_ciudad || '',
      estado: cliente.estado === '1' || cliente.estado === 1 || cliente.estado === true,
      es_extranjero: cliente.cliente_extranjero === '1',
      extranjero_id: cliente.cliente_extranjero_id || '',
      created_at: cliente.created_at,
      updated_at: cliente.updated_at,
      contactos: contactos.map(c => ({
        cc_id: c.cc_id,
        cc_nombres: c.cc_nombres || '',
        cc_apellidos: c.cc_apellidos || '',
        cc_email: c.cc_email || '',
        cc_telefono_movil: c.cc_telefono_movil || '',
        cc_cargo: c.cc_cargo || ''
      })),
      direcciones: direcciones.map(d => ({
        cd_id: d.cd_id,
        cd_direccion: d.cd_direccion || '',
        cd_comuna: d.cd_comuna || '',
        cd_ciudad: d.cd_ciudad || '',
        cd_tipo: d.cd_tipo || 'facturacion'
      }))
    };
    
    console.log(`✅ Cliente formateado: ${clienteFormateado.razon_social}`);
    
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

// Actualizar cliente
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    console.log(`📡 Actualizando cliente ${id}:`, body);
    
    // Construir payload para Obuma
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
    
    console.log("📤 Payload para Obuma:", payload);
    
    const response = await fetch(`${process.env.OBUMA_API_URL}/clientes.update.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    console.log("📦 Respuesta Obuma:", result);
    
    if (result.success === false || result.status === false) {
      return NextResponse.json(
        { error: result.message || 'Error al actualizar cliente' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cliente actualizado exitosamente',
      data: result 
    });
    
  } catch (error: any) {
    console.error("❌ Error en PUT cliente:", error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}