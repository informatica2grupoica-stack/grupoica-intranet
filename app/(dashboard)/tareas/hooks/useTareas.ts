'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface Tarea {
  id: string;
  titulo: string;
  descripcion: string;
  prioridad: 'baja' | 'media' | 'alta';
  estado: 'pendiente' | 'en_proceso' | 'completada';
  asignado_a: string;
  creado_por: string;
  proyecto: string;
  fecha_inicio: string;
  fecha_limite: string;
  horas_estimadas: number;
  horas_reales: number;
  progreso: number;
  depende_de: string[];
  etiquetas: string[];
  created_at: string;
  responsable?: { nombre: string; apellido: string };
  creador?: { nombre: string; apellido: string };
  comentarios?: [{ count: number }];
}

export function useTareas() {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [perfilUsuario, setPerfilUsuario] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState({
    total: 0,
    completadas: 0,
    en_proceso: 0,
    pendientes: 0,
    atrasadas: 0,
    progreso_general: 0
  });

  async function fetchTareas() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      setPerfilUsuario(perfil);

      let query = supabase.from('tareas').select(`
        *,
        responsable:perfiles!tareas_asignado_a_fkey(id, nombre, apellido),
        creador:perfiles!tareas_creado_por_fkey(id, nombre, apellido),
        comentarios:comentarios_tareas(count)
      `);

      if (perfil?.rol === 'user') {
        query = query.or(`asignado_a.eq.${perfil.id},creado_por.eq.${perfil.id}`);
      }

      const { data: tareasData } = await query.order('created_at', { ascending: false });
      
      if (tareasData) {
        setTareas(tareasData);
        
        // Calcular estadísticas
        const hoy = new Date();
        const completadas = tareasData.filter(t => t.estado === 'completada').length;
        const en_proceso = tareasData.filter(t => t.estado === 'en_proceso').length;
        const pendientes = tareasData.filter(t => t.estado === 'pendiente').length;
        const atrasadas = tareasData.filter(t => {
          if (t.estado === 'completada') return false;
          if (!t.fecha_limite) return false;
          return new Date(t.fecha_limite) < hoy;
        }).length;
        
        const progresoGeneral = tareasData.length > 0 
          ? Math.round((completadas / tareasData.length) * 100) 
          : 0;
        
        setEstadisticas({
          total: tareasData.length,
          completadas,
          en_proceso,
          pendientes,
          atrasadas,
          progreso_general: progresoGeneral
        });
      }

      const { data: users } = await supabase
        .from('perfiles')
        .select('id, nombre, apellido')
        .eq('activo', true);
      if (users) setUsuarios(users);
      
    } catch (error) {
      console.error("Error cargando tareas:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTareas();
    
    const channel = supabase.channel('tareas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, () => fetchTareas())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios_tareas' }, () => fetchTareas())
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, []);

  return { tareas, usuarios, perfilUsuario, loading, estadisticas, fetchTareas };
}