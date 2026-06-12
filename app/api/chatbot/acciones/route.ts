import { NextResponse } from 'next/server';
import { requireRol } from '@/lib/authServer';

export async function POST(req: Request) {
  try {
    // Muta precios y stock del ERP — solo administradores.
    // (El proxy ya lo exige; esto es defensa en profundidad por si la ruta
    // queda expuesta por un cambio en el matcher.)
    const auth = await requireRol([]);
    if (auth.error) return auth.error;

    const { accion, producto_id, sku, nuevo_precio, nuevo_stock } = await req.json();

    // Validación básica del payload antes de tocar el ERP
    if (!producto_id || typeof producto_id !== 'string' && typeof producto_id !== 'number') {
      return NextResponse.json({ error: 'producto_id inválido' }, { status: 422 });
    }
    if (accion === 'cambiar_precio' && (typeof nuevo_precio !== 'number' || !Number.isFinite(nuevo_precio) || nuevo_precio <= 0 || nuevo_precio > 100_000_000)) {
      return NextResponse.json({ error: 'nuevo_precio inválido' }, { status: 422 });
    }
    if (accion === 'actualizar_stock' && (typeof nuevo_stock !== 'number' || !Number.isInteger(nuevo_stock) || Math.abs(nuevo_stock) > 1_000_000)) {
      return NextResponse.json({ error: 'nuevo_stock inválido' }, { status: 422 });
    }

    let resultado;
    
    switch (accion) {
      case 'cambiar_precio':
        // Obtener producto actual
        const getRes = await fetch(`${process.env.OBUMA_API_URL}/productos.findById.json/${producto_id}`, {
          headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
        });
        const productoActual = await getRes.json();
        
        // Calcular nuevo precio con IVA
        const nuevoPrecioNeto = nuevo_precio;
        const nuevoPrecioBruto = Math.round(nuevo_precio * 1.19);
        const nuevoIva = nuevoPrecioBruto - nuevoPrecioNeto;
        
        // Actualizar en Obuma
        const updateRes = await fetch(`${process.env.OBUMA_API_URL}/productos.update.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access-token': process.env.OBUMA_API_TOKEN || '',
          },
          body: JSON.stringify({
            producto_id: producto_id,
            producto_precio_clp_neto: nuevoPrecioNeto.toString(),
            producto_precio_clp_iva: nuevoIva.toString(),
            producto_precio_clp_total: nuevoPrecioBruto.toString()
          })
        });
        
        resultado = await updateRes.json();
        break;
        
      case 'actualizar_stock':
        // Implementar actualización de stock
        const stockRes = await fetch(`${process.env.OBUMA_API_URL}/productosStock.create.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access-token': process.env.OBUMA_API_TOKEN || '',
          },
          body: JSON.stringify({
            bodega: "1",
            tipo_movimiento: nuevo_stock > 0 ? "ENTRADA" : "SALIDA",
            items: [{ producto_id: producto_id, cantidad: Math.abs(nuevo_stock) }]
          })
        });
        
        resultado = await stockRes.json();
        break;
        
      default:
        return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
    }
    
    return NextResponse.json({ success: true, resultado });
    
  } catch (error) {
    console.error("Error ejecutando acción:", error);
    return NextResponse.json({ error: "Error ejecutando acción" }, { status: 500 });
  }
}