// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  ClipboardCheck, MessageSquare, Calendar, Bell, Cake, 
  Clock, Loader2, ArrowRight, CheckCircle2, 
  Briefcase, GraduationCap, Award,
  Gift, Sparkles, Heart, Smile, Building, FileText, Truck
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [perfilId, setPerfilId] = useState("");
  const [empleadoId, setEmpleadoId] = useState<string | null>(null);

  // 📊 DATOS GLOBALES
  const [cumpleañosProximos, setCumpleañosProximos] = useState<any[]>([]);
  const [capacitacionesProximas, setCapacitacionesProximas] = useState<any[]>([]);
  const [aniversariosProximos, setAniversariosProximos] = useState<any[]>([]);
  const [totalEmpleados, setTotalEmpleados] = useState(0);
  const [empleadosNuevos, setEmpleadosNuevos] = useState<any[]>([]);
  const [contratosVencer, setContratosVencer] = useState<any[]>([]);
  const [proveedoresActivos, setProveedoresActivos] = useState(0);
  const [licitacionesActivas, setLicitacionesActivas] = useState(0);

  // 👤 DATOS PERSONALES
  const [misTareas, setMisTareas] = useState<any[]>([]);
  const [misMensajes, setMisMensajes] = useState(0);
  const [misNotificaciones, setMisNotificaciones] = useState(0);
  const [misProximasCapacitaciones, setMisProximasCapacitaciones] = useState<any[]>([]);
  const [miProximoCumpleaños, setMiProximoCumpleaños] = useState<any>(null);
  const [miAniversario, setMiAniversario] = useState<any>(null);
  const [misPermisosRecientes, setMisPermisosRecientes] = useState<any[]>([]);
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

      // Obtener perfil del usuario desde tabla perfiles
      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (perfilError || !perfil) {
        router.push("/login");
        return;
      }

      setUserName(perfil.nombre);
      setUserRole(perfil.rol);
      setPerfilId(perfil.id);
      setEmpleadoId(perfil.empleado_id || null);

      const hoy = new Date();

      // ============================================
      // 📊 DATOS GLOBALES
      // ============================================

      // 1. Próximos cumpleaños (desde perfiles, NO desde empleados)
      const { data: todosPerfiles } = await supabase
        .from('perfiles')
        .select('id, nombre, apellido, fecha_nacimiento, cargo')
        .eq('activo', true);

      const cumpleañosConDias = (todosPerfiles || [])
        .filter(p => p.fecha_nacimiento)
        .map(p => {
          const fechaNac = new Date(p.fecha_nacimiento);
          const proxCumple = new Date(hoy.getFullYear(), fechaNac.getMonth(), fechaNac.getDate());
          if (proxCumple < hoy) {
            proxCumple.setFullYear(proxCumple.getFullYear() + 1);
          }
          const dias = Math.ceil((proxCumple.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
          return { 
            ...p, 
            nombre_completo: `${p.nombre} ${p.apellido}`,
            diasFaltantes: dias, 
            fechaProxima: proxCumple 
          };
        })
        .filter(p => p.diasFaltantes <= 30 && p.diasFaltantes >= 0)
        .sort((a, b) => a.diasFaltantes - b.diasFaltantes)
        .slice(0, 6);
      
      setCumpleañosProximos(cumpleañosConDias);

      // 2. Próximas capacitaciones
      const { data: capacitaciones } = await supabase
        .from('capacitaciones')
        .select('*')
        .gte('fecha_inicio', hoy.toISOString().split('T')[0])
        .eq('activo', true)
        .order('fecha_inicio', { ascending: true })
        .limit(5);
      
      setCapacitacionesProximas(capacitaciones || []);

      // 3. Aniversarios laborales (desde empleados)
      const { data: empleados } = await supabase
        .from('empleados')
        .select('id, nombre_completo, cargo, fecha_ingreso')
        .eq('activo', true);

      const aniversarios = (empleados || [])
        .filter(e => e.fecha_ingreso)
        .map(e => {
          const fechaIngreso = new Date(e.fecha_ingreso);
          const proxAniv = new Date(hoy.getFullYear(), fechaIngreso.getMonth(), fechaIngreso.getDate());
          if (proxAniv < hoy) {
            proxAniv.setFullYear(proxAniv.getFullYear() + 1);
          }
          const años = hoy.getFullYear() - fechaIngreso.getFullYear();
          const dias = Math.ceil((proxAniv.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
          return { ...e, años, diasFaltantes: dias };
        })
        .filter(e => e.diasFaltantes <= 30 && e.diasFaltantes >= 0)
        .sort((a, b) => a.diasFaltantes - b.diasFaltantes)
        .slice(0, 5);
      
      setAniversariosProximos(aniversarios);

      // 4. Total empleados activos
      const { count: total } = await supabase
        .from('empleados')
        .select('id', { count: 'exact', head: true })
        .eq('activo', true);
      setTotalEmpleados(total || 0);

      // 5. Empleados nuevos (últimos 30 días)
      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);
      const { data: nuevos } = await supabase
        .from('empleados')
        .select('nombre_completo, cargo, fecha_ingreso')
        .gte('fecha_ingreso', hace30Dias.toISOString().split('T')[0])
        .order('fecha_ingreso', { ascending: false })
        .limit(3);
      setEmpleadosNuevos(nuevos || []);

      // 6. Contratos por vencer (próximos 30 días)
      const dentro30Dias = new Date();
      dentro30Dias.setDate(dentro30Dias.getDate() + 30);
      const { data: contratos } = await supabase
        .from('contratos_empleados')
        .select(`
          id, numero_contrato, tipo_contrato, fecha_fin,
          empleados (nombre_completo, cargo)
        `)
        .eq('vigente', true)
        .not('fecha_fin', 'is', null)
        .lte('fecha_fin', dentro30Dias.toISOString().split('T')[0])
        .limit(5);
      
      // Transformar datos de contratos para evitar errores de tipo
      const contratosFormateados = (contratos || []).map((c: any) => ({
        id: c.id,
        numero_contrato: c.numero_contrato,
        tipo_contrato: c.tipo_contrato,
        fecha_fin: c.fecha_fin,
        empleado_nombre: c.empleados?.nombre_completo || 'No especificado',
        empleado_cargo: c.empleados?.cargo || ''
      }));
      setContratosVencer(contratosFormateados);

      // 7. Proveedores activos
      const { count: proveedores } = await supabase
        .from('proveedores')
        .select('id', { count: 'exact', head: true })
        .eq('activo', true);
      setProveedoresActivos(proveedores || 0);

      // 8. Licitaciones activas
      const { count: licitaciones } = await supabase
        .from('licitaciones')
        .select('id', { count: 'exact', head: true });
      setLicitacionesActivas(licitaciones || 0);

      // ============================================
      // 👤 DATOS PERSONALES
      // ============================================

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

      // 3. Mis notificaciones no leídas
      const { count: notificaciones } = await supabase
        .from('notificaciones')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', perfil.id)
        .eq('leida', false);
      setMisNotificaciones(notificaciones || 0);

      // 4. Mis permisos pendientes
      if (perfil.empleado_id) {
        const { data: permisos } = await supabase
          .from('permisos_empleados')
          .select('id, tipo, fecha_inicio, fecha_fin, dias_solicitados, estado')
          .eq('empleado_id', perfil.empleado_id)
          .eq('estado', 'pendiente')
          .order('created_at', { ascending: false })
          .limit(3);
        setMisPermisosRecientes(permisos || []);
      }

      // 5. Mis próximas capacitaciones
      if (perfil.empleado_id) {
        const { data: misCaps } = await supabase
          .from('empleados_capacitaciones')
          .select(`
            capacitaciones (id, nombre, fecha_inicio, fecha_fin, modalidad, horas_total)
          `)
          .eq('empleado_id', perfil.empleado_id)
          .eq('completado', false);
        
        const capsFiltradas = (misCaps || [])
          .map((item: any) => item.capacitaciones)
          .filter((cap: any) => cap && cap.fecha_inicio && new Date(cap.fecha_inicio) >= new Date())
          .sort((a: any, b: any) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())
          .slice(0, 3);
        
        setMisProximasCapacitaciones(capsFiltradas);
      }

      // 6. Mi próximo cumpleaños (desde perfil)
      if (perfil.fecha_nacimiento) {
        const fechaNac = new Date(perfil.fecha_nacimiento);
        const proxCumple = new Date(hoy.getFullYear(), fechaNac.getMonth(), fechaNac.getDate());
        if (proxCumple < hoy) {
          proxCumple.setFullYear(proxCumple.getFullYear() + 1);
        }
        const dias = Math.ceil((proxCumple.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        setMiProximoCumpleaños({ dias, fecha: proxCumple });
      }

      // 7. Mi aniversario laboral (desde empleado asociado)
      if (perfil.empleado_id) {
        const { data: empleadoData } = await supabase
          .from('empleados')
          .select('fecha_ingreso')
          .eq('id', perfil.empleado_id)
          .single();
        
        if (empleadoData?.fecha_ingreso) {
          const fechaIngreso = new Date(empleadoData.fecha_ingreso);
          const proxAniv = new Date(hoy.getFullYear(), fechaIngreso.getMonth(), fechaIngreso.getDate());
          if (proxAniv < hoy) {
            proxAniv.setFullYear(proxAniv.getFullYear() + 1);
          }
          const años = hoy.getFullYear() - fechaIngreso.getFullYear();
          const dias = Math.ceil((proxAniv.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
          setMiAniversario({ años, dias, fecha: proxAniv });
        }
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
            Hola, <span className="text-[#00338d]">{userName}</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">{fechaActual}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-xs font-bold">
            {userRole === 'admin' ? 'Administrador' : userRole === 'superuser' ? 'Super Usuario' : userRole === 'rrhh' ? 'RRHH' : userRole === 'jefe' ? 'Jefatura' : 'Empleado'}
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
        
        <div onClick={() => router.push('/rrhh/permisos')} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <Clock className="text-rose-500 mb-2" size={28} />
            <ArrowRight size={16} className="text-slate-300 group-hover:text-rose-500 transition-colors" />
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2">{misPermisosRecientes.length}</p>
          <p className="text-xs text-slate-500">Permisos pendientes</p>
        </div>
      </div>

      {/* DATOS GLOBALES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Próximos Cumpleaños (desde perfiles) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Cake size={18} className="text-amber-500" />
            🎂 Próximos Cumpleaños
          </h2>
          {cumpleañosProximos.length > 0 ? (
            <div className="space-y-3">
              {cumpleañosProximos.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 border-b border-slate-100">
                  <div>
                    <p className="font-medium text-slate-800">{p.nombre_completo}</p>
                    <p className="text-xs text-slate-400">{p.cargo || 'Colaborador'}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    p.diasFaltantes === 0 ? 'bg-amber-500 text-white' :
                    p.diasFaltantes <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {p.diasFaltantes === 0 ? '¡HOY!' : `${p.diasFaltantes} días`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400">
              <Smile size={32} className="mx-auto mb-2 opacity-30" />
              <p>No hay cumpleaños próximos</p>
            </div>
          )}
        </div>

        {/* Próximas Capacitaciones */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <GraduationCap size={18} className="text-blue-500" />
            📚 Capacitaciones Programadas
          </h2>
          {capacitacionesProximas.length > 0 ? (
            <div className="space-y-3">
              {capacitacionesProximas.map((cap, idx) => (
                <div key={cap.id || idx} className="p-2 border-b border-slate-100">
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

        {/* Aniversarios Laborales */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Award size={18} className="text-emerald-500" />
            🏆 Aniversarios Laborales
          </h2>
          {aniversariosProximos.length > 0 ? (
            <div className="space-y-3">
              {aniversariosProximos.map((emp, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 border-b border-slate-100">
                  <div>
                    <p className="font-medium text-slate-800">{emp.nombre_completo}</p>
                    <p className="text-xs text-emerald-600">{emp.años} años</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    emp.diasFaltantes === 0 ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {emp.diasFaltantes === 0 ? '¡HOY!' : `${emp.diasFaltantes} días`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400">
              <Sparkles size={32} className="mx-auto mb-2 opacity-30" />
              <p>No hay aniversarios próximos</p>
            </div>
          )}
        </div>
      </div>

      {/* Estadísticas globales */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
          <Building size={24} className="mb-2 opacity-80" />
          <p className="text-2xl font-black">{totalEmpleados}</p>
          <p className="text-xs opacity-80">Colaboradores activos</p>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
          <FileText size={24} className="mb-2 opacity-80" />
          <p className="text-2xl font-black">{contratosVencer.length}</p>
          <p className="text-xs opacity-80">Contratos por vencer</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white">
          <Truck size={24} className="mb-2 opacity-80" />
          <p className="text-2xl font-black">{proveedoresActivos}</p>
          <p className="text-xs opacity-80">Proveedores activos</p>
        </div>
        
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white">
          <Briefcase size={24} className="mb-2 opacity-80" />
          <p className="text-2xl font-black">{licitacionesActivas}</p>
          <p className="text-xs opacity-80">Licitaciones activas</p>
        </div>
      </div>

      {/* Mis datos personales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Mis Fechas Especiales */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Heart size={18} className="text-rose-500" />
            🎯 Mis Fechas Especiales
          </h2>
          <div className="space-y-3">
            {miProximoCumpleaños && (
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Gift size={20} className="text-amber-500" />
                  <div>
                    <p className="font-medium text-slate-800">Mi Cumpleaños</p>
                    <p className="text-xs text-slate-500">
                      {miProximoCumpleaños.fecha.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-amber-600">
                  {miProximoCumpleaños.dias === 0 ? '¡HOY! 🎉' : `en ${miProximoCumpleaños.dias} días`}
                </span>
              </div>
            )}
            {miAniversario && (
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Award size={20} className="text-emerald-500" />
                  <div>
                    <p className="font-medium text-slate-800">Mi Aniversario Laboral</p>
                    <p className="text-xs text-slate-500">
                      {miAniversario.años} años
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-600">
                  {miAniversario.dias === 0 ? '¡HOY! 🏆' : `en ${miAniversario.dias} días`}
                </span>
              </div>
            )}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}