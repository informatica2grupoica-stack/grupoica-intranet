import { NextResponse } from 'next/server';

// DEBE SER "export async function GET" para que no dé error 405
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefijoSub = searchParams.get('prefijoSub'); // Ej: 6026424

  if (!prefijoSub) {
    return NextResponse.json({ error: 'Falta el prefijoSub' }, { status: 400 });
  }

  const headers = {
    'access-token': process.env.OBUMA_API_TOKEN || '',
    'Content-Type': 'application/json'
  };

  try {
    // 1. Consultar lista de productos
    const res = await fetch(`${process.env.OBUMA_API_URL}/productos.list.json`, { 
      headers, 
      cache: 'no-store' 
    });
    
    if (!res.ok) throw new Error("Error conectando con Obuma");
    
    const result = await res.json();
    const productos = result.data || [];

    // 2. Buscar el correlativo más alto para ese prefijo
    const numerosUsados = productos
      .filter((p: any) => String(p.producto_codigo_comercial).startsWith(prefijoSub))
      .map((p: any) => {
        const skuStr = String(p.producto_codigo_comercial);
        const sufijo = skuStr.replace(prefijoSub, "");
        return parseInt(sufijo) || 0;
      });
    
    const maxEncontrado = numerosUsados.length > 0 ? Math.max(...numerosUsados) : 0;
    
    // Lógica: Iniciar en 203 o seguir el conteo
    let proximoCorrelativo = maxEncontrado < 203 ? 203 : maxEncontrado + 1;
    const skuDefinitivo = `${prefijoSub}${String(proximoCorrelativo).padStart(3, '0')}`;

    console.log(`✅ SKU Generado: ${skuDefinitivo}`);

    return NextResponse.json({ 
      sku: skuDefinitivo, 
      correlativo: proximoCorrelativo 
    });

  } catch (error: any) {
    console.error("❌ Error en Generador SKU:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}