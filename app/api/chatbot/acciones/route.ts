import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { accion, producto_id, sku, nuevo_precio, nuevo_stock } = await req.json();
    
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