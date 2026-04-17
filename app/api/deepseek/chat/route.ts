// app/api/deepseek/chat/route.ts
import { NextResponse } from 'next/server';
import { callDeepSeek } from '@/app/lib/deepseek/client';

// Interfaz del producto
interface Producto {
  nombre: string;
  sku: string;
  precio: number;
  stock: number;
  categoria?: string;
}

export async function POST(req: Request) {
  try {
    const { pregunta, contexto } = await req.json();
    
    if (!pregunta || pregunta.trim() === "") {
      return NextResponse.json({ error: "La pregunta no puede estar vacía" }, { status: 400 });
    }

    const todosLosProductos: Producto[] = contexto?.productos || [];
    const preguntaLower: string = pregunta.toLowerCase();
    
    // Palabras comunes a ignorar
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
    
    let productosFiltrados: Producto[] = [...todosLosProductos];
    let criterioBusqueda: string = '';
    
    // 1. Búsqueda por SKU (prioridad máxima)
    if (esBusquedaSKU) {
      const skuBuscado: string | undefined = pregunta.match(/\d{7,}/)?.[0];
      if (skuBuscado) {
        productosFiltrados = productosFiltrados.filter((p: Producto) => p.sku === skuBuscado);
        criterioBusqueda = `SKU exacto: ${skuBuscado}`;
      }
    }
    
    // 2. Búsqueda por nombre exacto
    if (productosFiltrados.length === todosLosProductos.length && !esBusquedaSKU) {
      const coincidenciaExacta: Producto[] = productosFiltrados.filter((p: Producto) => 
        p.nombre.toLowerCase() === preguntaLower
      );
      
      if (coincidenciaExacta.length > 0) {
        productosFiltrados = coincidenciaExacta;
        criterioBusqueda = `nombre exacto: "${pregunta}"`;
      }
    }
    
    // 3. Búsqueda por coincidencia parcial
    if (productosFiltrados.length === todosLosProductos.length && !esBusquedaSKU) {
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
    
    // 4. Ordenar por relevancia
    productosFiltrados.sort((a: Producto, b: Producto) => {
      const aNombreMatch: number = a.nombre.toLowerCase().includes(preguntaLower) ? 2 : 0;
      const bNombreMatch: number = b.nombre.toLowerCase().includes(preguntaLower) ? 2 : 0;
      if (aNombreMatch !== bNombreMatch) return bNombreMatch - aNombreMatch;
      return 0;
    });
    
    const resultadosMostrar: Producto[] = productosFiltrados.slice(0, 20);
    const hayMasResultados: boolean = productosFiltrados.length > 20;
    
    console.log(`🔍 Búsqueda: "${pregunta}" → ${productosFiltrados.length} resultados (${criterioBusqueda})`);
    
    // Calcular estadísticas
    const totalStock: number = todosLosProductos.reduce((sum: number, p: Producto) => sum + (p.stock || 0), 0);
    const valorInventario: number = todosLosProductos.reduce((sum: number, p: Producto) => sum + ((p.precio || 0) * (p.stock || 0)), 0);
    
    // Construir prompt (sin variables ${precio} sueltas)
    let systemPrompt: string = `Eres un asistente experto en productos. RESPUESTAS EN ESPAÑOL. PRECISIÓN QUIRÚRGICA.

REGLAS ESTRICTAS:
1. SOLO usa los productos que te proporciono. NUNCA inventes.
2. Si el usuario busca un producto específico y NO está en la lista, responde: "🔍 No encontré '[producto]' en nuestra base de datos."
3. Si ENCUENTRAS productos, responde con: nombre, SKU, precio, stock.
4. Si hay múltiples resultados, muestra los más relevantes primero.

FORMATO DE RESPUESTA:
🔍 *Encontré X producto(s):*

• **{nombre}**
  └ SKU: {sku} | 💰 Precio: valor | 📦 Stock: {stock} unidades`;

    // Agregar estadísticas
    systemPrompt += `\n\n📊 ESTADÍSTICAS GENERALES:
- Total productos: ${todosLosProductos.length}
- Stock total: ${totalStock} unidades
- Valor inventario: $${valorInventario.toLocaleString('es-CL')} CLP`;

    // Agregar resultados
    if (resultadosMostrar.length > 0) {
      systemPrompt += `\n\n🎯 RESULTADOS DE BÚSQUEDA (${resultadosMostrar.length} productos encontrados):
${JSON.stringify(resultadosMostrar, null, 2)}`;
      
      if (hayMasResultados) {
        systemPrompt += `\n... y ${productosFiltrados.length - 20} productos más.`;
      }
    } else {
      systemPrompt += `\n\n❌ No se encontraron productos que coincidan con: "${pregunta}"`;
    }

    const result = await callDeepSeek([
      { role: "system", content: systemPrompt },
      { role: "user", content: pregunta }
    ], 0.1, 800);

    if (result.error) {
      return NextResponse.json({ 
        respuesta: "⚠️ Error técnico. Intenta nuevamente.",
        error: result.error 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      respuesta: result.content,
      timestamp: new Date().toISOString(),
      productos_encontrados: resultadosMostrar.length,
      criterio_busqueda: criterioBusqueda
    });
    
  } catch (error: any) {
    console.error("Error en chat:", error);
    return NextResponse.json(
      { respuesta: "⚠️ Error procesando la pregunta. Intenta nuevamente." },
      { status: 500 }
    );
  }
}