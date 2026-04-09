"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Laptop, Smartphone, Plus, Search, User, Hash, 
  Loader2, Trash2, X, Edit3, CheckCircle2, Mail
} from "lucide-react";

export default function DispositivosPage() {
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false); 
  const [dispositivosAgrupados, setDispositivosAgrupados] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    trabajador_id: "",
    nb_marca: "HP", nb_modelo: "", nb_serie: "",
    ph_marca: "Samsung", ph_modelo: "", ph_imei: "", ph_numero: "",
    edit_nombre: "",
    edit_tipo: "Notebook",
    edit_estado: "operativo"
  });

  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Validación dinámica de permisos (Igual que en Productos/Tareas)
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('es_admin, permiso_dispositivos')
          .eq('user_id', session.user.id)
          .single();

        if (
          session.user.email === 'informatica2.grupoica@gmail.com' || 
          perfil?.es_admin || 
          perfil?.permiso_dispositivos
        ) {
          setCanEdit(true);
        }
      }
      await fetchData();
    };
    initialize();
  }, []);

  const fetchData = async () => {
    const [resDisp, resUsers] = await Promise.all([
      supabase.from('dispositivos').select('*, perfiles(nombre, email)').order('created_at', { ascending: false }),
      supabase.from('perfiles').select('user_id, nombre, email').order('nombre', { ascending: true })
    ]);

    const data = resDisp.data || [];
    const grupos: any = {};

    data.forEach(item => {
      const key = item.asignado_a || 'STOCK';
      if (!grupos[key]) {
        grupos[key] = {
          id_asignado: key,
          usuario: item.perfiles?.nombre || 'BODEGA / STOCK',
          email: item.perfiles?.email || 'Sin correo asociado',
          equipos: []
        };
      }
      grupos[key].equipos.push(item);
    });

    setDispositivosAgrupados(Object.values(grupos));
    setUsuarios(resUsers.data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (editMode && selectedId) {
        const payload = {
            nombre_equipo: form.edit_nombre,
            tipo: form.edit_tipo,
            marca: form.edit_tipo === 'Notebook' ? form.nb_marca : form.ph_marca,
            modelo: form.edit_tipo === 'Notebook' ? form.nb_modelo : form.ph_modelo,
            serie_imei: form.edit_tipo === 'Notebook' ? form.nb_serie : form.ph_imei,
            numero_telefono: form.edit_tipo === 'Telefono' ? form.ph_numero : null,
            asignado_a: form.trabajador_id === "" ? null : form.trabajador_id,
            estado: form.edit_estado
        };
        const { error } = await supabase.from('dispositivos').update(payload).eq('id', selectedId);
        if (error) return alert(error.message);
    } else {
        if (!form.trabajador_id) return alert("Selecciona un trabajador");
        const registros = [];
        if (form.nb_serie) {
            registros.push({
                nombre_equipo: `Notebook ${form.nb_marca}`,
                tipo: "Notebook", marca: form.nb_marca, modelo: form.nb_modelo,
                serie_imei: form.nb_serie, asignado_a: form.trabajador_id, estado: "operativo"
            });
        }
        if (form.ph_imei) {
            registros.push({
                nombre_equipo: `Teléfono ${form.ph_marca}`,
                tipo: "Telefono", marca: form.ph_marca, modelo: form.ph_modelo,
                serie_imei: form.ph_imei, numero_telefono: form.ph_numero,
                asignado_a: form.trabajador_id, estado: "operativo"
            });
        }
        if (registros.length === 0) return alert("Ingresa al menos un equipo (Serie o IMEI)");
        const { error } = await supabase.from('dispositivos').insert(registros);
        if (error) return alert(error.message);
    }
    closeModal();
    fetchData();
  };

  const openEdit = (disp: any) => {
    setEditMode(true);
    setSelectedId(disp.id);
    setForm({
      trabajador_id: disp.asignado_a || "",
      nb_marca: disp.tipo === 'Notebook' ? disp.marca : "HP",
      nb_modelo: disp.tipo === 'Notebook' ? disp.modelo : "",
      nb_serie: disp.tipo === 'Notebook' ? disp.serie_imei : "",
      ph_marca: disp.tipo === 'Telefono' ? disp.marca : "Samsung",
      ph_modelo: disp.tipo === 'Telefono' ? disp.modelo : "",
      ph_imei: disp.tipo === 'Telefono' ? disp.serie_imei : "",
      ph_numero: disp.numero_telefono || "",
      edit_nombre: disp.nombre_equipo,
      edit_tipo: disp.tipo,
      edit_estado: disp.estado
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditMode(false);
    setSelectedId(null);
    setForm({
        trabajador_id: "", nb_marca: "HP", nb_modelo: "", nb_serie: "",
        ph_marca: "Samsung", ph_modelo: "", ph_imei: "", ph_numero: "",
        edit_nombre: "", edit_tipo: "Notebook", edit_estado: "operativo"
    });
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="animate-spin text-[#00338d]" size={40} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando Inventario...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Inventario de Asignaciones</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Grupo ICA - Gestión de Equipos</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)} className="bg-[#00338d] text-white px-8 py-4 rounded-[1.2rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-blue-800 transition-all shadow-xl shadow-blue-900/20">
            <Plus size={16} /> Entregar Nuevo Kit
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
        <input type="text" placeholder="Buscar trabajador..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[1.2rem] text-sm outline-none shadow-sm focus:border-blue-300 transition-all" onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dispositivosAgrupados.filter(g => g.usuario.toLowerCase().includes(searchTerm.toLowerCase())).map((grupo) => (
          <div key={grupo.id_asignado} className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:border-blue-200 transition-all group/card">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-lg font-black group-hover/card:bg-[#00338d] transition-colors">
                  {grupo.usuario.substring(0,2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-black text-slate-800 uppercase text-base mb-1">{grupo.usuario}</h4>
                  <p className="text-blue-600 text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider">
                    <Mail size={10} /> {grupo.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {grupo.equipos.map((eq: any) => (
                <div key={eq.id} onClick={() => canEdit && openEdit(eq)} className={`group relative flex items-center gap-4 p-4 bg-slate-50 rounded-[1.5rem] border border-transparent transition-all ${canEdit ? 'hover:border-blue-100 hover:bg-white cursor-pointer' : 'cursor-default'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${eq.tipo === 'Telefono' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-[#00338d]'}`}>
                    {eq.tipo === 'Telefono' ? <Smartphone size={18} /> : <Laptop size={18} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-black text-slate-700 uppercase">{eq.nombre_equipo}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{eq.marca} {eq.modelo} • {eq.serie_imei}</p>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${eq.estado === 'operativo' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{eq.estado}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] p-10 shadow-2xl overflow-y-auto max-h-[90vh] relative">
            <button onClick={closeModal} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-colors"><X size={24} /></button>
            <h3 className="text-2xl font-black text-[#00338d] uppercase italic mb-8 border-b border-slate-100 pb-4">
              {editMode ? 'Gestión de Activo' : 'Asignación de Nuevo Kit'}
            </h3>

            <div className="space-y-8">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 ml-1">Asignar a:</label>
                <select className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-[#00338d] outline-none" value={form.trabajador_id} onChange={(e) => setForm({...form, trabajador_id: e.target.value})}>
                    <option value="">-- ENVIAR A BODEGA (SIN ASIGNAR) --</option>
                    {usuarios.map(u => <option key={u.user_id} value={u.user_id}>{u.nombre} ({u.email})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {(!editMode || form.edit_tipo === 'Notebook') && (
                  <div className="space-y-4 p-6 bg-blue-50/30 border border-blue-100/50 rounded-3xl">
                    <div className="flex items-center gap-2 text-[#00338d] mb-2"><Laptop size={20}/><span className="text-xs font-black uppercase tracking-tight">Detalle Notebook</span></div>
                    <input type="text" placeholder="Marca" className="w-full p-3 bg-white rounded-xl text-sm outline-none border border-slate-200" value={form.nb_marca} onChange={(e) => setForm({...form, nb_marca: e.target.value})} />
                    <input type="text" placeholder="Modelo" className="w-full p-3 bg-white rounded-xl text-sm outline-none border border-slate-200" value={form.nb_modelo} onChange={(e) => setForm({...form, nb_modelo: e.target.value})} />
                    <input type="text" placeholder="N° Serie" className="w-full p-3 bg-white rounded-xl text-sm outline-none font-mono border border-slate-200" value={form.nb_serie} onChange={(e) => setForm({...form, nb_serie: e.target.value})} />
                  </div>
                )}

                {(!editMode || form.edit_tipo === 'Telefono') && (
                  <div className="space-y-4 p-6 bg-amber-50/30 border border-amber-100/50 rounded-3xl">
                    <div className="flex items-center gap-2 text-amber-600 mb-2"><Smartphone size={20}/><span className="text-xs font-black uppercase tracking-tight">Detalle Smartphone</span></div>
                    <input type="text" placeholder="Marca" className="w-full p-3 bg-white rounded-xl text-sm outline-none border border-slate-200" value={form.ph_marca} onChange={(e) => setForm({...form, ph_marca: e.target.value})} />
                    <input type="text" placeholder="Modelo" className="w-full p-3 bg-white rounded-xl text-sm outline-none border border-slate-200" value={form.ph_modelo} onChange={(e) => setForm({...form, ph_modelo: e.target.value})} />
                    <input type="text" placeholder="IMEI" className="w-full p-3 bg-white rounded-xl text-sm outline-none font-mono border border-slate-200" value={form.ph_imei} onChange={(e) => setForm({...form, ph_imei: e.target.value})} />
                    <input type="text" placeholder="Número" className="w-full p-3 bg-white rounded-xl text-sm outline-none border border-slate-200" value={form.ph_numero} onChange={(e) => setForm({...form, ph_numero: e.target.value})} />
                  </div>
                )}
              </div>

              {editMode && (
                <div className="p-6 bg-slate-900 rounded-3xl grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Nombre Visual</label>
                        <input type="text" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none mt-1" value={form.edit_nombre} onChange={(e) => setForm({...form, edit_nombre: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Estado</label>
                        <select className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white mt-1 outline-none" value={form.edit_estado} onChange={(e) => setForm({...form, edit_estado: e.target.value})}>
                            <option className="text-slate-800" value="operativo">Operativo</option>
                            <option className="text-slate-800" value="dañado">Dañado / Falla</option>
                            <option className="text-slate-800" value="de baja">De Baja / Obsoleto</option>
                        </select>
                    </div>
                </div>
              )}

              <button onClick={handleSave} className="w-full py-5 bg-[#00338d] text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 hover:bg-blue-800 transition-all active:scale-[0.98]">
                <CheckCircle2 size={20} /> {editMode ? 'Confirmar Cambios' : 'Registrar Entrega de Kit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}