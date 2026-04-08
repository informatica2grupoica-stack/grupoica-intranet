import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. LIMPIEZA DE DATOS
    const nombreLimpio = String(body.nombre_completo || "").toUpperCase().trim();
    const skuLimpio = String(body.sku || "").toUpperCase().trim();
    const tipoProducto = body.tipo === "Servicio" ? "1" : "0";

    if (!nombreLimpio || !skuLimpio) {
      return NextResponse.json(
        { error: "Faltan datos críticos: Nombre o SKU vacíos." },
        { status: 400 }
      );
    }

    // 2. LÓGICA DE IMPUESTOS (IVA CHILE 19%)
    const precioVentaInput = Number(body.precio_venta) || 0;
    const precioCostoInput = Number(body.precio_costo) || 0;

    let precioVentaNeto: number;
    let precioVentaBruto: number;

    // Calculamos siempre basándonos en el flag del front
    if (body.venta_incluye_iva) {
      // Input es Bruto (1000) -> Neto = 840,33... -> 840
      precioVentaBruto = precioVentaInput;
      precioVentaNeto = Math.round(precioVentaBruto / 1.19);
    } else {
      // Input es Neto (1000) -> Bruto = 1190
      precioVentaNeto = precioVentaInput;
      precioVentaBruto = Math.round(precioVentaNeto * 1.19);
    }

    const ivaVenta = precioVentaBruto - precioVentaNeto;

    // Costo (Obuma siempre prefiere el costo neto)
    const precioCostoNeto = body.costo_incluye_iva 
      ? Math.round(precioCostoInput / 1.19) 
      : precioCostoInput;

    // 3. CONSTRUCCIÓN DEL PAYLOAD PARA OBUMA
    // Importante: Se agregan campos de ID de impuesto y se usan nombres de campos estándar
    const obumaPayload = {
      producto_nombre: nombreLimpio,
      producto_tipo: tipoProducto, 
      producto_activo: "1",
      producto_codigo_comercial: skuLimpio,
      
      // Clasificación
      id_categoria: String(body.categoria_id || ""),
      id_subcategoria: String(body.subcategoria_id || ""),
      
      // Impuestos: 1 es el ID para IVA 19% en la mayoría de las cuentas Obuma Chile
      producto_impuesto_id: "1", 
      
      // Precios y Costos
      // Usamos tanto el neto como el total para que Obuma no tenga que calcular nada
      producto_costo_clp_neto: precioCostoNeto.toString(),
      producto_precio_clp_neto: precioVentaNeto.toString(),
      producto_precio_clp_iva: ivaVenta.toString(),
      producto_precio_clp_total: precioVentaBruto.toString(),
      
      // Flags de Estado (Obuma espera "1" o "0")
      producto_para_venta: body.se_puede_vender ? "1" : "0",
      producto_para_compra: body.se_puede_comprar ? "1" : "0",
      producto_inventariable: body.se_mantiene_stock ? "1" : "0",
      
      // Localización
      sucursal_id: "1" 
    };

    console.log("📤 Enviando a Obuma:", obumaPayload);

    // 4. ENVÍO A LA API
    const response = await fetch(`${process.env.OBUMA_API_URL}/productos.create.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.OBUMA_API_TOKEN || '',
      },
      body: JSON.stringify(obumaPayload),
    });

    const result = await response.json();

    // 5. MANEJO DE RESPUESTA
    if (!response.ok || result.success === false || result.status === false) {
      return NextResponse.json({ 
        error: result.message || 'Obuma rechazó los datos',
        details: result 
      }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("🔥 Error Crítico:", error);
    return NextResponse.json(
      { error: 'Error interno en el servidor', details: error.message }, 
      { status: 500 }
    );
  }
}