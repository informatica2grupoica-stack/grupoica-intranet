// app/api/deepseek/chat/route.ts
import { NextResponse } from 'next/server';
import { callDeepSeek } from '@/app/lib/deepseek/client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Producto {
  nombre: string;
  sku: string;
  precio: number;
  stock: number;
  categoria?: string;
}

interface DatosResponse {
  tipo: string;
  datos: any[];
  total: number;
  termino?: string;
  fuente?: string;
  esLista?: boolean;
  esPreguntaGeneral?: boolean;
  noEncontrado?: boolean;
  error?: boolean;
  productosTotal?: number;
  clientesTotal?: number;
}

// Esquema de la base de datos
const databaseSchema = {
  tablas: {
    productos_obuma: {
      descripcion: "Productos del inventario (desde Obuma)",
      campos: ["nombre", "sku", "precio_total", "stock_actual", "categoria_nombre", "subcategoria_nombre"],
      keywords: ["producto", "inventario", "stock", "precio", "sku", "categoría"]
    },
    clientes_obuma: {
      descripcion: "Clientes de la empresa (sincronizados desde Obuma)",
      campos: ["razon_social", "rut", "email", "telefono", "estado"],
      keywords: ["cliente", "clientes", "empresa", "contacto", "rut", "razón social"]
    },
    proveedores: {
      descripcion: "Proveedores de la empresa",
      campos: ["nombre_empresa", "rut_empresa", "categoria", "email_contacto", "telefono", "calificacion"],
      keywords: ["proveedor", "empresa", "contacto", "teléfono", "correo"]
    },
    proveedores_transporte: {
      descripcion: "Proveedores de servicios de transporte",
      campos: ["nombre", "tipo", "correo", "direccion", "contactos"],
      keywords: ["transporte", "camión", "flete", "logística"]
    },
    tareas: {
      descripcion: "Tareas y actividades del equipo",
      campos: ["titulo", "descripcion", "prioridad", "estado", "asignado_a", "fecha_limite"],
      keywords: ["tarea", "pendiente", "completada", "asignada", "prioridad"]
    },
    perfiles: {
      descripcion: "Usuarios del sistema",
      campos: ["nombre", "apellido", "email", "rol", "cargo", "activo"],
      keywords: ["usuario", "administrador", "admin", "persona", "equipo"]
    },
    dispositivos: {
      descripcion: "Equipos y dispositivos de la empresa",
      campos: ["nombre_equipo", "tipo", "marca", "modelo", "estado", "asignado_a"],
      keywords: ["dispositivo", "equipo", "computador", "notebook", "pc", "teléfono"]
    },
    mensajes: {
      descripcion: "Mensajes internos entre usuarios",
      campos: ["contenido", "emisor_id", "receptor_id", "leido", "created_at"],
      keywords: ["mensaje", "conversación", "chat", "comunicación"]
    },
    chatbot_historial: {
      descripcion: "Historial de conversaciones con el asistente",
      campos: ["pregunta", "respuesta", "created_at"],
      keywords: ["historial", "conversación anterior", "pregunta previa"]
    },
    analisis_competencia: {
      descripcion: "Análisis de precios de la competencia",
      campos: ["termino_busqueda", "nombre_producto_tienda", "tienda_url", "precio_num"],
      keywords: ["competencia", "precio competencia", "mercado"]
    },
    registros_precios: {
      descripcion: "Historial de precios de productos",
      campos: ["nombre_producto", "tienda", "precio_valor", "fecha"],
      keywords: ["historial precio", "evolución precio", "cambio precio"]
    }
  }
};

