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
  esLista?: boolean;
  esPreguntaGeneral?: boolean;
  error?: boolean;
}

// Esquema COMPLETO de la base de datos
const databaseSchema = {
  tablas: {
    productos_obuma: {
      descripcion: "Productos del inventario",
      campos: ["nombre", "sku", "precio_total", "stock_actual", "categoria_nombre"],
      keywords: ["producto", "inventario", "stock", "precio", "sku"]
    },
    clientes_obuma: {
      descripcion: "Clientes de la empresa",
      campos: ["razon_social", "rut", "email", "telefono", "estado"],
      keywords: ["cliente", "clientes", "empresa", "rut", "razon social"]
    },
    proveedores: {
      descripcion: "Proveedores de la empresa",
      campos: ["nombre_empresa", "rut_empresa", "categoria", "email_contacto", "telefono"],
      keywords: ["proveedor", "proveedores", "empresa"]
    },
    proveedores_transporte: {
      descripcion: "Proveedores de transporte",
      campos: ["nombre", "tipo", "correo", "direccion"],
      keywords: ["transporte", "camión", "flete", "logística"]
    },
    tareas: {
      descripcion: "Tareas del equipo",
      campos: ["titulo", "prioridad", "estado", "asignado_a", "fecha_limite"],
      keywords: ["tarea", "tareas", "pendiente", "asignada"]
    },
    perfiles: {
      descripcion: "Usuarios del sistema",
      campos: ["nombre", "apellido", "email", "rol"],
      keywords: ["usuario", "usuarios", "administrador", "admin"]
    },
    dispositivos: {
      descripcion: "Equipos y dispositivos",
      campos: ["nombre_equipo", "tipo", "marca", "modelo", "estado"],
      keywords: ["dispositivo", "equipo", "computador", "notebook", "pc"]
    },
    mensajes: {
      descripcion: "Mensajes internos",
      campos: ["contenido", "emisor_id", "receptor_id", "leido"],
      keywords: ["mensaje", "mensajes", "conversación", "chat"]
    },
    analisis_competencia: {
      descripcion: "Análisis de precios de la competencia",
      campos: ["termino_busqueda", "nombre_producto_tienda", "precio_num"],
      keywords: ["competencia", "precio competencia", "mercado"]
    },
    registros_precios: {
      descripcion: "Historial de precios",
      campos: ["nombre_producto", "tienda", "precio_valor", "fecha"],
      keywords: ["historial precio", "evolución precio"]
    },
    chatbot_historial: {
      descripcion: "Historial de conversaciones",
      campos: ["pregunta", "respuesta", "created_at"],
      keywords: ["historial", "conversación anterior"]
    },
    comentarios_tareas: {
      descripcion: "Comentarios en tareas",
      campos: ["contenido", "created_at"],
      keywords: ["comentario", "comentarios"]
    },
    ia_aprendizaje: {
      descripcion: "Aprendizaje de IA para SKUs",
      campos: ["producto_nombre", "sku_generado", "c1", "c2", "c3", "c4"],
      keywords: ["aprendizaje", "sugerencia", "patrón"]
    }
  }
};

