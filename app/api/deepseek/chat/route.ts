// app/api/deepseek/chat/route.ts
// Motor del chatbot "Asistente Obuma" v2 — multi-tabla, memoria, aprendizaje y prompts por rol.
import { NextResponse } from 'next/server';
import { callDeepSeek } from '@/app/lib/deepseek/client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Base de conocimiento: qué es el sistema y qué hace cada módulo ──────────
// Esto le da al bot contexto del PROYECTO, no solo de la base de datos.
const CONOCIMIENTO_SISTEMA = `
SISTEMA: Intranet de Grupo ICA Chile (empresa de construcción/ferretería y licitaciones públicas).
Integrado con el ERP Obuma (productos, clientes, stock, órdenes de compra).
MÓDULOS:
- Productos (Obuma): catálogo con SKU, precios (costo/neto/total con IVA 19%), stock por bodega.
- Clientes (Obuma): empresas, RUT, crédito, condiciones de pago.
- Proveedores: empresas que nos venden, con categoría, contacto y productos que ofrecen.
- Buscador de precios: cotiza productos en tiendas chilenas (Sodimac, Easy, Construmart, etc.).
- Tareas: gestión del equipo con prioridad, estado y responsable.
- RRHH: empleados, asistencias, contratos, capacitaciones, evaluaciones.
- Dispositivos: equipos asignados a colaboradores.
REGLA DE NEGOCIO: el IVA en Chile es 19% (factor 1.19). Precio total = neto × 1.19.
`.trim();

// ─── Tablas consultables (con columnas seguras y palabras clave) ─────────────
const TABLAS: Record<string, { campos: string; keywords: string[]; label: string }> = {
  productos_obuma: {
    label: 'productos',
    campos: 'nombre, sku, precio_costo, precio_neto, precio_total, stock_actual, stock_minimo, categoria_nombre, bodega',
    keywords: ['producto', 'productos', 'inventario', 'stock', 'precio', 'sku', 'catalogo', 'catálogo', 'articulo', 'artículo', 'mercaderia', 'mercadería'],
  },
  clientes_obuma: {
    label: 'clientes',
    campos: 'razon_social, nombre_fantasia, rut, email, telefono, comuna, ciudad, vendedor, credito_aprobado, dias_pago',
    keywords: ['cliente', 'clientes', 'razon social', 'razón social', 'comprador'],
  },
  proveedores: {
    label: 'proveedores',
    campos: 'nombre_empresa, rut_empresa, categoria, tipo_servicio, email_contacto, telefono, calificacion, comuna, ciudad',
    keywords: ['proveedor', 'proveedores', 'abastecedor'],
  },
  proveedores_transporte: {
    label: 'transporte',
    campos: 'nombre, tipo, rut, correo, direccion, vendedor',
    keywords: ['transporte', 'camion', 'camión', 'flete', 'logistica', 'logística', 'despacho'],
  },
  tareas: {
    label: 'tareas',
    campos: 'titulo, descripcion, prioridad, estado, fecha_limite, proyecto',
    keywords: ['tarea', 'tareas', 'pendiente', 'pendientes', 'asignada', 'proyecto'],
  },
  perfiles: {
    label: 'usuarios',
    campos: 'nombre, apellido, email, rol, cargo, activo',
    keywords: ['usuario', 'usuarios', 'colaborador', 'empleado', 'personal', 'administrador', 'admin', 'perfil'],
  },
  dispositivos: {
    label: 'dispositivos',
    campos: 'nombre_equipo, tipo, marca, modelo, serie_imei, estado, numero_telefono',
    keywords: ['dispositivo', 'equipo', 'computador', 'notebook', 'pc', 'telefono', 'teléfono', 'celular'],
  },
  registros_precios: {
    label: 'historial de precios',
    campos: 'nombre_producto, tienda, precio_valor, link, fecha',
    keywords: ['historial precio', 'evolucion precio', 'evolución precio', 'cotizacion anterior', 'cotización anterior'],
  },
  analisis_competencia: {
    label: 'competencia',
    campos: 'termino_busqueda, nombre_producto_tienda, precio_num, tienda_url',
    keywords: ['competencia', 'precio competencia', 'la competencia'],
  },
};

