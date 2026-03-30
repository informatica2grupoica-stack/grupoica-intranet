"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Laptop, Smartphone, Plus, Search, User, Hash, 
  Loader2, Trash2, X, Edit3, Save, CheckCircle2
} from "lucide-react";

export default function DispositivosPage() {
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false); 
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ESTADO DEL FORMULARIO UNIFICADO (Soporta Kit y Edición Individual)
  const [form, setForm] = useState({
    trabajador_id: "",
    // Datos Notebook
    nb_marca: "HP", nb_modelo: "", nb_serie: "",
    // Datos Teléfono
    ph_marca: "Samsung", ph_modelo: "", ph_imei: "", ph_numero: "",
    // Datos para edición simple (cuando solo editas 1 cosa)
    edit_nombre: "",
    edit_tipo: "Notebook",
    edit_estado: "operativo"
  });

  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email === 'informatica2.grupoica@gmail.com') setCanEdit(true);
      await fetchData();
    };
    initialize();
  }, []);

  const fetchData = async () => {
    const [resDisp, resUsers] = await Promise.all([
      supabase.from('dispositivos').select('*, perfiles(nombre, email)').order('created_at', { ascending: false }),
      supabase.from('perfiles').select('user_id, nombre, email').order('nombre', { ascending: true })
    ]);
    setDispositivos(resDisp.data || []);
    setUsuarios(resUsers.data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    // CASO 1: EDICIÓN DE UN EQUIPO EXISTENTE
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
    } 
    // CASO 2: NUEVO REGISTRO (PUEDE SER KIT)
    else {
        if (!form.trabajador_id) return alert("Selecciona un trabajador");
        const registros = [];

        if (form.nb_serie) {
            registros.push({
                nombre_equipo: `Notebook ${form.nb_marca} ${form.nb_modelo}`,
                tipo: "Notebook", marca: form.nb_marca, modelo: form.nb_modelo,
                serie_imei: form.nb_serie, asignado_a: form.trabajador_id, estado: "operativo"
            });
        }
        if (form.ph_imei) {
            registros.push({
                nombre_equipo: `Teléfono ${form.ph_marca} ${form.ph_modelo}`,
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
    if (!canEdit) return;
    setEditMode(true);
    setSelectedId(disp.id);
    setForm({
      trabajador_id: disp.asignado_a || "",
      nb_marca: disp.tipo === 'Notebook' ? disp.marca : "",
      nb_modelo: disp.tipo === 'Notebook' ? disp.modelo : "",
      nb_serie: disp.tipo === 'Notebook' ? disp.serie_imei : "",
      ph_marca: disp.tipo === 'Telefono' ? disp.marca : "",
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

  const eliminarDispositivo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar este registro?")) return;
    await supabase.from('dispositivos').delete().eq('id', id);
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="animate-spin text-[#00338d]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter leading-none">Control de Inventario</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Gestión de Activos Grupo ICA</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)} className="bg-[#00338d] text-white px-8 py-4 rounded-[1.2rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-blue-800 transition-all shadow-xl shadow-blue-900/20">
            <Plus size={16} /> Registrar Entrega (Kit)
          </button>
        )}
      </div>

      {/* BUSCADOR */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
        <input type="text" placeholder="Buscar por serie, trabajador o modelo..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[1.2rem] text-sm outline-none focus:ring-2 focus:ring-[#00338d]/10 transition-all" onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {/* GRID DE DISPOSITIVOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dispositivos.filter(d => 
          d.nombre_equipo.toLowerCase().includes(searchTerm.toLowerCase()) || 
          d.serie_imei?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.perfiles?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
        ).map((disp) => (
          <div key={disp.id} onClick={() => openEdit(disp)} className="bg-white border border-slate-100 rounded-[2.2rem] p-7 shadow-sm transition-all relative group cursor-pointer hover:border-blue-200">
            {canEdit && (
              <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); openEdit(disp); }} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl"><Edit3 size={14} /></button>
                <button onClick={(e) => eliminarDispositivo(disp.id, e)} className="p-2 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-xl"><Trash2 size={14} /></button>
              </div>
            )}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${disp.tipo === 'Telefono' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-[#00338d]'}`}>
              {disp.tipo === 'Telefono' ? <Smartphone size={24} /> : <Laptop size={24} />}
            </div>
            <h4 className="font-black text-slate-800 uppercase text-sm mb-1">{disp.nombre_equipo}</h4>
            <div className="space-y-1 mb-6 text-[10px] font-bold text-slate-400 uppercase">
                <p>{disp.marca} {disp.modelo}</p>
                <p className="flex items-center gap-1"><Hash size={10}/> {disp.serie_imei}</p>
            </div>
            <div className="pt-5 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white text-[9px] font-black">{disp.perfiles?.nombre?.substring(0,2).toUpperCase()}</div>
                    <span className="text-[11px] font-black text-slate-800 uppercase">{disp.perfiles?.nombre || 'STOCK'}</span>
                </div>
                <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${disp.estado === 'operativo' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{disp.estado}</span>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL COMPLETO (KIT / EDICIÓN) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] p-10 shadow-2xl overflow-y-auto max-h-[90vh] relative">
            <button onClick={closeModal} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500"><X size={24} /></button>
            <h3 className="text-2xl font-black text-[#00338d] uppercase italic mb-8">{editMode ? 'Editar Dispositivo' : 'Nueva Entrega de Kit'}</h3>

            <div className="space-y-8">
              {/* SELECCIÓN DE USUARIO */}
              <div className="bg-slate-50 p-6 rounded-3xl">
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 ml-1">Asignar a:</label>
                <select className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-[#00338d] outline-none shadow-sm" value={form.trabajador_id} onChange={(e) => setForm({...form, trabajador_id: e.target.value})}>
                    <option value="">-- QUEDAR EN BODEGA (STOCK) --</option>
                    {usuarios.map(u => <option key={u.user_id} value={u.user_id}>{u.nombre} - {u.email}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* BLOQUE NOTEBOOK (Solo visible si no estás editando un teléfono) */}
                {(!editMode || form.edit_tipo === 'Notebook') && (
                  <div className="space-y-4 p-6 border border-slate-100 rounded-3xl">
                    <div className="flex items-center gap-2 text-[#00338d] mb-2"><Laptop size={20}/><span className="text-xs font-black uppercase">Notebook</span></div>
                    <input type="text" placeholder="Marca" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none" value={form.nb_marca} onChange={(e) => setForm({...form, nb_marca: e.target.value})} />
                    <input type="text" placeholder="Modelo" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none" value={form.nb_modelo} onChange={(e) => setForm({...form, nb_modelo: e.target.value})} />
                    <input type="text" placeholder="N° de Serie" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none font-mono" value={form.nb_serie} onChange={(e) => setForm({...form, nb_serie: e.target.value})} />
                  </div>
                )}

                {/* BLOQUE TELÉFONO (Solo visible si no estás editando un notebook) */}
                {(!editMode || form.edit_tipo === 'Telefono') && (
                  <div className="space-y-4 p-6 border border-slate-100 rounded-3xl">
                    <div className="flex items-center gap-2 text-amber-600 mb-2"><Smartphone size={20}/><span className="text-xs font-black uppercase">Smartphone</span></div>
                    <input type="text" placeholder="Marca" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none" value={form.ph_marca} onChange={(e) => setForm({...form, ph_marca: e.target.value})} />
                    <input type="text" placeholder="Modelo" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none" value={form.ph_modelo} onChange={(e) => setForm({...form, ph_modelo: e.target.value})} />
                    <input type="text" placeholder="IMEI" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none font-mono" value={form.ph_imei} onChange={(e) => setForm({...form, ph_imei: e.target.value})} />
                    <input type="text" placeholder="N° Teléfono" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none" value={form.ph_numero} onChange={(e) => setForm({...form, ph_numero: e.target.value})} />
                  </div>
                )}
              </div>

              {editMode && (
                <div className="p-6 bg-blue-50/50 rounded-3xl grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Nombre en Inventario</label>
                        <input type="text" className="w-full p-3 bg-white rounded-xl text-sm outline-none mt-1" value={form.edit_nombre} onChange={(e) => setForm({...form, edit_nombre: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Estado</label>
                        <select className="w-full p-3 bg-white rounded-xl text-sm mt-1 outline-none" value={form.edit_estado} onChange={(e) => setForm({...form, edit_estado: e.target.value})}>
                            <option value="operativo">Operativo</option>
                            <option value="dañado">Dañado / Falla</option>
                            <option value="de baja">De Baja</option>
                        </select>
                    </div>
                </div>
              )}

              <button onClick={handleSave} className="w-full py-5 bg-[#00338d] text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 hover:bg-blue-800 transition-all">
                <CheckCircle2 size={20} /> {editMode ? 'Actualizar Información' : 'Registrar Entrega de Equipos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}