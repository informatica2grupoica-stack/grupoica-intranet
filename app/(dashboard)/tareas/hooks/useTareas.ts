// hooks/useTareas.ts (actualizado)
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface Comentario {
    id: string;
    created_at: string;
    tarea_id: string;
    perfil_id: string;
    contenido: string;
    perfil?: {
        nombre: string;
        apellido: string;
    };
}

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
}

export function useTareas() {
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [perfilUsuario, setPerfilUsuario] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [comentarios, setComentarios] = useState<Record<string, Comentario[]>>({});
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

            // Consulta de tareas con relaciones
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
                creador:perfiles!tareas_creado_por_fkey(nombre, apellido)
            `);

            if (perfil?.rol === 'user') {
                query = query.or(`asignado_a.eq.${perfil.id},creado_por.eq.${perfil.id}`);
            }

            const { data: tareasData, error: tareasError } = await query.order('created_at', { ascending: false });

            if (tareasError) {
                console.error("Error cargando tareas:", tareasError);
            }

            if (tareasData) {
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
                    creador: tarea.creador && tarea.creador.length > 0 ? tarea.creador[0] : undefined
                }));
                
                setTareas(tareasTransformadas);

                // Cargar comentarios para todas las tareas
                await fetchComentarios(tareasTransformadas.map(t => t.id));

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

    async function fetchComentarios(tareaIds: string[]) {
        if (tareaIds.length === 0) return;

        const { data, error } = await supabase
            .from('comentarios_tareas')
            .select(`
                *,
                perfil:perfiles!comentarios_tareas_perfil_id_fkey(
                    nombre,
                    apellido
                )
            `)
            .in('tarea_id', tareaIds)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Error cargando comentarios:", error);
            return;
        }

        // Organizar comentarios por tarea
        const comentariosPorTarea: Record<string, Comentario[]> = {};
        data?.forEach((comentario: any) => {
            if (!comentariosPorTarea[comentario.tarea_id]) {
                comentariosPorTarea[comentario.tarea_id] = [];
            }
            comentariosPorTarea[comentario.tarea_id].push({
                ...comentario,
                perfil: comentario.perfil?.[0]
            });
        });

        setComentarios(comentariosPorTarea);
    }

    async function agregarComentario(tareaId: string, contenido: string) {
        if (!perfilUsuario?.id) {
            console.error("No hay usuario autenticado");
            return false;
        }

        const { data, error } = await supabase
            .from('comentarios_tareas')
            .insert([{
                tarea_id: tareaId,
                perfil_id: perfilUsuario.id,
                contenido: contenido
            }])
            .select(`
                *,
                perfil:perfiles!comentarios_tareas_perfil_id_fkey(
                    nombre,
                    apellido
                )
            `)
            .single();

        if (error) {
            console.error("Error agregando comentario:", error);
            return false;
        }

        // Actualizar estado local
        const nuevoComentario: Comentario = {
            ...data,
            perfil: data.perfil?.[0]
        };

        setComentarios(prev => ({
            ...prev,
            [tareaId]: [...(prev[tareaId] || []), nuevoComentario]
        }));

        return true;
    }

    useEffect(() => {
        fetchTareas();

        const channel = supabase.channel('tareas-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, () => fetchTareas())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios_tareas' }, () => fetchTareas())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    return { 
        tareas, 
        usuarios, 
        perfilUsuario, 
        loading, 
        estadisticas, 
        fetchTareas,
        comentarios,
        agregarComentario
    };
}