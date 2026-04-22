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

// Función para buscar productos en Supabase (CON LOGS DETALLADOS)
async function buscarProductosEnSupabase(termino: string, limit: number = 20): Promise<Producto[]> {
  console.log("=========================================");
  console.log(`🔍 INICIO BÚSQUEDA - Término: "${termino}"`);
  console.log("=========================================");
  
  try {
    // 1. Verificar cuántos productos hay en total
    const { count: totalProductos, error: countError } = await supabase
      .from('productos_obuma')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 PASO 1: Total de productos en tabla productos_obuma: ${totalProductos || 0}`);
    
    if (countError) {
      console.error(`❌ Error al contar productos:`, countError);
    }
    
    // 2. Obtener una muestra de productos para verificar que hay datos
    const { data: muestra, error: muestraError } = await supabase
      .from('productos_obuma')
      .select('nombre, sku')
      .limit(5);
    
    if (muestraError) {
      console.error(`❌ Error al obtener muestra:`, muestraError);
    } else {
      console.log(`📋 PASO 2: Muestra de productos en BD:`);
      muestra?.forEach((p, idx) => {
        console.log(`   ${idx + 1}. "${p.nombre}" (SKU: ${p.sku})`);
      });
    }
    
    // 3. Construir consulta
    let query = supabase
      .from('productos_obuma')
      .select('nombre, sku, precio_total, stock_actual, categoria_nombre')
      .eq('activo', true);
    
    // 4. Determinar tipo de búsqueda
    const esSKU = /^\d{7,}$/.test(termino);
    console.log(`🔍 PASO 3: Tipo de búsqueda - esSKU: ${esSKU}`);
    
    if (esSKU) {
      console.log(`🔍 Buscando por SKU exacto: "${termino}"`);
      query = query.eq('sku', termino);
    } else {
      console.log(`🔍 Buscando por nombre que contenga: "${termino}"`);
      query = query.ilike('nombre', `%${termino}%`);
    }
    
    // 5. Ejecutar consulta
    const { data, error } = await query.limit(limit);
    
    if (error) {
      console.error(`❌ PASO 4: Error en consulta:`, error);
      return [];
    }
    
    console.log(`✅ PASO 4: Resultados encontrados: ${data?.length || 0}`);
    
    if (data && data.length > 0) {
      console.log(`📋 PASO 5: Detalle de resultados:`);
      data.forEach((p, idx) => {
        console.log(`   ${idx + 1}. "${p.nombre}" - SKU: ${p.sku} - Precio: ${p.precio_total} - Stock: ${p.stock_actual}`);
      });
    } else {
      console.log(`⚠️ PASO 5: No se encontraron productos para "${termino}"`);
      
      // Intentar búsqueda alternativa con término más corto
      const palabras = termino.split(' ');
      if (palabras.length > 1) {
        const palabraCorta = palabras[0];
        console.log(`🔄 Intentando búsqueda alternativa con: "${palabraCorta}"`);
        
        const { data: altData, error: altError } = await supabase
          .from('productos_obuma')
          .select('nombre, sku, precio_total, stock_actual, categoria_nombre')
          .eq('activo', true)
          .ilike('nombre', `%${palabraCorta}%`)
          .limit(limit);
        
        if (!altError && altData && altData.length > 0) {
          console.log(`✅ Búsqueda alternativa encontró ${altData.length} resultados`);
          return (altData || []).map((p: any) => ({
            nombre: p.nombre || '',
            sku: p.sku || '',
            precio: p.precio_total || 0,
            stock: p.stock_actual || 0,
            categoria: p.categoria_nombre || ''
          }));
        }
      }
    }
    
    console.log("=========================================");
    console.log(`🔍 FIN BÚSQUEDA`);
    console.log("=========================================");
    
    return (data || []).map((p: any) => ({
      nombre: p.nombre || '',
      sku: p.sku || '',
      precio: p.precio_total || 0,
      stock: p.stock_actual || 0,
      categoria: p.categoria_nombre || ''
    }));
    
  } catch (error) {
    console.error("❌ Error en buscarProductosEnSupabase:", error);
    return [];
  }
}

// Función para obtener estadísticas completas
async function obtenerEstadisticasCompletas(): Promise<any> {
  console.log("📊 Obteniendo estadísticas completas...");
  
  const { count: productosCount, error: productosError } = await supabase
    .from('productos_obuma')
    .select('*', { count: 'exact', head: true });
  
  if (productosError) {
    console.error("Error contando productos:", productosError);
  }
  
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
  
  console.log(`🎯 obtenerDatosPorIntencion - Intención: ${intencion}, Pregunta: "${pregunta}"`);
  
  try {
    switch (intencion) {
      case "productos_obuma": {
        console.log("📦 Procesando caso productos_obuma");
        
        let termino = '';
        
        if (p.match(/^(busca|encuentra|dame|muestra|listame|ver)\s+/)) {
          termino = p.replace(/^(busca|encuentra|dame|muestra|listame|ver)\s+/, '').trim();
          console.log(`📦 Término extraído (comando especial): "${termino}"`);
        } else {
          termino = p
            .replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '')
            .replace(/producto|productos|inventario|stock|precio|sku|catalogo|tienes|hay|algún|alguna/gi, '')
            .replace(/de|del|para|por|con|sin|sobre|entre/gi, '')
            .trim();
          console.log(`📦 Término extraído (limpieza general): "${termino}"`);
        }
        
        if (!termino || termino.length < 3) {
          const { count } = await supabase
            .from('productos_obuma')
            .select('*', { count: 'exact', head: true });
          console.log(`📊 Pregunta general de productos: total = ${count || 0}`);
          return { tipo: "productos", datos: [], total: count || 0, esPreguntaGeneral: true };
        }
        
        console.log(`🔍 Buscando producto específico: "${termino}"`);
        
        const productos = await buscarProductosEnSupabase(termino, limit);
        
        if (productos.length > 0) {
          console.log(`✅ Productos encontrados: ${productos.length}`);
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
        
        console.log(`❌ No se encontraron productos para "${termino}"`);
        
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
        
        console.log(`📋 Tareas encontradas: ${tareasFormateadas.length}`);
        if (tareasFormateadas.length > 0) {
          console.log(`📋 Primera tarea: ${tareasFormateadas[0].titulo} → Responsable: ${tareasFormateadas[0].responsable}`);
        }
        
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
    
    console.log("=========================================");
    console.log(`💬 NUEVA CONSULTA AL CHATBOT: "${pregunta}"`);
    console.log("=========================================");
    
    if (!pregunta || pregunta.trim() === "") {
      return NextResponse.json({ error: "La pregunta no puede estar vacía" }, { status: 400 });
    }

    const intencion = detectarIntencion(pregunta);
    console.log(`🎯 Intención detectada: ${intencion}`);
    
    const datosDB = await obtenerDatosPorIntencion(intencion, pregunta);
    console.log(`📦 datosDB resultante: tipo=${datosDB.tipo}, total=${datosDB.total}, datos.length=${datosDB.datos?.length || 0}`);
    
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
NO uses ejemplos como "producto de prueba" o "Lenovo ThinkPad" a menos que estén explícitamente en esta lista.`;
    }
    else if (datosDB.tipo === "productos" && datosDB.noEncontrado) {
      systemPrompt += `\n\n❌ No se encontró el producto "${datosDB.termino}" en la base de datos.
Responde EXACTAMENTE: "No encontré el producto '${datosDB.termino}' en nuestra base de datos. Tenemos ${datosDB.total} productos en total. ¿Quieres que te liste algunos o busques por otra palabra?"`;
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
3. Usa emojis para hacer la conversación más amigable (📦 para productos, 👥 para clientes, ✅ para tareas, 💻 para dispositivos)
4. Si muestras listados, usa • o ✅ al inicio de cada línea
5. Destaca información importante con **negritas**
6. Si no hay datos, dilo honestamente y ofrece ayuda
7. Sé conciso pero completo - ve al grano`;

    console.log(`🤖 Enviando prompt a DeepSeek...`);
    
    const result = await callDeepSeek([
      { role: "system", content: systemPrompt },
      { role: "user", content: pregunta }
    ], 0.3, 800);

    if (result.error) {
      console.error(`❌ Error en DeepSeek: ${result.error}`);
      return NextResponse.json({ 
        respuesta: "🔌 Lo siento, tuve un problema de conexión. ¿Puedes intentarlo de nuevo?",
        error: result.error 
      }, { status: 500 });
    }
    
    console.log(`✅ Respuesta generada exitosamente`);
    console.log("=========================================");
    
    return NextResponse.json({ 
      respuesta: result.content,
      timestamp: new Date().toISOString(),
      intencion,
      total_encontrado: datosDB.datos?.length || 0
    });
    
  } catch (error: any) {
    console.error("❌ Error en chat:", error);
    return NextResponse.json(
      { respuesta: "🔌 Ups, algo salió mal. Por favor, intenta nuevamente." },
      { status: 500 }
    );
  }
}