"use client";
import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, Loader2, Bot, User } from "lucide-react";

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [chat, setChat] = useState<{ rol: 'user' | 'ia', texto: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat, loading]);

  const enviarPregunta = async () => {
    if (!mensaje.trim() || loading) return;

    const query = mensaje;
    setMensaje("");
    setChat(prev => [...prev, { rol: 'user', texto: query }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: query }),
      });
      
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      setChat(prev => [...prev, { rol: 'ia', texto: data.respuesta }]);
    } catch (e) {
      setChat(prev => [...prev, { rol: 'ia', texto: "No pude conectar con DeepSeek. ¿Revisaste la API Key en el .env?" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[999]">
      {/* Botón Flotante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all hover:bg-slate-900 border-4 border-white"
        >
          <MessageSquare size={28} />
        </button>
      )}

      {/* Ventana de Chat */}
      {isOpen && (
        <div className="w-[380px] h-[550px] bg-white rounded-3xl shadow-[-20px_20px_60px_rgba(0,0,0,0.2)] border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
          
          {/* Header */}
          <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[2px] text-blue-400">Intranet IA</p>
                <p className="text-sm font-bold">Asistente DeepSeek</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="bg-slate-800 p-2 rounded-full hover:bg-red-500 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Área de Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {chat.length === 0 && (
              <div className="text-center py-10">
                <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bot size={24} className="text-slate-400" />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">
                  Hola Alexis, ¿analizamos algo de Obuma hoy?
                </p>
              </div>
            )}
            
            {chat.map((m, i) => (
              <div key={i} className={`flex ${m.rol === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[85%] ${m.rol === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${m.rol === 'user' ? 'bg-blue-100' : 'bg-slate-200'}`}>
                    {m.rol === 'user' ? <User size={14} className="text-blue-600" /> : <Bot size={14} className="text-slate-600" />}
                  </div>
                  <div className={`p-3 rounded-2xl text-xs font-medium leading-relaxed ${
                    m.rol === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none shadow-sm'
                  }`}>
                    {m.texto}
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start items-center gap-2">
                <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm">
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase animate-pulse">Pensando...</span>
              </div>
            )}
          </div>

          {/* Input de Texto */}
          <div className="p-4 bg-white border-t border-slate-100">
            <div className="flex gap-2 bg-slate-100 p-2 rounded-2xl">
              <input 
                className="flex-1 bg-transparent border-none px-2 py-1 text-xs font-bold outline-none placeholder:text-slate-400"
                placeholder="Escribe tu consulta..."
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviarPregunta()}
              />
              <button 
                onClick={enviarPregunta}
                disabled={loading}
                className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-all disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[9px] text-center text-slate-400 mt-2 font-medium">DeepSeek-V3 • IA Integrada en Intranet</p>
          </div>
        </div>
      )}
    </div>
  );
}