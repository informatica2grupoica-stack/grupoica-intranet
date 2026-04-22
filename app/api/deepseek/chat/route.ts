// app/api/deepseek/chat/route.ts
import { NextResponse } from 'next/server';
import { callDeepSeek } from '@/app/lib/deepseek/client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// INTERFACES
// ============================================
interface Producto {
  nombre: string;
  sku: string;
  precio: number;
  stock: number;
  categoria?: string;
}

// ============================================
// ESQUEMA COMPLETO DE LA BASE DE DATOS
// ============================================
const databaseSchema = {
  tablas: {
    productos_obuma: {
      descripcion: "Productos del inventario (desde Obuma)",
      campos: ["nombre", "sku", "precio_total", "stock_actual", "categoria_nombre"],
      keywords: ["producto", "inventario", "stock", "precio", "sku"]
    },
    clientes_obuma: {
      descripcion: "Clientes de la empresa",
      campos: ["razon_social", "rut", "email", "telefono", "estado", "total_contactos"],
      keywords: ["cliente", "clientes", "empresa", "rut", "razón social"]
    },
    proveedores: {
      descripcion: "Proveedores de la empresa",
      campos: ["nombre_empresa", "rut_empresa", "categoria", "email_contacto", "telefono"],
      keywords: ["proveedor", "proveedores", "empresa"]
    },
    proveedores_transporte: {
      descripcion: "Proveedores de servicios de transporte",
      campos: ["nombre", "tipo", "correo", "direccion"],
      keywords: ["transporte", "camión", "flete", "logística"]
    },
    tareas: {
      descripcion: "Tareas y actividades del equipo",
      campos: ["titulo", "prioridad", "estado", "asignado_a", "fecha_limite"],
      keywords: ["tarea", "tareas", "pendiente", "asignada", "prioridad"]
    },
    perfiles: {
      descripcion: "Usuarios del sistema",
      campos: ["nombre", "apellido", "email", "rol", "cargo"],
      keywords: ["usuario", "usuarios", "administrador", "admin"]
    },
    dispositivos: {
      descripcion: "Equipos y dispositivos",
      campos: ["nombre_equipo", "tipo", "marca", "modelo", "estado"],
      keywords: ["dispositivo", "equipo", "computador", "notebook", "pc"]
    },
    mensajes: {
      descripcion: "Mensajes internos entre usuarios",
      campos: ["contenido", "emisor_id", "receptor_id", "leido"],
      keywords: ["mensaje", "mensajes", "conversación", "chat"]
    },
    analisis_competencia: {
      descripcion: "Análisis de precios de la competencia",
      campos: ["termino_busqueda", "nombre_producto_tienda", "precio_num"],
      keywords: ["competencia", "precio competencia", "mercado"]
    },
    registros_precios: {
      descripcion: "Historial de precios de productos",
      campos: ["nombre_producto", "tienda", "precio_valor", "fecha"],
      keywords: ["historial precio", "evolución precio"]
    },
    chatbot_historial: {
      descripcion: "Historial de conversaciones",
      campos: ["pregunta", "respuesta", "created_at"],
      keywords: ["historial", "conversación anterior"]
    }
  }
};

// ============================================
// DETECCIÓN DE INTENCIÓN MEJORADA
// ============================================
function detectarIntencion(pregunta: string): { tabla: string; filtro: string; esPreguntaGeneral: boolean } {
  const p = pregunta.toLowerCase();
  
  // Patrones de búsqueda
  const patrones = [
    { tabla: "clientes_obuma", palabras: ["cliente", "clientes", "empresa", "rut", "razón social"] },
    { tabla: "productos_obuma", palabras: ["producto", "inventario", "stock", "precio", "sku", "catalogo"] },
    { tabla: "proveedores", palabras: ["proveedor", "proveedores"] },
    { tabla: "proveedores_transporte", palabras: ["transporte", "camión", "flete", "logística"] },
    { tabla: "tareas", palabras: ["tarea", "tareas", "pendiente", "asignada"] },
    { tabla: "perfiles", palabras: ["usuario", "usuarios", "administrador", "admin"] },
    { tabla: "dispositivos", palabras: ["dispositivo", "equipo", "computador", "notebook", "pc"] },
    { tabla: "mensajes", palabras: ["mensaje", "mensajes", "conversación"] },
    { tabla: "analisis_competencia", palabras: ["competencia", "precio competencia"] },
    { tabla: "registros_precios", palabras: ["historial precio", "evolución precio"] }
  ];
  
  // Extraer posible término de búsqueda
  let filtro = "";
  const matchBusqueda = p.match(/(?:busca|encuentra|dame|muestra|listame)\s+([a-záéíóúñ\s]+)/i);
  if (matchBusqueda && matchBusqueda[1]) {
    filtro = matchBusqueda[1].trim();
  }
  
  // Detectar tabla
  for (const patron of patrones) {
    if (patron.palabras.some(palabra => p.includes(palabra))) {
      return { tabla: patron.tabla, filtro, esPreguntaGeneral: false };
    }
  }
  
  return { tabla: "general", filtro, esPreguntaGeneral: true };
}

