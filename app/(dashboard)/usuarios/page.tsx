"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  UserPlus, Loader2, X, Pencil, Trash2, Search, 
  Lock, Briefcase, CheckCircle2, Circle, LayoutList, Package, Laptop,
  Calendar, Phone, MapPin, Building, Globe, Eye
} from "lucide-react";

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [perfilLogueado, setPerfilLogueado] = useState<any>(null);
  const [loadingLista, setLoadingLista] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // ESTADO INICIAL CON TODOS LOS CAMPOS DE LA TABLA
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    nombre: "",
    apellido: "",
    rut: "",
    fecha_nacimiento: "",
    telefono: "",
    direccion: "",
    comuna: "",
    ciudad: "",
    region: "",
    cargo: "",
    rol: "user",
    permisos: {
      can_assign_tasks: false,
      can_create_tasks: false,
      can_view_billing: false,
      can_manage_devices: false,
      can_create_products: false,
      can_search_products_only: false
    }
  });

  useEffect(() => {
    obtenerUsuariosYSesion();
  }, []);

  async function obtenerUsuariosYSesion() {
    setLoadingLista(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: miPerfil } = await supabase
          .from('perfiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        setPerfilLogueado(miPerfil);
      }

      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error) setUsuarios(data || []);
    } catch (err) {
      console.error("Error al cargar datos:", err);
    } finally {
      setLoadingLista(false);
    }
  }

  const usuariosFiltrados = usuarios.filter(u => 
    `${u.nombre} ${u.apellido} ${u.email} ${u.cargo} ${u.rut || ''} ${u.telefono || ''}`.toLowerCase().includes(filtro.toLowerCase())
  );

  function cerrarModal() {
    setIsModalOpen(false);
    setEditandoId(null);
    setFormData({ 
      email: "", password: "", nombre: "", apellido: "", rut: "", 
      fecha_nacimiento: "", telefono: "", direccion: "", comuna: "", ciudad: "", region: "",
      cargo: "", rol: "user",
      permisos: { 
        can_assign_tasks: false, can_create_tasks: false, 
        can_view_billing: false, can_manage_devices: false, can_create_products: false,
        can_search_products_only: false
      }
    });
    setMensaje({ tipo: "", texto: "" });
  }

  function prepararEdicion(user: any) {
    if (user.rol === 'superuser') return;
    setEditandoId(user.id);
    setFormData({
      email: user.email,
      password: "",
      nombre: user.nombre || "",
      apellido: user.apellido || "",
      rut: user.rut || "",
      fecha_nacimiento: user.fecha_nacimiento || "",
      telefono: user.telefono || "",
      direccion: user.direccion || "",
      comuna: user.comuna || "",
      ciudad: user.ciudad || "",
      region: user.region || "",
      cargo: user.cargo || "",
      rol: user.rol,
      permisos: {
        can_assign_tasks: user.permisos?.can_assign_tasks || false,
        can_create_tasks: user.permisos?.can_create_tasks || false,
        can_view_billing: user.permisos?.can_view_billing || false,
        can_manage_devices: user.permisos?.can_manage_devices || false,
        can_create_products: user.permisos?.can_create_products || false,
        can_search_products_only: user.permisos?.can_search_products_only || false
      }
    });
    setIsModalOpen(true);
  }

  const togglePermiso = (key: string) => {
    setFormData(prev => ({
      ...prev,
      permisos: {
        ...prev.permisos,
        [key]: !(prev.permisos as any)[key]
      }
    }));
  };

  async function handleGuardarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setLoadingForm(true);
    setMensaje({ tipo: "", texto: "" });

    try {
      const dataPayload: any = {
        nombre: formData.nombre,
        apellido: formData.apellido,
        rut: formData.rut || null,
        fecha_nacimiento: formData.fecha_nacimiento || null,
        telefono: formData.telefono || null,
        direccion: formData.direccion || null,
        comuna: formData.comuna || null,
        ciudad: formData.ciudad || null,
        region: formData.region || null,
        cargo: formData.cargo || null,
        rol: formData.rol,
        permisos: formData.permisos,
        updated_at: new Date().toISOString()
      };

      if (editandoId) {
        const { error } = await supabase
          .from('perfiles')
          .update(dataPayload)
          .eq('id', editandoId);
        if (error) throw error;
      } else {
        const { data: auth, error: authErr } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });
        if (authErr) throw authErr;

        const { error: pErr } = await supabase.from('perfiles').insert([{
          ...dataPayload,
          user_id: auth.user?.id,
          email: formData.email.toLowerCase().trim(),
          activo: true
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
    if (user.rol === 'superuser') return alert("❌ El Superusuario es intocable.");
    if (!confirm(`¿Estás seguro de eliminar a ${user.nombre} ${user.apellido}?`)) return;
    const { error } = await supabase.from('perfiles').delete().eq('id', user.id);
    if (!error) obtenerUsuariosYSesion();
    else alert("No tienes permisos suficientes.");
  }

  async function toggleEstado(user: any) {
    if (user.rol === 'superuser') return;
    const { error } = await supabase
      .from('perfiles')
      .update({ activo: !user.activo, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (!error) obtenerUsuariosYSesion();
  }

  const formatearFecha = (fecha: string) => {
    if (!fecha) return "—";
    return new Date(fecha).toLocaleDateString('es-CL');
  };

  // Obtener lista de roles permitidos desde el CHECK constraint
  const rolesPermitidos = ['superuser', 'admin', 'user', 'rrhh', 'jefe', 'vendedor'];

  // Verificar si un usuario tiene el permiso de solo productos (para mostrar indicador)
  const tienePermisoSoloProductos = (usuario: any) => {
    return usuario.permisos?.can_search_products_only === true;
  };

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
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
          {(perfilLogueado?.rol === 'admin' || perfilLogueado?.rol === 'superuser') && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-[#00338d] hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-100"
            >
              <UserPlus className="w-4 h-4" /> Nuevo Miembro
            </button>
          )}
        </div>
      </div>

      {/* TABLA DE USUARIOS */}
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
                    <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600 mb-2 opacity-20" />
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
                usuariosFiltrados.map((user) => {
                  const esSuperUser = user.rol === 'superuser';
                  const soyAdminOSuper = perfilLogueado?.rol === 'admin' || perfilLogueado?.rol === 'superuser';
                  const esSoloProductos = tienePermisoSoloProductos(user);

                  return (
                    <tr key={user.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs border border-white shadow-sm transition-all ${esSuperUser ? 'bg-indigo-600 text-white' : (esSoloProductos ? 'bg-emerald-600 text-white' : 'bg-slate-100 group-hover:bg-blue-600 group-hover:text-white')}`}>
                            {user.nombre?.substring(0, 1)}{user.apellido?.substring(0, 1)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                              {user.nombre} {user.apellido}
                              {esSuperUser && <Lock className="w-3 h-3 text-indigo-500" />}
                              {esSoloProductos && !esSuperUser && <Eye className="w-3 h-3 text-emerald-500" />}
                            </p>
                            <p className="text-[9px] text-slate-400 font-mono">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <p className="text-xs font-mono text-slate-600">{user.rut || '—'}</p>
                       </td>
                      <td className="px-3 py-4">
                        <p className="text-xs text-slate-600">{formatearFecha(user.fecha_nacimiento)}</p>
                       </td>
                      <td className="px-3 py-4">
                        <p className="text-xs text-slate-600">{user.telefono || '—'}</p>
                       </td>
                      <td className="px-3 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-slate-600 text-xs">
                          <Briefcase className="w-3 h-3 text-slate-300" />
                          {user.cargo || 'Operativo'}
                        </div>
                       </td>
                      <td className="px-3 py-4 text-center">
                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border ${
                          esSuperUser ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 
                          user.rol === 'admin' ? 'bg-blue-50 border-blue-100 text-blue-600' : 
                          user.rol === 'rrhh' ? 'bg-purple-50 border-purple-100 text-purple-600' :
                          user.rol === 'jefe' ? 'bg-orange-50 border-orange-100 text-orange-600' :
                          'bg-slate-50 border-slate-100 text-slate-500'
                        }`}>
                          {user.rol?.toUpperCase()}
                        </span>
                       </td>
                      <td className="px-3 py-4 text-center">
                        {esSoloProductos ? (
                          <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600">
                            🔍 SOLO PRODUCTOS
                          </span>
                        ) : (
                          <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-slate-400">
                            COMPLETO
                          </span>
                        )}
                       </td>
                      <td className="px-3 py-4 text-center">
                        <button 
                          disabled={esSuperUser || !soyAdminOSuper}
                          onClick={() => toggleEstado(user)}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black transition-all ${
                            esSuperUser ? 'bg-indigo-100 text-indigo-600 cursor-default' :
                            user.activo 
                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white' 
                            : 'bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white'
                          } disabled:opacity-50`}
                        >
                          {user.activo ? "ACTIVO" : "INACTIVO"}
                        </button>
                       </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!esSuperUser && soyAdminOSuper ? (
                            <>
                              <button onClick={() => prepararEdicion(user)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Editar">
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

      {/* MODAL DE REGISTRO/EDICIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden my-8">
            <div className="px-8 py-6 flex justify-between items-center bg-slate-50/50 sticky top-0 border-b border-slate-100">
              <h2 className="text-xl font-black text-slate-800">
                {editandoId ? "✏️ Editar Colaborador" : "➕ Nuevo Miembro"}
              </h2>
              <button onClick={cerrarModal} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleGuardarUsuario} className="p-8 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* INFORMACIÓN PERSONAL */}
              <div className="bg-blue-50/30 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-blue-700">Datos Personales</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Nombre *" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-blue-500/20" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} required />
                  <input placeholder="Apellido *" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 ring-blue-500/20" value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} required />
                  <input placeholder="RUT (ej: 12345678-9)" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none" value={formData.rut} onChange={e => setFormData({...formData, rut: e.target.value})} />
                  <input type="date" placeholder="Fecha de Nacimiento" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" value={formData.fecha_nacimiento} onChange={e => setFormData({...formData, fecha_nacimiento: e.target.value})} />
                </div>
              </div>

              {/* CONTACTO Y UBICACIÓN */}
              <div className="bg-slate-50/50 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">Contacto y Ubicación</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Teléfono" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                  <input placeholder="Dirección" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none col-span-2" value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} />
                  <input placeholder="Comuna" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" value={formData.comuna} onChange={e => setFormData({...formData, comuna: e.target.value})} />
                  <input placeholder="Ciudad" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" value={formData.ciudad} onChange={e => setFormData({...formData, ciudad: e.target.value})} />
                  <input placeholder="Región" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} />
                </div>
              </div>

              {/* INFORMACIÓN LABORAL */}
              <div className="bg-emerald-50/30 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-emerald-700">Información Laboral</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Cargo" className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" value={formData.cargo} onChange={e => setFormData({...formData, cargo: e.target.value})} />
                  <select className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none" value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})}>
                    {rolesPermitidos.filter(r => r !== 'superuser').map(rol => (
                      <option key={rol} value={rol}>{rol.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CREDENCIALES */}
              <div className="bg-slate-100 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">🔐 Credenciales de Acceso</h3>
                <div className="grid grid-cols-1 gap-4">
                  <input type="email" placeholder="Email *" disabled={!!editandoId} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                  {!editandoId && (
                    <input placeholder="Contraseña temporal *" type="password" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                  )}
                </div>
              </div>

              {/* PERMISOS ESPECIALES */}
              <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">⚡ Permisos Especiales</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { key: 'can_assign_tasks', label: 'Asignar Tareas', icon: LayoutList },
                    { key: 'can_create_tasks', label: 'Crear Tareas', icon: CheckCircle2 },
                    { key: 'can_view_billing', label: 'Ver Facturación', icon: Building },
                    { key: 'can_manage_devices', label: 'Gestionar Equipos', icon: Laptop },
                    { key: 'can_create_products', label: 'Crear Productos', icon: Package },
                    { key: 'can_search_products_only', label: '🔍 SOLO Productos', icon: Eye },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => togglePermiso(p.key)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all border ${
                        (formData.permisos as any)[p.key] 
                        ? 'bg-blue-600 border-blue-400 text-white' 
                        : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                      }`}
                    >
                      <p.icon size={14} />
                      <span className="text-[8px] font-bold uppercase text-center leading-tight">{p.label}</span>
                      {(formData.permisos as any)[p.key] ? <CheckCircle2 size={8}/> : <Circle size={8}/>}
                    </button>
                  ))}
                </div>
                {/* Advertencia sobre el permiso SOLO Productos */}
                {(formData.permisos as any).can_search_products_only && (
                  <div className="mt-3 p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
                    <p className="text-[9px] text-amber-300 text-center font-bold">
                      ⚠️ Este usuario SOLO podrá ver el buscador de productos y nada más
                    </p>
                  </div>
                )}
              </div>

              {mensaje.texto && (
                <div className={`p-4 rounded-xl text-xs font-black text-center ${mensaje.tipo === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {mensaje.texto}
                </div>
              )}

              <button disabled={loadingForm} className="w-full bg-[#00338d] text-white py-4 rounded-xl font-black text-sm hover:bg-blue-900 transition-all uppercase tracking-wider shadow-xl">
                {loadingForm ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (editandoId ? "💾 Guardar Cambios" : "📝 Registrar Miembro")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}