// Detectar intención
function detectarIntencion(pregunta: string): string {
  const p = pregunta.toLowerCase();
  
  const palabrasCliente = ['cliente', 'clientes', 'empresa', 'rut', 'razon social', 'envapol', 'brigada', 'municipalidad', 'limitada', 'spa'];
  for (const palabra of palabrasCliente) {
    if (p.includes(palabra)) {
      return "clientes_obuma";
    }
  }
  
  if (p.includes('producto') || p.includes('inventario') || p.includes('stock') || p.includes('sku')) {
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

// Obtener datos de cualquier tabla
async function obtenerDatos(intencion: string, pregunta: string, limit: number = 20): Promise<DatosResponse> {
  const p = pregunta.toLowerCase();
  
  try {
    switch (intencion) {
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
        
      case "productos_obuma": {
        let query = supabase.from('productos_obuma').select('nombre, sku, precio_total, stock_actual').eq('activo', true);
        const terminos = p.replace(/productos?|busca|encuentra/gi, '').trim();
        if (terminos && terminos.length > 2) {
          query = query.ilike('nombre', `%${terminos}%`);
        }
        const { data } = await query.limit(limit);
        return { tipo: "productos", datos: data || [], total: data?.length || 0 };
      }
        
      case "proveedores": {
        const { data } = await supabase.from('proveedores').select('nombre_empresa, categoria, email_contacto, telefono').eq('activo', true).limit(limit);
        return { tipo: "proveedores", datos: data || [], total: data?.length || 0 };
      }
        
      case "proveedores_transporte": {
        const { data } = await supabase.from('proveedores_transporte').select('nombre, tipo, correo').limit(limit);
        return { tipo: "transporte", datos: data || [], total: data?.length || 0 };
      }
        
      case "tareas": {
        let tareasQuery = supabase.from('tareas').select('titulo, prioridad, estado, fecha_limite');
        if (p.includes('pendiente')) tareasQuery = tareasQuery.eq('estado', 'pendiente');
        const { data } = await tareasQuery.order('created_at', { ascending: false }).limit(limit);
        return { tipo: "tareas", datos: data || [], total: data?.length || 0 };
      }
        
      case "perfiles": {
        let perfilesQuery = supabase.from('perfiles').select('nombre, apellido, email, rol');
        if (p.includes('admin')) perfilesQuery = perfilesQuery.in('rol', ['admin', 'superuser']);
        const { data } = await perfilesQuery.limit(limit);
        return { tipo: "usuarios", datos: data || [], total: data?.length || 0 };
      }
        
      case "dispositivos": {
        const { data } = await supabase.from('dispositivos').select('nombre_equipo, tipo, marca, estado').limit(limit);
        return { tipo: "dispositivos", datos: data || [], total: data?.length || 0 };
      }
        
      case "mensajes": {
        const { data } = await supabase.from('mensajes').select('contenido, leido, created_at').order('created_at', { ascending: false }).limit(limit);
        return { tipo: "mensajes", datos: data || [], total: data?.length || 0 };
      }
        
      case "analisis_competencia": {
        const { data } = await supabase.from('analisis_competencia').select('termino_busqueda, nombre_producto_tienda, precio_num').limit(limit);
        return { tipo: "competencia", datos: data || [], total: data?.length || 0 };
      }
        
      case "registros_precios": {
        const { data } = await supabase.from('registros_precios').select('nombre_producto, tienda, precio_valor, fecha').limit(limit);
        return { tipo: "precios", datos: data || [], total: data?.length || 0 };
      }
        
      default: {
        const stats = await Promise.all([
          supabase.from('productos_obuma').select('*', { count: 'exact', head: true }),
          supabase.from('clientes_obuma').select('*', { count: 'exact', head: true }),
          supabase.from('proveedores').select('*', { count: 'exact', head: true }),
          supabase.from('tareas').select('*', { count: 'exact', head: true }),
          supabase.from('perfiles').select('*', { count: 'exact', head: true }),
          supabase.from('dispositivos').select('*', { count: 'exact', head: true })
        ]);
        
        return {
          tipo: "estadisticas",
          datos: [],
          total: 6
        };
      }
    }
  } catch (error) {
    console.error(`Error en ${intencion}:`, error);
    return { tipo: intencion, datos: [], total: 0, error: true };
  }
}

// Búsqueda local de productos
function buscarEnProductos(pregunta: string, productos: Producto[]) {
  const preguntaLower = pregunta.toLowerCase();
  const esBusquedaSKU = /\d{7,}/.test(pregunta);
  
  if (esBusquedaSKU) {
    const sku = pregunta.match(/\d{7,}/)?.[0];
    if (sku) return productos.filter(p => p.sku === sku);
  }
  
  const palabrasClave = preguntaLower.split(' ').filter(p => p.length > 3);
  if (palabrasClave.length === 0) return productos.slice(0, 10);
  
  return productos.filter(p => {
    const texto = `${p.nombre} ${p.sku}`.toLowerCase();
    return palabrasClave.some(palabra => texto.includes(palabra));
  }).slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const { pregunta, contexto } = await req.json();
    
    if (!pregunta || pregunta.trim() === "") {
      return NextResponse.json({ error: "La pregunta no puede estar vacía" }, { status: 400 });
    }

    const productos = contexto?.productos || [];
    const intencion = detectarIntencion(pregunta);
    const datos = await obtenerDatos(intencion, pregunta);
    const productosEncontrados = intencion === "productos_obuma" ? buscarEnProductos(pregunta, productos) : [];
    
    let systemPrompt = `Eres "Asistente Obuma", un asistente conversacional que conoce TODA la base de datos.

📊 ESQUEMA COMPLETO:
${JSON.stringify(databaseSchema, null, 2)}

🎯 PREGUNTA: "${pregunta}"
🔍 INTENCIÓN: ${intencion}`;

    if (datos.tipo === "clientes" && datos.datos && datos.datos.length > 0) {
      systemPrompt += `\n\n👥 CLIENTES ENCONTRADOS:
${JSON.stringify(datos.datos, null, 2)}

Responde SOLO con estos datos reales. NO inventes clientes.`;
    }
    else if (datos.tipo === "clientes" && datos.esPreguntaGeneral) {
      systemPrompt += `\n\nResponde: "Tenemos ${datos.total} clientes registrados en total."`;
    }
    else if (datos.datos && datos.datos.length > 0) {
      systemPrompt += `\n\n📦 DATOS ENCONTRADOS (${datos.tipo}):
${JSON.stringify(datos.datos, null, 2)}`;
    }
    
    if (productosEncontrados.length > 0) {
      systemPrompt += `\n\n📦 PRODUCTOS DESTACADOS:
${JSON.stringify(productosEncontrados.slice(0, 8), null, 2)}`;
    }

    systemPrompt += `\n\nREGLAS:
1. Responde en español, de forma natural y amable
2. Usa los datos REALES que se te proporcionan
3. NO inventes información
4. Usa emojis para hacer la conversación amigable (👥, 📦, ✅, 🔍)
5. Si no hay datos, dilo honestamente y ofrece ayuda`;

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
      intencion
    });
    
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { respuesta: "🔌 Ups, algo salió mal. Intenta nuevamente." },
      { status: 500 }
    );
  }
}