// ============================================
// OBTENER DATOS DE SUPABASE (RÁPIDO)
// ============================================
async function obtenerDatos(intencion: string, filtro: string, limit: number = 20) {
  const startTime = Date.now();
  
  try {
    switch (intencion) {
      case "clientes_obuma":
        let query = supabase.from('clientes_obuma').select('razon_social, rut, email, telefono, estado').eq('estado', true);
        if (filtro) query = query.ilike('razon_social', `%${filtro}%`);
        const { data: clientes } = await query.limit(limit);
        return { datos: clientes || [], total: clientes?.length || 0, tiempo: Date.now() - startTime };
        
      case "productos_obuma":
        let prodQuery = supabase.from('productos_obuma').select('nombre, sku, precio_total, stock_actual, categoria_nombre').eq('activo', true);
        if (filtro) prodQuery = prodQuery.ilike('nombre', `%${filtro}%`);
        const { data: productos } = await prodQuery.limit(limit);
        return { datos: productos || [], total: productos?.length || 0, tiempo: Date.now() - startTime };
        
      case "proveedores":
        const { data: proveedores } = await supabase
          .from('proveedores')
          .select('nombre_empresa, categoria, email_contacto, telefono')
          .eq('activo', true)
          .limit(limit);
        return { datos: proveedores || [], total: proveedores?.length || 0, tiempo: Date.now() - startTime };
        
      case "tareas":
        let tareasQuery = supabase.from('tareas').select('titulo, prioridad, estado, fecha_limite');
        if (filtro?.includes('pendiente')) tareasQuery = tareasQuery.eq('estado', 'pendiente');
        const { data: tareas } = await tareasQuery.order('created_at', { ascending: false }).limit(limit);
        return { datos: tareas || [], total: tareas?.length || 0, tiempo: Date.now() - startTime };
        
      case "perfiles":
        let perfilesQuery = supabase.from('perfiles').select('nombre, apellido, email, rol');
        if (filtro?.includes('admin')) perfilesQuery = perfilesQuery.in('rol', ['admin', 'superuser']);
        const { data: perfiles } = await perfilesQuery.limit(limit);
        return { datos: perfiles || [], total: perfiles?.length || 0, tiempo: Date.now() - startTime };
        
      case "dispositivos":
        const { data: dispositivos } = await supabase
          .from('dispositivos')
          .select('nombre_equipo, tipo, marca, estado')
          .limit(limit);
        return { datos: dispositivos || [], total: dispositivos?.length || 0, tiempo: Date.now() - startTime };
        
      default:
        // Estadísticas generales (rápido, solo conteos)
        const tablas = ['productos_obuma', 'clientes_obuma', 'proveedores', 'tareas', 'perfiles', 'dispositivos'];
        const stats: Record<string, number> = {};
        for (const tabla of tablas) {
          const { count } = await supabase.from(tabla).select('*', { count: 'exact', head: true });
          stats[tabla] = count || 0;
        }
        return { datos: stats, total: Object.keys(stats).length, tiempo: Date.now() - startTime };
    }
  } catch (error) {
    console.error(`Error en ${intencion}:`, error);
    return { datos: [], total: 0, tiempo: 0, error: true };
  }
}

