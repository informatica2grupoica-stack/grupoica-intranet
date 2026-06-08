// app/api/deepseek/chat/route.ts
// Motor del chatbot "Asistente IA" v5 — DeepSeek-V3 — responde todo
import { NextResponse } from 'next/server';
import { callDeepSeek, buildMessages } from '@/app/lib/deepseek/client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

function detectarTablas(pregunta: string): string[] {
  const p = normalizar(pregunta);
  return Object.entries(TABLAS)
    .filter(([, cfg]) => cfg.keywords.some((k) => p.includes(normalizar(k))))
    .map(([tabla]) => tabla);
}

async function buscarProductos(pregunta: string, limit = 15) {
  const p = normalizar(pregunta);
  const relleno = ['busca', 'buscar', 'encuentra', 'dame', 'muestra', 'muestrame', 'lista', 'listame', 'ver', 'tienes', 'hay', 'algun', 'alguna', 'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'producto', 'productos', 'precio', 'stock', 'sku', 'inventario', 'cuanto', 'cuantos'];
  const palabras = p.split(/\s+/).filter((w) => w.length > 2 && !relleno.includes(w));

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

  const variantes = (w: string): string[] => {
    const set = new Set<string>([w]);
    if (w.length > 4) {
      if (w.endsWith('s')) set.add(w.slice(0, -1));
      else set.add(w + 's');
      if (w.length > 6) set.add(w.slice(0, w.length - 1));
    }
    return [...set];
  };

  const orFilter = palabras.flatMap(variantes).map((w) => `nombre.ilike.*${w}*`).join(',');
  const { data } = await supabase
    .from('productos_obuma')
    .select(TABLAS.productos_obuma.campos)
    .eq('activo', true)
    .or(orFilter)
    .limit(limit);

  let lista = data || [];
  lista.sort((a: any, b: any) => {
    const na = normalizar(a.nombre), nb = normalizar(b.nombre);
    const ca = palabras.filter((w) => na.includes(w)).length;
    const cb = palabras.filter((w) => nb.includes(w)).length;
    return cb - ca;
  });

  return lista;
}

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
    const w = p.split(/\s+/).filter((x) => x.length > 2 && !['cliente', 'clientes', 'busca', 'buscar'].includes(x)).join(' ');
    if (w) query = query.ilike('razon_social', `%${w}%`);
  }

  const { data } = await query.limit(limit);
  return { datos: data || [], total: count || 0 };
}

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
  const counts = await Promise.all(tablas.map((t) => supabase.from(t).select('*', { count: 'exact', head: true })));
  return tablas.reduce((acc, t, i) => ({ ...acc, [t]: counts[i].count || 0 }), {} as Record<string, number>);
}

// Detecta si la pregunta es de conocimiento general (no necesita BD)
function esConsultaGeneral(p: string): boolean {
  const pat = /\b(clima|tiempo|lluvia|temperatura|pronostico|pronóstico|hora|fecha|hoy|dia|día|dolar|dólar|uf|utm|euro|precio dolar|cotizacion|cotización|noticias|chiste|broma|historia|curiosidad|receta|definicion|definición|traducir|traduccion|qué es|que es|cómo funciona|como funciona|quién es|quien es|cuál es la capital|mundial|deporte|fútbol|futbol)\b/i;
  return pat.test(p);
}

