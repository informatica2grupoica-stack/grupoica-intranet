// components/ChatBot.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Send, Minimize2, Maximize2, Bot, History, RefreshCw } from 'lucide-react';
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

interface ClienteReal {
  id: string;
  razon_social: string;
  rut: string;
  email: string;
  telefono: string;
  estado: boolean;
  total_contactos: number;
  total_direcciones: number;
}

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol?: string;
}

const SUGGESTIONS = [
  '¿Cuántos productos tenemos?',
  '¿Cuántos clientes activos?',
  'Productos sin stock',
  'Tareas pendientes',
];

export default function ChatBot() {
  const [isOpen, setIsOpen]       = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mensajes, setMensajes]   = useState<Mensaje[]>([{
    id: '1',
    texto: '✨ Hola, soy tu asistente Gemini. Puedo buscar productos, clientes, consultar stock, cambiar precios y responder preguntas sobre tu base de datos.\n\n¿En qué te ayudo?',
    esUsuario: false,
    timestamp: new Date(),
  }]);
  const [input, setInput]         = useState('');
  const [cargando, setCargando]   = useState(false);
  const [productos, setProductos] = useState<ProductoReal[]>([]);
  const [clientes, setClientes]   = useState<ClienteReal[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [usuario, setUsuario]     = useState<Usuario | null>(null);
  const [recargando, setRecargando] = useState(false);
  const messagesEndRef            = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: perfil } = await supabase
          .from('perfiles').select('nombre, rol').eq('user_id', session.user.id).single();
        setUsuario({
          id: session.user.id,
          email: session.user.email || '',
          nombre: perfil?.nombre || session.user.email?.split('@')[0] || 'Usuario',
          rol: perfil?.rol || 'usuario',
        });
      }
    })();
  }, []);

  const cargarProductos = async () => {
    const { data } = await supabase
      .from('productos_obuma')
      .select('id, nombre, sku, precio_total, stock_actual, categoria_nombre')
      .eq('activo', true).order('nombre');
    if (data) {
      setProductos(data.map((p: any) => ({
        id: p.id, nombre: p.nombre, sku: p.sku,
        precio: p.precio_total, stock: p.stock_actual, categoria: p.categoria_nombre,
      })));
    }
  };

  const cargarClientes = async () => {
    const { data } = await supabase
      .from('clientes_obuma')
      .select('id, razon_social, rut, email, telefono, estado, total_contactos, total_direcciones')
      .eq('estado', true).order('razon_social');
    if (data) {
      setClientes(data.map((c: any) => ({
        id: c.id, razon_social: c.razon_social, rut: c.rut || '',
        email: c.email || '', telefono: c.telefono || '',
        estado: c.estado, total_contactos: c.total_contactos || 0, total_direcciones: c.total_direcciones || 0,
      })));
    }
  };

  useEffect(() => {
    (async () => {
      setCargandoDatos(true);
      await Promise.all([cargarProductos(), cargarClientes()]);
      setCargandoDatos(false);
    })();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const detectarYEjecutarAccion = async (pregunta: string): Promise<{ esAccion: boolean; respuesta: string; exitosa: boolean }> => {
    const p = pregunta.toLowerCase();
    const precioMatch = p.match(/(?:cambia|actualiza|modifica|setea).*?precio.*?(?:sku|codigo|producto)\s*(\d{7,}).*?a\s*(\d+(?:\.\d+)?)/i);
    if (precioMatch) {
      const sku = precioMatch[1];
      const nuevoPrecio = parseInt(precioMatch[2]);
      const producto = productos.find(x => x.sku === sku);
      if (!producto) return { esAccion: true, respuesta: `❌ No encontré el producto con SKU ${sku}.`, exitosa: false };
      try {
        const getRes = await fetch(`/api/obuma/productos/list?codigo_sku=${sku}`);
        const getData = await getRes.json();
        const productoActual = getData.data?.[0];
        if (!productoActual) return { esAccion: true, respuesta: `❌ No se encontraron datos del producto.`, exitosa: false };
        const nuevoPrecioBruto = Math.round(nuevoPrecio * 1.19);
        const updateRes = await fetch(`/api/obuma/productos/${producto.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...productoActual, precio_venta: nuevoPrecioBruto, precio_neto: nuevoPrecio, venta_incluye_iva: true, nombre_completo: producto.nombre, sku: producto.sku, tipo: productoActual.tipo || 'Producto', categoria_id: productoActual.categoria_id || '', subcategoria_id: productoActual.subcategoria_id || '', se_puede_vender: true, se_puede_comprar: true, se_mantiene_stock: true }),
        });
        if (updateRes.ok) {
          await Promise.all([cargarProductos(), cargarClientes()]);
          return { esAccion: true, respuesta: `✅ Precio actualizado!\n\n📦 ${producto.nombre}\n💰 Nuevo precio: $${nuevoPrecioBruto.toLocaleString('es-CL')}\n📌 SKU: ${sku}`, exitosa: true };
        }
        return { esAccion: true, respuesta: `❌ Error al actualizar el precio.`, exitosa: false };
      } catch { return { esAccion: true, respuesta: `❌ Error de conexión.`, exitosa: false }; }
    }

    const stockMatch = p.match(/(?:cambia|actualiza|modifica|setea).*?stock.*?(?:sku|codigo|producto)\s*(\d{7,}).*?a\s*(\d+)/i);
    if (stockMatch) {
      const sku = stockMatch[1];
      const nuevoStock = parseInt(stockMatch[2]);
      const producto = productos.find(x => x.sku === sku);
      if (!producto) return { esAccion: true, respuesta: `❌ No encontré el producto con SKU ${sku}.`, exitosa: false };
      const diferencia = nuevoStock - (producto.stock || 0);
      if (diferencia === 0) return { esAccion: true, respuesta: `ℹ️ El producto ya tiene ${nuevoStock} unidades.`, exitosa: true };
      try {
        const res = await fetch('/api/obuma/stock', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sku, cantidad: Math.abs(diferencia), tipo_movimiento: diferencia > 0 ? 'ENTRADA' : 'SALIDA', concepto: 'Actualización por ChatBot', referencia: `Ajuste a ${nuevoStock} unidades` }),
        });
        const data = await res.json();
        if (data.success) {
          await Promise.all([cargarProductos(), cargarClientes()]);
          return { esAccion: true, respuesta: `✅ Stock actualizado!\n\n📦 ${producto.nombre}\n📊 ${producto.stock} → ${nuevoStock} unidades`, exitosa: true };
        }
        return { esAccion: true, respuesta: `❌ Error al actualizar stock.`, exitosa: false };
      } catch { return { esAccion: true, respuesta: `❌ Error de conexión.`, exitosa: false }; }
    }

    return { esAccion: false, respuesta: '', exitosa: false };
  };

  const guardarHistorial = async (pregunta: string, respuesta: string, productosEncontrados = 0) => {
    if (!usuario) return;
    await fetch('/api/chatbot/historial', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: usuario.id, usuario_nombre: usuario.nombre, pregunta, respuesta, productos_encontrados: productosEncontrados }),
    }).catch(() => {});
  };

  const cargarHistorial = async () => {
    if (!usuario) return;
    setCargando(true);
    try {
      const res = await fetch(`/api/chatbot/historial?usuario_id=${usuario.id}&limit=15`);
      const data = await res.json();
      const texto = data.historial?.length
        ? `📜 **Últimas conversaciones:**\n\n${data.historial.map((h: any, i: number) => `${i + 1}. ❓ **${h.pregunta.slice(0, 60)}${h.pregunta.length > 60 ? '...' : ''}**\n   💡 ${h.respuesta.slice(0, 100)}...`).join('\n\n')}`
        : '📜 No hay conversaciones previas aún.';
      setMensajes(prev => [...prev, { id: Date.now().toString(), texto, esUsuario: false, timestamp: new Date() }]);
    } catch {
      setMensajes(prev => [...prev, { id: Date.now().toString(), texto: '❌ Error al cargar el historial.', esUsuario: false, timestamp: new Date() }]);
    } finally {
      setCargando(false);
    }
  };

  const enviarMensaje = async (textoOverride?: string) => {
    const pregunta = (textoOverride ?? input).trim();
    if (!pregunta || cargando) return;
    setInput('');

    const userMsg: Mensaje = { id: Date.now().toString(), texto: pregunta, esUsuario: true, timestamp: new Date() };
    setMensajes(prev => [...prev, userMsg]);
    setCargando(true);

    try {
      const { esAccion, respuesta: accionRespuesta, exitosa } = await detectarYEjecutarAccion(pregunta);
      if (esAccion) {
        setMensajes(prev => [...prev, { id: (Date.now() + 1).toString(), texto: accionRespuesta, esUsuario: false, timestamp: new Date(), detalles: { esAccion: true, accionExitosa: exitosa } }]);
        await guardarHistorial(pregunta, accionRespuesta);
        setCargando(false);
        return;
      }

      const historialReciente = mensajes.slice(-6).map(m => ({ role: m.esUsuario ? 'user' : 'assistant', content: m.texto }));

      const response = await fetch('/api/deepseek/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta, usuario_rol: usuario?.rol || 'usuario', historial_reciente: historialReciente, contexto: { productos, clientes } }),
      });
      const data = await response.json();
      const respuestaTexto = data.respuesta || 'Lo siento, no pude procesar tu pregunta.';

      await guardarHistorial(pregunta, respuestaTexto, data.productos_encontrados || 0);
      setMensajes(prev => [...prev, { id: (Date.now() + 1).toString(), texto: respuestaTexto, esUsuario: false, timestamp: new Date(), detalles: { productosEncontrados: data.productos_encontrados || 0, criterio: data.criterio_busqueda } }]);
    } catch {
      setMensajes(prev => [...prev, { id: (Date.now() + 1).toString(), texto: '❌ Error de conexión. Intenta nuevamente.', esUsuario: false, timestamp: new Date() }]);
    } finally {
      setCargando(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensaje(); }
  };

  const formatMensaje = (msg: Mensaje) => {
    let html = msg.texto
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>')
      .replace(/•/g, '<span class="text-[#3B82F6] mr-1">•</span>')
      .replace(/---/g, '<hr class="my-2 border-slate-200"/>')
      .replace(/\b(\d{7,})\b/g, '<code class="bg-slate-100 px-1 rounded text-xs font-mono">$1</code>')
      .replace(/\$\d{1,3}(?:\.\d{3})*/g, m => `<span class="font-bold text-emerald-600">${m}</span>`);

    const bubble = msg.esUsuario
      ? 'bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white rounded-br-none shadow-md shadow-blue-500/20'
      : msg.detalles?.esAccion
        ? msg.detalles.accionExitosa
          ? 'bg-emerald-50 border border-emerald-200 text-slate-700 rounded-bl-none'
          : 'bg-amber-50 border border-amber-200 text-slate-700 rounded-bl-none'
        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm';

    return (
      <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm ${bubble}`}>
        <div className="whitespace-pre-wrap break-words leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
        <div className={`text-[9px] mt-1.5 flex justify-between items-center gap-2 ${msg.esUsuario ? 'text-blue-200' : 'text-slate-400'}`}>
          <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {msg.detalles?.productosEncontrados !== undefined && msg.detalles.productosEncontrados > 0 && (
            <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
              🎯 {msg.detalles.productosEncontrados} resultados
            </span>
          )}
          {msg.detalles?.esAccion && msg.detalles.accionExitosa && (
            <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">✅ Completado</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Botón flotante */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white rounded-2xl shadow-xl shadow-blue-500/40 flex items-center justify-center z-50"
          >
            <Bot size={24} />
            <span className="absolute -top-1 -right-1 bg-emerald-400 text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
              IA
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Ventana chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30, originX: 1, originY: 1 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className={`fixed bottom-6 right-6 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden transition-all duration-300 ${
              isMinimized ? 'w-80 h-14' : 'w-[520px] h-[660px]'
            }`}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1E293B] to-[#0F172A] text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-blue-900/30">
                  <Bot size={15} />
                </div>
                <div>
                  <p className="font-bold text-sm leading-none">Asistente Gemini</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Grupo ICA · IA</p>
                </div>
                {!cargandoDatos && (
                  <div className="flex gap-1 ml-1">
                    {productos.length > 0 && (
                      <span className="bg-white/10 text-[9px] font-bold px-2 py-0.5 rounded-full">📦 {productos.length}</span>
                    )}
                    {clientes.length > 0 && (
                      <span className="bg-white/10 text-[9px] font-bold px-2 py-0.5 rounded-full">👥 {clientes.length}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={cargarHistorial} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Historial">
                  <History size={14} />
                </button>
                <button
                  onClick={async () => {
                    setRecargando(true);
                    await Promise.all([cargarProductos(), cargarClientes()]);
                    setRecargando(false);
                    setMensajes(prev => [...prev, { id: Date.now().toString(), texto: `🔄 Datos actualizados: ${productos.length} productos, ${clientes.length} clientes.`, esUsuario: false, timestamp: new Date() }]);
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  title="Actualizar datos"
                >
                  <RefreshCw size={14} className={recargando ? 'animate-spin' : ''} />
                </button>
                <button onClick={() => setIsMinimized(s => !s)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Mensajes */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/80">
                  {cargandoDatos ? (
                    <div className="flex justify-center items-center h-32">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <motion.div
                            key={i}
                            animate={{ y: [0, -8, 0] }}
                            transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.15 }}
                            className="w-2 h-2 bg-[#2563EB]/40 rounded-full"
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <AnimatePresence initial={false}>
                        {mensajes.map((msg) => (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 12, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                            className={`flex ${msg.esUsuario ? 'justify-end' : 'justify-start'}`}
                          >
                            {formatMensaje(msg)}
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {cargando && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-slate-200 p-3.5 rounded-2xl rounded-bl-none shadow-sm">
                            <div className="flex gap-1">
                              {[0, 1, 2].map(i => (
                                <motion.div
                                  key={i}
                                  animate={{ y: [0, -6, 0] }}
                                  transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.13 }}
                                  className="w-1.5 h-1.5 bg-[#2563EB]/50 rounded-full"
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Sugerencias */}
                <div className="px-4 pt-2 pb-1 bg-white border-t border-slate-100">
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => enviarMensaje(s)}
                        className="text-[10px] bg-slate-50 hover:bg-[#EFF6FF] hover:text-[#2563EB] border border-slate-200 hover:border-[#2563EB]/30 text-slate-500 px-2.5 py-1 rounded-full transition-all font-medium"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input */}
                <div className="p-3 bg-white border-t border-slate-100">
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKey}
                      placeholder="Pregunta o da una instrucción..."
                      className="flex-1 p-2.5 bg-slate-50 border border-slate-200 focus:border-[#2563EB]/40 focus:bg-white rounded-xl text-sm outline-none resize-none transition-all"
                      rows={1}
                      disabled={cargando}
                    />
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => enviarMensaje()}
                      disabled={cargando || !input.trim()}
                      className="w-10 h-10 bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white rounded-xl flex items-center justify-center shadow-md shadow-blue-500/25 disabled:opacity-40 transition-opacity flex-shrink-0"
                    >
                      <Send size={16} />
                    </motion.button>
                  </div>
                  <p className="text-[9px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Gemini 2.0 Flash · {productos.length} prods · {clientes.length} clientes
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
