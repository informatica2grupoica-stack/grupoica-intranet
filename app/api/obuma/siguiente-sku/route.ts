import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefijoSub = searchParams.get('prefijoSub'); 
  const inicioManual = searchParams.get('inicio'); 

  if (!prefijoSub) return NextResponse.json({ error: 'Falta prefijo' }, { status: 400 });

  const headers = {
    'App-Id': process.env.OBUMA_APP_ID || '',
    'App-Token': process.env.OBUMA_APP_TOKEN || ''
  };

  try {
    // 1. Obtener lista para base inicial
    const res = await fetch(`https://api.obuma.cl/v1/productos.list.json`, { 
      headers, 
      cache: 'no-store' 
    });

    if (!res.ok) throw new Error('Fallo al conectar con lista de Obuma');

    const result = await res.json();
    const productos = result.data || [];

    // 2. Determinar correlativo inicial
    let proximoCorrelativo = 1;

    if (inicioManual) {
      proximoCorrelativo = parseInt(inicioManual);
    } else {
      const numerosUsados = productos
        .filter((p: any) => String(p.producto_codigo_comercial).startsWith(prefijoSub))
        .map((p: any) => {
          const skuStr = String(p.producto_codigo_comercial);
          const sufijo = skuStr.replace(prefijoSub, "");
          const num = parseInt(sufijo);
          return isNaN(num) ? 0 : num;
        });
      
      const maxEncontrado = numerosUsados.length > 0 ? Math.max(...numerosUsados) : 0;
      // Si no hay productos, empezamos en 203 por estándar de Grupo ICA, si no, max + 1
      proximoCorrelativo = maxEncontrado > 0 ? maxEncontrado + 1 : 203;
    }

    // 3. Verificación de Disponibilidad Real (Punch-Test)
    let skuDefinitivo = "";
    let disponible = false;
    let intentos = 0;

    while (!disponible && intentos < 10) {
      const candidato = `${prefijoSub}${String(proximoCorrelativo).padStart(3, '0')}`;
      
      const checkRes = await fetch(`https://api.obuma.cl/v1/productos.get.json?codigo=${candidato}`, {
        headers,
        cache: 'no-store'
      });
      
      const checkData = await checkRes.json();

      // Si status es false, el código está disponible
      if (checkData.status === false) {
        skuDefinitivo = candidato;
        disponible = true;
      } else {
        proximoCorrelativo++;
        intentos++;
      }
    }

    return NextResponse.json({ 
      sku: skuDefinitivo, 
      correlativo: proximoCorrelativo,
      check: "verificado_en_obuma" 
    });

  } catch (error: any) {
    console.error("Error en Generador SKU:", error.message);
    return NextResponse.json({ error: "Error interno del servidor Obuma" }, { status: 500 });
  }
}