// ============================================
// BÚSQUEDA EN PRODUCTOS (RÁPIDA)
// ============================================
function buscarEnProductos(pregunta: string, productos: Producto[]): { resultados: Producto[]; total: number } {
  const preguntaLower = pregunta.toLowerCase();
  const esBusquedaSKU = /\d{7,}/.test(pregunta);
  
  if (esBusquedaSKU) {
    const sku = pregunta.match(/\d{7,}/)?.[0];
    if (sku) {
      const encontrado = productos.filter(p => p.sku === sku);
      return { resultados: encontrado.slice(0, 10), total: encontrado.length };
    }
  }
  
  const palabrasClave = preguntaLower
    .split(' ')
    .filter(p => p.length > 2 && !['el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'de', 'del', 'para', 'por', 'con', 'sin', 'tiene', 'buscar', 'encuentra', 'dame', 'muestra', 'listame', 'quiero', 'necesito', 'producto', 'productos'].includes(p));
  
  if (palabrasClave.length === 0) {
    return { resultados: productos.slice(0, 10), total: productos.length };
  }
  
  const resultados = productos.filter(p => {
    const texto = `${p.nombre} ${p.sku} ${p.categoria || ''}`.toLowerCase();
    return palabrasClave.every(palabra => texto.includes(palabra));
  });
  
  return { resultados: resultados.slice(0, 15), total: resultados.length };
}

// ============================================
// PROMPT CONVERSACIONAL PROFESIONAL
// ============================================
function construirPrompt(pregunta: string, intencion: string, datos: any, productos: Producto[], productosEncontrados: Producto[]) {
  const statsGenerales = `📊 **Resumen del sistema:**
• Productos: ${productos.length} | Stock total: ${productos.reduce((s, p) => s + (p.stock || 0), 0)} | Valor: $${productos.reduce((s, p) => s + ((p.precio || 0) * (p.stock || 0)), 0).toLocaleString('es-CL')}
• Clientes: ${datos.total > 0 ? datos.total : 'consultar'}
• Proveedores, tareas y más disponible`;

  const datosPrompt = datos.datos && datos.total > 0 
    ? `📦 **Información encontrada (${datos.total} registros):**
${JSON.stringify(datos.datos.slice(0, 10), null, 2)}`
    : `ℹ️ No se encontraron registros específicos para esta consulta.`;

  const productosPrompt = productosEncontrados.length > 0
    ? `\n\n🎯 **Productos destacados (${productosEncontrados.length} coincidencias):**
${productosEncontrados.slice(0, 8).map(p => `• **${p.nombre}** - SKU: ${p.sku} - Stock: ${p.stock} - Precio: $${p.precio?.toLocaleString('es-CL')}`).join('\n')}`
    : '';

  return `Eres "Asistente Obuma", un asistente conversacional experto y amable.

🎯 **Pregunta del usuario:** "${pregunta}"
🔍 **Intención detectada:** ${intencion}

${statsGenerales}

${datosPrompt}
${productosPrompt}

🎨 **REGLAS DE RESPUESTA (IMPORTANTE):**
1. Responde como una persona amable, natural y cercana
2. Usa emojis para hacer la conversación más amigable (📦, 👥, ✅, 🔍, 💰, etc.)
3. Si te preguntan por cantidades, da el número exacto con emoji
4. Si muestras listados, usa • o ✅ al inicio de cada línea
5. Destaca información importante con **negritas**
6. Si no encuentras algo, dilo con honestidad y ofrece ayuda alternativa
7. Al final, haz una pregunta de seguimiento relacionada

**EJEMPLO DE RESPUESTA IDEAL:**
"¡Hola! 👋 Según mi base de datos, tenemos **${productos.length} productos** en inventario. 📦

Los más destacados son:
• **Cable USB C** - SKU: 6026423727 - Stock: 50 unidades - Precio: $12.990
• **Monitor LED 24** - SKU: 6026423728 - Stock: 12 unidades - Precio: $189.990

¿Te gustaría que busque algún producto en específico o necesitas información sobre clientes? 🔍"`;
}

// ============================================
// ENDPOINT PRINCIPAL
// ============================================
export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const { pregunta, contexto } = await req.json();
    
    if (!pregunta || pregunta.trim() === "") {
      return NextResponse.json({ error: "La pregunta no puede estar vacía" }, { status: 400 });
    }

    // Datos base
    const productosObuma: Producto[] = contexto?.productos || [];
    
    // Detectar intención
    const { tabla: intencion, filtro } = detectarIntencion(pregunta);
    
    // Obtener datos según intención (paralelo)
    const datosDB = await obtenerDatos(intencion, filtro);
    
    // Búsqueda local en productos (rápida)
    const { resultados: productosEncontrados, total: totalProductosEncontrados } = buscarEnProductos(pregunta, productosObuma);
    
    // Construir prompt conversacional
    const systemPrompt = construirPrompt(pregunta, intencion, datosDB, productosObuma, productosEncontrados);
    
    // Llamar a DeepSeek
    const result = await callDeepSeek([
      { role: "system", content: systemPrompt },
      { role: "user", content: pregunta }
    ], 0.4, 800);

    if (result.error) {
      return NextResponse.json({ 
        respuesta: "🤖 Lo siento, tuve un pequeño problema técnico. ¿Puedes intentarlo de nuevo?",
        error: result.error 
      }, { status: 500 });
    }
    
    const duracion = Date.now() - startTime;
    console.log(`✅ Chat completado en ${duracion}ms | Intención: ${intencion} | Datos: ${datosDB.total} | Productos encontrados: ${totalProductosEncontrados}`);
    
    return NextResponse.json({ 
      respuesta: result.content,
      timestamp: new Date().toISOString(),
      duracion_ms: duracion,
      intencion,
      datos_consultados: datosDB.total,
      productos_encontrados: totalProductosEncontrados
    });
    
  } catch (error: any) {
    console.error("Error en chat:", error);
    return NextResponse.json(
      { respuesta: "🤖 Ups, algo salió mal. Por favor, intenta nuevamente." },
      { status: 500 }
    );
  }
}