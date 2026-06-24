import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const supabase = supabaseAdmin;

// La creación masiva puede tardar (Obuma crea de a uno). Subimos el límite.
export const maxDuration = 300;

const limpiar = (t: string) =>
  String(t || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const construirNombre = (c1: string, c2: string, c3: string, c4: string) =>
  [limpiar(c1), limpiar(c2), c3 ? `${limpiar(c3)} MT` : '', limpiar(c4)].filter(Boolean).join(' ');

interface FilaEntrada {
  c1?: string;
  c2?: string;
  c3?: string;
  c4?: string;
  tipo?: string;
  categoria_id?: string;
  categoria_nombre?: string;
  subcategoria_id?: string;
  precio_costo?: number;
  precio_venta?: number;
  venta_incluye_iva?: boolean;
  costo_incluye_iva?: boolean;
  se_puede_vender?: boolean;
  se_puede_comprar?: boolean;
  se_mantiene_stock?: boolean;
  producto_vender_en_web?: boolean;
}

interface ResultadoFila {
  fila: number;
  nombre: string;
  sku: string | null;
  estado: 'creado' | 'omitido_duplicado' | 'error';
  detalle?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const filas: FilaEntrada[] = Array.isArray(body?.productos) ? body.productos : [];

    if (filas.length === 0) {
      return NextResponse.json({ error: 'No se recibieron productos.' }, { status: 400 });
    }
    if (filas.length > 500) {
      return NextResponse.json(
        { error: 'Máximo 500 productos por carga. Divide el archivo.' },
        { status: 400 }
      );
    }

    const headers = {
      'Content-Type': 'application/json',
      'access-token': process.env.OBUMA_API_TOKEN || '',
    };

    // 1. TRAER LA LISTA DE OBUMA UNA SOLA VEZ (para SKUs y detección de duplicados)
    const resList = await fetch(`${process.env.OBUMA_API_URL}/productos.list.json`, {
      headers,
      cache: 'no-store',
    });
    if (!resList.ok) {
      return NextResponse.json({ error: 'No se pudo conectar con Obuma.' }, { status: 502 });
    }
    const listData = await resList.json();
    const productosObuma: any[] = listData.data || [];

    // Nombres existentes normalizados (para omitir duplicados)
    const nombresExistentes = productosObuma
      .map((p) => limpiar(p.producto_nombre))
      .filter(Boolean);

    // 2. CALCULAR EL CORRELATIVO BASE POR PREFIJO (mismo criterio que /siguiente-sku)
    //    Se incrementa localmente para evitar SKUs repetidos dentro del mismo lote.
    const proximoCorrelativo = new Map<string, number>();
    const siguienteSku = (prefijoSub: string): string => {
      if (!proximoCorrelativo.has(prefijoSub)) {
        const usados = productosObuma
          .filter((p) => String(p.producto_codigo_comercial).startsWith(prefijoSub))
          .map((p) => parseInt(String(p.producto_codigo_comercial).replace(prefijoSub, ''), 10) || 0);
        const max = usados.length > 0 ? Math.max(...usados) : 0;
        proximoCorrelativo.set(prefijoSub, max < 203 ? 203 : max + 1);
      }
      const correlativo = proximoCorrelativo.get(prefijoSub)!;
      proximoCorrelativo.set(prefijoSub, correlativo + 1);
      return `${prefijoSub}${String(correlativo).padStart(3, '0')}`;
    };

    const resultados: ResultadoFila[] = [];
    const nombresEnLote = new Set<string>(); // evita duplicados dentro del propio archivo

    // 3. PROCESAR FILA POR FILA
    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const numFila = i + 1;
      const nombre = construirNombre(fila.c1 || '', fila.c2 || '', fila.c3 || '', fila.c4 || '');

      // Validaciones mínimas
      if (!nombre) {
        resultados.push({ fila: numFila, nombre, sku: null, estado: 'error', detalle: 'Nombre vacío (C1..C4 sin datos).' });
        continue;
      }
      if (!fila.categoria_id || !fila.subcategoria_id) {
        resultados.push({ fila: numFila, nombre, sku: null, estado: 'error', detalle: 'Categoría o subcategoría no encontrada.' });
        continue;
      }

      // Detección de duplicados (mismo criterio "contiene" que la creación individual)
      const nombreNorm = limpiar(nombre);
      const esDuplicado =
        nombresEnLote.has(nombreNorm) ||
        nombresExistentes.some((n) => n.includes(nombreNorm));
      if (esDuplicado) {
        resultados.push({ fila: numFila, nombre, sku: null, estado: 'omitido_duplicado', detalle: 'Ya existe un producto similar.' });
        continue;
      }

      // Generar SKU (prefijo 60 para Mercado Público, 50 para el resto)
      const prefijo = limpiar(fila.categoria_nombre || '').includes('MERCADO PUBLICO') ? '60' : '50';
      const sku = siguienteSku(`${prefijo}${fila.subcategoria_id}`);

      // Lógica de IVA (idéntica a la creación individual)
      const precioVentaInput = Number(fila.precio_venta) || 0;
      const precioCostoInput = Number(fila.precio_costo) || 0;

      let precioVentaNeto: number;
      let precioVentaBruto: number;
      if (fila.venta_incluye_iva) {
        precioVentaBruto = precioVentaInput;
        precioVentaNeto = Math.round(precioVentaBruto / 1.19);
      } else {
        precioVentaNeto = precioVentaInput;
        precioVentaBruto = Math.round(precioVentaNeto * 1.19);
      }
      const ivaVenta = precioVentaBruto - precioVentaNeto;
      const precioCostoNeto = fila.costo_incluye_iva
        ? Math.round(precioCostoInput / 1.19)
        : precioCostoInput;

      const obumaPayload = {
        producto_nombre: nombreNorm,
        producto_tipo: fila.tipo === 'Servicio' ? '1' : '0',
        producto_activo: '1',
        producto_codigo_comercial: sku,
        producto_categoria: String(fila.categoria_id),
        producto_subcategoria: String(fila.subcategoria_id),
        producto_impuesto_id: '1',
        producto_costo_clp_neto: precioCostoNeto.toString(),
        producto_costo_clp_neto_estandar: precioCostoNeto.toString(),
        producto_precio_clp_neto: precioVentaNeto.toString(),
        producto_precio_clp_iva: ivaVenta.toString(),
        producto_precio_clp_total: precioVentaBruto.toString(),
        producto_para_venta: fila.se_puede_vender === false ? '0' : '1',
        producto_para_compra: fila.se_puede_comprar === false ? '0' : '1',
        producto_inventariable: fila.se_mantiene_stock === false ? '0' : '1',
        producto_vender_en_web: fila.producto_vender_en_web === false ? '0' : '1',
        sucursal_id: '1',
      };

      try {
        const response = await fetch(`${process.env.OBUMA_API_URL}/productos.create.json`, {
          method: 'POST',
          headers,
          body: JSON.stringify(obumaPayload),
        });
        const result = await response.json();

        if (!response.ok || result.success === false || result.status === false) {
          resultados.push({
            fila: numFila,
            nombre: nombreNorm,
            sku,
            estado: 'error',
            detalle: result.message || 'Obuma rechazó los datos.',
          });
          continue;
        }

        // Marcamos como existente para que no se repita dentro del lote
        nombresEnLote.add(nombreNorm);
        nombresExistentes.push(nombreNorm);

        // Sincronizar a Supabase (best-effort, no bloquea el lote)
        try {
          const productoId = result.data?.producto_id || result.producto_id;
          if (productoId) {
            await supabase.from('productos_obuma').upsert(
              {
                id: String(productoId),
                sku,
                nombre: nombreNorm,
                tipo: fila.tipo === 'Servicio' ? 'Servicio' : 'Producto',
                categoria_nombre: fila.categoria_nombre || '',
                subcategoria_nombre: '',
                precio_total: precioVentaBruto,
                precio_neto: precioVentaNeto,
                stock_actual: 0,
                activo: true,
                para_venta: obumaPayload.producto_para_venta === '1',
                para_compra: obumaPayload.producto_para_compra === '1',
                inventariable: obumaPayload.producto_inventariable === '1',
                vender_en_web: obumaPayload.producto_vender_en_web === '1',
                ultima_sincronizacion: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            );
          }
        } catch (syncErr) {
          console.warn(`⚠️ No se sincronizó a Supabase la fila ${numFila}:`, syncErr);
        }

        resultados.push({ fila: numFila, nombre: nombreNorm, sku, estado: 'creado' });
      } catch (err: any) {
        resultados.push({
          fila: numFila,
          nombre: nombreNorm,
          sku,
          estado: 'error',
          detalle: err?.message || 'Error de red con Obuma.',
        });
      }
    }

    const resumen = {
      total: resultados.length,
      creados: resultados.filter((r) => r.estado === 'creado').length,
      omitidos: resultados.filter((r) => r.estado === 'omitido_duplicado').length,
      errores: resultados.filter((r) => r.estado === 'error').length,
    };

    return NextResponse.json({ success: true, resumen, resultados });
  } catch (error: any) {
    console.error('🔥 Error crítico en carga masiva:', error);
    return NextResponse.json(
      { error: 'Error interno en el servidor', details: error.message },
      { status: 500 }
    );
  }
}
