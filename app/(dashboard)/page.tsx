// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Users, ClipboardCheck, Activity, ShieldCheck, Calendar, Loader2, 
  MessageSquare, ArrowRight, Bell, AlertTriangle, CheckCircle2, 
  Cake, Clock, UserCheck, Briefcase, FileText, Home, TrendingUp,
  Star, Award, Coffee, Zap, Eye
} from "lucide-react";

// Componentes de Recharts
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';

export default function HomePage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [perfilId, setPerfilId] = useState("");
  
  // Datos según rol
  const [misTareas, setMisTareas] = useState<any[]>([]);
  const [misMensajes, setMisMensajes] = useState<number>(0);
  const [misAsistencias, setMisAsistencias] = useState({ presente: 0, ausente: 0, tarde: 0 });
  const [misPermisos, setMisPermisos] = useState<any[]>([]);
  const [misCapacitaciones, setMisCapacitaciones] = useState<any[]>([]);
  const [proximosCumpleaños, setProximosCumpleaños] = useState<any[]>([]);
  const [estadisticasEquipo, setEstadisticasEquipo] = useState<any>(null);
  
  const [fechaActual, setFechaActual] = useState("");

  useEffect(() => {
    setIsMounted(true);
    const opciones: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setFechaActual(new Date().toLocaleDateString('es-ES', opciones));
    cargarDatosUsuario();
  }, []);

  const cargarDatosUsuario = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      // Obtener perfil del usuario
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (!perfil) {
        router.push("/login");
        return;
      }

      setUserRole(perfil.rol);
      setUserName(perfil.nombre);
      setUserId(session.user.id);
      setPerfilId(perfil.id);

      // Cargar datos según el rol
      if (perfil.rol === 'admin' || perfil.rol === 'superuser' || perfil.rol === 'rrhh') {
        await cargarDatosAdmin();
      } else if (perfil.rol === 'jefe') {
        await cargarDatosJefe(perfil.id);
      } else {
        await cargarDatosUsuarioNormal(perfil.id);
      }
      
    } catch (error) {
      console.error("Error cargando datos:", error);
    } finally {
      setLoading(false);
    }
  };

  // 📋 DATOS PARA USUARIO NORMAL
  const cargarDatosUsuarioNormal = async (perfilId: string) => {
    // Mis tareas pendientes
    const { data: tareas } = await supabase
      .from('tareas')
      .select('*')
      .eq('asignado_a', perfilId)
      .eq('estado', 'pendiente')
      .order('fecha_limite', { ascending: true })
      .limit(5);
    setMisTareas(tareas || []);

    // Mis mensajes no leídos
    const { count: mensajes } = await supabase
      .from('mensajes')
      .select('*', { count: 'exact', head: true })
      .eq('receptor_id', userId)
      .eq('leido', false);
    setMisMensajes(mensajes || 0);

    // Mis asistencias del mes
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const anio = hoy.getFullYear();
    const startDate = `${anio}-${mes.toString().padStart(2, '0')}-01`;
    const endDate = new Date(anio, mes, 0).toISOString().split('T')[0];
    
    const { data: asistencias } = await supabase
      .from('asistencias')
      .select('estado')
      .eq('empleado_id', perfilId)
      .gte('fecha', startDate)
      .lte('fecha', endDate);
    
    setMisAsistencias({
      presente: asistencias?.filter(a => a.estado === 'presente').length || 0,
      ausente: asistencias?.filter(a => a.estado === 'ausente').length || 0,
      tarde: asistencias?.filter(a => a.estado === 'tarde').length || 0,
    });

    // Mis permisos
    const { data: permisos } = await supabase
      .from('permisos_empleados')
      .select('*')
      .eq('empleado_id', perfilId)
      .order('created_at', { ascending: false })
      .limit(5);
    setMisPermisos(permisos || []);

    // Mis capacitaciones
    const { data: capacitaciones } = await supabase
      .from('empleados_capacitaciones')
      .select('*, capacitacion:capacitaciones(*)')
      .eq('empleado_id', perfilId)
      .eq('completado', false)
      .limit(5);
    setMisCapacitaciones(capacitaciones || []);
  };

  // 👔 DATOS PARA JEFE
  const cargarDatosJefe = async (perfilId: string) => {
    // Primero, obtener los empleados a cargo (que tienen este jefe)
    const { data: empleadosACargo } = await supabase
      .from('empleados')
      .select('id, nombre_completo, cargo')
      .eq('jefe_directo_id', perfilId);
    
    const idsEquipo = empleadosACargo?.map(e => e.id) || [];
    
    // Estadísticas del equipo
    const { data: asistenciasEquipo } = await supabase
      .from('asistencias')
      .select('estado, empleado_id')
      .in('empleado_id', idsEquipo)
      .gte('fecha', new Date().toISOString().split('T')[0]);
    
    const { data: permisosPendientes } = await supabase
      .from('permisos_empleados')
      .select('*, empleado:empleados(nombre_completo)')
      .in('empleado_id', idsEquipo)
      .eq('estado', 'pendiente');
    
    setEstadisticasEquipo({
      total: empleadosACargo?.length || 0,
      presentes: asistenciasEquipo?.filter(a => a.estado === 'presente').length || 0,
      permisosPendientes: permisosPendientes?.length || 0,
      permisos: permisosPendientes || []
    });
    
    // También cargar datos personales
    await cargarDatosUsuarioNormal(perfilId);
  };

  // 📊 DATOS PARA ADMIN/RRHH
  const cargarDatosAdmin = async () => {
    // Estadísticas generales de empleados
    const { data: empleados } = await supabase
      .from('empleados')
      .select('estado, cargo, area')
      .eq('activo', true);
    
    const { data: permisosPendientes } = await supabase
      .from('permisos_empleados')
      .select('*, empleado:empleados(nombre_completo, cargo)')
      .eq('estado', 'pendiente')
      .limit(5);
    
    const { data: cumpleaños } = await supabase
      .from('empleados')
      .select('nombre_completo, cargo, fecha_nacimiento')
      .eq('activo', true);
    
    // Próximos cumpleaños (30 días)
    const hoy = new Date();
    const proxCumpleaños = cumpleaños?.filter(e => e.fecha_nacimiento)
      .map(e => {
        const fechaNac = new Date(e.fecha_nacimiento);
        const prox = new Date(hoy.getFullYear(), fechaNac.getMonth(), fechaNac.getDate());
        if (prox < hoy) prox.setFullYear(prox.getFullYear() + 1);
        const dias = Math.ceil((prox.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        return { ...e, diasFaltantes: dias };
      })
      .filter(e => e.diasFaltantes <= 30)
      .sort((a, b) => a.diasFaltantes - b.diasFaltantes)
      .slice(0, 5) || [];
    
    setProximosCumpleaños(proxCumpleaños);
    setMisPermisos(permisosPendientes || []);
    
    setEstadisticasEquipo({
      total: empleados?.length || 0,
      porArea: empleados?.reduce((acc: any, e) => {
        if (e.area) acc[e.area] = (acc[e.area] || 0) + 1;
        return acc;
      }, {})
    });
  };

  if (loading || !isMounted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-12 h-12 animate-spin text-[#00338d] mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">Cargando tu espacio...</p>
      </div>
    );
  }

  // 👤 RENDER PARA USUARIO NORMAL
  if (userRole === 'user') {
    return (
      <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-800">
              Hola, <span className="text-blue-600">{userName}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">{fechaActual}</p>
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-3 rounded-2xl text-white shadow-lg">
            <UserCheck size={24} />
          </div>
        </div>

        {/* Tarjetas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div onClick={() => router.push('/tareas')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all">
            <ClipboardCheck className="text-blue-500 mb-2" size={24} />
            <p className="text-2xl font-black text-slate-800">{misTareas.length}</p>
            <p className="text-xs text-slate-500">Tareas pendientes</p>
          </div>
          
          <div onClick={() => router.push('/chat')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all">
            <MessageSquare className="text-emerald-500 mb-2" size={24} />
            <p className="text-2xl font-black text-slate-800">{misMensajes}</p>
            <p className="text-xs text-slate-500">Mensajes nuevos</p>
          </div>
          
          <div onClick={() => router.push('/rrhh/asistencias')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all">
            <Calendar className="text-amber-500 mb-2" size={24} />
            <p className="text-2xl font-black text-slate-800">{misAsistencias.presente}</p>
            <p className="text-xs text-slate-500">Asistencias este mes</p>
          </div>
          
          <div onClick={() => router.push('/rrhh/permisos')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all">
            <Bell className="text-rose-500 mb-2" size={24} />
            <p className="text-2xl font-black text-slate-800">{misPermisos.filter(p => p.estado === 'pendiente').length}</p>
            <p className="text-xs text-slate-500">Permisos pendientes</p>
          </div>
        </div>

        {/* Mis Tareas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <ClipboardCheck size={18} className="text-blue-500" />
            Mis Tareas Pendientes
          </h2>
          {misTareas.length > 0 ? (
            <div className="space-y-3">
              {misTareas.map((tarea) => (
                <div key={tarea.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-medium text-slate-800">{tarea.titulo}</p>
                    <p className="text-xs text-slate-400">Vence: {new Date(tarea.fecha_limite).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    tarea.prioridad === 'alta' ? 'bg-red-100 text-red-600' :
                    tarea.prioridad === 'media' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {tarea.prioridad}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" />
              <p>No tienes tareas pendientes 🎉</p>
            </div>
          )}
        </div>

        {/* Mis Permisos Recientes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-amber-500" />
            Mis Solicitudes Recientes
          </h2>
          {misPermisos.length > 0 ? (
            <div className="space-y-3">
              {misPermisos.slice(0, 5).map((permiso) => (
                <div key={permiso.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-medium text-slate-800">
                      {permiso.tipo === 'vacaciones' ? '🏖️ Vacaciones' : '📋 Permiso'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(permiso.fecha_inicio).toLocaleDateString()} - {new Date(permiso.fecha_fin).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    permiso.estado === 'aprobado' ? 'bg-emerald-100 text-emerald-600' :
                    permiso.estado === 'rechazado' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {permiso.estado === 'aprobado' ? 'Aprobado' : permiso.estado === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Clock size={32} className="mx-auto mb-2 opacity-30" />
              <p>No hay solicitudes recientes</p>
            </div>
          )}
        </div>

        {/* Próximas Capacitaciones */}
        {misCapacitaciones.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Star size={18} className="text-purple-500" />
              Mis Capacitaciones Pendientes
            </h2>
            <div className="space-y-3">
              {misCapacitaciones.map((cap) => (
                <div key={cap.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-xl">
                  <div>
                    <p className="font-medium text-slate-800">{cap.capacitacion?.nombre}</p>
                    <p className="text-xs text-slate-400">{cap.capacitacion?.proveedor}</p>
                  </div>
                  <span className="text-xs text-purple-600">{cap.capacitacion?.horas_total} horas</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 👔 RENDER PARA JEFE
  if (userRole === 'jefe') {
    return (
      <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-800">
              Panel de <span className="text-blue-600">Jefatura</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Bienvenido, {userName}</p>
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-3 rounded-2xl text-white shadow-lg">
            <Briefcase size={24} />
          </div>
        </div>

        {/* Resumen del equipo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <Users className="text-blue-500 mb-2" size={24} />
            <p className="text-2xl font-black text-slate-800">{estadisticasEquipo?.total || 0}</p>
            <p className="text-xs text-slate-500">Miembros del equipo</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <UserCheck className="text-emerald-500 mb-2" size={24} />
            <p className="text-2xl font-black text-slate-800">{estadisticasEquipo?.presentes || 0}</p>
            <p className="text-xs text-slate-500">Presentes hoy</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer" onClick={() => router.push('/rrhh/permisos')}>
            <Bell className="text-rose-500 mb-2" size={24} />
            <p className="text-2xl font-black text-slate-800">{estadisticasEquipo?.permisosPendientes || 0}</p>
            <p className="text-xs text-slate-500">Permisos pendientes</p>
          </div>
        </div>

        {/* Mis datos personales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ClipboardCheck size={18} className="text-blue-500" />
              Mis Tareas Pendientes
            </h2>
            {misTareas.length > 0 ? (
              misTareas.map((tarea) => (
                <div key={tarea.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl mb-2">
                  <span className="text-sm">{tarea.titulo}</span>
                  <span className="text-xs text-amber-600">{new Date(tarea.fecha_limite).toLocaleDateString()}</span>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-400 py-4">Sin tareas pendientes</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Clock size={18} className="text-amber-500" />
              Mis Solicitudes Recientes
            </h2>
            {misPermisos.length > 0 ? (
              misPermisos.slice(0, 5).map((permiso) => (
                <div key={permiso.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl mb-2">
                  <span className="text-sm">{permiso.tipo}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    permiso.estado === 'aprobado' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {permiso.estado}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-400 py-4">Sin solicitudes</p>
            )}
          </div>
        </div>

        {/* Permisos del equipo pendientes */}
        {estadisticasEquipo?.permisos?.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Bell size={18} className="text-rose-500" />
              Solicitudes de Permiso del Equipo
            </h2>
            <div className="space-y-3">
              {estadisticasEquipo.permisos.map((permiso: any) => (
                <div key={permiso.id} className="flex justify-between items-center p-3 bg-rose-50 rounded-xl">
                  <div>
                    <p className="font-medium text-slate-800">{permiso.empleado?.nombre_completo}</p>
                    <p className="text-xs text-slate-500">{permiso.tipo} · {permiso.dias_solicitados} días</p>
                  </div>
                  <button 
                    onClick={() => router.push('/rrhh/permisos')}
                    className="text-xs text-blue-600 font-medium"
                  >
                    Revisar →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 📊 RENDER PARA ADMIN / RRHH / SUPERUSER
  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-800">
            Dashboard <span className="text-blue-600">RRHH</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Visión general del talento humano • {fechaActual}</p>
        </div>
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-3 rounded-2xl text-white shadow-lg">
          <ShieldCheck size={24} />
        </div>
      </div>

      {/* Tarjetas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <Users className="text-blue-500 mb-2" size={24} />
          <p className="text-2xl font-black text-slate-800">{estadisticasEquipo?.total || 0}</p>
          <p className="text-xs text-slate-500">Empleados Activos</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer" onClick={() => router.push('/rrhh/permisos')}>
          <Bell className="text-amber-500 mb-2" size={24} />
          <p className="text-2xl font-black text-slate-800">{misPermisos.length}</p>
          <p className="text-xs text-slate-500">Permisos pendientes</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <Calendar className="text-emerald-500 mb-2" size={24} />
          <p className="text-2xl font-black text-slate-800">{proximosCumpleaños.length}</p>
          <p className="text-xs text-slate-500">Cumpleaños próximos</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <Briefcase className="text-purple-500 mb-2" size={24} />
          <p className="text-2xl font-black text-slate-800">{Object.keys(estadisticasEquipo?.porArea || {}).length}</p>
          <p className="text-xs text-slate-500">Áreas / Departamentos</p>
        </div>
      </div>

      {/* Próximos Cumpleaños */}
      {proximosCumpleaños.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Cake size={18} className="text-amber-500" />
            Próximos Cumpleaños 🎂
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {proximosCumpleaños.map((emp) => (
              <div key={emp.nombre_completo} className="flex justify-between items-center p-3 bg-amber-50 rounded-xl">
                <div>
                  <p className="font-medium text-slate-800">{emp.nombre_completo}</p>
                  <p className="text-xs text-slate-500">{emp.cargo || 'Sin cargo'}</p>
                </div>
                <span className="text-xs font-bold text-amber-600">{emp.diasFaltantes} días</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permisos Pendientes */}
      {misPermisos.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-rose-500" />
            Solicitudes de Permiso Pendientes
          </h2>
          <div className="space-y-3">
            {misPermisos.map((permiso) => (
              <div key={permiso.id} className="flex justify-between items-center p-3 bg-rose-50 rounded-xl">
                <div>
                  <p className="font-medium text-slate-800">{permiso.empleado?.nombre_completo || 'Empleado'}</p>
                  <p className="text-xs text-slate-500">
                    {permiso.tipo === 'vacaciones' ? 'Vacaciones' : permiso.tipo} · {permiso.dias_solicitados} días
                  </p>
                </div>
                <button 
                  onClick={() => router.push('/rrhh/permisos')}
                  className="text-xs text-blue-600 font-medium"
                >
                  Revisar →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Distribución por Área */}
      {estadisticasEquipo?.porArea && Object.keys(estadisticasEquipo.porArea).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Briefcase size={18} className="text-purple-500" />
            Distribución por Área
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(estadisticasEquipo.porArea).map(([area, cantidad]) => (
              <div key={area} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-medium text-slate-700">{area}</span>
                <span className="text-xs font-bold text-blue-600">{cantidad as number} personas</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}