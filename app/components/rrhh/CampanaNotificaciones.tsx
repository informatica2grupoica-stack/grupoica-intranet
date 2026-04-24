// components/rrhh/CampanaNotificaciones.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, X, Calendar, FileText, Users, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useNotificaciones } from '@/app/hooks/useNotificaciones';

interface CampanaNotificacionesProps {
  usuarioId: string;
}

export default function CampanaNotificaciones({ usuarioId }: CampanaNotificacionesProps) {
  const [abierto, setAbierto] = useState(false);
  const [mostrando, setMostrando] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { noLeidas, notificaciones, marcarComoLeida, marcarTodasComoLeidas } = useNotificaciones(usuarioId);

  useEffect(() => {
    if (mostrando) {
      setAbierto(true);
    }
  }, [mostrando]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMostrando(false);
        setTimeout(() => setAbierto(false), 300);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcono = (tipo: string) => {
    switch (tipo) {
      case 'cumpleanos':
        return <Calendar size={14} className="text-amber-500" />;
      case 'contrato':
        return <FileText size={14} className="text-blue-500" />;
      case 'permiso':
        return <AlertCircle size={14} className="text-purple-500" />;
      default:
        return <Users size={14} className="text-emerald-500" />;
    }
  };

  const formatFecha = (fecha: string) => {
    const diff = new Date().getTime() - new Date(fecha).getTime();
    const horas = Math.floor(diff / (1000 * 60 * 60));
    if (horas < 1) return 'Hace unos momentos';
    if (horas < 24) return `Hace ${horas} horas`;
    return `Hace ${Math.floor(horas / 24)} días`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setMostrando(!mostrando)}
        className="relative p-2 text-slate-500 hover:text-blue-600 transition-colors rounded-xl hover:bg-slate-100"
      >
        <Bell size={20} />
        {noLeidas.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {noLeidas.length > 9 ? '9+' : noLeidas.length}
          </span>
        )}
      </button>

      {/* Dropdown de notificaciones */}
      {abierto && (
        <div className={`absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 transition-all duration-200 ${
          mostrando ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white">
            <h3 className="font-bold text-slate-800">Notificaciones</h3>
            {noLeidas.length > 0 && (
              <button
                onClick={marcarTodasComoLeidas}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <CheckCheck size={12} />
                Marcar todas
              </button>
            )}
          </div>

          {/* Lista de notificaciones */}
          <div className="max-h-96 overflow-y-auto">
            {notificaciones.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No hay notificaciones</p>
                <p className="text-[10px] text-slate-400">Las alertas aparecerán aquí</p>
              </div>
            ) : (
              notificaciones.slice(0, 10).map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${
                    !notif.leida ? 'bg-blue-50/30' : ''
                  }`}
                  onClick={() => {
                    if (!notif.leida) marcarComoLeida(notif.id);
                    if (notif.link) {
                      window.location.href = notif.link;
                    }
                  }}
                >
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      {getIcono(notif.tipo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{notif.titulo}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.mensaje}</p>
                      <p className="text-[9px] text-slate-400 mt-1">{formatFecha(notif.created_at)}</p>
                    </div>
                    {!notif.leida && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notificaciones.length > 0 && (
            <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
              <Link
                href="/rrhh/notificaciones"
                className="text-[10px] font-bold text-slate-500 hover:text-blue-600"
              >
                Ver todas las notificaciones
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}