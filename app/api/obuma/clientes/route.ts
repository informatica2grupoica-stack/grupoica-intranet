// app/api/obuma/clientes/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    console.log("🚀 POST /api/obuma/clientes - Inicio");
    
    const body = await request.json();
    console.log("📡 Body recibido:", JSON.stringify(body, null, 2));

    // Validaciones
    if (!body.rut && !body.es_extranjero) {
      console.log("❌ Error: RUT requerido");
      return NextResponse.json({ error: 'El RUT es requerido' }, { status: 400 });
    }
    
    if (!body.razon_social) {
      console.log("❌ Error: Razón social requerida");
      return NextResponse.json({ error: 'La razón social es requerida' }, { status: 400 });
    }

    if (!body.email) {
      console.log("❌ Error: Email requerido");
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

    // Generar clave automática si no viene
    if (!body.clave) {
      payload.cliente_clave = Math.random().toString(36).substring(2, 10).toUpperCase();
    }

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
    console.log("📦 Respuesta Obuma completa:", JSON.stringify(result, null, 2));

    // Verificar error de Obuma
    if (result.result?.result === "0") {
      console.log(`❌ Obuma error: ${result.result?.result_detail}`);
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