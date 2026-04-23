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
    created_at: string;
    responsable?: { nombre: string; apellido: string };
    creador?: { nombre: string; apellido: string };
    comentarios?: { count: number };
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
            if (!session) {
                console.log("No hay sesión activa");
                setLoading(false);
                return;
            }

            // Obtener perfil del usuario
            let perfil = null;
            const { data: perfilData, error: perfilError } = await supabase
                .from('perfiles')
                .select('*')
                .eq('user_id', session.user.id)
                .maybeSingle();
            
            if (perfilError) {
                console.error("Error obteniendo perfil:", perfilError);
            }
            
            if (!perfilData) {
                console.log("Usuario sin perfil, creando perfil por defecto...");
                const nuevoPerfil = {
                    user_id: session.user.id,
                    email: session.user.email,
                    nombre: session.user.email?.split('@')[0] || 'Usuario',
                    apellido: '',
                    rol: 'admin',
                    activo: true,
                    permisos: {
                        can_create_tasks: true,
                        can_edit_all_tasks: true,
                        can_delete_all_tasks: true,
                        can_assign_tasks: true,
                        can_manage_devices: false,
                        can_create_products: false,
                        can_view_billing: false
                    }
                };
                
                const { data: newPerfil, error: insertError } = await supabase
                    .from('perfiles')
                    .insert([nuevoPerfil])
                    .select()
                    .single();
                
                if (!insertError && newPerfil) {
                    perfil = newPerfil;
                } else {
                    // Perfil temporal en memoria
                    perfil = {
                        id: session.user.id,
                        user_id: session.user.id,
                        email: session.user.email,
                        nombre: session.user.email?.split('@')[0] || 'Usuario',
                        apellido: '',
                        rol: 'admin',
                        activo: true,
                        permisos: {
                            can_create_tasks: true,
                            can_edit_all_tasks: true,
                            can_delete_all_tasks: true,
                            can_assign_tasks: true
                        }
                    };
                }
            } else {
                perfil = perfilData;
            }
            
            setPerfilUsuario(perfil);
            console.log("Perfil usuario cargado:", perfil?.nombre, "Rol:", perfil?.rol);

            // Consulta de tareas - SOLO columnas que existen
            let query = supabase.from('tareas').select(`
                id,
                titulo,
                descripcion,
                prioridad,
                estado,
                asignado_a,
                creado_por,
                proyecto,
                fecha_inicio,
                fecha_limite,
                created_at,
                responsable:perfiles!tareas_asignado_a_fkey(nombre, apellido),
                creador:perfiles!tareas_creado_por_fkey(nombre, apellido),
                comentarios:comentarios_tareas(count)
            `);

            // Si el usuario no es admin, solo ver sus tareas asignadas o creadas por él
            if (perfil?.rol === 'user') {
                query = query.or(`asignado_a.eq.${perfil.id},creado_por.eq.${perfil.id}`);
            }

            const { data: tareasData, error: tareasError } = await query.order('created_at', { ascending: false });

            if (tareasError) {
                console.error("Error cargando tareas:", tareasError);
            }

            if (tareasData) {
                // Transformar los datos para que coincidan con la interfaz Tarea
                const tareasTransformadas: Tarea[] = tareasData.map((tarea: any) => ({
                    id: tarea.id,
                    titulo: tarea.titulo,
                    descripcion: tarea.descripcion,
                    prioridad: tarea.prioridad,
                    estado: tarea.estado,
                    asignado_a: tarea.asignado_a,
                    creado_por: tarea.creado_por,
                    proyecto: tarea.proyecto,
                    fecha_inicio: tarea.fecha_inicio,
                    fecha_limite: tarea.fecha_limite,
                    created_at: tarea.created_at,
                    responsable: tarea.responsable && tarea.responsable.length > 0 ? tarea.responsable[0] : undefined,
                    creador: tarea.creador && tarea.creador.length > 0 ? tarea.creador[0] : undefined,
                    comentarios: tarea.comentarios && tarea.comentarios.length > 0 ? tarea.comentarios[0] : undefined
                }));
                
                setTareas(tareasTransformadas);

                // Calcular estadísticas
                const hoy = new Date();
                const completadas = tareasTransformadas.filter(t => t.estado === 'completada').length;
                const en_proceso = tareasTransformadas.filter(t => t.estado === 'en_proceso').length;
                const pendientes = tareasTransformadas.filter(t => t.estado === 'pendiente').length;
                const atrasadas = tareasTransformadas.filter(t => {
                    if (t.estado === 'completada') return false;
                    if (!t.fecha_limite) return false;
                    return new Date(t.fecha_limite) < hoy;
                }).length;

                const progresoGeneral = tareasTransformadas.length > 0
                    ? Math.round((completadas / tareasTransformadas.length) * 100)
                    : 0;

                setEstadisticas({
                    total: tareasTransformadas.length,
                    completadas,
                    en_proceso,
                    pendientes,
                    atrasadas,
                    progreso_general: progresoGeneral
                });
            }

            // Obtener lista de usuarios activos
            const { data: users, error: usersError } = await supabase
                .from('perfiles')
                .select('id, nombre, apellido')
                .eq('activo', true);
            
            if (usersError) {
                console.error("Error cargando usuarios:", usersError);
            }
            if (users) setUsuarios(users);

        } catch (error) {
            console.error("Error en fetchTareas:", error);
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