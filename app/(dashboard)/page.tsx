"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  ClipboardCheck, MessageSquare, Calendar, Bell, Cake, 
  Clock, Loader2, ArrowRight, CheckCircle2, 
  Briefcase, GraduationCap, Building, FileText, Truck,
  Gift, Smile, Heart, Users, TrendingUp, Package, AlertCircle
} from "lucide-react";

// Definir tipos para mejor seguridad
interface Perfil {
  id: string;
  nombre: string;
  apellido: string | null;
  fecha_nacimiento: string | null;
  cargo: string | null;
  rol: string;
  activo: boolean;
}

interface Cumpleaños {
  id: string;
  nombre: string;
  apellido: string | null;
  nombre_completo: string;
  cargo: string | null;
  diasFaltantes: number;
  fechaProxima: Date;
  mes: number;
  dia: number;
}

interface Tarea {
  id: string;
  titulo: string;
  nombre?: string;
  prioridad?: string;
  fecha_limite?: string;
  estado?: string;
  completado?: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [perfilId, setPerfilId] = useState("");
  const [empleadoId, setEmpleadoId] = useState<string | null>(null);

  // 📊 DATOS GLOBALES
  const [cumpleañosProximos, setCumpleañosProximos] = useState<Cumpleaños[]>([]);
  const [capacitacionesProximas, setCapacitacionesProximas] = useState<any[]>([]);
  const [totalEmpleados, setTotalEmpleados] = useState(0);
  const [proveedoresActivos, setProveedoresActivos] = useState(0);
  const [licitacionesActivas, setLicitacionesActivas] = useState(0);

  // 👤 DATOS PERSONALES
  const [misTareas, setMisTareas] = useState<Tarea[]>([]);
  const [misMensajes, setMisMensajes] = useState(0);
  const [misNotificaciones, setMisNotificaciones] = useState(0);
  const [misProximasCapacitaciones, setMisProximasCapacitaciones] = useState<any[]>([]);
  const [miProximoCumpleaños, setMiProximoCumpleaños] = useState<any>(null);
  const [fechaActual, setFechaActual] = useState("");

  useEffect(() => {
    const opciones: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setFechaActual(new Date().toLocaleDateString('es-ES', opciones));
    cargarDatos();
  }, []);

