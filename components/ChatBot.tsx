// components/ChatBot.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Minimize2, Maximize2, Bot, Search, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Mensaje {
  id: string;
  texto: string;
  esUsuario: boolean;
  timestamp: Date;
  detalles?: {
    productosEncontrados?: number;
    criterio?: string;
  };
}

interface ProductoReal {
  nombre: string;
  sku: string;
  precio: number;
  stock: number;
  categoria?: string;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: '1',
      texto: '👋 ¡Hola! Soy tu asistente de productos. Puedo ayudarte a buscar productos, verificar SKUs o responder preguntas sobre tu inventario. ¿En qué te ayudo?',
      esUsuario: false,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [productos, setProductos] = useState<ProductoReal[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const mensajesEndRef = useRef<HTMLDivElement>(null);

  // Cargar productos desde Supabase
  useEffect(() => {
    const cargarProductos = async () => {
      try {
        const { data, error } = await supabase
          .from('productos_obuma')
          .select('nombre, sku, precio_total, stock_actual, categoria_nombre')
          .eq('activo', true)
          .order('nombre');

        if (error) throw error;

        if (data && data.length > 0) {
          const productosMap = data.map((p: any) => ({
            nombre: p.nombre,
            sku: p.sku,
            precio: p.precio_total,
            stock: p.stock_actual,
            categoria: p.categoria_nombre
          }));
          setProductos(productosMap);
          console.log(`✅ ChatBot: ${productosMap.length} productos cargados`);
        }
      } catch (error) {
        console.error("Error cargando productos:", error);
      } finally {
        setCargandoProductos(false);
      }
    };
    
    cargarProductos();
  }, []);

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // Búsqueda local rápida (para respuestas inmediatas)
  const buscarLocalmente = (pregunta: string): ProductoReal[] => {
    const preguntaLower = pregunta.toLowerCase();
    const palabrasClave = preguntaLower.split(' ').filter(p => p.length > 2);
    
    // Buscar por SKU exacto (prioridad máxima)
    const skuMatch = /\d{7,}/.exec(pregunta);
    if (skuMatch) {
      const exacto = productos.filter(p => p.sku === skuMatch[0]);
      if (exacto.length > 0) return exacto;
    }
    
    // Buscar coincidencias
    return productos.filter(p => {
      const textoBusqueda = `${p.nombre} ${p.sku} ${p.categoria || ''}`.toLowerCase();
      
      // Coincidencia exacta de la frase
      if (textoBusqueda.includes(preguntaLower)) return true;
      
      // Coincidencia por palabras clave
      return palabrasClave.every(palabra => textoBusqueda.includes(palabra));
    });
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
      // Búsqueda local primero
      const resultadosLocales = buscarLocalmente(pregunta);
      
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
      
    } catch (error) {
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
    
    // Mejorar formato
    contenido = contenido.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    contenido = contenido.replace(/\n/g, '<br/>');
    contenido = contenido.replace(/^\d+\. /gm, '• ');
    contenido = contenido.replace(/└/g, '&nbsp;&nbsp;&nbsp;↳');
    contenido = contenido.replace(/---/g, '<hr class="my-2 border-slate-200"/>');
    
    // Resaltar SKUs
    contenido = contenido.replace(/\b(\d{7,})\b/g, '<code class="bg-slate-100 px-1 rounded text-xs">$1</code>');
    
    // Resaltar precios
    contenido = contenido.replace(/\$\d{1,3}(?:\.\d{3})*/g, match => `<span class="font-bold text-emerald-600">${match}</span>`);
    
    return (
      <div
        className={`max-w-[85%] p-3 rounded-2xl text-sm ${
          msg.esUsuario
            ? 'bg-[#00338d] text-white rounded-br-none'
            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
        }`}
      >
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
      isMinimized ? 'w-80 h-14' : 'w-[500px] h-[650px]'
    }`}>
      {/* Header */}
      <div className="bg-[#00338d] text-white p-4 rounded-t-2xl flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bot size={18} />
          <span className="font-bold text-sm">Asistente Obuma IA</span>
          {!cargandoProductos && productos.length > 0 && (
            <span className="bg-emerald-400/30 text-[9px] font-bold px-2 py-0.5 rounded-full">
              📦 {productos.length}
            </span>
          )}
        </div>
        <div className="flex gap-2">
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
          {/* Mensajes */}
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

          {/* Sugerencias rápidas */}
          <div className="px-4 pt-2 pb-1 bg-slate-50 border-t border-slate-100">
            <div className="flex flex-wrap gap-1">
              {["¿Cuántos productos tenemos?", "Productos con poco stock", "Productos más caros", "Buscar por SKU"].map((sug) => (
                <button
                  key={sug}
                  onClick={() => {
                    setInput(sug);
                    enviarMensaje();
                  }}
                  className="text-[8px] bg-slate-100 hover:bg-slate-200 text-slate-500 px-2 py-1 rounded-full transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-200 bg-white rounded-b-2xl">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ej: 'busca film plastico' o 'tienes copla pvc' o 'SKU 6026423727'"
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
            <div className="text-[9px] text-slate-400 mt-2 text-center">
              🔍 Búsqueda precisa por nombre, SKU o categoría | {productos.length} productos indexados
            </div>
          </div>
        </>
      )}
    </div>
  );
}