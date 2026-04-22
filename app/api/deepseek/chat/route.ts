// app/api/deepseek/chat/route.ts
import { NextResponse } from 'next/server';
import { callDeepSeek } from '@/app/lib/deepseek/client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Interfaz del producto
interface Producto {
  nombre: string;
  sku: string;
  precio: number;
  stock: number;
  categoria?: string;
}

// Esquema de la base de datos para que la IA sepa qué existe
const databaseSchema = {
  tablas: {
    productos_obuma: {
      descripcion: "Productos del inventario (desde Obuma)",
      campos: ["nombre", "sku", "precio_total", "stock_actual", "categoria_nombre", "subcategoria_nombre"],
      keywords: ["producto", "inventario", "stock", "precio", "sku", "categoría"]
    },
    clientes_obuma: {
      descripcion: "Clientes de la empresa (sincronizados desde Obuma)",
      campos: ["razon_social", "rut", "email", "telefono", "estado", "total_contactos", "total_direcciones"],
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

// Función para detectar qué quiere el usuario
function detectarIntencion(pregunta: string): string {
  const p = pregunta.toLowerCase();
  
  const intenciones: { patrones: string[]; tabla: string }[] = [
    { patrones: ["producto", "inventario", "stock", "precio", "sku"], tabla: "productos_obuma" },
    { patrones: ["cliente", "clientes", "empresa", "contacto", "rut", "razón social"], tabla: "clientes_obuma" },
    { patrones: ["proveedor", "empresa", "contacto", "teléfono", "correo", "mail"], tabla: "proveedores" },
    { patrones: ["transporte", "camión", "flete", "logística"], tabla: "proveedores_transporte" },
    { patrones: ["tarea", "pendiente", "completada", "asignada", "prioridad"], tabla: "tareas" },
    { patrones: ["usuario", "administrador", "admin", "persona", "equipo humano"], tabla: "perfiles" },
    { patrones: ["dispositivo", "equipo", "computador", "notebook", "pc", "teléfono"], tabla: "dispositivos" },
    { patrones: ["mensaje", "conversación", "chat"], tabla: "mensajes" },
    { patrones: ["historial", "conversación anterior", "pregunta previa"], tabla: "chatbot_historial" },
    { patrones: ["competencia", "precio competencia", "mercado"], tabla: "analisis_competencia" },
    { patrones: ["historial precio", "evolución precio"], tabla: "registros_precios" }
  ];
  
  for (const intencion of intenciones) {
    for (const patron of intencion.patrones) {
      if (p.includes(patron)) {
        return intencion.tabla;
      }
    }
  }
  
  return "general";
}

// Función para obtener datos según la intención (MEJORADA PARA CLIENTES)
async function obtenerDatosPorIntencion(intencion: string, pregunta: string, limit: number = 30) {
  const p = pregunta.toLowerCase();
  
  try {
    switch (intencion) {
      case "productos_obuma":
        let query = supabase.from('productos_obuma').select('*').eq('activo', true);
        
        const terminos = p.replace(/productos?|busca|encuentra|tienes?|muestra|listame|dame/gi, '').trim();
        if (terminos && terminos.length > 2) {
          query = query.ilike('nombre', `%${terminos}%`);
        }
        
        const { data: productos } = await query.limit(limit);
        return { tipo: "productos", datos: productos, total: productos?.length || 0 };
        
      case "clientes_obuma":
        // Contar clientes
        const { count: totalClientes } = await supabase
          .from('clientes_obuma')
          .select('*', { count: 'exact', head: true });
        
        console.log(`📊 Total clientes en Supabase: ${totalClientes || 0}`);
        
        if (!totalClientes || totalClientes === 0) {
          return { tipo: "clientes", datos: [], total: 0 };
        }
        
        // Construir consulta base
        let clientesQuery = supabase
          .from('clientes_obuma')
          .select('razon_social, rut, email, telefono, estado')
          .limit(limit);
        
        // Extraer término de búsqueda
        let terminoBusqueda = p
          .replace(/cliente|clientes|busca|encuentra|dame|muestra|listame|ver|todos|los|las|el|la|cuántos|cuantos|tenemos|hay/gi, '')
          .trim();
        
        // Si hay término específico (como "envapol")
        if (terminoBusqueda && terminoBusqueda.length > 2 && 
            terminoBusqueda !== 'activos' && 
            terminoBusqueda !== 'inactivos') {
          console.log(`🔍 Buscando cliente con término: "${terminoBusqueda}"`);
          clientesQuery = clientesQuery.ilike('razon_social', `%${terminoBusqueda}%`);
        }
        
        const { data: clientes, error } = await clientesQuery;
        
        if (error) {
          console.error("Error en consulta de clientes:", error);
          return { tipo: "clientes", datos: [], total: totalClientes, error: true };
        }
        
        console.log(`✅ Clientes obtenidos: ${clientes?.length || 0}`);
        
        // Si es pregunta general de cantidad
        if (p.includes('cuántos') || p.includes('cuantos') || p.includes('total de clientes')) {
          return { 
            tipo: "clientes", 
            datos: [], 
            total: totalClientes,
            esPreguntaGeneral: true
          };
        }
        
        return { 
          tipo: "clientes", 
          datos: clientes || [], 
          total: totalClientes,
          encontrados: clientes?.length || 0
        };
        
      case "proveedores":
        let proveedoresQuery = supabase.from('proveedores').select('*').eq('activo', true);
        
        const nombreProveedor = p.match(/(?:proveedor|empresa)\s+([a-záéíóúñ\s]+)/i);
        if (nombreProveedor && nombreProveedor[1]?.trim().length > 2) {
          proveedoresQuery = proveedoresQuery.ilike('nombre_empresa', `%${nombreProveedor[1].trim()}%`);
        }
        
        const { data: proveedores } = await proveedoresQuery.limit(limit);
        return { tipo: "proveedores", datos: proveedores, total: proveedores?.length || 0 };
        
      case "tareas":
        let tareasQuery = supabase.from('tareas').select('*');
        
        if (p.includes('pendiente')) tareasQuery = tareasQuery.eq('estado', 'pendiente');
        if (p.includes('completada')) tareasQuery = tareasQuery.eq('estado', 'completada');
        if (p.includes('alta')) tareasQuery = tareasQuery.eq('prioridad', 'alta');
        
        const { data: tareas } = await tareasQuery.order('created_at', { ascending: false }).limit(limit);
        return { tipo: "tareas", datos: tareas, total: tareas?.length || 0 };
        
      case "perfiles":
        let perfilesQuery = supabase.from('perfiles').select('*');
        
        if (p.includes('administrador') || p.includes('admin')) {
          perfilesQuery = perfilesQuery.in('rol', ['admin', 'superuser']);
        }
        
        const { data: perfiles } = await perfilesQuery.limit(limit);
        return { tipo: "usuarios", datos: perfiles, total: perfiles?.length || 0 };
        
      case "dispositivos":
        let dispositivosQuery = supabase.from('dispositivos').select('*');
        
        if (p.includes('disponible')) dispositivosQuery = dispositivosQuery.eq('estado', 'operativo');
        if (p.includes('asignado')) dispositivosQuery = dispositivosQuery.not('asignado_a', 'is', null);
        
        const { data: dispositivos } = await dispositivosQuery.limit(limit);
        return { tipo: "dispositivos", datos: dispositivos, total: dispositivos?.length || 0 };
        
      case "mensajes":
        const { data: mensajes } = await supabase
          .from('mensajes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        return { tipo: "mensajes", datos: mensajes, total: mensajes?.length || 0 };
        
      case "analisis_competencia":
        const { data: competencia } = await supabase
          .from('analisis_competencia')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        return { tipo: "competencia", datos: competencia, total: competencia?.length || 0 };
        
      default:
        const stats: Record<string, number> = {};
        const tablas = ['productos_obuma', 'clientes_obuma', 'proveedores', 'tareas', 'perfiles', 'dispositivos', 'mensajes'];
        
        for (const tabla of tablas) {
          const { count } = await supabase.from(tabla).select('*', { count: 'exact', head: true });
          stats[tabla] = count || 0;
        }
        
        return { tipo: "estadisticas", datos: stats, total: Object.keys(stats).length };
    }
  } catch (error) {
    console.error(`Error obteniendo datos de ${intencion}:`, error);
    return { tipo: intencion, datos: [], total: 0, error: true };
  }
}

// Función para contar productos
function buscarEnProductos(pregunta: string, productos: Producto[]) {
  const preguntaLower = pregunta.toLowerCase();
  
  const palabrasComunes: string[] = [
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'de', 'del', 
    'para', 'por', 'con', 'sin', 'sobre', 'entre', 'hasta', 'desde', 'durante', 
    'según', 'mediante', 'vs', 'contra', 'tiene', 'buscar', 'encuentra', 'dame', 
    'muestra', 'listame', 'quiero', 'necesito', 'producto', 'productos'
  ];
  
  const palabrasClave: string[] = preguntaLower
    .split(' ')
    .filter((p: string) => p.length > 2 && !palabrasComunes.includes(p))
    .map((p: string) => p.trim());
  
  const esFraseExacta: boolean = preguntaLower.length > 10 && palabrasClave.length <= 2;
  const esBusquedaSKU: boolean = /\d{7,}/.test(pregunta);
  
  let productosFiltrados: Producto[] = [...productos];
  let criterioBusqueda: string = '';
  
  if (esBusquedaSKU) {
    const skuBuscado: string | undefined = pregunta.match(/\d{7,}/)?.[0];
    if (skuBuscado) {
      productosFiltrados = productosFiltrados.filter((p: Producto) => p.sku === skuBuscado);
      criterioBusqueda = `SKU exacto: ${skuBuscado}`;
    }
  }
  
  if (productosFiltrados.length === productos.length && !esBusquedaSKU) {
    const coincidenciaExacta: Producto[] = productosFiltrados.filter((p: Producto) => 
      p.nombre.toLowerCase() === preguntaLower
    );
    
    if (coincidenciaExacta.length > 0) {
      productosFiltrados = coincidenciaExacta;
      criterioBusqueda = `nombre exacto: "${pregunta}"`;
    }
  }
  
  if (productosFiltrados.length === productos.length && !esBusquedaSKU) {
    if (esFraseExacta) {
      productosFiltrados = productosFiltrados.filter((p: Producto) => 
        p.nombre.toLowerCase().includes(preguntaLower)
      );
      criterioBusqueda = `frase: "${pregunta}"`;
    } else if (palabrasClave.length > 0) {
      productosFiltrados = productosFiltrados.filter((p: Producto) => {
        const textoBusqueda: string = `${p.nombre} ${p.sku} ${p.categoria || ''}`.toLowerCase();
        return palabrasClave.every((palabra: string) => textoBusqueda.includes(palabra));
      });
      criterioBusqueda = `palabras clave: ${palabrasClave.join(', ')}`;
    }
  }
  
  return { productosFiltrados, criterioBusqueda };
}

export async function POST(req: Request) {
  try {
    const { pregunta, contexto } = await req.json();
    
    if (!pregunta || pregunta.trim() === "") {
      return NextResponse.json({ error: "La pregunta no puede estar vacía" }, { status: 400 });
    }

    const productosObuma: Producto[] = contexto?.productos || [];
    
    const intencion = detectarIntencion(pregunta);
    const datosDB = await obtenerDatosPorIntencion(intencion, pregunta);
    
    let productosFiltrados: Producto[] = [];
    let criterioBusqueda = '';
    
    if (intencion === "productos_obuma" || intencion === "general") {
      const resultado = buscarEnProductos(pregunta, productosObuma);
      productosFiltrados = resultado.productosFiltrados;
      criterioBusqueda = resultado.criterioBusqueda;
    }
    
    const resultadosMostrar = productosFiltrados.slice(0, 20);
    const hayMasResultados = productosFiltrados.length > 20;
    
    const totalStock = productosObuma.reduce((sum, p) => sum + (p.stock || 0), 0);
    const valorInventario = productosObuma.reduce((sum, p) => sum + ((p.precio || 0) * (p.stock || 0)), 0);
    
    let systemPrompt = `Eres un asistente inteligente que conoce TODA la base de datos de la empresa.

📊 ESQUEMA DE LA BASE DE DATOS:
${JSON.stringify(databaseSchema, null, 2)}

🗣️ LA PREGUNTA DEL USUARIO ES: "${pregunta}"
🔍 INTENCIÓN DETECTADA: ${intencion}

REGLAS IMPORTANTES:
1. Responde SIEMPRE en español, de forma natural y conversacional
2. Si te preguntan por cantidades, da números exactos
3. Si te preguntan por listados, muéstralos ordenados y con formato claro
4. Puedes consultar productos, clientes, proveedores, tareas, usuarios, dispositivos, mensajes
5. Si no encuentras información, di honestamente que no la tienes

DATOS OBTENIDOS DE LA BASE DE DATOS:
- Tipo de datos: ${datosDB.tipo}
- Total encontrado: ${datosDB.total}
- Datos: ${JSON.stringify(datosDB.datos, null, 2)}`;

    if (productosObuma.length > 0) {
      systemPrompt += `\n\n📊 ESTADÍSTICAS DE PRODUCTOS:
- Total productos: ${productosObuma.length}
- Stock total: ${totalStock} unidades
- Valor inventario: $${valorInventario.toLocaleString('es-CL')} CLP`;
    }

    if (resultadosMostrar.length > 0) {
      systemPrompt += `\n\n🎯 PRODUCTOS ENCONTRADOS EN LA BÚSQUEDA (${resultadosMostrar.length}):
${JSON.stringify(resultadosMostrar, null, 2)}`;
      
      if (hayMasResultados) {
        systemPrompt += `\n... y ${productosFiltrados.length - 20} productos más.`;
      }
    }

    const result = await callDeepSeek([
      { role: "system", content: systemPrompt },
      { role: "user", content: pregunta }
    ], 0.3, 1000);

    if (result.error) {
      return NextResponse.json({ 
        respuesta: "⚠️ Error técnico. Intenta nuevamente.",
        error: result.error 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      respuesta: result.content,
      timestamp: new Date().toISOString(),
      intencion: intencion,
      productos_encontrados: resultadosMostrar.length,
      datos_consultados: datosDB.tipo,
      total_encontrado: datosDB.total
    });
    
  } catch (error: any) {
    console.error("Error en chat:", error);
    return NextResponse.json(
      { respuesta: "⚠️ Error procesando la pregunta. Intenta nuevamente." },
      { status: 500 }
    );
  }
}