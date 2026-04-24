// app/(dashboard)/rrhh/notificaciones/page.tsx
'use client';
import { useAuth } from '@/app/hooks/useAuth';
import { useNotificaciones } from '@/app/hooks/useNotificaciones';
import { Bell, CheckCheck, Calendar, FileText, Users, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function NotificacionesPage() {
  const { perfil } = useAuth();
  const { notificaciones, loading, marcarComoLeida, marcarTodasComoLeidas } = useNotificaciones(perfil?.id || null);

  const getIcono = (tipo: string) => {
    switch (tipo) {
      case 'cumpleanos':
        return <Calendar size={16} className="text-amber-500" />;
      case 'contrato':
        return <FileText size={16} className="text-blue-500" />;
      case 'permiso':
        return <AlertCircle size={16} className="text-purple-500" />;
      default:
        return <Users size={16} className="text-emerald-500" />;
    }
  };

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase italic">
            Notificaciones
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Alertas y recordatorios del sistema
          </p>
        </div>

        {notificaciones.filter(n => !n.leida).length > 0 && (
          <button
            onClick={marcarTodasComoLeidas}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            <CheckCheck size={14} />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Lista de notificaciones */}
      {notificaciones.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <Bell size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-bold text-lg">No hay notificaciones</p>
          <p className="text-slate-400 text-sm mt-1">Todas las alertas aparecerán aquí</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="divide-y divide-slate-100">
            {notificaciones.map((notif) => (
              <div
                key={notif.id}
                className={`p-5 hover:bg-slate-50 transition-colors cursor-pointer ${
                  !notif.leida ? 'bg-blue-50/20' : ''
                }`}
                onClick={() => {
                  if (!notif.leida) marcarComoLeida(notif.id);
                  if (notif.link) {
                    window.location.href = notif.link;
                  }
                }}
              >
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    {getIcono(notif.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-slate-800">{notif.titulo}</p>
                      {!notif.leida && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white">
                          Nueva
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{notif.mensaje}</p>
                    <p className="text-[10px] text-slate-400 mt-2">{formatFecha(notif.created_at)}</p>
                  </div>
                  {notif.link && (
                    <Link
                      href={notif.link}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Ver →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}