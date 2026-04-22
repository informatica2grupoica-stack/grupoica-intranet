// app/api/obuma/clientes/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    console.log("🚀 POST /api/obuma/clientes - Inicio");
    
    const body = await request.json();
    console.log("📡 Body recibido:", JSON.stringify(body, null, 2));

    // Extraer valores
    const razonSocial = body.razon_social || body.cliente_razon_social;
    const email = body.email || body.cliente_email;
    const rut = body.rut || body.cliente_rut || '';

    // Validaciones
    if (!razonSocial) {
      return NextResponse.json({ error: 'La razón social es requerida' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'El email es requerido' }, { status: 400 });
    }

    // Payload para Obuma
    const payload = {
      cliente_razon_social: razonSocial,
      cliente_email: email,
      cliente_rut: rut,
      cliente_telefono: body.telefono || body.cliente_telefono || '',
      cliente_direccion: body.direccion || body.cliente_direccion || '',
      cliente_comuna: body.comuna || body.cliente_comuna || '',
      cliente_ciudad: body.ciudad || body.cliente_ciudad || '',
      cliente_clave: Math.random().toString(36).substring(2, 10).toUpperCase(),
      estado: '1'
    };

    console.log("📤 Payload a Obuma:", JSON.stringify(payload, null, 2));
    
    const response = await fetch(`${process.env.OBUMA_API_URL}/clientes.create.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("📦 Respuesta Obuma:", JSON.stringify(result, null, 2));

    // ✅ CORREGIDO: Manejar respuesta de Obuma correctamente
    // Obuma devuelve result.result (número) no result.result
    // Si result.result === 0 es éxito, si es diferente es error
    
    let clienteId = null;
    let mensaje = '';
    
    // Extraer ID del cliente de la respuesta
    if (result.result?.result === 0 || result.result?.result === "0") {
      // Cliente creado o ya existente
      if (result.result?.result_detail) {
        const match = result.result.result_detail.match(/cliente_id:(\d+)/);
        if (match) {
          clienteId = match[1];
        }
        mensaje = result.result.result_detail;
      }
      
      return NextResponse.json({ 
        success: true, 
        cliente_id: clienteId,
        message: mensaje || 'Cliente procesado correctamente'
      });
    }
    
    // Si hay error
    return NextResponse.json(
      { error: result.result?.result_detail || 'Error al crear cliente' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error("❌ Error:", error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}