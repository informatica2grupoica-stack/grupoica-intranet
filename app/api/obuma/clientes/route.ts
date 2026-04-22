// app/api/obuma/clientes/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    console.log("🚀 POST /api/obuma/clientes - Inicio");
    
    const body = await request.json();
    console.log("📡 Body recibido:", JSON.stringify(body, null, 2));

    // Extraer valores (soportar ambos formatos)
    const razonSocial = body.razon_social || body.cliente_razon_social;
    const email = body.email || body.cliente_email;
    const rut = body.rut || body.cliente_rut || '';
    const telefono = body.telefono || body.cliente_telefono || '';
    const direccion = body.direccion || body.cliente_direccion || '';
    const comuna = body.comuna || body.cliente_comuna || '';
    const ciudad = body.ciudad || body.cliente_ciudad || '';

    // Validaciones
    if (!razonSocial) {
      console.log("❌ Error: Razón social requerida");
      return NextResponse.json({ error: 'La razón social es requerida' }, { status: 400 });
    }

    if (!email) {
      console.log("❌ Error: Email requerido");
      return NextResponse.json({ error: 'El email es requerido' }, { status: 400 });
    }

    // Payload mínimo según documentación de Obuma
    const payload = {
      cliente_razon_social: razonSocial,
      cliente_email: email,
      cliente_rut: rut,
      cliente_telefono: telefono,
      cliente_direccion: direccion,
      cliente_comuna: comuna,
      cliente_ciudad: ciudad,
      cliente_clave: Math.random().toString(36).substring(2, 10).toUpperCase(),
      estado: '1'
    };

    console.log("📤 Payload a Obuma:", JSON.stringify(payload, null, 2));
    
    const obumaUrl = `${process.env.OBUMA_API_URL}/clientes.create.json`;
    console.log(`📡 URL Obuma: ${obumaUrl}`);
    
    const response = await fetch(obumaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(payload),
    });

    console.log(`📡 Respuesta HTTP status: ${response.status}`);
    
    const result = await response.json();
    console.log("📦 Respuesta Obuma COMPLETA:", JSON.stringify(result, null, 2));

    // Verificar error de Obuma
    if (result.result?.result === "0") {
      console.log(`❌ Obuma error code: ${result.result?.result}`);
      console.log(`❌ Obuma error detail: ${result.result?.result_detail}`);
      return NextResponse.json(
        { error: result.result?.result_detail || 'Error al crear cliente en Obuma' },
        { status: 400 }
      );
    }

    if (result.success === false || result.status === false) {
      console.log(`❌ Obuma success false: ${result.message}`);
      return NextResponse.json(
        { error: result.message || 'Error al crear cliente' },
        { status: 400 }
      );
    }

    console.log("✅ Cliente creado exitosamente");
    
    return NextResponse.json({ 
      success: true, 
      data: result.data || result,
      message: 'Cliente creado exitosamente'
    });

  } catch (error: any) {
    console.error("❌ Error capturado:", error.message);
    console.error("Stack:", error.stack);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}