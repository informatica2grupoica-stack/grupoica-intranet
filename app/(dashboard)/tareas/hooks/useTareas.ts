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
            if (!session) {
                console.log("No hay sesión activa");
                setLoading(false);
                return;
            }

            // Obtener perfil del usuario
            const { data: perfil, error: perfilError } = await supabase
                .from('perfiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single();
            
            if (perfilError) {
                console.error("Error obteniendo perfil:", perfilError);
                // Crear perfil por defecto si no existe
                if (perfilError.code === 'PGRST116') {
                    console.log("Usuario sin perfil, creando perfil por defecto...");
                    const nuevoPerfil = {
                        user_id: session.user.id,
                        email: session.user.email,
                        nombre: session.user.email?.split('@')[0] || 'Usuario',
                        apellido: '',
                        rol: 'user',
                        activo: true,
                        permisos: {
                            can_create_tasks: true,
                            can_edit_all_tasks: false,
                            can_delete_all_tasks: false,
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
                        setPerfilUsuario(newPerfil);
                    } else {
                        // Si no se puede crear, usar un perfil por defecto
                        setPerfilUsuario({
                            id: session.user.id,
                            user_id: session.user.id,
                            email: session.user.email,
                            nombre: session.user.email?.split('@')[0] || 'Usuario',
                            apellido: '',
                            rol: 'user',
                            activo: true,
                            permisos: {
                                can_create_tasks: true,
                                can_edit_all_tasks: false,
                                can_delete_all_tasks: false,
                                can_assign_tasks: true
                            }
                        });
                    }
                } else {
                    setPerfilUsuario(null);
                }
            } else {
                setPerfilUsuario(perfil);
            }
            
            console.log("Perfil usuario:", perfilUsuario || perfil);

            // Consulta de tareas
            let query = supabase.from('tareas').select(`
                *,
                responsable:perfiles!tareas_asignado_a_fkey(id, nombre, apellido),
                creador:perfiles!tareas_creado_por_fkey(id, nombre, apellido),
                comentarios:comentarios_tareas(count)
            `);

            // Si el usuario no es admin, solo ver sus tareas asignadas o creadas por él
            const usuarioActual = perfilUsuario || perfil;
            if (usuarioActual?.rol === 'user') {
                query = query.or(`asignado_a.eq.${usuarioActual.id},creado_por.eq.${usuarioActual.id}`);
            }

            const { data: tareasData, error: tareasError } = await query.order('created_at', { ascending: false });

            if (tareasError) {
                console.error("Error cargando tareas:", tareasError);
            }

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