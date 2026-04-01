import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefijoSub = searchParams.get('prefijoSub'); // Ejemplo: 6026423
  const inicioManual = searchParams.get('inicio'); // Para forzar desde el 204

  if (!prefijoSub) return NextResponse.json({ error: 'Falta prefijo' }, { status: 400 });

  const headers = {
    'App-Id': process.env.OBUMA_APP_ID || '',
    'App-Token': process.env.OBUMA_APP_TOKEN || ''
  };

  try {
    // 1. Obtener la lista para tener una base inicial
    const res = await fetch(`https://api.obuma.cl/v1/productos.list.json`, { 
      headers, 
      cache: 'no-store' 
    });
    const result = await res.json();
    const productos = result.data || [];

    // 2. Determinar el punto de partida
    let proximoCorrelativo = 1;

    if (inicioManual) {
      proximoCorrelativo = parseInt(inicioManual);
    } else {
      // Buscamos el máximo actual en la lista obtenida
      const numerosUsados = productos
        .filter((p: any) => String(p.producto_codigo_comercial).startsWith(prefijoSub))
        .map((p: any) => {
          const skuStr = String(p.producto_codigo_comercial);
          const sufijo = skuStr.replace(prefijoSub, "");
          return parseInt(sufijo) || 0;
        });
      
      const maxEncontrado = numerosUsados.length > 0 ? Math.max(...numerosUsados) : 0;
      proximoCorrelativo = maxEncontrado + 1;
    }

    // --- NIVEL DE SEGURIDAD 2: EL "PUNCH-TEST" ---
    // Vamos a verificar disponibilidad real uno por uno (máximo 10 intentos para no colgar la API)
    let skuDefinitivo = "";
    let disponible = false;
    let intentos = 0;

    while (!disponible && intentos < 10) {
      const candidato = `${prefijoSub}${String(proximoCorrelativo).padStart(3, '0')}`;
      
      // Consultamos a Obuma por ESTE código específico
      const checkRes = await fetch(`https://api.obuma.cl/v1/productos.get.json?codigo=${candidato}`, {
        headers,
        cache: 'no-store'
      });
      
      const checkData = await checkRes.json();

      // Si Obuma dice "status: false" o no encuentra el producto, el SKU está LIBRE
      if (checkData.status === false || !checkData.data) {
        skuDefinitivo = candidato;
        disponible = true;
      } else {
        // Si el producto existe, saltamos al siguiente
        proximoCorrelativo++;
        intentos++;
      }
    }

    return NextResponse.json({ 
      sku: skuDefinitivo, 
      correlativo: proximoCorrelativo,
      check: "verificado_en_obuma" 
    });

  } catch (error) {
    console.error("Error en Generador SKU:", error);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}