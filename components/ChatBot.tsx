// components/ChatBot.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Minimize2, Maximize2, Bot } from 'lucide-react';

interface Mensaje {
  id: string;
  texto: string;
  esUsuario: boolean;
  timestamp: Date;
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
      texto: '👋 ¡Hola! Soy tu asistente de productos. Puedo ayudarte a buscar productos, verificar SKUs o responder preguntas sobre tu inventario real de Obuma. ¿En qué te ayudo?',
      esUsuario: false,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [productosReales, setProductosReales] = useState<ProductoReal[]>([]);
  const mensajesEndRef = useRef<HTMLDivElement>(null);

  // Cargar productos reales al iniciar el chat
  useEffect(() => {
    const cargarProductos = async () => {
      try {
        const response = await fetch('/api/obuma/productos/list?limit=10000');
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          const productos = data.data.map((p: any) => ({
            nombre: p.producto_nombre || '',
            sku: p.producto_codigo_comercial || '',
            precio: p.producto_precio_clp_total || 0,
            stock: p.stock_actual || 0,
            categoria: p.categoria_nombre || ''
          }));
          setProductosReales(productos);
          console.log(`✅ Cargados ${productos.length} productos reales para el chat`);
        }
      } catch (error) {
        console.error("Error cargando productos para el chat:", error);
      }
    };
    
    cargarProductos();
  }, []);

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

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
      // Enviar pregunta junto con productos reales como contexto
      const response = await fetch('/api/deepseek/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pregunta,
          contexto: {
            productos: productosReales.slice(0, 50) // Enviamos hasta 50 productos como contexto
          }
        })
      });

      const data = await response.json();
      
      let respuestaTexto = data.respuesta || data.error || "Lo siento, no pude procesar tu pregunta.";
      
      // Si la respuesta es muy larga, formatearla mejor
      if (respuestaTexto.length > 500 && !respuestaTexto.includes('\n')) {
        respuestaTexto = respuestaTexto.slice(0, 500) + '...';
      }
      
      const botMsg: Mensaje = {
        id: (Date.now() + 1).toString(),
        texto: respuestaTexto,
        esUsuario: false,
        timestamp: new Date()
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
      isMinimized ? 'w-80 h-14' : 'w-96 h-[550px]'
    }`}>
      {/* Header */}
      <div className="bg-[#00338d] text-white p-4 rounded-t-2xl flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bot size={18} />
          <span className="font-bold text-sm">Asistente Obuma IA</span>
          {productosReales.length > 0 && (
            <span className="bg-emerald-400/30 text-[8px] font-bold px-1.5 py-0.5 rounded-full">
              {productosReales.length} productos
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
            {mensajes.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.esUsuario ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.esUsuario
                      ? 'bg-[#00338d] text-white rounded-br-none'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {msg.texto}
                  </div>
                  <div className={`text-[9px] mt-1 ${msg.esUsuario ? 'text-blue-200' : 'text-slate-400'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {cargando && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
            <div ref={mensajesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-200 bg-white rounded-b-2xl">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu pregunta... Ej: '¿Qué productos tengo?' o 'Busca el SKU 50...'"
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
              <span>{productosReales.length > 0 ? `${productosReales.length} productos en inventario` : "Conectando con Obuma..."}</span>
              <button
                onClick={async () => {
                  const response = await fetch('/api/obuma/productos/list?limit=10000');
                  const data = await response.json();
                  if (data.data) {
                    const productos = data.data.map((p: any) => ({
                      nombre: p.producto_nombre || '',
                      sku: p.producto_codigo_comercial || '',
                      precio: p.producto_precio_clp_total || 0,
                      stock: p.stock_actual || 0
                    }));
                    setProductosReales(productos);
                    const refreshMsg: Mensaje = {
                      id: Date.now().toString(),
                      texto: `🔄 Actualizado: Tengo ${productos.length} productos reales en mi base de datos. ¡Pregúntame sobre ellos!`,
                      esUsuario: false,
                      timestamp: new Date()
                    };
                    setMensajes(prev => [...prev, refreshMsg]);
                  }
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