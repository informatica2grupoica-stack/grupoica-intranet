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
  proveedoresTotal?: number;
  tareasTotal?: number;
  dispositivosTotal?: number;
  usuariosTotal?: number;
  mensajesTotal?: number;
}

// Esquema completo de la base de datos
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
      keywords: ["tarea", "tareas", "pendiente", "asignada", "prioridad"]
    },
    perfiles: {
      descripcion: "Usuarios del sistema",
      campos: ["nombre", "apellido", "email", "rol", "cargo"],
      keywords: ["usuario", "usuarios", "administrador", "admin", "perfil"]
    },
    dispositivos: {
      descripcion: "Equipos y dispositivos",
      campos: ["nombre_equipo", "tipo", "marca", "modelo", "estado", "asignado_a"],
      keywords: ["dispositivo", "equipo", "computador", "notebook", "pc", "teléfono"]
    },
    mensajes: {
      descripcion: "Mensajes internos",
      campos: ["contenido", "emisor_id", "receptor_id", "leido", "created_at"],
      keywords: ["mensaje", "mensajes", "conversación", "chat"]
    },
    chatbot_historial: {
      descripcion: "Historial de conversaciones",
      campos: ["pregunta", "respuesta", "created_at"],
      keywords: ["historial", "conversación anterior"]
    },
    analisis_competencia: {
      descripcion: "Análisis de precios de la competencia",
      campos: ["termino_busqueda", "nombre_producto_tienda", "precio_num"],
      keywords: ["competencia", "precio competencia"]
    },
    registros_precios: {
      descripcion: "Historial de precios",
      campos: ["nombre_producto", "tienda", "precio_valor", "fecha"],
      keywords: ["historial precio", "evolución precio"]
    },
    ia_aprendizaje: {
      descripcion: "Aprendizaje de IA para SKUs",
      campos: ["producto_nombre", "sku_generado", "c1", "c2", "c3", "c4"],
      keywords: ["aprendizaje", "sugerencia", "patrón"]
    },
    comentarios_tareas: {
      descripcion: "Comentarios en tareas",
      campos: ["contenido", "created_at"],
      keywords: ["comentario", "comentarios"]
    }
  }
};

// Función para normalizar texto (quitar tildes, mayúsculas)
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Función para buscar productos en Supabase (BÚSQUEDA INTELIGENTE)
async function buscarProductosEnSupabase(termino: string, limit: number = 20): Promise<Producto[]> {
  console.log(`🔍 Búsqueda inteligente - Término original: "${termino}"`);
  
  try {
    const terminoNormalizado = normalizarTexto(termino);
    console.log(`📝 Término normalizado: "${terminoNormalizado}"`);
    
    // Dividir en palabras clave para búsqueda más flexible
    const palabrasClave = terminoNormalizado.split(/\s+/).filter(p => p.length > 2);
    console.log(`🔑 Palabras clave: ${palabrasClave.join(', ')}`);
    
    // Primero, obtener todos los productos activos
    let query = supabase
      .from('productos_obuma')
      .select('nombre, sku, precio_total, stock_actual, categoria_nombre')
      .eq('activo', true);
    
    const { data: todosProductos, error: errorProductos } = await query;
    
    if (errorProductos) {
      console.error(`❌ Error obteniendo productos:`, errorProductos);
      return [];
    }
    
    if (!todosProductos || todosProductos.length === 0) {
      console.log(`⚠️ No hay productos en la base de datos`);
      return [];
    }
    
    console.log(`📊 Total productos en BD: ${todosProductos.length}`);
    
    // Búsqueda inteligente por SKU exacto (prioridad máxima)
    const esSKU = /^\d{7,}$/.test(terminoNormalizado);
    if (esSKU) {
      const producto = todosProductos.find(p => p.sku === terminoNormalizado);
      if (producto) {
        console.log(`✅ Encontrado por SKU exacto: "${producto.nombre}"`);
        return [{
          nombre: producto.nombre,
          sku: producto.sku,
          precio: producto.precio_total || 0,
          stock: producto.stock_actual || 0,
          categoria: producto.categoria_nombre || ''
        }];
      }
    }
    
    // Búsqueda por coincidencia de palabras clave
    const resultados = todosProductos.filter(producto => {
      const nombreNormalizado = normalizarTexto(producto.nombre);
      
      // Coincidencia exacta (prioridad alta)
      if (nombreNormalizado === terminoNormalizado) {
        return true;
      }
      
      // Coincidencia por palabras clave (todas las palabras deben coincidir)
      if (palabrasClave.length > 0) {
        return palabrasClave.every(palabra => nombreNormalizado.includes(palabra));
      }
      
      // Coincidencia parcial
      return nombreNormalizado.includes(terminoNormalizado);
    });
    
    console.log(`✅ Resultados encontrados: ${resultados.length}`);
    
    if (resultados.length > 0) {
      resultados.slice(0, 5).forEach((p, idx) => {
        console.log(`   ${idx+1}. "${p.nombre}" - SKU: ${p.sku}`);
      });
    }
    
    return resultados.slice(0, limit).map((p: any) => ({
      nombre: p.nombre || '',
      sku: p.sku || '',
      precio: p.precio_total || 0,
      stock: p.stock_actual || 0,
      categoria: p.categoria_nombre || ''
    }));
    
  } catch (error) {
    console.error("❌ Error en búsqueda inteligente:", error);
    return [];
  }
}

