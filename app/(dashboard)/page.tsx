// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  ClipboardCheck, MessageSquare, Calendar, Bell, Cake, 
  Clock, UserCheck, Loader2, ArrowRight, CheckCircle2, 
  Briefcase, Star, Users
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [perfilId, setPerfilId] = useState("");
  const [userId, setUserId] = useState("");
  const [userRole, setUserRole] = useState("");

  // Datos del dashboard
  const [misTareas, setMisTareas] = useState<any[]>([]);
  const [misMensajes, setMisMensajes] = useState(0);
  const [misAsistencias, setMisAsistencias] = useState({ presente: 0, ausente: 0, tarde: 0 });
  const [misPermisos, setMisPermisos] = useState<any[]>([]);
  const [proximosCumpleaños, setProximosCumpleaños] = useState<any[]>([]);
  const [equipoInfo, setEquipoInfo] = useState({ total: 0, permisosPendientes: 0 });
  const [fechaActual, setFechaActual] = useState("");

  useEffect(() => {
    const opciones: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setFechaActual(new Date().toLocaleDateString('es-ES', opciones));
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
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

      setUserName(perfil.nombre);
      setPerfilId(perfil.id);
      setUserId(session.user.id);
      setUserRole(perfil.rol);

      // 1. Mis tareas pendientes
      const { data: tareas } = await supabase
        .from('tareas')
        .select('id, titulo, prioridad, fecha_limite')
        .eq('asignado_a', perfil.id)
        .eq('estado', 'pendiente')
        .order('fecha_limite', { ascending: true })
        .limit(5);
      setMisTareas(tareas || []);

      // 2. Mis mensajes no leídos
      const { count: mensajes } = await supabase
        .from('mensajes')
        .select('*', { count: 'exact', head: true })
        .eq('receptor_id', session.user.id)
        .eq('leido', false);
      setMisMensajes(mensajes || 0);

      // 3. Mis asistencias del mes actual
      const hoy = new Date();
      const mes = hoy.getMonth() + 1;
      const anio = hoy.getFullYear();
      const startDate = `${anio}-${mes.toString().padStart(2, '0')}-01`;
      const endDate = new Date(anio, mes, 0).toISOString().split('T')[0];
      
      const { data: asistencias } = await supabase
        .from('asistencias')
        .select('estado')
        .eq('empleado_id', perfil.id)
        .gte('fecha', startDate)
        .lte('fecha', endDate);
      
      setMisAsistencias({
        presente: asistencias?.filter(a => a.estado === 'presente').length || 0,
        ausente: asistencias?.filter(a => a.estado === 'ausente').length || 0,
        tarde: asistencias?.filter(a => a.estado === 'tarde').length || 0,
      });

      // 4. Mis permisos pendientes
      const { data: permisos } = await supabase
        .from('permisos_empleados')
        .select('id, tipo, fecha_inicio, fecha_fin, dias_solicitados, estado')
        .eq('empleado_id', perfil.id)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false })
        .limit(5);
      setMisPermisos(permisos || []);

      // 5. Próximos cumpleaños (de toda la empresa)
      const { data: empleados } = await supabase
        .from('empleados')
        .select('nombre_completo, cargo, fecha_nacimiento')
        .eq('activo', true);

      const hoyDate = new Date();
      const proxCumple = (empleados || [])
        .filter(e => e.fecha_nacimiento)
        .map(e => {
          const fechaNac = new Date(e.fecha_nacimiento);
          const prox = new Date(hoyDate.getFullYear(), fechaNac.getMonth(), fechaNac.getDate());
          if (prox < hoyDate) {
            prox.setFullYear(prox.getFullYear() + 1);
          }
          const dias = Math.ceil((prox.getTime() - hoyDate.getTime()) / (1000 * 60 * 60 * 24));
          return { ...e, diasFaltantes: dias };
        })
        .filter(e => e.diasFaltantes <= 30 && e.diasFaltantes >= 0)
        .sort((a, b) => a.diasFaltantes - b.diasFaltantes)
        .slice(0, 5);
      setProximosCumpleaños(proxCumple);

      // 6. Si es jefe o admin, mostrar información del equipo
      if (perfil.rol === 'admin' || perfil.rol === 'superuser' || perfil.rol === 'rrhh' || perfil.rol === 'jefe') {
        // Obtener permisos pendientes del equipo
        let query = supabase
          .from('permisos_empleados')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'pendiente');
        
        // Si es jefe, filtrar por su equipo
        if (perfil.rol === 'jefe') {
          const { data: equipo } = await supabase
            .from('empleados')
            .select('id')
            .eq('jefe_directo_id', perfil.id);
          const idsEquipo = equipo?.map(e => e.id) || [];
          if (idsEquipo.length > 0) {
            query = query.in('empleado_id', idsEquipo);
          }
        }
        
        const { count: permisosPendientesEquipo } = await query;
        
        // Total de empleados (para admin) o equipo (para jefe)
        let totalEmpleados = 0;
        if (perfil.rol === 'jefe') {
          const { count } = await supabase
            .from('empleados')
            .select('id', { count: 'exact', head: true })
            .eq('jefe_directo_id', perfil.id);
          totalEmpleados = count || 0;
        } else {
          const { count } = await supabase
            .from('empleados')
            .select('id', { count: 'exact', head: true })
            .eq('activo', true);
          totalEmpleados = count || 0;
        }
        
        setEquipoInfo({
          total: totalEmpleados,
          permisosPendientes: permisosPendientesEquipo || 0
        });
      }

    } catch (error) {
      console.error("Error cargando datos:", error);
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
            Hola, <span className="text-blue-600">{userName}</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">{fechaActual}</p>
        </div>
        <div className="flex items-center gap-3">
          {(userRole === 'admin' || userRole === 'superuser' || userRole === 'rrhh' || userRole === 'jefe') && (
            <div className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1">
              <Users size={14} />
              {equipoInfo.total} personas en el equipo
            </div>
          )}
          <div className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-xs font-bold">
            {userRole === 'admin' ? 'Administrador' : userRole === 'superuser' ? 'Super Usuario' : userRole === 'rrhh' ? 'RRHH' : userRole === 'jefe' ? 'Jefatura' : 'Empleado'}
          </div>
        </div>
      </div>

      {/* Tarjetas rápidas */}
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
        
        <div onClick={() => router.push('/rrhh/asistencias')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <Calendar className="text-amber-500 mb-2" size={28} />
            <ArrowRight size={16} className="text-slate-300 group-hover:text-amber-500 transition-colors" />
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2">{misAsistencias.presente}</p>
          <p className="text-xs text-slate-500">Asistencias este mes</p>
        </div>
        
        <div onClick={() => router.push('/rrhh/permisos')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <Bell className="text-rose-500 mb-2" size={28} />
            <ArrowRight size={16} className="text-slate-300 group-hover:text-rose-500 transition-colors" />
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2">{misPermisos.length}</p>
          <p className="text-xs text-slate-500">Permisos pendientes</p>
        </div>
      </div>

      {/* Contenido principal - 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Columna izquierda: Mis Tareas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <ClipboardCheck size={18} className="text-blue-500" />
            Mis Tareas Pendientes
          </h2>
          {misTareas.length > 0 ? (
            <div className="space-y-3">
              {misTareas.map((tarea) => (
                <div key={tarea.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => router.push('/tareas')}>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{tarea.titulo}</p>
                    <p className="text-xs text-slate-400">Vence: {new Date(tarea.fecha_limite).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full shrink-0 ml-2 ${
                    tarea.prioridad === 'alta' ? 'bg-red-100 text-red-600' :
                    tarea.prioridad === 'media' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {tarea.prioridad === 'alta' ? 'Alta' : tarea.prioridad === 'media' ? 'Media' : 'Baja'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" />
              <p>No tienes tareas pendientes</p>
              <p className="text-xs mt-1">¡Buen trabajo! 🎉</p>
            </div>
          )}
        </div>

        {/* Columna derecha: Próximos Cumpleaños */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Cake size={18} className="text-amber-500" />
            Próximos Cumpleaños 🎂
          </h2>
          {proximosCumpleaños.length > 0 ? (
            <div className="space-y-3">
              {proximosCumpleaños.map((emp, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                  <div>
                    <p className="font-medium text-slate-800">{emp.nombre_completo}</p>
                    <p className="text-xs text-slate-500">{emp.cargo || 'Sin cargo'}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-600">{emp.diasFaltantes} días</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Cake size={32} className="mx-auto mb-2 opacity-30" />
              <p>No hay cumpleaños próximos</p>
            </div>
          )}
        </div>

        {/* Mis Solicitudes de Permiso */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-amber-500" />
            Mis Solicitudes de Permiso
          </h2>
          {misPermisos.length > 0 ? (
            <div className="space-y-3">
              {misPermisos.map((permiso) => (
                <div key={permiso.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => router.push('/rrhh/permisos')}>
                  <div>
                    <p className="font-medium text-slate-800">
                      {permiso.tipo === 'vacaciones' ? '🏖️ Vacaciones' : 
                       permiso.tipo === 'licencia_medica' ? '🏥 Licencia Médica' :
                       permiso.tipo === 'permiso_administrativo' ? '📋 Permiso Administrativo' : '📝 Permiso'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(permiso.fecha_inicio).toLocaleDateString()} - {new Date(permiso.fecha_fin).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-amber-200 text-amber-700">
                    {permiso.dias_solicitados} días
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" />
              <p>No hay solicitudes pendientes</p>
            </div>
          )}
        </div>

        {/* Información del equipo (solo para jefes y admin) */}
        {(userRole === 'admin' || userRole === 'superuser' || userRole === 'rrhh' || userRole === 'jefe') && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Users size={18} className="text-purple-500" />
              {userRole === 'jefe' ? 'Mi Equipo' : 'Equipo'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-purple-600">{equipoInfo.total}</p>
                <p className="text-xs text-slate-500">Miembros</p>
              </div>
              <div 
                className="bg-rose-50 rounded-xl p-4 text-center cursor-pointer hover:bg-rose-100 transition-colors"
                onClick={() => router.push('/rrhh/permisos')}
              >
                <p className="text-2xl font-bold text-rose-600">{equipoInfo.permisosPendientes}</p>
                <p className="text-xs text-slate-500">Permisos pendientes</p>
              </div>
            </div>
            <button 
              onClick={() => router.push('/rrhh/empleados')}
              className="w-full mt-4 text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver todos los miembros →
            </button>
          </div>
        )}

        {/* Estadísticas de asistencia */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-emerald-500" />
            Mi Asistencia del Mes
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{misAsistencias.presente}</p>
              <p className="text-[10px] text-slate-500">Presente</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{misAsistencias.ausente}</p>
              <p className="text-[10px] text-slate-500">Ausente</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{misAsistencias.tarde}</p>
              <p className="text-[10px] text-slate-500">Tarde</p>
            </div>
          </div>
          <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${((misAsistencias.presente + misAsistencias.tarde) / (misAsistencias.presente + misAsistencias.ausente + misAsistencias.tarde || 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}