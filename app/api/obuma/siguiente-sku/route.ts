import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const prefijoSub = searchParams.get('prefijoSub'); // Ejemplo: 6026423

  if (!prefijoSub) return NextResponse.json({ error: 'Falta prefijo' }, { status: 400 });

  const headers = {
    'access-token': process.env.OBUMA_API_TOKEN || '',
    'Content-Type': 'application/json'
  };

  try {
    // 1. Obtener la lista completa para ver qué números ya existen
    const res = await fetch(`${process.env.OBUMA_API_URL}/productos.list.json`, { 
      headers, 
      cache: 'no-store' 
    });
    
    if (!res.ok) throw new Error("No se pudo obtener la lista de Obuma");
    
    const result = await res.json();
    const productos = result.data || result.productos || [];

    // 2. Extraer los números correlativos que ya existen para ese prefijo
    const numerosUsados = productos
      .filter((p: any) => String(p.producto_codigo_comercial).startsWith(prefijoSub))
      .map((p: any) => {
        const skuStr = String(p.producto_codigo_comercial);
        const sufijo = skuStr.replace(prefijoSub, ""); // Quitamos el prefijo
        return parseInt(sufijo) || 0;
      });
    
    // 3. Determinar el punto de partida (203 según tu requerimiento)
    const maxEncontrado = numerosUsados.length > 0 ? Math.max(...numerosUsados) : 0;
    
    // Si el máximo es menor a 203, empezamos en 203. Si ya hay más de 203, seguimos.
    let proximoCorrelativo = maxEncontrado < 203 ? 203 : maxEncontrado + 1;

    // 4. Verificación de Seguridad "Uno a Uno" (Punch-Test)
    // Esto asegura que el SKU realmente no exista en la base de datos profunda de Obuma
    let skuDefinitivo = "";
    let disponible = false;
    let intentos = 0;

    while (!disponible && intentos < 15) {
      const candidato = `${prefijoSub}${String(proximoCorrelativo).padStart(3, '0')}`;
      
      const checkRes = await fetch(`${process.env.OBUMA_API_URL}/productos.get.json?codigo=${candidato}`, {
        headers,
        cache: 'no-store'
      });
      
      const checkData = await checkRes.json();

      // Si Obuma devuelve status false o no hay data, el SKU está LIBRE
      if (checkData.status === false || !checkData.data) {
        skuDefinitivo = candidato;
        disponible = true;
      } else {
        proximoCorrelativo++;
        intentos++;
      }
    }

    return NextResponse.json({ 
      sku: skuDefinitivo, 
      correlativo: proximoCorrelativo 
    });

  } catch (error: any) {
    console.error("Error en Generador SKU:", error.message);
    return NextResponse.json({ error: "Error interno del servidor", details: error.message }, { status: 500 });
  }
}