// Función para obtener estadísticas completas
async function obtenerEstadisticasCompletas(): Promise<any> {
  const { count: productosCount } = await supabase
    .from('productos_obuma')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 Total productos en Supabase: ${productosCount || 0}`);
  
  const [clientes, proveedores, tareas, dispositivos, perfiles, mensajes] = await Promise.all([
    supabase.from('clientes_obuma').select('*', { count: 'exact', head: true }),
    supabase.from('proveedores').select('*', { count: 'exact', head: true }),
    supabase.from('tareas').select('*', { count: 'exact', head: true }),
    supabase.from('dispositivos').select('*', { count: 'exact', head: true }),
    supabase.from('perfiles').select('*', { count: 'exact', head: true }),
    supabase.from('mensajes').select('*', { count: 'exact', head: true })
  ]);
  
  return {
    productos: productosCount || 0,
    clientes: clientes.count || 0,
    proveedores: proveedores.count || 0,
    tareas: tareas.count || 0,
    dispositivos: dispositivos.count || 0,
    usuarios: perfiles.count || 0,
    mensajes: mensajes.count || 0
  };
}

// Función para detectar intención del usuario
function detectarIntencion(pregunta: string): string {
  const p = pregunta.toLowerCase();
  
  const mapas = [
    { tabla: "clientes_obuma", palabras: ["cliente", "clientes", "empresa", "rut", "razon social", "envapol", "brigada", "municipalidad"] },
    { tabla: "productos_obuma", palabras: ["producto", "inventario", "stock", "precio", "sku", "catalogo"] },
    { tabla: "proveedores", palabras: ["proveedor", "proveedores"] },
    { tabla: "proveedores_transporte", palabras: ["transporte", "camión", "flete", "logística"] },
    { tabla: "tareas", palabras: ["tarea", "tareas", "pendiente", "asignada"] },
    { tabla: "perfiles", palabras: ["usuario", "usuarios", "administrador", "admin"] },
    { tabla: "dispositivos", palabras: ["dispositivo", "equipo", "computador", "notebook", "pc"] },
    { tabla: "mensajes", palabras: ["mensaje", "mensajes", "conversación", "chat"] },
    { tabla: "analisis_competencia", palabras: ["competencia", "precio competencia"] },
    { tabla: "registros_precios", palabras: ["historial precio", "evolución precio"] }
  ];
  
  for (const mapa of mapas) {
    if (mapa.palabras.some(palabra => p.includes(palabra))) {
      return mapa.tabla;
    }
  }
  return "general";
}

// Función para obtener datos según la intención
async function obtenerDatosPorIntencion(intencion: string, pregunta: string, limit: number = 20): Promise<DatosResponse> {
  const p = pregunta.toLowerCase();
  
  try {
    switch (intencion) {
      case "productos_obuma": {
        let termino = '';
        
        if (p.match(/^(busca|encuentra|dame|muestra|listame|ver)\s+/)) {
          termino = p.replace(/^(busca|encuentra|dame|muestra|listame|ver)\s+/, '').trim();
        } else {
          termino = p
            .replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '')
            .replace(/producto|productos|inventario|stock|precio|sku|catalogo|tienes|hay|algún|alguna/gi, '')
            .replace(/de|del|para|por|con|sin|sobre|entre/gi, '')
            .trim();
        }
        
        if (!termino || termino.length < 3) {
          const { count } = await supabase
            .from('productos_obuma')
            .select('*', { count: 'exact', head: true });
          return { tipo: "productos", datos: [], total: count || 0, esPreguntaGeneral: true };
        }
        
        console.log(`🔍 Buscando producto: "${termino}"`);
        
        const productos = await buscarProductosEnSupabase(termino, limit);
        
        if (productos.length > 0) {
          return { 
            tipo: "productos", 
            datos: productos, 
            total: productos.length,
            fuente: "Supabase"
          };
        }
        
        const { count } = await supabase
          .from('productos_obuma')
          .select('*', { count: 'exact', head: true });
        
        return { 
          tipo: "productos", 
          datos: [], 
          total: count || 0, 
          noEncontrado: true, 
          termino 
        };
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
      
      case "proveedores": {
        const { count } = await supabase.from('proveedores').select('*', { count: 'exact', head: true });
        const { data } = await supabase
          .from('proveedores')
          .select('nombre_empresa, categoria, email_contacto, telefono, calificacion')
          .eq('activo', true)
          .limit(limit);
        return { tipo: "proveedores", datos: data || [], total: count || 0 };
      }
      
      case "tareas": {
        const { count } = await supabase.from('tareas').select('*', { count: 'exact', head: true });
        
        let query = supabase
          .from('tareas')
          .select(`
            titulo,
            descripcion,
            prioridad,
            estado,
            fecha_limite,
            fecha_inicio,
            proyecto,
            creado_por,
            asignado_a,
            responsable:perfiles!tareas_asignado_a_fkey(
              nombre,
              apellido
            )
          `);
        
        if (p.includes('pendiente')) query = query.eq('estado', 'pendiente');
        if (p.includes('en proceso') || p.includes('en_proceso')) query = query.eq('estado', 'en_proceso');
        if (p.includes('completada')) query = query.eq('estado', 'completada');
        if (p.includes('alta')) query = query.eq('prioridad', 'alta');
        if (p.includes('baja')) query = query.eq('prioridad', 'baja');
        
        const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
        
        if (error) {
          console.error("Error en consulta de tareas:", error);
          return { tipo: "tareas", datos: [], total: count || 0, error: true };
        }
        
        const tareasFormateadas = (data || []).map((t: any) => ({
          titulo: t.titulo,
          descripcion: t.descripcion,
          prioridad: t.prioridad,
          estado: t.estado,
          fecha_limite: t.fecha_limite,
          fecha_inicio: t.fecha_inicio,
          proyecto: t.proyecto || 'Sin proyecto',
          responsable: t.responsable ? `${t.responsable.nombre} ${t.responsable.apellido}` : 'No asignado'
        }));
        
        return { tipo: "tareas", datos: tareasFormateadas, total: count || 0 };
      }
      
      case "perfiles": {
        const { count } = await supabase.from('perfiles').select('*', { count: 'exact', head: true });
        let query = supabase.from('perfiles').select('nombre, apellido, email, rol, cargo, activo');
        if (p.includes('admin') || p.includes('administrador')) {
          query = query.in('rol', ['admin', 'superuser']);
        }
        if (p.includes('activo')) query = query.eq('activo', true);
        const { data } = await query.limit(limit);
        return { tipo: "usuarios", datos: data || [], total: count || 0 };
      }
      
      case "dispositivos": {
        const { count } = await supabase.from('dispositivos').select('*', { count: 'exact', head: true });
        let query = supabase.from('dispositivos').select('nombre_equipo, tipo, marca, modelo, estado, asignado_a');
        if (p.includes('disponible')) query = query.eq('estado', 'operativo');
        if (p.includes('asignado')) query = query.not('asignado_a', 'is', null);
        const { data } = await query.limit(limit);
        return { tipo: "dispositivos", datos: data || [], total: count || 0 };
      }
      
      case "mensajes": {
        const { count } = await supabase.from('mensajes').select('*', { count: 'exact', head: true });
        let query = supabase.from('mensajes').select('contenido, leido, created_at, emisor_id, receptor_id');
        if (p.includes('no leído') || p.includes('no leidos')) query = query.eq('leido', false);
        const { data } = await query.order('created_at', { ascending: false }).limit(limit);
        return { tipo: "mensajes", datos: data || [], total: count || 0 };
      }
      
      case "proveedores_transporte": {
        const { count } = await supabase.from('proveedores_transporte').select('*', { count: 'exact', head: true });
        const { data } = await supabase.from('proveedores_transporte').select('nombre, tipo, correo, direccion').limit(limit);
        return { tipo: "transporte", datos: data || [], total: count || 0 };
      }
      
      case "analisis_competencia": {
        const { count } = await supabase.from('analisis_competencia').select('*', { count: 'exact', head: true });
        const { data } = await supabase.from('analisis_competencia').select('termino_busqueda, nombre_producto_tienda, precio_num, tienda_url').limit(limit);
        return { tipo: "competencia", datos: data || [], total: count || 0 };
      }
      
      case "registros_precios": {
        const { count } = await supabase.from('registros_precios').select('*', { count: 'exact', head: true });
        const { data } = await supabase.from('registros_precios').select('nombre_producto, tienda, precio_valor, fecha').limit(limit);
        return { tipo: "precios", datos: data || [], total: count || 0 };
      }
        
      default: {
        const stats = await obtenerEstadisticasCompletas();
        return { 
          tipo: "estadisticas", 
          datos: [], 
          total: 7,
          productosTotal: stats.productos,
          clientesTotal: stats.clientes,
          proveedoresTotal: stats.proveedores,
          tareasTotal: stats.tareas,
          dispositivosTotal: stats.dispositivos,
          usuariosTotal: stats.usuarios,
          mensajesTotal: stats.mensajes
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
    
    let systemPrompt = `Eres "Asistente Obuma", un asistente inteligente que conoce TODA la base de datos de la empresa.

📊 ESQUEMA COMPLETO DE LA BASE DE DATOS:
${JSON.stringify(databaseSchema, null, 2)}

🎯 PREGUNTA DEL USUARIO: "${pregunta}"
🔍 INTENCIÓN DETECTADA: ${intencion}`;

    if (datosDB.tipo === "productos" && datosDB.datos && datosDB.datos.length > 0) {
      systemPrompt += `\n\n📦 PRODUCTOS REALES ENCONTRADOS EN SUPABASE (${datosDB.total} resultados):
${JSON.stringify(datosDB.datos, null, 2)}

⚠️ REGLA ESTRICTA: Estos son los ÚNICOS productos que existen en la base de datos.
NO INVENTES NINGÚN PRODUCTO. Si el usuario pregunta por un producto que no está en esta lista, responde que no existe.
NO uses ejemplos como "producto de prueba" a menos que estén explícitamente en esta lista.`;
    }
    else if (datosDB.tipo === "productos" && datosDB.noEncontrado) {
      systemPrompt += `\n\n❌ **NO SE ENCONTRARON PRODUCTOS EN LA BASE DE DATOS**

La búsqueda del producto "${datosDB.termino}" no arrojó resultados en la tabla productos_obuma.

⚠️ **REGLAS ESTRICTAS:**
1. NO inventes productos falsos
2. NO uses SKU inventados
3. Responde EXACTAMENTE: "No encontré el producto '${datosDB.termino}' en nuestra base de datos. Tenemos ${datosDB.total} productos en total. ¿Quieres que busque por otra palabra o SKU?"`;
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
    else if (datosDB.datos && datosDB.datos.length > 0) {
      systemPrompt += `\n\n📋 DATOS ENCONTRADOS (${datosDB.tipo}):
${JSON.stringify(datosDB.datos, null, 2)}`;
    }
    else if (datosDB.tipo === "estadisticas") {
      systemPrompt += `\n\n📊 ESTADÍSTICAS COMPLETAS:
- 📦 Productos: ${datosDB.productosTotal || 0}
- 👥 Clientes: ${datosDB.clientesTotal || 0}
- 🏢 Proveedores: ${datosDB.proveedoresTotal || 0}
- ✅ Tareas: ${datosDB.tareasTotal || 0}
- 💻 Dispositivos: ${datosDB.dispositivosTotal || 0}
- 👤 Usuarios: ${datosDB.usuariosTotal || 0}
- 💬 Mensajes: ${datosDB.mensajesTotal || 0}`;
    }

    systemPrompt += `\n\n🎨 REGLAS DE RESPUESTA:
1. Responde en español, de forma natural, amable y conversacional
2. Usa los datos REALES que se te proporcionan - NUNCA inventes información
3. Si no hay datos en la lista que se te proporcionó, NO INVENTES NADA
4. Usa emojis para hacer la conversación más amigable (📦 para productos, 👥 para clientes, ✅ para tareas, 💻 para dispositivos)
5. Si muestras listados, usa • o ✅ al inicio de cada línea
6. Destaca información importante con **negritas**
7. Si no hay datos, dilo honestamente y ofrece ayuda`;

    const result = await callDeepSeek([
      { role: "system", content: systemPrompt },
      { role: "user", content: pregunta }
    ], 0.2, 600);

    if (result.error) {
      return NextResponse.json({ 
        respuesta: "🔌 Lo siento, tuve un problema de conexión. ¿Puedes intentarlo de nuevo?",
        error: result.error 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      respuesta: result.content,
      timestamp: new Date().toISOString(),
      intencion,
      total_encontrado: datosDB.datos?.length || 0
    });
    
  } catch (error: any) {
    console.error("Error en chat:", error);
    return NextResponse.json(
      { respuesta: "🔌 Ups, algo salió mal. Por favor, intenta nuevamente." },
      { status: 500 }
    );
  }
}