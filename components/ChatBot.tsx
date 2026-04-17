// components/ChatBot.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Minimize2, Maximize2, Bot, History, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Mensaje {
  id: string;
  texto: string;
  esUsuario: boolean;
  timestamp: Date;
  detalles?: {
    productosEncontrados?: number;
    criterio?: string;
    esAccion?: boolean;
    accionExitosa?: boolean;
  };
}

interface ProductoReal {
  id: string;
  nombre: string;
  sku: string;
  precio: number;
  stock: number;
  categoria?: string;
}

interface Usuario {
  id: string;
  email: string;
  nombre: string;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: '1',
      texto: '👋 ¡Hola! Soy tu asistente de productos. Puedo ayudarte a buscar productos, verificar SKUs o responder preguntas sobre tu inventario.\n\n✨ **Nuevo:** También puedo ayudarte a cambiar precios o actualizar stock. Solo dime:\n• "cambia el precio del SKU 6026423727 a 15000"\n• "actualiza stock del SKU 6026423727 a 50"\n\n¿En qué te ayudo?',
      esUsuario: false,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [productos, setProductos] = useState<ProductoReal[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [recargandoLista, setRecargandoLista] = useState(false);
  const mensajesEndRef = useRef<HTMLDivElement>(null);

  // Obtener usuario actual
  useEffect(() => {
    const getUsuario = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUsuario({
            id: session.user.id,
            email: session.user.email || '',
            nombre: session.user.user_metadata?.nombre || session.user.email?.split('@')[0] || 'Usuario'
          });
        }
      } catch (error) {
        console.error("Error obteniendo usuario:", error);
      }
    };
    getUsuario();
  }, []);

  // Cargar productos desde Supabase
  const cargarProductos = async () => {
    try {
      const { data, error } = await supabase
        .from('productos_obuma')
        .select('id, nombre, sku, precio_total, stock_actual, categoria_nombre')
        .eq('activo', true)
        .order('nombre');

      if (error) throw error;

      if (data && data.length > 0) {
        const productosMap: ProductoReal[] = data.map((p: any) => ({
          id: p.id,
          nombre: p.nombre,
          sku: p.sku,
          precio: p.precio_total,
          stock: p.stock_actual,
          categoria: p.categoria_nombre
        }));
        setProductos(productosMap);
        console.log(`✅ ChatBot: ${productosMap.length} productos cargados`);
        return productosMap.length;
      }
      return 0;
    } catch (error) {
      console.error("Error cargando productos:", error);
      return 0;
    }
  };

  // Cargar productos al inicio
  useEffect(() => {
    const inicializar = async () => {
      setCargandoProductos(true);
      await cargarProductos();
      setCargandoProductos(false);
    };
    inicializar();
  }, []);

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // Guardar mensaje en historial
  const guardarEnHistorial = async (pregunta: string, respuesta: string, productosEncontrados: number = 0) => {
    if (!usuario) return;
    
    try {
      await fetch('/api/chatbot/historial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: usuario.id,
          usuario_nombre: usuario.nombre,
          pregunta,
          respuesta,
          productos_encontrados: productosEncontrados
        })
      });
    } catch (error) {
      console.error("Error guardando historial:", error);
    }
  };

  // Recargar lista de productos después de una acción
  const recargarListaProductos = async (): Promise<boolean> => {
    setRecargandoLista(true);
    const count = await cargarProductos();
    setRecargandoLista(false);
    return count > 0;
  };

  // Detectar y ejecutar acciones
  const detectarYEjecutarAccion = async (pregunta: string): Promise<{ esAccion: boolean; respuesta: string; exitosa: boolean }> => {
    const preguntaLower = pregunta.toLowerCase();
    
    // Detectar cambio de precio
    const precioMatch = preguntaLower.match(/(?:cambia|actualiza|modifica|setea).*?precio.*?(?:sku|codigo|producto)\s*(\d{7,}).*?a\s*(\d+(?:\.\d+)?)/i);
    if (precioMatch) {
      const sku = precioMatch[1];
      const nuevoPrecio = parseInt(precioMatch[2]);
      const producto = productos.find(p => p.sku === sku);
      
      if (!producto) {
        return { esAccion: true, respuesta: `❌ No encontré el producto con SKU ${sku}. Verifica el código.`, exitosa: false };
      }
      
      try {
        const getRes = await fetch(`/api/obuma/productos/list?codigo_sku=${sku}`);
        const getData = await getRes.json();
        const productoActual = getData.data?.[0];
        
        if (!productoActual) {
          return { esAccion: true, respuesta: `❌ No se encontraron datos del producto.`, exitosa: false };
        }
        
        const nuevoPrecioBruto = Math.round(nuevoPrecio * 1.19);
        
        const updateRes = await fetch(`/api/obuma/productos/${producto.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...productoActual,
            precio_venta: nuevoPrecioBruto,
            precio_neto: nuevoPrecio,
            venta_incluye_iva: true,
            nombre_completo: producto.nombre,
            sku: producto.sku,
            tipo: productoActual.tipo || 'Producto',
            categoria_id: productoActual.categoria_id || '',
            subcategoria_id: productoActual.subcategoria_id || '',
            se_puede_vender: true,
            se_puede_comprar: true,
            se_mantiene_stock: true
          })
        });
        
        const data = await updateRes.json();
        
        if (updateRes.ok) {
          // Recargar productos desde Supabase para actualizar la lista
          await recargarListaProductos();
          return { 
            esAccion: true, 
            respuesta: `✅ Precio actualizado correctamente!\n\n📦 Producto: ${producto.nombre}\n💰 Nuevo precio: $${nuevoPrecioBruto.toLocaleString('es-CL')}\n📌 SKU: ${sku}\n\n🔄 La lista de productos se ha actualizado.`,
            exitosa: true 
          };
        }
        return { esAccion: true, respuesta: `❌ Error al actualizar el precio: ${data.error || 'Intenta nuevamente'}`, exitosa: false };
      } catch (error) {
        console.error("Error actualizando precio:", error);
        return { esAccion: true, respuesta: `❌ Error de conexión. No se pudo actualizar el precio.`, exitosa: false };
      }
    }
    
    // Detectar actualización de stock
    const stockMatch = preguntaLower.match(/(?:cambia|actualiza|modifica|setea).*?stock.*?(?:sku|codigo|producto)\s*(\d{7,}).*?a\s*(\d+)/i);
    if (stockMatch) {
      const sku = stockMatch[1];
      const nuevoStock = parseInt(stockMatch[2]);
      const producto = productos.find(p => p.sku === sku);
      const stockActual = producto?.stock || 0;
      const diferencia = nuevoStock - stockActual;
      
      if (!producto) {
        return { esAccion: true, respuesta: `❌ No encontré el producto con SKU ${sku}. Verifica el código.`, exitosa: false };
      }
      
      if (diferencia === 0) {
        return { esAccion: true, respuesta: `ℹ️ El producto ya tiene ${nuevoStock} unidades en stock. No se requiere cambio.`, exitosa: true };
      }
      
      try {
        const stockRes = await fetch('/api/obuma/stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku: sku,
            cantidad: Math.abs(diferencia),
            tipo_movimiento: diferencia > 0 ? "ENTRADA" : "SALIDA",
            concepto: "Actualización por ChatBot",
            referencia: `Ajuste de stock a ${nuevoStock} unidades`
          })
        });
        
        const data = await stockRes.json();
        
        if (data.success) {
          // Recargar productos desde Supabase para actualizar la lista
          await recargarListaProductos();
          const direccion = diferencia > 0 ? "aumentado" : "disminuido";
          return { 
            esAccion: true, 
            respuesta: `✅ Stock actualizado correctamente!\n\n📦 Producto: ${producto.nombre}\n📊 Stock ${direccion}: ${stockActual} → ${nuevoStock} unidades\n📌 SKU: ${sku}\n\n🔄 La lista de productos se ha actualizado.`,
            exitosa: true 
          };
        }
        return { esAccion: true, respuesta: `❌ Error al actualizar el stock: ${data.error || 'Intenta nuevamente'}`, exitosa: false };
      } catch (error) {
        console.error("Error actualizando stock:", error);
        return { esAccion: true, respuesta: `❌ Error de conexión. No se pudo actualizar el stock.`, exitosa: false };
      }
    }
    
    return { esAccion: false, respuesta: '', exitosa: false };
  };

  // Cargar historial
  const cargarHistorial = async () => {
    if (!usuario) {
      const noUserMsg: Mensaje = {
        id: Date.now().toString(),
        texto: "🔐 Inicia sesión para ver tu historial de conversaciones.",
        esUsuario: false,
        timestamp: new Date()
      };
      setMensajes(prev => [...prev, noUserMsg]);
      return;
    }
    
    setCargando(true);
    try {
      const res = await fetch(`/api/chatbot/historial?usuario_id=${usuario.id}&limit=15`);
      const data = await res.json();
      
      if (data.historial && data.historial.length > 0) {
        const historialTexto = data.historial.map((h: any, i: number) => 
          `${i + 1}. ❓ **${h.pregunta.length > 60 ? h.pregunta.substring(0, 60) + '...' : h.pregunta}**\n   💡 ${h.respuesta.substring(0, 100)}...`
        ).join('\n\n');
        
        const historialMsg: Mensaje = {
          id: Date.now().toString(),
          texto: `📜 **Tus últimas conversaciones:**\n\n${historialTexto}\n\n---\n💡 *Pregúntame "ver historial" para actualizar*`,
          esUsuario: false,
          timestamp: new Date()
        };
        setMensajes(prev => [...prev, historialMsg]);
      } else {
        const emptyMsg: Mensaje = {
          id: Date.now().toString(),
          texto: "📜 No hay conversaciones previas en tu historial. ¡Empieza a preguntarme sobre productos!",
          esUsuario: false,
          timestamp: new Date()
        };
        setMensajes(prev => [...prev, emptyMsg]);
      }
    } catch (error) {
      console.error("Error cargando historial:", error);
      const errorMsg: Mensaje = {
        id: Date.now().toString(),
        texto: "❌ Error al cargar el historial. Intenta nuevamente.",
        esUsuario: false,
        timestamp: new Date()
      };
      setMensajes(prev => [...prev, errorMsg]);
    } finally {
      setCargando(false);
    }
  };

  // Sugerencias proactivas basadas en stock bajo
  const sugerirStockBajo = async (): Promise<string> => {
    const productosBajoStock = productos.filter(p => p.stock > 0 && p.stock <= 5);
    if (productosBajoStock.length > 0) {
      const lista = productosBajoStock.slice(0, 3).map(p => `• **${p.nombre}** (Stock: ${p.stock})`).join('\n');
      return `⚠️ **Alerta de stock bajo:**\n\n${lista}\n\n${productosBajoStock.length > 3 ? `... y ${productosBajoStock.length - 3} más.` : ''}\n\n¿Necesitas reabastecer alguno?`;
    }
    return '';
  };

  const enviarMensaje = async () => {
    if (!input.trim() || cargando) return;

    const pregunta = input.trim();
    setInput('');
    
    const userMsg: Mensaje = {
      id: Date.now().toString(),
      texto: pregunta,
      esUsuario: true,
      timestamp: new Date()
    };
    setMensajes(prev => [...prev, userMsg]);
    setCargando(true);

    try {
      const { esAccion, respuesta: accionRespuesta, exitosa } = await detectarYEjecutarAccion(pregunta);
      
      if (esAccion) {
        const botMsg: Mensaje = {
          id: (Date.now() + 1).toString(),
          texto: accionRespuesta,
          esUsuario: false,
          timestamp: new Date(),
          detalles: { esAccion: true, accionExitosa: exitosa }
        };
        setMensajes(prev => [...prev, botMsg]);
        await guardarEnHistorial(pregunta, accionRespuesta, 0);
        setCargando(false);
        
        if (exitosa) {
          const sugerencia = await sugerirStockBajo();
          if (sugerencia) {
            setTimeout(() => {
              const sugerenciaMsg: Mensaje = {
                id: (Date.now() + 2).toString(),
                texto: sugerencia,
                esUsuario: false,
                timestamp: new Date()
              };
              setMensajes(prev => [...prev, sugerenciaMsg]);
            }, 1000);
          }
        }
        return;
      }
      
      const response = await fetch('/api/deepseek/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pregunta,
          contexto: { productos }
        })
      });

      const data = await response.json();
      let respuestaTexto = data.respuesta || "Lo siento, no pude procesar tu pregunta.";
      
      await guardarEnHistorial(pregunta, respuestaTexto, data.productos_encontrados || 0);
      
      const botMsg: Mensaje = {
        id: (Date.now() + 1).toString(),
        texto: respuestaTexto,
        esUsuario: false,
        timestamp: new Date(),
        detalles: {
          productosEncontrados: data.productos_encontrados || 0,
          criterio: data.criterio_busqueda
        }
      };
      setMensajes(prev => [...prev, botMsg]);
      
      if (pregunta.toLowerCase().includes('producto') || pregunta.toLowerCase().includes('tienes')) {
        const sugerencia = await sugerirStockBajo();
        if (sugerencia) {
          setTimeout(() => {
            const sugerenciaMsg: Mensaje = {
              id: (Date.now() + 2).toString(),
              texto: sugerencia,
              esUsuario: false,
              timestamp: new Date()
            };
            setMensajes(prev => [...prev, sugerenciaMsg]);
          }, 1500);
        }
      }
      
    } catch (error) {
      console.error("Error en enviarMensaje:", error);
      const errorMsg: Mensaje = {
        id: (Date.now() + 1).toString(),
        texto: "❌ Error de conexión. Intenta nuevamente.",
        esUsuario: false,
        timestamp: new Date()
      };
      setMensajes(prev => [...prev, errorMsg]);
    } finally {
      setCargando(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  const renderMensaje = (msg: Mensaje) => {
    let contenido = msg.texto;
    
    contenido = contenido.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    contenido = contenido.replace(/\n/g, '<br/>');
    contenido = contenido.replace(/^\d+\. /gm, '• ');
    contenido = contenido.replace(/•/g, '<span class="text-blue-500 mr-1">•</span>');
    contenido = contenido.replace(/---/g, '<hr class="my-2 border-slate-200"/>');
    contenido = contenido.replace(/\b(\d{7,})\b/g, '<code class="bg-slate-100 px-1 rounded text-xs font-mono">$1</code>');
    contenido = contenido.replace(/\$\d{1,3}(?:\.\d{3})*/g, match => `<span class="font-bold text-emerald-600">${match}</span>`);
    
    const bgColor = msg.esUsuario 
      ? 'bg-[#00338d] text-white rounded-br-none'
      : msg.detalles?.esAccion 
        ? msg.detalles.accionExitosa 
          ? 'bg-emerald-50 border border-emerald-200 text-slate-700 rounded-bl-none'
          : 'bg-amber-50 border border-amber-200 text-slate-700 rounded-bl-none'
        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm';
    
    return (
      <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${bgColor}`}>
        <div 
          className="whitespace-pre-wrap break-words"
          dangerouslySetInnerHTML={{ __html: contenido }}
        />
        <div className={`text-[9px] mt-1 flex justify-between items-center ${msg.esUsuario ? 'text-blue-200' : 'text-slate-400'}`}>
          <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {msg.detalles?.productosEncontrados !== undefined && msg.detalles.productosEncontrados > 0 && (
            <span className="text-[8px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">
              🎯 {msg.detalles.productosEncontrados} resultados
            </span>
          )}
          {msg.detalles?.esAccion && msg.detalles.accionExitosa && (
            <span className="text-[8px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">
              ✅ Acción completada
            </span>
          )}
          {recargandoLista && (
            <span className="text-[8px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
              🔄 Actualizando...
            </span>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-[#00338d] text-white p-4 rounded-full shadow-2xl hover:bg-blue-800 transition-all z-50 group"
      >
        <Bot size={28} />
        <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
          IA
        </span>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 transition-all duration-300 ${
      isMinimized ? 'w-80 h-14' : 'w-[550px] h-[680px]'
    }`}>
      <div className="bg-[#00338d] text-white p-4 rounded-t-2xl flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bot size={18} />
          <span className="font-bold text-sm">Asistente Obuma IA</span>
          {!cargandoProductos && productos.length > 0 && (
            <span className="bg-emerald-400/30 text-[9px] font-bold px-2 py-0.5 rounded-full">
              📦 {productos.length}
            </span>
          )}
          {recargandoLista && (
            <span className="bg-blue-400/30 text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse">
              🔄
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={cargarHistorial}
            className="hover:bg-blue-700 p-1 rounded transition-colors"
            title="Ver historial"
          >
            <History size={16} />
          </button>
          <button
            onClick={async () => {
              setRecargandoLista(true);
              await cargarProductos();
              setRecargandoLista(false);
              const refreshMsg: Mensaje = {
                id: Date.now().toString(),
                texto: `🔄 Lista actualizada: ${productos.length} productos en inventario.`,
                esUsuario: false,
                timestamp: new Date()
              };
              setMensajes(prev => [...prev, refreshMsg]);
            }}
            className="hover:bg-blue-700 p-1 rounded transition-colors"
            title="Recargar productos"
          >
            <RefreshCw size={16} className={recargandoLista ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="hover:bg-blue-700 p-1 rounded transition-colors"
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="hover:bg-blue-700 p-1 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {cargandoProductos ? (
              <div className="flex justify-center items-center h-32">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            ) : (
              <>
                {mensajes.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.esUsuario ? 'justify-end' : 'justify-start'}`}
                  >
                    {renderMensaje(msg)}
                  </div>
                ))}
                {cargando && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none shadow-sm">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={mensajesEndRef} />
          </div>

          <div className="px-4 pt-2 pb-1 bg-slate-50 border-t border-slate-100">
            <div className="flex flex-wrap gap-1">
              {["¿Cuántos productos tenemos?", "Productos con poco stock", "Productos más caros", "Buscar por SKU", "Ver mi historial"].map((sug) => (
                <button
                  key={sug}
                  onClick={() => {
                    if (sug === "Ver mi historial") {
                      cargarHistorial();
                    } else {
                      setInput(sug);
                      enviarMensaje();
                    }
                  }}
                  className="text-[8px] bg-slate-100 hover:bg-slate-200 text-slate-500 px-2 py-1 rounded-full transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 bg-white rounded-b-2xl">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ej: 'busca film plastico' o 'cambia el precio del SKU 6026423727 a 15000' o 'actualiza stock del SKU 6026423727 a 50'"
                className="flex-1 p-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00338d] resize-none"
                rows={1}
                disabled={cargando}
              />
              <button
                onClick={enviarMensaje}
                disabled={cargando || !input.trim()}
                className="bg-[#00338d] text-white p-2 rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50"
              >
                <Send size={20} />
              </button>
            </div>
            <div className="text-[9px] text-slate-400 mt-2 text-center flex items-center justify-center gap-2">
              <span>🤖</span>
              <span>{productos.length > 0 ? `${productos.length} productos indexados` : "Cargando..."}</span>
              <button
                onClick={async () => {
                  setRecargandoLista(true);
                  await cargarProductos();
                  setRecargandoLista(false);
                  const refreshMsg: Mensaje = {
                    id: Date.now().toString(),
                    texto: `🔄 Actualizado: ${productos.length} productos en mi base de datos.`,
                    esUsuario: false,
                    timestamp: new Date()
                  };
                  setMensajes(prev => [...prev, refreshMsg]);
                }}
                className="text-[8px] text-blue-500 hover:text-blue-700 underline"
              >
                ↻ actualizar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}