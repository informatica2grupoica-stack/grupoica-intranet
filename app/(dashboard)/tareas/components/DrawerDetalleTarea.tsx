// components/DrawerDetalleTarea.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  X, Calendar, User, Flag, CheckCircle, Clock, FolderOpen, 
  MessageCircle, UserCheck, CalendarDays, Send, Loader2, AlertCircle
} from 'lucide-react';

interface Comentario {
  id: string;
  created_at: string;
  contenido: string;
  perfil_id: string;
  tarea_id: string;
  perfil?: {
    nombre: string;
    apellido: string;
  };
}

interface DrawerDetalleTareaProps {
  tarea: any;
  perfilUsuario: any;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function DrawerDetalleTarea({ tarea, perfilUsuario, onClose, onUpdate }: DrawerDetalleTareaProps) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar comentarios al abrir el drawer
  useEffect(() => {
    cargarComentarios();
  }, [tarea.id]);

  const cargarComentarios = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('comentarios_tareas')
        .select(`
          *,
          perfil:perfiles!comentarios_tareas_perfil_id_fkey(
            nombre,
            apellido
          )
        `)
        .eq('tarea_id', tarea.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transformar los datos
      const comentariosFormateados = data?.map((c: any) => ({
        ...c,
        perfil: c.perfil?.[0] || null
      })) || [];

      setComentarios(comentariosFormateados);
    } catch (err: any) {
      console.error("Error cargando comentarios:", err);
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const enviarComentario = async () => {
    if (!nuevoComentario.trim()) return;
    if (!perfilUsuario?.id) {
      setError("No has iniciado sesión");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('comentarios_tareas')
        .insert([{
          tarea_id: tarea.id,
          perfil_id: perfilUsuario.id,
          contenido: nuevoComentario.trim()
        }])
        .select(`
          *,
          perfil:perfiles!comentarios_tareas_perfil_id_fkey(
            nombre,
            apellido
          )
        `)
        .single();

      if (error) throw error;

      // Agregar comentario a la lista
      const nuevoComentarioObj: Comentario = {
        ...data,
        perfil: data.perfil?.[0] || {
          nombre: perfilUsuario.nombre,
          apellido: perfilUsuario.apellido
        }
      };

      setComentarios(prev => [...prev, nuevoComentarioObj]);
      setNuevoComentario('');
      
      // Notificar actualización al padre
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error("Error enviando comentario:", err);
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const getPrioridadInfo = (prioridad: string) => {
    switch (prioridad) {
      case 'alta': return { color: 'text-red-600 bg-red-50', icon: Flag, text: 'Alta' };
      case 'media': return { color: 'text-yellow-600 bg-yellow-50', icon: Flag, text: 'Media' };
      case 'baja': return { color: 'text-green-600 bg-green-50', icon: Flag, text: 'Baja' };
      default: return { color: 'text-slate-600 bg-slate-50', icon: Flag, text: prioridad };
    }
  };

  const getEstadoInfo = (estado: string) => {
    switch (estado) {
      case 'completada': return { color: 'text-green-600 bg-green-50', icon: CheckCircle, text: 'Completada' };
      case 'en_proceso': return { color: 'text-blue-600 bg-blue-50', icon: Clock, text: 'En Proceso' };
      case 'pendiente': return { color: 'text-orange-600 bg-orange-50', icon: Clock, text: 'Pendiente' };
      default: return { color: 'text-slate-600 bg-slate-50', icon: Clock, text: estado };
    }
  };

  // 🔥 Función mejorada para obtener nombre completo
  const getNombreCompleto = (persona: any) => {
    if (!persona) return 'No asignado';
    
    // Si es un array, tomar el primer elemento
    if (Array.isArray(persona)) {
      if (persona.length === 0) return 'No asignado';
      persona = persona[0];
    }
    
    // Ahora debería ser un objeto
    if (persona && typeof persona === 'object') {
      const nombre = persona.nombre || '';
      const apellido = persona.apellido || '';
      const nombreCompleto = `${nombre} ${apellido}`.trim();
      return nombreCompleto || 'No asignado';
    }
    
    return 'No asignado';
  };

  const PrioridadInfo = getPrioridadInfo(tarea.prioridad);
  const EstadoInfo = getEstadoInfo(tarea.estado);
  const IconPrioridad = PrioridadInfo.icon;
  const IconEstado = EstadoInfo.icon;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-slate-900">{tarea.titulo}</h2>
              {tarea.proyecto && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <FolderOpen size={14} />
                  <span>{tarea.proyecto}</span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Prioridad y Estado */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`flex items-center gap-3 p-3 rounded-xl ${PrioridadInfo.color}`}>
                <IconPrioridad size={20} />
                <div>
                  <p className="text-xs font-medium uppercase opacity-70">Prioridad</p>
                  <p className="text-lg font-bold">{PrioridadInfo.text}</p>
                </div>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-xl ${EstadoInfo.color}`}>
                <IconEstado size={20} />
                <div>
                  <p className="text-xs font-medium uppercase opacity-70">Estado</p>
                  <p className="text-lg font-bold">{EstadoInfo.text}</p>
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <MessageCircle size={14} />
                Descripción
              </h3>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-slate-700 whitespace-pre-wrap">
                  {tarea.descripcion || 'Sin descripción'}
                </p>
              </div>
            </div>

            {/* Responsables */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <UserCheck size={14} />
                Responsables
              </h3>
              <div className="grid gap-3">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Asignado a:</p>
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-slate-400" />
                    <span className="font-medium text-slate-800">
                      {getNombreCompleto(tarea.responsable)}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Creado por:</p>
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-slate-400" />
                    <span className="font-medium text-slate-800">
                      {getNombreCompleto(tarea.creador)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fechas */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <CalendarDays size={14} />
                Cronograma
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Fecha de inicio</p>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-slate-400" />
                    <span className="font-medium text-slate-800">
                      {tarea.fecha_inicio ? new Date(tarea.fecha_inicio).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'No definida'}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Fecha límite</p>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-slate-400" />
                    <span className="font-medium text-slate-800">
                      {tarea.fecha_limite ? new Date(tarea.fecha_limite).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'No definida'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comentarios */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <MessageCircle size={14} />
                Comentarios ({comentarios.length})
              </h3>
              
              {/* Lista de comentarios */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {cargando ? (
                  <div className="flex justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-slate-400" />
                  </div>
                ) : comentarios.length === 0 ? (
                  <div className="bg-slate-50 rounded-xl p-8 text-center">
                    <MessageCircle size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-500 text-sm">No hay comentarios aún</p>
                    <p className="text-slate-400 text-xs">Sé el primero en comentar</p>
                  </div>
                ) : (
                  comentarios.map((comentario) => (
                    <div key={comentario.id} className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User size={14} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-slate-800">
                              {comentario.perfil?.nombre || 'Usuario'} {comentario.perfil?.apellido || ''}
                            </p>
                            <p className="text-xs text-slate-400">
                              {new Date(comentario.created_at).toLocaleString('es-CL')}
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-700 text-sm ml-10">
                        {comentario.contenido}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-500" />
                  <p className="text-xs text-rose-600">{error}</p>
                </div>
              )}

              {/* Input para nuevo comentario */}
              {perfilUsuario && (
                <div className="mt-4">
                  <textarea
                    value={nuevoComentario}
                    onChange={(e) => setNuevoComentario(e.target.value)}
                    placeholder="Escribe un comentario..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={enviarComentario}
                      disabled={!nuevoComentario.trim() || enviando}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                    >
                      {enviando ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          Enviar comentario
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Metadatos */}
            <div className="text-xs text-slate-400 pt-4 border-t border-slate-200">
              <p>Creada el: {new Date(tarea.created_at).toLocaleString('es-CL')}</p>
              <p className="text-[9px] font-mono mt-1">ID: {tarea.id}</p>
            </div>
          </div>

          {/* Footer con acciones */}
          <div className="p-6 border-t border-slate-200 bg-slate-50">
            <div className="flex gap-3">
              <button className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors">
                Editar tarea
              </button>
              <button className="flex-1 px-4 py-2 border border-slate-300 hover:bg-white text-slate-700 rounded-xl font-bold text-sm transition-colors">
                Ver historial
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
}