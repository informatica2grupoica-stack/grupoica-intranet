"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { SECTIONS_CONFIG, getDefaultSecciones } from "@/lib/sections";
import {
  UserPlus, Loader2, X, Pencil, Trash2, Search,
  Lock, Briefcase, CheckCircle2, Circle, LayoutList, Package, Laptop,
  Calendar, Phone, MapPin, Building, Globe, Eye, ShieldCheck,
  ToggleLeft, ToggleRight, Layout
} from "lucide-react";

// Permisos de acción (independientes de las secciones)
const ACTION_PERMS = [
  { key: "can_assign_tasks",        label: "Asignar Tareas",    icon: LayoutList },
  { key: "can_create_tasks",        label: "Crear Tareas",      icon: CheckCircle2 },
  { key: "can_view_billing",        label: "Ver Facturación",   icon: Building },
  { key: "can_manage_devices",      label: "Gestionar Equipos", icon: Laptop },
  { key: "can_create_products",     label: "Crear Productos",   icon: Package },
  { key: "can_search_products_only",label: "🔍 SOLO Productos", icon: Eye },
];

function buildDefaultPermisos() {
  return {
    can_assign_tasks:         false,
    can_create_tasks:         false,
    can_view_billing:         false,
    can_manage_devices:       false,
    can_create_products:      false,
    can_search_products_only: false,
    secciones:                getDefaultSecciones(),
  };
}

// Cuando se carga un usuario existente, combina sus secciones guardadas
// con las del config (nuevas secciones aparecen habilitadas por defecto)
function mergeConConfigSecciones(savedSecciones: Record<string, boolean> | undefined | null): Record<string, boolean> {
  const defaults = getDefaultSecciones();
  if (!savedSecciones) return defaults;
  return { ...defaults, ...savedSecciones };
}