// Función para buscar productos DIRECTAMENTE en Obuma API (prioridad)
async function buscarProductosEnObuma(termino: string, limit: number = 20): Promise<Producto[]> {
  try {
    const obumaUrl = `${process.env.OBUMA_API_URL}/productos.list.json?filter=${encodeURIComponent(termino)}&limit=${limit}`;
    console.log(`🔍 Buscando en Obuma API: ${obumaUrl}`);
    
    const response = await fetch(obumaUrl, {
      headers: {
        'access-token': process.env.OBUMA_API_TOKEN || '',
      }
    });
    
    if (!response.ok) {
      console.error(`Error Obuma: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const productos = data.data || data.productos || [];
    
    console.log(`✅ Obuma devolvió ${productos.length} productos para "${termino}"`);
    
    return productos.map((p: any) => ({
      nombre: p.producto_nombre || '',
      sku: p.producto_codigo_comercial || '',
      precio: p.producto_precio_clp_total || 0,
      stock: p.stock_actual || 0,
      categoria: p.categoria_nombre || ''
    }));
    
  } catch (error) {
    console.error("Error buscando en Obuma:", error);
    return [];
  }
}

// Función para buscar productos en Supabase (fallback)
async function buscarProductosEnSupabase(termino: string, limit: number = 20): Promise<Producto[]> {
  try {
    let query = supabase.from('productos_obuma').select('nombre, sku, precio_total, stock_actual, categoria_nombre').eq('activo', true);
    if (termino && termino.length > 2) {
      query = query.ilike('nombre', `%${termino}%`);
    }
    const { data } = await query.limit(limit);
    console.log(`📦 Supabase devolvió ${data?.length || 0} productos para "${termino}"`);
    return (data || []).map((p: any) => ({
      nombre: p.nombre,
      sku: p.sku,
      precio: p.precio_total,
      stock: p.stock_actual,
      categoria: p.categoria_nombre
    }));
  } catch (error) {
    console.error("Error buscando en Supabase:", error);
    return [];
  }
}

// Función para detectar qué quiere el usuario
function detectarIntencion(pregunta: string): string {
  const p = pregunta.toLowerCase();
  
  const palabrasCliente = ['cliente', 'clientes', 'empresa', 'contacto', 'rut', 'razón social', 'envapol', 'brigada', 'municipalidad', 'limitada', 'spa'];
  for (const palabra of palabrasCliente) {
    if (p.includes(palabra)) {
      return "clientes_obuma";
    }
  }
  
  if (p.includes('producto') || p.includes('inventario') || p.includes('stock') || p.includes('precio') || p.includes('sku')) {
    return "productos_obuma";
  }
  
  if (p.includes('proveedor')) return "proveedores";
  if (p.includes('transporte') || p.includes('camión')) return "proveedores_transporte";
  if (p.includes('tarea') || p.includes('pendiente')) return "tareas";
  if (p.includes('usuario') || p.includes('administrador')) return "perfiles";
  if (p.includes('dispositivo') || p.includes('equipo')) return "dispositivos";
  if (p.includes('mensaje') || p.includes('conversación')) return "mensajes";
  if (p.includes('competencia')) return "analisis_competencia";
  if (p.includes('historial precio')) return "registros_precios";
  
  return "general";
}

// Función para obtener datos según la intención
async function obtenerDatosPorIntencion(intencion: string, pregunta: string, limit: number = 20): Promise<DatosResponse> {
  const p = pregunta.toLowerCase();
  
  try {
    switch (intencion) {
      case "productos_obuma": {
        let termino = p
          .replace(/productos?|busca|encuentra|tienes?|muestra|listame|dame|el|la|los|las/gi, '')
          .trim();
        
        if (termino && termino.length > 2) {
          console.log(`🔍 Prioridad 1: Buscando "${termino}" en Obuma API...`);
          const productosObuma = await buscarProductosEnObuma(termino, limit);
          
          if (productosObuma.length > 0) {
            return { 
              tipo: "productos", 
              datos: productosObuma, 
              total: productosObuma.length,
              fuente: "Obuma API (tiempo real)"
            };
          }
          
          console.log(`⚠️ No encontrado en Obuma, buscando en Supabase...`);
          const productosSupabase = await buscarProductosEnSupabase(termino, limit);
          
          if (productosSupabase.length > 0) {
            return { 
              tipo: "productos", 
              datos: productosSupabase, 
              total: productosSupabase.length,
              fuente: "Supabase (caché)"
            };
          }
          
          console.log(`❌ No se encontraron productos para "${termino}"`);
          return { tipo: "productos", datos: [], total: 0, noEncontrado: true, termino };
        }
        
        const { count } = await supabase.from('productos_obuma').select('*', { count: 'exact', head: true });
        return { tipo: "productos", datos: [], total: count || 0, esPreguntaGeneral: true };
      }
        
      case "clientes_obuma": {
        const { count: totalClientes } = await supabase.from('clientes_obuma').select('*', { count: 'exact', head: true });
        
        let termino = p.replace(/cliente|clientes|busca|encuentra|dame|lista|todos/gi, '').trim();
        if (termino && termino.length > 2 && termino !== 'activos') {
          const { data } = await supabase
            .from('clientes_obuma')
            .select('razon_social, rut, email, telefono')
            .ilike('razon_social', `%${termino}%`)
            .limit(5);
          return { tipo: "clientes", datos: data || [], total: totalClientes || 0, termino };
        }
        
        if (p.includes('lista') || p.includes('todos')) {
          const { data } = await supabase.from('clientes_obuma').select('razon_social, rut').limit(limit);
          return { tipo: "clientes", datos: data || [], total: totalClientes || 0, esLista: true };
        }
        
        return { tipo: "clientes", datos: [], total: totalClientes || 0, esPreguntaGeneral: true };
      }
        
      default: {
        const stats = await Promise.all([
          supabase.from('productos_obuma').select('*', { count: 'exact', head: true }),
          supabase.from('clientes_obuma').select('*', { count: 'exact', head: true })
        ]);
        return { 
          tipo: "estadisticas", 
          datos: [], 
          total: 2,
          productosTotal: stats[0].count || 0,
          clientesTotal: stats[1].count || 0
        };
      }
    }
  } catch (error) {
    console.error(`Error en ${intencion}:`, error);
    return { tipo: intencion, datos: [], total: 0, error: true };
  }
}

export async function POST(req: Request) {
  try {
    const { pregunta, contexto } = await req.json();
    
    if (!pregunta || pregunta.trim() === "") {
      return NextResponse.json({ error: "La pregunta no puede estar vacía" }, { status: 400 });
    }

    const intencion = detectarIntencion(pregunta);
    const datosDB = await obtenerDatosPorIntencion(intencion, pregunta);
    
    let systemPrompt = `Eres un asistente inteligente que conoce la base de datos de la empresa.

🎯 PREGUNTA: "${pregunta}"
🔍 INTENCIÓN: ${intencion}`;

    if (datosDB.tipo === "productos" && datosDB.datos && datosDB.datos.length > 0) {
      systemPrompt += `\n\n📦 PRODUCTOS ENCONTRADOS (${datosDB.total} resultados - Fuente: ${datosDB.fuente || 'Obuma'}):
${JSON.stringify(datosDB.datos, null, 2)}

Responde MOSTRANDO estos productos reales. Incluye nombre, SKU y precio.`;
    }
    else if (datosDB.tipo === "productos" && datosDB.noEncontrado) {
      systemPrompt += `\n\n❌ No se encontró el producto "${datosDB.termino}" en el inventario.
Responde: "No encontré el producto '${datosDB.termino}' en nuestra base de datos. ¿Quieres que busque productos similares o me des más detalles?"`;
    }
    else if (datosDB.tipo === "productos" && datosDB.esPreguntaGeneral) {
      systemPrompt += `\n\nResponde: "Tenemos ${datosDB.total} productos en inventario."`;
    }
    else if (datosDB.tipo === "clientes" && datosDB.datos && datosDB.datos.length > 0) {
      systemPrompt += `\n\n👥 CLIENTES ENCONTRADOS:
${JSON.stringify(datosDB.datos, null, 2)}`;
    }
    else if (datosDB.tipo === "clientes" && datosDB.esPreguntaGeneral) {
      systemPrompt += `\n\nResponde: "Tenemos ${datosDB.total} clientes registrados."`;
    }
    else if (datosDB.tipo === "estadisticas") {
      systemPrompt += `\n\n📊 ESTADÍSTICAS:
- Productos: ${datosDB.productosTotal || 0}
- Clientes: ${datosDB.clientesTotal || 0}`;
    }

    systemPrompt += `\n\nREGLAS:
1. Responde en español, de forma natural y amable
2. Usa los datos REALES que se te proporcionan
3. NO inventes información
4. Usa emojis para hacer la conversación amigable (📦, 👥)
5. Si el usuario busca un producto específico, busca exactamente ese nombre`;

    const result = await callDeepSeek([
      { role: "system", content: systemPrompt },
      { role: "user", content: pregunta }
    ], 0.3, 800);

    if (result.error) {
      return NextResponse.json({ 
        respuesta: "🔌 Lo siento, tuve un problema. Intenta nuevamente.",
        error: result.error 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      respuesta: result.content,
      timestamp: new Date().toISOString(),
      intencion,
      productos_encontrados: datosDB.datos?.length || 0
    });
    
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { respuesta: "🔌 Ups, algo salió mal. Intenta nuevamente." },
      { status: 500 }
    );
  }
}