  const formatearFecha = (fecha: string | null | undefined) => {
    if (!fecha) return "No disponible";
    try {
      return new Date(fecha).toLocaleDateString('es-CL');
    } catch {
      return "Fecha inválida";
    }
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      // Obtener perfil del usuario
      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (perfilError || !perfil) {
        console.error("Error obteniendo perfil:", perfilError);
        router.push("/login");
        return;
      }

      setUserName(perfil.nombre);
      setUserRole(perfil.rol);
      setPerfilId(perfil.id);
      setEmpleadoId(perfil.empleado_id || null);

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      // ============================================
      // 📊 DATOS GLOBALES - CUPLEAÑOS CORREGIDO
      // ============================================
      
      const { data: todosPerfiles, error: perfilesError } = await supabase
        .from('perfiles')
        .select('id, nombre, apellido, fecha_nacimiento, cargo, rol, activo')
        .eq('activo', true);
      
      if (perfilesError) {
        console.error("Error cargando perfiles:", perfilesError);
      }

      console.log("Perfiles cargados:", todosPerfiles?.length);
      console.log("Perfiles con fecha:", todosPerfiles?.filter(p => p.fecha_nacimiento).length);

      // Procesar cumpleaños con tipo seguro
      const cumpleañosArray: Cumpleaños[] = [];
      
      for (const p of (todosPerfiles || [])) {
        if (!p.fecha_nacimiento) {
          console.log(`Perfil ${p.nombre} sin fecha_nacimiento`);
          continue;
        }
        
        try {
          const fechaNac = new Date(p.fecha_nacimiento);
          if (isNaN(fechaNac.getTime())) {
            console.log(`Fecha inválida para ${p.nombre}: ${p.fecha_nacimiento}`);
            continue;
          }
          
          const proxCumple = new Date(hoy.getFullYear(), fechaNac.getMonth(), fechaNac.getDate());
          
          if (proxCumple < hoy) {
            proxCumple.setFullYear(proxCumple.getFullYear() + 1);
          }
          
          const dias = Math.ceil((proxCumple.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
          
          if (dias <= 30 && dias >= 0) {
            cumpleañosArray.push({
              id: p.id,
              nombre: p.nombre,
              apellido: p.apellido,
              nombre_completo: `${p.nombre} ${p.apellido || ''}`.trim(),
              cargo: p.cargo,
              diasFaltantes: dias,
              fechaProxima: proxCumple,
              mes: fechaNac.getMonth() + 1,
              dia: fechaNac.getDate()
            });
          }
        } catch (error) {
          console.error(`Error procesando fecha para ${p.nombre}:`, error);
        }
      }
      
      // Ordenar de forma segura (a y b no pueden ser null aquí)
      cumpleañosArray.sort((a, b) => a.diasFaltantes - b.diasFaltantes);
      const cumpleañosProximosFiltrados = cumpleañosArray.slice(0, 6);
      
      console.log("Cumpleaños próximos encontrados:", cumpleañosProximosFiltrados.length);
      setCumpleañosProximos(cumpleañosProximosFiltrados);

      // 2. Próximas capacitaciones globales
      const { data: capacitaciones, error: capsError } = await supabase
        .from('capacitaciones')
        .select('*')
        .gte('fecha_inicio', hoy.toISOString().split('T')[0])
        .eq('activo', true)
        .order('fecha_inicio', { ascending: true })
        .limit(5);
      
      if (capsError) console.error("Error capacitaciones:", capsError);
      setCapacitacionesProximas(capacitaciones || []);

      // 3. Total perfiles activos
      const { count: total, error: totalError } = await supabase
        .from('perfiles')
        .select('id', { count: 'exact', head: true })
        .eq('activo', true);
      
      if (totalError) console.error("Error total:", totalError);
      setTotalEmpleados(total || 0);

      // 4. Proveedores activos
      const { count: proveedores, error: provError } = await supabase
        .from('proveedores')
        .select('id', { count: 'exact', head: true })
        .eq('activo', true);
      
      if (provError) console.error("Error proveedores:", provError);
      setProveedoresActivos(proveedores || 0);

      // 5. Licitaciones activas
      const { count: licitaciones, error: licError } = await supabase
        .from('licitaciones')
        .select('id', { count: 'exact', head: true });
      
      if (licError) console.error("Error licitaciones:", licError);
      setLicitacionesActivas(licitaciones || 0);

      // ============================================
      // 👤 DATOS PERSONALES - TAREAS
      // ============================================

      // 1. Mis tareas pendientes
      console.log("Buscando tareas para perfil_id:", perfil.id);
      
      const { data: tareasUsuario, error: tareasError } = await supabase
        .from('tareas')
        .select('*')
        .eq('asignado_a', perfil.id);
      
      if (tareasError) {
        console.error("Error cargando tareas:", tareasError);
        setMisTareas([]);
      } else {
        console.log("Tareas encontradas (total):", tareasUsuario?.length);
        console.log("Primera tarea:", tareasUsuario?.[0]);
        
        // Filtramos las pendientes
        const pendientes = (tareasUsuario || []).filter((t: any) => {
          return t.estado === 'pendiente' || 
                 t.estado === 'Pendiente' || 
                 t.completado === false || 
                 t.status === 'pending';
        });
        
        // Ordenar por fecha_limite de forma segura
        pendientes.sort((a: any, b: any) => {
          if (!a.fecha_limite && !b.fecha_limite) return 0;
          if (!a.fecha_limite) return 1;
          if (!b.fecha_limite) return -1;
          return new Date(a.fecha_limite).getTime() - new Date(b.fecha_limite).getTime();
        });
        
        console.log("Tareas pendientes encontradas:", pendientes.length);
        setMisTareas(pendientes.slice(0, 5));
      }

      // 2. Mis mensajes no leídos
      const { count: mensajes, error: msgError } = await supabase
        .from('mensajes')
        .select('*', { count: 'exact', head: true })
        .eq('receptor_id', session.user.id)
        .eq('leido', false);
      
      if (msgError) console.error("Error mensajes:", msgError);
      setMisMensajes(mensajes || 0);

      // 3. Mis notificaciones no leídas
      const { count: notificaciones, error: notError } = await supabase
        .from('notificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', perfil.id)
        .eq('leida', false);
      
      if (notError) console.error("Error notificaciones:", notError);
      setMisNotificaciones(notificaciones || 0);

      // 4. Mis próximas capacitaciones
      if (perfil.empleado_id) {
        console.log("Buscando capacitaciones para empleado_id:", perfil.empleado_id);
        
        const { data: misCaps, error: capsPersonalesError } = await supabase
          .from('empleados_capacitaciones')
          .select(`
            id,
            completado,
            fecha_inscripcion,
            capacitacion_id,
            capacitaciones!inner (
              id, 
              nombre, 
              fecha_inicio, 
              fecha_fin, 
              modalidad, 
              horas_total,
              activo
            )
          `)
          .eq('empleado_id', perfil.empleado_id)
          .eq('completado', false);
        
        if (capsPersonalesError) {
          console.error("Error capacitaciones personales:", capsPersonalesError);
          setMisProximasCapacitaciones([]);
        } else if (misCaps && misCaps.length > 0) {
          console.log("Capacitaciones personales encontradas:", misCaps.length);
          
          const capsFiltradas = misCaps
            .map((item: any) => item.capacitaciones)
            .filter((cap: any) => {
              if (!cap || !cap.fecha_inicio) return false;
              const fechaInicio = new Date(cap.fecha_inicio);
              return fechaInicio >= hoy && cap.activo === true;
            })
            .sort((a: any, b: any) => {
              if (!a.fecha_inicio && !b.fecha_inicio) return 0;
              if (!a.fecha_inicio) return 1;
              if (!b.fecha_inicio) return -1;
              return new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime();
            })
            .slice(0, 3);
          
          setMisProximasCapacitaciones(capsFiltradas);
        } else {
          setMisProximasCapacitaciones([]);
        }
      } else {
        console.log("Perfil sin empleado_id asociado");
        setMisProximasCapacitaciones([]);
      }

      // 5. Mi próximo cumpleaños
      if (perfil.fecha_nacimiento) {
        try {
          const fechaNac = new Date(perfil.fecha_nacimiento);
          if (!isNaN(fechaNac.getTime())) {
            const proxCumple = new Date(hoy.getFullYear(), fechaNac.getMonth(), fechaNac.getDate());
            if (proxCumple < hoy) {
              proxCumple.setFullYear(proxCumple.getFullYear() + 1);
            }
            const dias = Math.ceil((proxCumple.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
            setMiProximoCumpleaños({ dias, fecha: proxCumple });
          } else {
            console.log("Fecha de nacimiento inválida:", perfil.fecha_nacimiento);
            setMiProximoCumpleaños(null);
          }
        } catch (error) {
          console.error("Error procesando mi cumpleaños:", error);
          setMiProximoCumpleaños(null);
        }
      }

    } catch (error) {
      console.error("Error general cargando datos:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-12 h-12 animate-spin text-[#00338d] mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">Cargando tu espacio...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800">
            Hola, <span className="text-[#00338d]">{userName}</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">{fechaActual}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-xs font-bold">
            {userRole === 'admin' ? 'Administrador' : userRole === 'superuser' ? 'Super Usuario' : userRole === 'vendedor' ? 'Vendedor' : 'Usuario'}
          </div>
        </div>
      </div>

      {/* Tarjetas rápidas personales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => router.push('/tareas')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <ClipboardCheck className="text-blue-500 mb-2" size={28} />
            <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2">{misTareas.length}</p>
          <p className="text-xs text-slate-500">Tareas pendientes</p>
        </div>
        
        <div onClick={() => router.push('/chat')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <MessageSquare className="text-emerald-500 mb-2" size={28} />
            <ArrowRight size={16} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2">{misMensajes}</p>
          <p className="text-xs text-slate-500">Mensajes nuevos</p>
        </div>
        
        <div onClick={() => router.push('/notificaciones')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <Bell className="text-amber-500 mb-2" size={28} />
            <ArrowRight size={16} className="text-slate-300 group-hover:text-amber-500 transition-colors" />
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2">{misNotificaciones}</p>
          <p className="text-xs text-slate-500">Notificaciones</p>
        </div>
        
        <div onClick={() => router.push('/capacitaciones')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <GraduationCap className="text-purple-500 mb-2" size={28} />
            <ArrowRight size={16} className="text-slate-300 group-hover:text-purple-500 transition-colors" />
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2">{misProximasCapacitaciones.length}</p>
          <p className="text-xs text-slate-500">Capacitaciones pendientes</p>
        </div>
      </div>

      {/* DATOS GLOBALES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Próximos Cumpleaños */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Cake size={18} className="text-amber-500" />
            🎂 Próximos Cumpleaños
            {cumpleañosProximos.length > 0 && (
              <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {cumpleañosProximos.length}
              </span>
            )}
          </h2>
          {cumpleañosProximos.length > 0 ? (
            <div className="space-y-3">
              {cumpleañosProximos.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 border-b border-slate-100 hover:bg-slate-50 rounded-lg transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{p.nombre_completo}</p>
                    <p className="text-xs text-slate-400">{p.cargo || 'Colaborador'}</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">
                      {p.dia}/{p.mes}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                    p.diasFaltantes === 0 ? 'bg-amber-500 text-white animate-pulse' :
                    p.diasFaltantes <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {p.diasFaltantes === 0 ? '🎉 ¡HOY! 🎉' : `${p.diasFaltantes} ${p.diasFaltantes === 1 ? 'día' : 'días'}`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Smile size={32} className="mx-auto mb-2 opacity-30" />
              <p>No hay cumpleaños próximos</p>
              <p className="text-xs mt-1">Pronto celebraremos a alguien 🎉</p>
            </div>
          )}
        </div>

        {/* Próximas Capacitaciones Globales */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <GraduationCap size={18} className="text-blue-500" />
            📚 Capacitaciones Programadas
          </h2>
          {capacitacionesProximas.length > 0 ? (
            <div className="space-y-3">
              {capacitacionesProximas.map((cap) => (
                <div key={cap.id} className="p-2 border-b border-slate-100">
                  <p className="font-medium text-slate-800">{cap.nombre}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-400">
                      {formatearFecha(cap.fecha_inicio)}
                    </p>
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {cap.modalidad === 'presencial' ? '📌 Presencial' : cap.modalidad === 'online' ? '💻 Online' : '🎓 Mixto'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400">
              <Calendar size={32} className="mx-auto mb-2 opacity-30" />
              <p>No hay capacitaciones próximas</p>
            </div>
          )}
        </div>

        {/* Mi Cumpleaños Personal */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Heart size={18} className="text-rose-500" />
            🎯 Mi Fecha Especial
          </h2>
          {miProximoCumpleaños ? (
            <div className={`flex items-center justify-between p-4 rounded-xl transition-all ${miProximoCumpleaños.dias === 0 ? 'bg-amber-100 border-2 border-amber-400 animate-pulse' : 'bg-amber-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${miProximoCumpleaños.dias === 0 ? 'bg-amber-500' : 'bg-amber-200'}`}>
                  <Gift size={20} className={miProximoCumpleaños.dias === 0 ? 'text-white' : 'text-amber-600'} />
                </div>
                <div>
                  <p className="font-bold text-slate-800">
                    {miProximoCumpleaños.dias === 0 ? '¡ES HOY! 🎉🎂' : 'Mi Cumpleaños'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {miProximoCumpleaños.fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                  </p>
                </div>
              </div>
              <span className={`text-sm font-bold ${miProximoCumpleaños.dias === 0 ? 'text-amber-700 text-base' : 'text-amber-600'}`}>
                {miProximoCumpleaños.dias === 0 ? '🎊 FELICIDADES 🎊' : `en ${miProximoCumpleaños.dias} ${miProximoCumpleaños.dias === 1 ? 'día' : 'días'}`}
              </span>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400">
              <AlertCircle size={32} className="mx-auto mb-2 opacity-30" />
              <p>No hay fecha de nacimiento registrada</p>
              <p className="text-xs mt-1">Contacta a recursos humanos para actualizar tu perfil</p>
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN DE TAREAS PENDIENTES */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <ClipboardCheck size={18} className="text-blue-500" />
          ✅ Mis Tareas Pendientes
          {misTareas.length > 0 && (
            <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {misTareas.length} pendientes
            </span>
          )}
        </h2>
        {misTareas.length > 0 ? (
          <div className="space-y-3">
            {misTareas.map((tarea) => (
              <div 
                key={tarea.id} 
                onClick={() => router.push(`/tareas/${tarea.id}`)}
                className="flex items-center justify-between p-3 bg-blue-50 rounded-xl cursor-pointer hover:bg-blue-100 transition-all group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800">{tarea.titulo || tarea.nombre || 'Tarea sin título'}</p>
                    {tarea.prioridad && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        tarea.prioridad === 'alta' ? 'bg-red-100 text-red-700' :
                        tarea.prioridad === 'media' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {tarea.prioridad}
                      </span>
                    )}
                  </div>
                  {tarea.fecha_limite && (
                    <p className="text-xs text-slate-500 mt-1">
                      📅 Límite: {formatearFecha(tarea.fecha_limite)}
                    </p>
                  )}
                </div>
                <Clock size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" />
            <p>¡No tienes tareas pendientes!</p>
            <p className="text-xs mt-1">Todo al día ✨</p>
          </div>
        )}
      </div>

      {/* Estadísticas globales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
          <Users size={24} className="mb-2 opacity-80" />
          <p className="text-2xl font-black">{totalEmpleados}</p>
          <p className="text-xs opacity-80">Colaboradores activos</p>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
          <Building size={24} className="mb-2 opacity-80" />
          <p className="text-2xl font-black">{proveedoresActivos}</p>
          <p className="text-xs opacity-80">Proveedores activos</p>
        </div>
        
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white">
          <Briefcase size={24} className="mb-2 opacity-80" />
          <p className="text-2xl font-black">{licitacionesActivas}</p>
          <p className="text-xs opacity-80">Licitaciones activas</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white">
          <Package size={24} className="mb-2 opacity-80" />
          <p className="text-2xl font-black">0</p>
          <p className="text-xs opacity-80">Órdenes pendientes</p>
        </div>
      </div>

      {/* Mis Capacitaciones Pendientes */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <GraduationCap size={18} className="text-blue-500" />
          📖 Mis Capacitaciones Pendientes
        </h2>
        {misProximasCapacitaciones.length > 0 ? (
          <div className="space-y-3">
            {misProximasCapacitaciones.map((cap, idx) => (
              <div key={cap.id || idx} className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                <div>
                  <p className="font-medium text-slate-800">{cap.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {formatearFecha(cap.fecha_inicio)} • {cap.horas_total || 0} horas
                  </p>
                </div>
                <Clock size={16} className="text-blue-500" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" />
            <p>No tienes capacitaciones pendientes</p>
            <p className="text-xs mt-1">¡Buen trabajo! 🎉</p>
          </div>
        )}
      </div>
    </div>
  );
}