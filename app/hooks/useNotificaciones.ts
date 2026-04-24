// hooks/useNotificaciones.ts
'use client';
import { useState, useEffect, useCallback } from 'react';

export interface Notificacion {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  link: string | null;
  leida: boolean;
  created_at: string;
}

export function useNotificaciones(usuarioId: string | null) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarNotificaciones = useCallback(async () => {
    if (!usuarioId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/rrhh/notificaciones?usuarioId=${usuarioId}`);
      const result = await response.json();
      
      if (response.ok) {
        setNotificaciones(result.data || []);
        setNoLeidas((result.data || []).filter((n: Notificacion) => !n.leida));
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [usuarioId]);

  const marcarComoLeida = async (notificacionId: string) => {
    try {
      const response = await fetch('/api/rrhh/notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificacionId }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setNotificaciones(prev =>
          prev.map(n => n.id === notificacionId ? { ...n, leida: true } : n)
        );
        setNoLeidas(prev => prev.filter(n => n.id !== notificacionId));
      }
    } catch (err) {
      console.error('Error marcando como leída:', err);
    }
  };

  const marcarTodasComoLeidas = async () => {
    for (const notif of noLeidas) {
      await marcarComoLeida(notif.id);
    }
  };

  useEffect(() => {
    if (usuarioId) {
      cargarNotificaciones();
      
      // Recargar cada 30 segundos
      const interval = setInterval(cargarNotificaciones, 30000);
      return () => clearInterval(interval);
    }
  }, [usuarioId, cargarNotificaciones]);

  return {
    notificaciones,
    noLeidas,
    loading,
    error,
    cargarNotificaciones,
    marcarComoLeida,
    marcarTodasComoLeidas,
  };
}