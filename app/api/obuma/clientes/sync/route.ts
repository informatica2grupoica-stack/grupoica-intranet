// app/api/obuma/clientes/sync/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Función para obtener TODOS los clientes (todas las páginas)
async function obtenerTodosLosClientes(): Promise<any[]> {
  let todosLosClientes: any[] = [];
  let pagina = 1;
  let hayMas = true;
  const limit = 500;

  while (hayMas) {
    const url = new URL(`${process.env.OBUMA_API_URL}/clientes.list.json`);
    url.searchParams.append('page', pagina.toString());
    url.searchParams.append('limit', limit.toString());
    
    console.log(`📡 Consultando página ${pagina} de clientes...`);
    
    const response = await fetch(url.toString(), {
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const data = await response.json();
    const clientes = data.data || data.clientes || [];
    
    if (clientes.length === 0) {
      hayMas = false;
    } else {
      todosLosClientes.push(...clientes);
      console.log(`📦 Página ${pagina}: ${clientes.length} clientes (total: ${todosLosClientes.length})`);
      
      if (clientes.length < limit) {
        hayMas = false;
      } else {
        pagina++;
      }
    }
  }

  return todosLosClientes;
}

// Función para obtener contactos de un cliente
async function obtenerContactos(clienteId: string): Promise<any[]> {
  try {
    const response = await fetch(`${process.env.OBUMA_API_URL}/clientesContactos.list.json/${clienteId}`, {
      headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
    });
    if (response.ok) {
      const data = await response.json();
      return data.data || data.contactos || [];
    }
  } catch (error) {
    console.warn(`Error obteniendo contactos de ${clienteId}:`, error);
  }
  return [];
}

// Función para obtener direcciones de un cliente
async function obtenerDirecciones(clienteId: string): Promise<any[]> {
  try {
    const response = await fetch(`${process.env.OBUMA_API_URL}/clientesDirecciones.list.json/${clienteId}`, {
      headers: { 'access-token': process.env.OBUMA_API_TOKEN || '' }
    });
    if (response.ok) {
      const data = await response.json();
      return data.data || data.direcciones || [];
    }
  } catch (error) {
    console.warn(`Error obteniendo direcciones de ${clienteId}:`, error);
  }
  return [];
}

export async function POST() {
  const startTime = Date.now();
  console.log("🔄 Iniciando sincronización de clientes con Obuma...");

  try {
    // 1. Obtener TODOS los clientes
    const todosLosClientes = await obtenerTodosLosClientes();
    console.log(`✅ Obtenidos ${todosLosClientes.length} clientes de Obuma`);

    if (todosLosClientes.length === 0) {
      return NextResponse.json({
        success: true,
        sincronizados: 0,
        errores: 0,
        total_clientes: 0,
        duracion_ms: Date.now() - startTime
      });
    }

    // 2. Procesar clientes en batches para mejor rendimiento
    let guardados = 0;
    let errores = 0;
    const erroresDetalle: any[] = [];

    for (let i = 0; i < todosLosClientes.length; i++) {
      const cliente = todosLosClientes[i];
      
      try {
        // Obtener contactos y direcciones en paralelo
        const [contactos, direcciones] = await Promise.all([
          obtenerContactos(cliente.cliente_id),
          obtenerDirecciones(cliente.cliente_id)
        ]);
        
        const clienteParaBD = {
          id: String(cliente.cliente_id),
          rut: cliente.cliente_rut || '',
          razon_social: cliente.cliente_razon_social || 'Sin nombre',
          nombre_fantasia: cliente.cliente_nombre_fantasia || '',
          email: cliente.cliente_email || '',
          telefono: cliente.cliente_telefono || '',
          direccion: cliente.cliente_direccion || '',
          comuna: cliente.cliente_comuna || '',
          ciudad: cliente.cliente_ciudad || '',
          region: cliente.cliente_region || '',
          giro_comercial: cliente.cliente_giro_comercial || '',
          sitio_web: cliente.cliente_sitio_web || '',
          contacto_nombre: cliente.cliente_contacto || '',
          contacto_celular: cliente.cliente_celular || '',
          estado: cliente.estado === '1',
          es_extranjero: cliente.cliente_extranjero === '1',
          extranjero_id: cliente.cliente_extranjero_id || '',
          agente_retenedor: cliente.cliente_agente_retenedor === '1',
          bloqueado: cliente.cliente_bloqueado === '1',
          facturar_cta_cte: cliente.cliente_facturar_cta_cte === '1',
          credito_aprobado: parseInt(cliente.cliente_credito_aprobado) || 0,
          dias_pago: parseInt(cliente.cliente_dias_pago) || 0,
          plazo_pago: parseInt(cliente.cliente_plazo_pago) || 0,
          vendedor: cliente.cliente_vendedor || '',
          forma_pago: cliente.cliente_forma_pago || '',
          centro_costo: cliente.cliente_centro_costo || '',
          observacion: cliente.cliente_observacion || '',
          total_contactos: contactos.length,
          total_direcciones: direcciones.length,
          ultima_sincronizacion: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('clientes_obuma')
          .upsert(clienteParaBD, { onConflict: 'id' });
        
        if (error) {
          console.error(`❌ Error guardando cliente ${cliente.cliente_id}:`, error.message);
          errores++;
          erroresDetalle.push({
            id: cliente.cliente_id,
            razon_social: cliente.cliente_razon_social,
            error: error.message
          });
        } else {
          guardados++;
        }
        
        // Log cada 100 clientes
        if ((i + 1) % 100 === 0) {
          console.log(`📊 Progreso: ${i + 1}/${todosLosClientes.length} clientes (${guardados} guardados, ${errores} errores)`);
        }
        
      } catch (err) {
        console.error(`❌ Error procesando cliente ${cliente.cliente_id}:`, err);
        errores++;
        erroresDetalle.push({
          id: cliente.cliente_id,
          razon_social: cliente.cliente_razon_social,
          error: String(err)
        });
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Sincronización completada en ${duration}ms: ${guardados} guardados, ${errores} errores`);
    
    return NextResponse.json({
      success: true,
      sincronizados: guardados,
      errores: errores,
      total_clientes: todosLosClientes.length,
      duracion_ms: duration,
      errores_detalle: erroresDetalle.slice(0, 20),
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("❌ Error en sincronización:", error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Error al sincronizar clientes con Obuma', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Endpoint GET para verificar estado de la tabla
export async function GET() {
  try {
    const { count, error: countError } = await supabase
      .from('clientes_obuma')
      .select('*', { count: 'exact', head: true });
    
    const { data: lastSync, error: syncError } = await supabase
      .from('clientes_obuma')
      .select('ultima_sincronizacion')
      .order('ultima_sincronizacion', { ascending: false })
      .limit(1);
    
    return NextResponse.json({
      sincronizado: !countError,
      total_clientes: count || 0,
      ultima_sincronizacion: lastSync?.[0]?.ultima_sincronizacion || null,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error al verificar estado', details: error.message },
      { status: 500 }
    );
  }
}