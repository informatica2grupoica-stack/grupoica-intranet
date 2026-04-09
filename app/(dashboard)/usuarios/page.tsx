"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  UserPlus, Loader2, X, Pencil, Trash2, Search, 
  Lock, Briefcase, CheckCircle2, Circle, LayoutList, Package, Laptop
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

  // ESTADO INICIAL CON PERMISOS
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    nombre: "",
    apellido: "",
    cargo: "",
    rol: "user",
    permisos: {
      can_create_tasks: false,
      can_create_products: false,
      can_manage_devices: false
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
    `${u.nombre} ${u.apellido} ${u.email} ${u.cargo}`.toLowerCase().includes(filtro.toLowerCase())
  );

  function cerrarModal() {
    setIsModalOpen(false);
    setEditandoId(null);
    setFormData({ 
      email: "", password: "", nombre: "", apellido: "", cargo: "", rol: "user",
      permisos: { can_create_tasks: false, can_create_products: false, can_manage_devices: false }
    });
    setMensaje({ tipo: "", texto: "" });
  }

  function prepararEdicion(user: any) {
    if (user.rol === 'superuser') return;
    setEditandoId(user.id);
    setFormData({
      email: user.email,
      password: "",
      nombre: user.nombre,
      apellido: user.apellido,
      cargo: user.cargo || "",
      rol: user.rol,
      permisos: user.permisos || { can_create_tasks: false, can_create_products: false, can_manage_devices: false }
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
        cargo: formData.cargo,
        rol: formData.rol, // Quitamos la validación que forzaba a 'admin' para permitir que el state maneje el rol elegido
        permisos: formData.permisos 
      };

      if (editandoId) {
        const { error } = await supabase.from('perfiles').update(dataPayload).eq('id', editandoId);
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
      
      setMensaje({ tipo: "success", texto: editandoId ? "Cambios guardados" : "Miembro registrado" });
      setTimeout(() => { cerrarModal(); obtenerUsuariosYSesion(); }, 1000);
    } catch (err: any) {
      setMensaje({ tipo: "error", texto: err.message });
    } finally {
      setLoadingForm(false);
    }
  }

  async function handleEliminar(user: any) {
    if (user.rol === 'superuser') return alert("Error: El Superusuario es intocable.");
    if (!confirm(`¿Estás seguro de eliminar a ${user.nombre}?`)) return;
    const { error } = await supabase.from('perfiles').delete().eq('id', user.id);
    if (!error) obtenerUsuariosYSesion();
    else alert("No tienes permisos suficientes.");
  }

  async function toggleEstado(user: any) {
    if (user.rol === 'superuser') return;
    const { error } = await supabase.from('perfiles').update({ activo: !user.activo }).eq('id', user.id);
    if (!error) obtenerUsuariosYSesion();
  }

  return (
    <div className="animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Gestión de Usuarios</h1>
          <p className="text-slate-400 text-sm mt-1">Panel de control de acceso GrupoICA.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o cargo..." 
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

      {/* TABLA */}
      <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50/30">
              <th className="px-8 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Colaborador</th>
              <th className="px-6 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-center">Cargo</th>
              <th className="px-6 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-center">Rol</th>
              <th className="px-6 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-center">Estado</th>
              <th className="px-8 py-5 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loadingLista ? (
              <tr>
                <td colSpan={5} className="py-24 text-center">
                  <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600 mb-2 opacity-20" />
                </td>
              </tr>
            ) : usuariosFiltrados.map((user) => {
              const esSuperUser = user.rol === 'superuser';
              const soyAdminOSuper = perfilLogueado?.rol === 'admin' || perfilLogueado?.rol === 'superuser';

              return (
                <tr key={user.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs border border-white shadow-sm transition-all ${esSuperUser ? 'bg-indigo-600 text-white' : 'bg-slate-100 group-hover:bg-blue-600 group-hover:text-white'}`}>
                        {user.nombre?.substring(0, 1)}{user.apellido?.substring(0, 1)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 flex items-center gap-2">
                          {user.nombre} {user.apellido}
                          {esSuperUser && <Lock className="w-3 h-3 text-indigo-500" />}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-600 font-semibold">
                      <Briefcase className="w-3 h-3 text-slate-300" />
                      {user.cargo || 'Operativo'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${
                      esSuperUser ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 
                      user.rol === 'admin' ? 'bg-blue-50 border-blue-100 text-blue-600' : 
                      'bg-slate-50 border-slate-100 text-slate-500'
                    }`}>
                      {user.rol?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      disabled={esSuperUser || !soyAdminOSuper}
                      onClick={() => toggleEstado(user)}
                      className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                        esSuperUser ? 'bg-indigo-100 text-indigo-600 cursor-default' :
                        user.activo 
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white' 
                        : 'bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white'
                      } disabled:opacity-50`}
                    >
                      {user.activo ? "ACTIVO" : "INACTIVO"}
                    </button>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!esSuperUser && soyAdminOSuper ? (
                        <>
                          <button onClick={() => prepararEdicion(user)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleEliminar(user)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-bold px-2 italic uppercase">Protegido</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL CON SECCIÓN DE PODERES */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="px-10 py-8 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-800">{editandoId ? "Gestionar Colaborador" : "Nuevo Miembro"}</h2>
              <button onClick={cerrarModal} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X /></button>
            </div>
            
            <form onSubmit={handleGuardarUsuario} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <input placeholder="Nombre" className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 ring-blue-500/20" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} required />
                <input placeholder="Apellido" className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 ring-blue-500/20" value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} required />
              </div>

              <div className="grid grid-cols-2 gap-6 items-center">
                <input type="email" placeholder="Email" disabled={!!editandoId} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm disabled:opacity-50" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                <select className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-blue-600 outline-none" value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})}>
                  <option value="user">USER (Normal)</option>
                  <option value="admin">ADMIN (Gestión)</option>
                </select>
              </div>

              {!editandoId && (
                <input placeholder="Contraseña temporal" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-mono" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
              )}

              <input placeholder="Cargo en la empresa" className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-medium" value={formData.cargo} onChange={e => setFormData({...formData, cargo: e.target.value})} />

              {/* PANEL DE ATRIBUCIONES ESPECIALES */}
              <div className="bg-slate-900 rounded-[2rem] p-6 text-white space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Atribuciones Especiales</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { key: 'can_create_tasks', label: 'Tareas', icon: LayoutList },
                    { key: 'can_create_products', label: 'Productos', icon: Package },
                    { key: 'can_manage_devices', label: 'Equipos', icon: Laptop },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => togglePermiso(p.key)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border-2 ${
                        (formData.permisos as any)[p.key] 
                        ? 'bg-blue-600 border-blue-400 text-white' 
                        : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
                      }`}
                    >
                      <p.icon size={18} />
                      <span className="text-[10px] font-bold uppercase">{p.label}</span>
                      {(formData.permisos as any)[p.key] ? <CheckCircle2 size={12}/> : <Circle size={12}/>}
                    </button>
                  ))}
                </div>
              </div>

              {mensaje.texto && (
                <div className={`p-4 rounded-2xl text-xs font-black text-center ${mensaje.tipo === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {mensaje.texto.toUpperCase()}
                </div>
              )}

              <button disabled={loadingForm} className="w-full bg-[#00338d] text-white py-4 rounded-[1.5rem] font-black text-sm hover:bg-blue-900 transition-all uppercase tracking-widest shadow-xl">
                {loadingForm ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (editandoId ? "Guardar Atribuciones" : "Registrar Miembro")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}