export default function GestionUsuarios() {
  const [usuarios, setUsuarios]               = useState<any[]>([]);
  const [perfilLogueado, setPerfilLogueado]   = useState<any>(null);
  const [loadingLista, setLoadingLista]       = useState(true);
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [loadingForm, setLoadingForm]         = useState(false);
  const [filtro, setFiltro]                   = useState("");
  const [mensaje, setMensaje]                 = useState({ tipo: "", texto: "" });
  const [editandoId, setEditandoId]           = useState<string | null>(null);
  const [tabActivo, setTabActivo]             = useState<"datos" | "acceso">("datos");

  const [formData, setFormData] = useState(() => ({
    email:           "",
    password:        "",
    nombre:          "",
    apellido:        "",
    rut:             "",
    fecha_nacimiento:"",
    telefono:        "",
    direccion:       "",
    comuna:          "",
    ciudad:          "",
    region:          "",
    cargo:           "",
    rol:             "user",
    permisos:        buildDefaultPermisos(),
  }));

  useEffect(() => { obtenerUsuariosYSesion(); }, []);

  async function obtenerUsuariosYSesion() {
    setLoadingLista(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: miPerfil } = await supabase
          .from("perfiles").select("*").eq("user_id", session.user.id).single();
        setPerfilLogueado(miPerfil);
      }
      const { data, error } = await supabase
        .from("perfiles").select("*").order("created_at", { ascending: false });
      if (!error) setUsuarios(data || []);
    } catch (err) {
      console.error("Error al cargar datos:", err);
    } finally {
      setLoadingLista(false);
    }
  }

  const usuariosFiltrados = usuarios.filter(u =>
    `${u.nombre} ${u.apellido} ${u.email} ${u.cargo} ${u.rut || ""} ${u.telefono || ""}`.toLowerCase()
      .includes(filtro.toLowerCase())
  );

  function cerrarModal() {
    setIsModalOpen(false);
    setEditandoId(null);
    setTabActivo("datos");
    setFormData({
      email: "", password: "", nombre: "", apellido: "", rut: "",
      fecha_nacimiento: "", telefono: "", direccion: "", comuna: "",
      ciudad: "", region: "", cargo: "", rol: "user",
      permisos: buildDefaultPermisos(),
    });
    setMensaje({ tipo: "", texto: "" });
  }

  function prepararEdicion(user: any) {
    if (user.rol === "superuser") return;
    setEditandoId(user.id);
    setTabActivo("datos");
    setFormData({
      email:            user.email,
      password:         "",
      nombre:           user.nombre          || "",
      apellido:         user.apellido        || "",
      rut:              user.rut             || "",
      fecha_nacimiento: user.fecha_nacimiento|| "",
      telefono:         user.telefono        || "",
      direccion:        user.direccion       || "",
      comuna:           user.comuna          || "",
      ciudad:           user.ciudad          || "",
      region:           user.region          || "",
      cargo:            user.cargo           || "",
      rol:              user.rol,
      permisos: {
        can_assign_tasks:         user.permisos?.can_assign_tasks         || false,
        can_create_tasks:         user.permisos?.can_create_tasks         || false,
        can_view_billing:         user.permisos?.can_view_billing         || false,
        can_manage_devices:       user.permisos?.can_manage_devices       || false,
        can_create_products:      user.permisos?.can_create_products      || false,
        can_search_products_only: user.permisos?.can_search_products_only || false,
        secciones: mergeConConfigSecciones(user.permisos?.secciones),
      },
    });
    setIsModalOpen(true);
  }

  const toggleAccionPerm = (key: string) => {
    setFormData(prev => ({
      ...prev,
      permisos: { ...prev.permisos, [key]: !(prev.permisos as any)[key] },
    }));
  };

  const toggleSeccion = (key: string) => {
    setFormData(prev => ({
      ...prev,
      permisos: {
        ...prev.permisos,
        secciones: {
          ...prev.permisos.secciones,
          [key]: !prev.permisos.secciones[key],
        },
      },
    }));
  };

  const habilitarTodasSecciones = () =>
    setFormData(prev => ({
      ...prev,
      permisos: { ...prev.permisos, secciones: getDefaultSecciones() },
    }));

  const deshabilitarTodasSecciones = () =>
    setFormData(prev => ({
      ...prev,
      permisos: {
        ...prev.permisos,
        secciones: Object.fromEntries(
          SECTIONS_CONFIG.flatMap(g => g.items.map(i => [i.key, false]))
        ),
      },
    }));

  async function handleGuardarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setLoadingForm(true);
    setMensaje({ tipo: "", texto: "" });
    try {
      const dataPayload: any = {
        nombre:           formData.nombre,
        apellido:         formData.apellido,
        rut:              formData.rut              || null,
        fecha_nacimiento: formData.fecha_nacimiento || null,
        telefono:         formData.telefono         || null,
        direccion:        formData.direccion        || null,
        comuna:           formData.comuna           || null,
        ciudad:           formData.ciudad           || null,
        region:           formData.region           || null,
        cargo:            formData.cargo            || null,
        rol:              formData.rol,
        permisos:         formData.permisos,
        updated_at:       new Date().toISOString(),
      };

      if (editandoId) {
        const { error } = await supabase.from("perfiles").update(dataPayload).eq("id", editandoId);
        if (error) throw error;
      } else {
        const { data: auth, error: authErr } = await supabase.auth.signUp({
          email:    formData.email,
          password: formData.password,
        });
        if (authErr) throw authErr;
        const { error: pErr } = await supabase.from("perfiles").insert([{
          ...dataPayload,
          user_id: auth.user?.id,
          email:   formData.email.toLowerCase().trim(),
          activo:  true,
        }]);
        if (pErr) throw pErr;
      }

      setMensaje({ tipo: "success", texto: editandoId ? "✅ Cambios guardados" : "✅ Miembro registrado" });
      setTimeout(() => { cerrarModal(); obtenerUsuariosYSesion(); }, 1200);
    } catch (err: any) {
      console.error("Error:", err);
      setMensaje({ tipo: "error", texto: err.message || "Error al guardar" });
    } finally {
      setLoadingForm(false);
    }
  }

  async function handleEliminar(user: any) {
    if (user.rol === "superuser") return alert("❌ El Superusuario es intocable.");
    if (!confirm(`¿Eliminar a ${user.nombre} ${user.apellido}?`)) return;
    const { error } = await supabase.from("perfiles").delete().eq("id", user.id);
    if (!error) obtenerUsuariosYSesion();
    else alert("No tienes permisos suficientes.");
  }

  async function toggleEstado(user: any) {
    if (user.rol === "superuser") return;
    const { error } = await supabase
      .from("perfiles")
      .update({ activo: !user.activo, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (!error) obtenerUsuariosYSesion();
  }

  const formatearFecha = (fecha: string) =>
    fecha ? new Date(fecha).toLocaleDateString("es-CL") : "—";

  const rolesPermitidos = ["superuser", "admin", "user", "rrhh", "jefe", "vendedor"];
  const soyAdminOSuper  = perfilLogueado?.rol === "admin" || perfilLogueado?.rol === "superuser";

  // Cuenta secciones habilitadas de un usuario
  const contarSeccionesHabilitadas = (u: any): string => {
    const secciones = u.permisos?.secciones;
    if (!secciones) return "Completo";
    if (u.rol === "admin" || u.rol === "superuser") return "Completo";
    const total   = SECTIONS_CONFIG.flatMap(g => g.items).length;
    const activas = Object.values(secciones).filter(Boolean).length;
    if (activas === total) return "Completo";
    return `${activas}/${total} secciones`;
  };

  // Secciones habilitadas del form actual (para preview en el tab)
  const seccionesActivas = formData.permisos.secciones
    ? Object.values(formData.permisos.secciones).filter(Boolean).length
    : 0;
  const seccionesTotal = SECTIONS_CONFIG.flatMap(g => g.items).length;
  const esRolAdminEnForm = formData.rol === "admin" || formData.rol === "superuser";

  return (
    <div className="animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">👥 Gestión de Usuarios</h1>
          <p className="text-slate-400 text-sm mt-1">Panel de control de acceso y datos personales GrupoICA.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, RUT o cargo..."
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 ring-blue-50 w-64 transition-all"
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
            />
          </div>
          {soyAdminOSuper && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-[#059669] hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-100"
            >
              <UserPlus className="w-4 h-4" /> Nuevo Miembro
            </button>
          )}
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/30">
                <th className="px-5 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Colaborador</th>
                <th className="px-3 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest">RUT</th>
                <th className="px-3 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Fecha Nac.</th>
                <th className="px-3 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Teléfono</th>
                <th className="px-3 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-center">Cargo</th>
                <th className="px-3 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-center">Rol</th>
                <th className="px-3 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-center">Acceso</th>
                <th className="px-3 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-center">Estado</th>
                <th className="px-5 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loadingLista ? (
                <tr>
                  <td colSpan={9} className="py-24 text-center">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#059669] mb-2 opacity-20" />
                    <p className="text-slate-400 text-xs">Cargando usuarios...</p>
                  </td>
                </tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-24 text-center">
                    <p className="text-slate-400 text-sm">No se encontraron usuarios</p>
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map(user => {
                  const esSuperUser = user.rol === "superuser";
                  const accesoLabel = contarSeccionesHabilitadas(user);
                  const esCompleto  = accesoLabel === "Completo";

                  return (
                    <tr key={user.id} className="hover:bg-[#ECFDF5]/30 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs border border-white shadow-sm transition-all ${
                            esSuperUser ? "bg-[#111827] text-white" : "bg-slate-100 group-hover:bg-[#059669] group-hover:text-white"
                          }`}>
                            {user.nombre?.substring(0, 1)}{user.apellido?.substring(0, 1)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                              {user.nombre} {user.apellido}
                              {esSuperUser && <Lock className="w-3 h-3 text-indigo-500" />}
                            </p>
                            <p className="text-[9px] text-slate-400 font-mono">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <p className="text-xs font-mono text-slate-600">{user.rut || "—"}</p>
                      </td>
                      <td className="px-3 py-4">
                        <p className="text-xs text-slate-600">{formatearFecha(user.fecha_nacimiento)}</p>
                      </td>
                      <td className="px-3 py-4">
                        <p className="text-xs text-slate-600">{user.telefono || "—"}</p>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-slate-600 text-xs">
                          <Briefcase className="w-3 h-3 text-slate-300" />
                          {user.cargo || "Operativo"}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border ${
                          esSuperUser          ? "bg-[#ECFDF5] border-indigo-100 text-[#059669]" :
                          user.rol === "admin" ? "bg-[#ECFDF5] border-[#D1FAE5] text-[#059669]" :
                          user.rol === "rrhh"  ? "bg-purple-50 border-purple-100 text-purple-600" :
                          user.rol === "jefe"  ? "bg-orange-50 border-orange-100 text-orange-600" :
                          "bg-slate-50 border-slate-100 text-slate-500"
                        }`}>
                          {user.rol?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border ${
                          esCompleto
                            ? "bg-slate-50 border-slate-100 text-slate-400"
                            : "bg-amber-50 border-amber-100 text-amber-600"
                        }`}>
                          {esCompleto ? "COMPLETO" : accesoLabel.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <button
                          disabled={esSuperUser || !soyAdminOSuper}
                          onClick={() => toggleEstado(user)}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black transition-all ${
                            esSuperUser       ? "bg-[#D1FAE5] text-[#059669] cursor-default" :
                            user.activo
                              ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white"
                              : "bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white"
                          } disabled:opacity-50`}
                        >
                          {user.activo ? "ACTIVO" : "INACTIVO"}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!esSuperUser && soyAdminOSuper ? (
                            <>
                              <button onClick={() => prepararEdicion(user)} className="p-2 text-slate-400 hover:text-[#059669] hover:bg-[#ECFDF5] rounded-xl transition-all" title="Editar">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleEliminar(user)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Eliminar">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[9px] text-slate-300 font-bold px-2 italic uppercase">Protegido</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL ─────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden my-8">
            {/* Header del modal */}
            <div className="px-8 py-5 flex justify-between items-center bg-slate-50/50 sticky top-0 border-b border-slate-100 z-10">
              <h2 className="text-xl font-black text-slate-800">
                {editandoId ? "✏️ Editar Colaborador" : "➕ Nuevo Miembro"}
              </h2>
              <button onClick={cerrarModal} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/30 px-8">
              <button
                type="button"
                onClick={() => setTabActivo("datos")}
                className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                  tabActivo === "datos"
                    ? "border-[#059669] text-[#059669]"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                📋 Datos & Credenciales
              </button>
              <button
                type="button"
                onClick={() => setTabActivo("acceso")}
                className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
                  tabActivo === "acceso"
                    ? "border-[#059669] text-[#059669]"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Accesos & Permisos
                {!esRolAdminEnForm && (
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                    seccionesActivas === seccionesTotal
                      ? "bg-slate-100 text-slate-400"
                      : "bg-amber-100 text-amber-600"
                  }`}>
                    {seccionesActivas}/{seccionesTotal}
                  </span>
                )}
              </button>
            </div>

            <form onSubmit={handleGuardarUsuario}>
              <div className="p-8 space-y-5 max-h-[62vh] overflow-y-auto">

                {/* ── TAB: DATOS ─────────────────────────────────────── */}
                {tabActivo === "datos" && (
                  <>
                    {/* Datos personales */}
                    <div className="bg-[#ECFDF5]/30 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <UserPlus className="w-4 h-4 text-[#059669]" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-[#047857]">Datos Personales</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <input placeholder="Nombre *" required className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#059669]/20" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                        <input placeholder="Apellido *" required className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-[#059669]/20" value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} />
                        <input placeholder="RUT (ej: 12345678-9)" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none" value={formData.rut} onChange={e => setFormData({...formData, rut: e.target.value})} />
                        <input type="date" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" value={formData.fecha_nacimiento} onChange={e => setFormData({...formData, fecha_nacimiento: e.target.value})} />
                      </div>
                    </div>

                    {/* Contacto */}
                    <div className="bg-slate-50/50 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Phone className="w-4 h-4 text-slate-500" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">Contacto y Ubicación</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <input placeholder="Teléfono" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                        <input placeholder="Dirección" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none col-span-2" value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} />
                        <input placeholder="Comuna" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" value={formData.comuna} onChange={e => setFormData({...formData, comuna: e.target.value})} />
                        <input placeholder="Ciudad" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" value={formData.ciudad} onChange={e => setFormData({...formData, ciudad: e.target.value})} />
                        <input placeholder="Región" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none col-span-2" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} />
                      </div>
                    </div>

                    {/* Laboral */}
                    <div className="bg-emerald-50/30 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Briefcase className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-emerald-700">Información Laboral</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <input placeholder="Cargo" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" value={formData.cargo} onChange={e => setFormData({...formData, cargo: e.target.value})} />
                        <select className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none" value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})}>
                          {rolesPermitidos.filter(r => r !== "superuser").map(r => (
                            <option key={r} value={r}>{r.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Credenciales */}
                    <div className="bg-slate-100 rounded-2xl p-5 space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">🔐 Credenciales de Acceso</h3>
                      <input type="email" placeholder="Email *" disabled={!!editandoId} required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                      {!editandoId && (
                        <input type="password" placeholder="Contraseña temporal *" required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                      )}
                    </div>
                  </>
                )}

                {/* ── TAB: ACCESOS ───────────────────────────────────── */}
                {tabActivo === "acceso" && (
                  <>
                    {/* Aviso para admin/superuser */}
                    {esRolAdminEnForm && (
                      <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                        <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-black text-emerald-700">Acceso completo garantizado</p>
                          <p className="text-[11px] text-emerald-600 mt-0.5">
                            Los roles <strong>Admin</strong> y <strong>Superusuario</strong> tienen acceso a todas las secciones sin importar la configuración de abajo.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Secciones */}
                    <div className={`rounded-2xl p-5 space-y-4 ${esRolAdminEnForm ? "bg-slate-800/60" : "bg-slate-900"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-1.5">
                          <Layout className="w-3.5 h-3.5" /> Acceso a Secciones
                        </span>
                        {!esRolAdminEnForm && (
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={habilitarTodasSecciones} className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
                              Habilitar todas
                            </button>
                            <span className="text-white/20">|</span>
                            <button type="button" onClick={deshabilitarTodasSecciones} className="text-[9px] text-slate-500 hover:text-slate-300 font-bold transition-colors">
                              Quitar todas
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        {SECTIONS_CONFIG.map(group => (
                          <div key={group.group}>
                            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-500 mb-2">
                              {group.group}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {group.items.map(item => {
                                const activa = formData.permisos.secciones[item.key] !== false;
                                return (
                                  <button
                                    key={item.key}
                                    type="button"
                                    disabled={esRolAdminEnForm}
                                    onClick={() => toggleSeccion(item.key)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                      esRolAdminEnForm
                                        ? "bg-emerald-700/30 border-emerald-700/30 text-emerald-400/60 cursor-default"
                                        : activa
                                          ? "bg-emerald-600 border-emerald-500 text-white shadow-sm"
                                          : "bg-white/5 border-white/10 text-white/30 hover:bg-white/10 hover:text-white/60"
                                    }`}
                                  >
                                    {activa
                                      ? <CheckCircle2 className="w-3 h-3" />
                                      : <Circle className="w-3 h-3" />
                                    }
                                    {item.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {!esRolAdminEnForm && (
                        <p className="text-[9px] text-slate-500 border-t border-white/5 pt-3">
                          Las secciones deshabilitadas no aparecerán en el sidebar y el acceso directo a esas rutas será redirigido.
                        </p>
                      )}
                    </div>

                    {/* Permisos de acción */}
                    <div className="bg-slate-900 rounded-2xl p-5 space-y-4">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 flex items-center gap-1.5">
                        ⚡ Permisos de Acción
                      </span>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {ACTION_PERMS.map(p => {
                          const activo = (formData.permisos as any)[p.key];
                          return (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => toggleAccionPerm(p.key)}
                              className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all border ${
                                activo
                                  ? "bg-[#059669] border-emerald-500 text-white"
                                  : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                              }`}
                            >
                              <p.icon size={14} />
                              <span className="text-[8px] font-bold uppercase text-center leading-tight">{p.label}</span>
                              {activo ? <CheckCircle2 size={8} /> : <Circle size={8} />}
                            </button>
                          );
                        })}
                      </div>
                      {(formData.permisos as any).can_search_products_only && (
                        <div className="p-2.5 bg-amber-500/20 rounded-xl border border-amber-500/30">
                          <p className="text-[9px] text-amber-300 text-center font-bold">
                            ⚠️ Con «SOLO Productos» activo, el usuario solo podrá acceder al buscador de productos.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {mensaje.texto && (
                  <div className={`p-4 rounded-xl text-xs font-black text-center ${
                    mensaje.tipo === "success" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                  }`}>
                    {mensaje.texto}
                  </div>
                )}
              </div>

              {/* Footer fijo */}
              <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/30 sticky bottom-0">
                <button
                  disabled={loadingForm}
                  className="w-full bg-[#059669] text-white py-3.5 rounded-xl font-black text-sm hover:bg-emerald-700 transition-all uppercase tracking-wider shadow-lg"
                >
                  {loadingForm
                    ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    : editandoId ? "💾 Guardar Cambios" : "📝 Registrar Miembro"
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
