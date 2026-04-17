// app/api/obuma/stock/route.ts
import { NextResponse } from 'next/server';

interface StockItem {
  producto_id: string;
  cantidad: string;
}

export async function POST(request: Request) {
  try {
    const { 
      producto_id, 
      sku,
      cantidad, 
      tipo_movimiento, // "ENTRADA" o "SALIDA"
      concepto, 
      referencia,
      bodega = "1"
    } = await request.json();
    
    // Validar tipo de movimiento
    if (!["ENTRADA", "SALIDA"].includes(tipo_movimiento)) {
      return NextResponse.json(
        { error: 'tipo_movimiento debe ser "ENTRADA" o "SALIDA"' },
        { status: 400 }
      );
    }
    
    // Obtener producto_id si se envió SKU
    let productoIdFinal = producto_id;
    if (!productoIdFinal && sku) {
      const productRes = await fetch(`${process.env.OBUMA_API_URL}/productos.list.json?codigo_sku=${sku}`, {
        headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
      });
      const productData = await productRes.json();
      const producto = (productData.data || productData.productos || [])[0];
      if (producto) {
        productoIdFinal = producto.producto_id;
      } else {
        return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
      }
    }
    
    const payload = {
      bodega: bodega,
      tipo_movimiento: tipo_movimiento,
      concepto_movimiento: concepto || `Actualización de stock via API`,
      referencia_movimiento: referencia || `Ajuste de ${Math.abs(cantidad)} unidades`,
      items: [{
        producto_id: productoIdFinal,
        cantidad: Math.abs(cantidad).toString()
      }]
    };
    
    const response = await fetch(`${process.env.OBUMA_API_URL}/productosStock.create.json`, {
      method: 'POST',
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (data.success === false || data.status === false) {
      return NextResponse.json(
        { error: data.message || 'Error actualizando stock', details: data },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `Stock actualizado: ${tipo_movimiento} de ${Math.abs(cantidad)} unidades`,
      data: data
    });
    
  } catch (error: any) {
    console.error("Error actualizando stock:", error);
    return NextResponse.json(
      { error: 'Error al actualizar stock', details: error.message },
      { status: 500 }
    );
  }
}