function normalizar(t: string): string {
  return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Detecta TODAS las tablas relevantes (no solo una) → permite respuestas cruzadas
function detectarTablas(pregunta: string): string[] {
  const p = normalizar(pregunta);
  const encontradas: string[] = [];
  for (const [tabla, cfg] of Object.entries(TABLAS)) {
    if (cfg.keywords.some((k) => p.includes(normalizar(k)))) encontradas.push(tabla);
  }
  return encontradas;
}

// Búsqueda de productos del lado de Supabase (escala a miles, no carga todo a memoria)
async function buscarProductos(pregunta: string, limit = 15) {
  const p = normalizar(pregunta);
  // Extraer término: quitar palabras de relleno
  const relleno = ['busca', 'buscar', 'encuentra', 'dame', 'muestra', 'muestrame', 'lista', 'listame', 'ver', 'tienes', 'hay', 'algun', 'alguna', 'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'producto', 'productos', 'precio', 'stock', 'sku', 'inventario', 'cuanto', 'cuantos'];
  const palabras = p.split(/\s+/).filter((w) => w.length > 2 && !relleno.includes(w));

  // SKU exacto
  const skuMatch = pregunta.match(/\b(\d{6,})\b/);
  if (skuMatch) {
    const { data } = await supabase
      .from('productos_obuma')
      .select(TABLAS.productos_obuma.campos)
      .eq('sku', skuMatch[1])
      .limit(1);
    if (data && data.length) return data;
  }

  if (!palabras.length) return [];

  // Generar variantes singular/plural para cada palabra (tornillo↔tornillos)
  const variantes = (w: string): string[] => {
    const set = new Set<string>([w]);
    if (w.length > 4) {
      if (w.endsWith('s')) set.add(w.slice(0, -1));
      else set.add(w + 's');
      // raíz corta para coincidencias parciales (martill, tornill)
      if (w.length > 6) set.add(w.slice(0, w.length - 1));
    }
    return [...set];
  };

  // Búsqueda OR por palabra clave (ilike en nombre, insensible a mayúsculas)
  const orFilter = palabras
    .flatMap(variantes)
    .map((w) => `nombre.ilike.%${w}%`)
    .join(',');
  const { data } = await supabase
    .from('productos_obuma')
    .select(TABLAS.productos_obuma.campos)
    .eq('activo', true)
    .or(orFilter)
    .limit(limit);

  // Priorizar los que contienen TODAS las palabras
  let lista = data || [];
  lista.sort((a: any, b: any) => {
    const na = normalizar(a.nombre), nb = normalizar(b.nombre);
    const ca = palabras.filter((w) => na.includes(w)).length;
    const cb = palabras.filter((w) => nb.includes(w)).length;
    return cb - ca;
  });

  // FALLBACK EN VIVO: si Supabase no tiene el producto (sync desactualizado),
  // consultar Obuma directo — así el chatbot ve TODO el catálogo, no solo lo sincronizado.
  if (lista.length === 0) {
    const termino = palabras.join(' ');
    const vivos = await buscarProductosObumaVivo(termino, limit);
    if (vivos.length) return vivos;
  }
  return lista;
}

// Consulta el catálogo Obuma en vivo (lo mismo que muestra /obuma-productos)
async function buscarProductosObumaVivo(termino: string, limit = 15): Promise<any[]> {
  try {
    if (!process.env.OBUMA_API_URL || !process.env.OBUMA_API_TOKEN) return [];
    const url = new URL(`${process.env.OBUMA_API_URL}/productos.list.json`);
    url.searchParams.append('filter', termino);
    url.searchParams.append('limit', String(limit));
    const r = await fetch(url.toString(), {
      headers: { 'access-token': process.env.OBUMA_API_TOKEN, 'Content-Type': 'application/json' },
    });
    if (!r.ok) return [];
    const data = await r.json();
    const productos = data.data || data.productos || [];
    return productos.slice(0, limit).map((p: any) => {
      const total = Number(p.producto_precio_clp_total) || 0;
      return {
        nombre: p.producto_nombre || 'Sin nombre',
        sku: p.producto_codigo_comercial || `SKU_${p.producto_id}`,
        precio_costo: Number(p.producto_costo_clp_neto) || 0,
        precio_neto: Math.round(total / 1.19),
        precio_total: total,
        stock_actual: null, // el listado vivo no trae stock; consultar por SKU si se necesita
        categoria_nombre: p.categoria_nombre || '',
        _fuente: 'obuma_vivo',
      };
    });
  } catch {
    return [];
  }
}

// Trae datos de una tabla genérica con filtro opcional
async function fetchTabla(tabla: string, pregunta: string, limit = 15) {
  const cfg = TABLAS[tabla];
  if (!cfg) return { datos: [], total: 0 };
  const p = normalizar(pregunta);

  const { count } = await supabase.from(tabla).select('*', { count: 'exact', head: true });

  if (tabla === 'productos_obuma') {
    const datos = await buscarProductos(pregunta, limit);
    return { datos, total: count || 0 };
  }

  let query = supabase.from(tabla).select(cfg.campos);

  // Filtros específicos útiles
  if (tabla === 'tareas') {
    if (p.includes('pendiente')) query = query.eq('estado', 'pendiente');
    else if (p.includes('proceso')) query = query.eq('estado', 'en_proceso');
    else if (p.includes('completada') || p.includes('terminada')) query = query.eq('estado', 'completada');
    if (p.includes('alta')) query = query.eq('prioridad', 'alta');
    query = query.order('created_at', { ascending: false });
  }
  if (tabla === 'perfiles') {
    if (p.includes('admin')) query = query.in('rol', ['admin', 'superuser']);
    if (p.includes('activo')) query = query.eq('activo', true);
  }
  if (tabla === 'proveedores') query = query.eq('activo', true);
  if (tabla === 'dispositivos') {
    if (p.includes('disponible') || p.includes('operativo')) query = query.eq('estado', 'operativo');
  }
  if (tabla === 'clientes_obuma') {
    const term = palabrasClave(pregunta);
    if (term) query = query.ilike('razon_social', `%${term}%`);
  }

  const { data } = await query.limit(limit);
  return { datos: data || [], total: count || 0 };
}

function palabrasClave(pregunta: string): string {
  const p = normalizar(pregunta);
  const relleno = ['cliente', 'clientes', 'busca', 'buscar', 'encuentra', 'dame', 'lista', 'todos', 'muestra', 'el', 'la', 'los', 'las', 'de', 'del'];
  const w = p.split(/\s+/).filter((x) => x.length > 2 && !relleno.includes(x));
  return w.join(' ');
}

// Aprendizaje: respuestas pasadas BIEN valoradas (feedback positivo) para preguntas similares
async function ejemplosAprendidos(pregunta: string): Promise<string> {
  try {
    const palabras = normalizar(pregunta).split(/\s+/).filter((w) => w.length > 3);
    if (!palabras.length) return '';
    const { data } = await supabase
      .from('chatbot_historial')
      .select('pregunta, respuesta')
      .eq('feedback', true)
      .ilike('pregunta', `%${palabras[0]}%`)
      .order('created_at', { ascending: false })
      .limit(2);
    if (!data || !data.length) return '';
    return data
      .map((e: any) => `P: ${e.pregunta}\nR (bien valorada): ${String(e.respuesta).slice(0, 250)}`)
      .join('\n---\n');
  } catch {
    return '';
  }
}

async function estadisticas() {
  const tablas = ['productos_obuma', 'clientes_obuma', 'proveedores', 'tareas', 'dispositivos', 'perfiles'];
  const counts = await Promise.all(
    tablas.map((t) => supabase.from(t).select('*', { count: 'exact', head: true }))
  );
  return tablas.reduce((acc, t, i) => ({ ...acc, [t]: counts[i].count || 0 }), {} as Record<string, number>);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pregunta: string = (body.pregunta || '').trim();
    const usuarioRol: string = body.usuario_rol || 'usuario';
    const historialReciente: Array<{ role: string; content: string }> = Array.isArray(body.historial_reciente)
      ? body.historial_reciente.slice(-6)
      : [];

    if (!pregunta) {
      return NextResponse.json({ error: 'La pregunta no puede estar vacía' }, { status: 400 });
    }

    // 1. Detectar tablas relevantes (puede ser más de una → respuestas cruzadas)
    const tablas = detectarTablas(pregunta);

    // 2. Traer datos de cada tabla relevante en paralelo
    let bloquesDatos = '';
    let totalEncontrado = 0;
    if (tablas.length > 0) {
      const resultados = await Promise.all(tablas.map((t) => fetchTabla(t, pregunta)));
      tablas.forEach((t, i) => {
        const { datos, total } = resultados[i];
        totalEncontrado += datos.length;
        bloquesDatos += `\n\n### ${TABLAS[t].label.toUpperCase()} (total en BD: ${total}, mostrando ${datos.length})\n`;
        bloquesDatos += datos.length
          ? JSON.stringify(datos, null, 1)
          : '(sin coincidencias para esta búsqueda)';
      });
    } else {
      // Pregunta general → estadísticas
      const stats = await estadisticas();
      bloquesDatos = `\n\n### RESUMEN GENERAL\n${JSON.stringify(stats, null, 1)}`;
    }

    // 3. Aprendizaje: ejemplos pasados bien valorados
    const aprendido = await ejemplosAprendidos(pregunta);

    // 4. Prompt profesional por rol
    const vistaPrecios =
      ['admin', 'superuser', 'jefe'].includes(usuarioRol)
        ? 'Puedes mostrar precio de COSTO y de VENTA, márgenes y datos sensibles.'
        : usuarioRol === 'vendedor'
        ? 'Enfócate en precio de VENTA (precio_total con IVA) y stock disponible. NO menciones precio de costo ni márgenes.'
        : 'Muestra precio de venta y stock. Evita datos financieros sensibles (costos, márgenes, créditos).';

    const systemPrompt = `Eres "Asistente Obuma", el asistente interno de Grupo ICA Chile. Profesional, directo y útil.

${CONOCIMIENTO_SISTEMA}

ROL DEL USUARIO: ${usuarioRol}. ${vistaPrecios}

DATOS REALES DE LA BASE DE DATOS (úsalos como ÚNICA fuente de verdad):${bloquesDatos}
${aprendido ? `\n\nEJEMPLOS DE RESPUESTAS BIEN VALORADAS (imita su estilo y precisión):\n${aprendido}` : ''}

REGLAS ESTRICTAS:
1. Responde SOLO con los datos reales de arriba. NUNCA inventes productos, precios, SKU, clientes ni cifras.
2. Si no hay coincidencias, dilo claro y ofrece alternativas (buscar por otra palabra, SKU, etc.).
3. Formatea precios en pesos chilenos: $1.234.567. El IVA es 19%.
4. Usa **negritas** para lo importante y viñetas (•) para listas. Emojis con moderación (📦 productos, 👥 clientes, ✅ tareas, 💻 equipos).
5. Si la pregunta cruza temas (ej: un producto y su proveedor), conecta los datos de las distintas secciones.
6. Sé conciso: respuestas claras y al grano, sin relleno.
7. Si un producto tiene "_fuente": "obuma_vivo", es del catálogo Obuma en vivo (recién consultado, válido). Si su stock_actual es null, di "stock no consultado" y ofrece verificarlo por SKU — NO digas que el stock es 0.`;

    // 5. Construir mensajes con MEMORIA de conversación
    const mensajes: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    for (const m of historialReciente) {
      if (m.role === 'user' || m.role === 'assistant') {
        mensajes.push({ role: m.role, content: String(m.content).slice(0, 500) });
      }
    }
    mensajes.push({ role: 'user', content: pregunta });

    const result = await callDeepSeek(mensajes, 0.3, 800);

    if (result.error) {
      return NextResponse.json(
        { respuesta: '🔌 Tuve un problema de conexión con el asistente. Intenta de nuevo.', error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      respuesta: result.content,
      timestamp: new Date().toISOString(),
      tablas_consultadas: tablas,
      productos_encontrados: totalEncontrado,
      criterio_busqueda: tablas.join(', ') || 'general',
    });
  } catch (error: any) {
    console.error('Error en chat:', error);
    return NextResponse.json(
      { respuesta: '🔌 Ups, algo salió mal. Intenta nuevamente.' },
      { status: 500 }
    );
  }
}