// Obtiene indicadores económicos actuales
async function obtenerIndicadores(): Promise<string> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://grupoica-intranet.vercel.app'}/api/indicadores`);
    if (!res.ok) return '';
    const data = await res.json();
    return `UF: $${data.uf?.valor?.toLocaleString('es-CL')} | UTM: $${data.utm?.valor?.toLocaleString('es-CL')} | USD: $${data.dolar?.valor?.toLocaleString('es-CL')} | EUR: $${data.euro?.valor?.toLocaleString('es-CL')}`;
  } catch { return ''; }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pregunta: string = (body.pregunta || '').trim();
    const usuarioRol: string = body.usuario_rol || 'usuario';
    const historialReciente: Array<{ role: string; content: string }> = Array.isArray(body.historial_reciente)
      ? body.historial_reciente.slice(-8)
      : [];
    const usuarioNombre: string = body.usuario_nombre || 'Usuario';

    if (!pregunta) {
      return NextResponse.json({ error: 'La pregunta no puede estar vacía' }, { status: 400 });
    }

    // Fecha y hora actual en Chile
    const ahora = new Date();
    const fechaChile = ahora.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Santiago' });
    const horaChile = ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' });

    // Determinar si necesita consultar la BD o si es consulta general
    const esGeneral = esConsultaGeneral(pregunta);
    let tablas = esGeneral ? [] : detectarTablas(pregunta);
    const esConteo = /\bcu[aá]nt|\bcantidad\b|\btotal(es)?\b|\bresumen\b|\bestad[ií]stica/.test(normalizar(pregunta));
    if (!esGeneral && tablas.length === 0 && !esConteo) tablas = ['productos_obuma'];

    let bloquesDatos = '';
    let totalEncontrado = 0;

    if (tablas.length > 0) {
      const resultados = await Promise.all(tablas.map((t) => fetchTabla(t, pregunta)));
      tablas.forEach((t, i) => {
        const { datos, total } = resultados[i];
        totalEncontrado += datos.length;
        bloquesDatos += `\n\n### ${TABLAS[t].label.toUpperCase()} (total en BD: ${total}, mostrando ${datos.length})\n`;
        bloquesDatos += datos.length ? JSON.stringify(datos, null, 1) : '(sin coincidencias)';
      });
    }
    if (!esGeneral && (esConteo || tablas.length === 0)) {
      const stats = await estadisticas();
      bloquesDatos += `\n\n### RESUMEN GENERAL\n${JSON.stringify(stats, null, 1)}`;
    }

    const [aprendido, indicadores] = await Promise.all([
      ejemplosAprendidos(pregunta),
      obtenerIndicadores(),
    ]);

    const vistaPrecios =
      ['admin', 'superuser', 'jefe'].includes(usuarioRol)
        ? 'Puedes mostrar precio de COSTO y de VENTA, márgenes y datos sensibles.'
        : usuarioRol === 'vendedor'
        ? 'Solo precio de VENTA (precio_total con IVA) y stock. NO precio de costo ni márgenes.'
        : 'Muestra precio de venta y stock. Evita datos financieros sensibles.';

    const systemPrompt = `Eres el asistente IA interno de Comercial MP (Grupo ICA Chile). Eres inteligente, amable, directo y sabes de todo. Respondes SIEMPRE en español chileno natural.

📅 FECHA Y HORA ACTUAL: ${fechaChile}, ${horaChile} (hora de Santiago, Chile)
💱 INDICADORES ECONÓMICOS HOY: ${indicadores || 'no disponibles'}
👤 USUARIO: ${usuarioNombre} | ROL: ${usuarioRol}

${CONOCIMIENTO_SISTEMA}

PERMISOS DE PRECIOS: ${vistaPrecios}

${bloquesDatos ? `📊 DATOS REALES DE LA BASE DE DATOS:${bloquesDatos}` : ''}

${aprendido ? `💡 EJEMPLOS DE RESPUESTAS BIEN VALORADAS ANTES:\n${aprendido}` : ''}

INSTRUCCIONES:
1. Responde CUALQUIER pregunta — negocio, clima, cultura general, chistes, cálculos, conversación, lo que sea.
2. Para preguntas del negocio: usa SOLO los datos reales de arriba. NUNCA inventes productos, SKU, precios o clientes.
3. Si no tienes datos de algo específico, dilo honestamente y sugiere alternativas.
4. Para preguntas generales (hora, fecha, indicadores, clima general): responde con el contexto que tienes.
5. Para clima específico de una ciudad: di que no tienes datos meteorológicos en tiempo real pero puedes dar info general.
6. Formatea precios en pesos chilenos: $1.234.567. IVA Chile = 19%.
7. Usa **negritas** y • viñetas cuando ayude a la claridad. Emojis con moderación.
8. Respuestas concisas y útiles — sin relleno innecesario.
9. Si te hacen una broma o pregunta informal, responde de forma natural y amigable.`.trim();

    const messages = buildMessages(systemPrompt, historialReciente, pregunta);
    const result = await callDeepSeek(messages, { temperature: 0.3, maxTokens: 1200, retries: 3 });

    if (result.error) {
      console.error('[chatbot] DeepSeek error:', result.error);
      const msg =
        result.error === 'RATE_LIMIT'   ? '⏳ Demasiadas solicitudes. Espera un momento e intenta de nuevo.' :
        result.error === 'TIMEOUT'      ? '⏳ El asistente tardó demasiado. Intenta de nuevo.' :
        result.error === 'SERVER_ERROR' ? '🔌 Error temporal del servidor. Intenta en unos segundos.' :
        result.error.includes('no configurada') ? '⚙️ La API key de IA no está configurada.' :
        `🔌 Error: ${result.error}`;
      return NextResponse.json({ respuesta: msg, error: result.error }, { status: 500 });
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
    return NextResponse.json({ respuesta: '🔌 Ups, algo salió mal. Intenta nuevamente.' }, { status: 500 });
  }
}
