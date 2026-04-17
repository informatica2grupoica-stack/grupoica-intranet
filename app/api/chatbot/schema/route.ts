// app/api/chatbot/schema/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Definir el esquema de la base de datos para que la IA sepa qué existe
const databaseSchema = {
  tablas: {
    productos_obuma: {
      descripcion: "Productos sincronizados desde Obuma",
      campos: ["id", "sku", "nombre", "precio_total", "stock_actual", "categoria_nombre", "subcategoria_nombre", "fabricante_nombre", "activo"],
      ejemplos: "buscar productos, consultar stock, ver precios"
    },
    proveedores: {
      descripcion: "Proveedores de la empresa",
      campos: ["id", "nombre_empresa", "rut_empresa", "categoria", "nombre_contacto", "email_contacto", "telefono", "calificacion", "activo"],
      ejemplos: "listar proveedores, buscar por categoría, ver contactos"
    },
    proveedores_transporte: {
      descripcion: "Proveedores de servicios de transporte",
      campos: ["id", "nombre", "rut", "direccion", "correo", "tipo", "contactos"],
      ejemplos: "proveedores de camiones, contactos de transporte"
    },
    tareas: {
      descripcion: "Tareas y actividades del equipo",
      campos: ["id", "titulo", "descripcion", "prioridad", "estado", "asignado_a", "fecha_limite", "proyecto"],
      ejemplos: "tareas pendientes, tareas por usuario, prioridades"
    },
    perfiles: {
      descripcion: "Perfiles de usuarios del sistema",
      campos: ["id", "nombre", "apellido", "email", "rol", "cargo", "activo"],
      ejemplos: "listar usuarios, administradores, roles"
    },
    dispositivos: {
      descripcion: "Equipos y dispositivos de la empresa",
      campos: ["id", "nombre_equipo", "tipo", "marca", "modelo", "serie_imei", "asignado_a", "estado"],
      ejemplos: "dispositivos por usuario, equipos disponibles"
    },
    mensajes: {
      descripcion: "Mensajes internos entre usuarios",
      campos: ["id", "contenido", "emisor_id", "receptor_id", "leido", "created_at"],
      ejemplos: "mensajes no leídos, conversaciones"
    },
    chatbot_historial: {
      descripcion: "Historial de conversaciones con el asistente IA",
      campos: ["id", "usuario_nombre", "pregunta", "respuesta", "created_at"],
      ejemplos: "últimas preguntas, historial por usuario"
    },
    ia_aprendizaje: {
      descripcion: "Aprendizaje de la IA para sugerencias de productos",
      campos: ["id", "producto_nombre", "sku_generado", "c1", "c2", "c3", "c4"],
      ejemplos: "patrones de nombres, SKUs sugeridos"
    },
    analisis_competencia: {
      descripcion: "Análisis de precios de la competencia",
      campos: ["id", "termino_busqueda", "nombre_producto_tienda", "tienda_url", "precio_num"],
      ejemplos: "precios competencia, búsquedas de mercado"
    },
    registros_precios: {
      descripcion: "Historial de precios de productos",
      campos: ["id", "termino_busqueda", "nombre_producto", "tienda", "precio_valor", "fecha"],
      ejemplos: "evolución de precios, comparativas"
    },
    comentarios_tareas: {
      descripcion: "Comentarios en tareas",
      campos: ["id", "tarea_id", "perfil_id", "contenido", "created_at"],
      ejemplos: "comentarios de tareas"
    }
  }
};

export async function GET() {
  return NextResponse.json({ schema: databaseSchema });
}

export async function POST(req: Request) {
  try {
    const { consulta, tabla, limit = 50 } = await req.json();
    
    // Validar tabla permitida (evitar inyección SQL)
    const tablasPermitidas = [
      'productos_obuma', 'proveedores', 'proveedores_transporte', 'tareas', 
      'perfiles', 'dispositivos', 'mensajes', 'chatbot_historial', 
      'ia_aprendizaje', 'analisis_competencia', 'registros_precios', 'comentarios_tareas'
    ];
    
    if (tabla && !tablasPermitidas.includes(tabla)) {
      return NextResponse.json({ error: "Tabla no permitida" }, { status: 400 });
    }
    
    // Si se especifica una tabla, consultar sus datos
    if (tabla) {
      let query = supabase.from(tabla).select('*').limit(limit);
      
      // Ordenar según la tabla
      if (tabla === 'productos_obuma') query = query.order('nombre');
      if (tabla === 'proveedores') query = query.order('nombre_empresa');
      if (tabla === 'tareas') query = query.order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return NextResponse.json({ 
        success: true, 
        tabla, 
        total: data?.length || 0,
        datos: data || []
      });
    }
    
    // Si no hay tabla específica, devolver estadísticas generales
    // ✅ CORREGIDO: Usar Record<string, number | string> para tipado correcto
    const stats: Record<string, number | string> = {};
    
    for (const nombreTabla of tablasPermitidas) {
      try {
        const { count, error } = await supabase
          .from(nombreTabla)
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          stats[nombreTabla] = count || 0;
        } else {
          stats[nombreTabla] = 'error';
        }
      } catch (e) {
        console.error(`Error contando ${nombreTabla}:`, e);
        stats[nombreTabla] = 'error';
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      stats,
      schema: databaseSchema
    });
    
  } catch (error: any) {
    console.error("Error en schema API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}