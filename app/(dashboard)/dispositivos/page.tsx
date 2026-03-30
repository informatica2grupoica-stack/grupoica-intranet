"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Laptop, Smartphone, Plus, Search, User, Hash, 
  Loader2, Trash2, X, Edit3, Save, SmartphoneNfc
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

  // Estado del formulario (simplificado para edición y creación)
  const [form, setForm] = useState({
    nombre_equipo: "",
    tipo: "Notebook",
    marca: "",
    modelo: "",
    serie_imei: "",
    numero_telefono: "",
    asignado_a: "",
    estado: "operativo"
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
      supabase.from('dispositivos').select('*, perfiles(nombre)').order('created_at', { ascending: false }),
      supabase.from('perfiles').select('user_id, nombre, email').order('nombre', { ascending: true })
    ]);
    setDispositivos(resDisp.data || []);
    setUsuarios(resUsers.data || []);
    setLoading(false);
  };

  // FUNCIÓN PARA GUARDAR O ACTUALIZAR
  const handleSave = async () => {
    if (!form.nombre_equipo || !form.serie_imei) return alert("Faltan datos obligatorios");
    
    const payload = { ...form, asignado_a: form.asignado_a === "" ? null : form.asignado_a };

    let error;
    if (editMode && selectedId) {
      const { error: err } = await supabase.from('dispositivos').update(payload).eq('id', selectedId);
      error = err;
    } else {
      const { error: err } = await supabase.from('dispositivos').insert([payload]);
      error = err;
    }

    if (error) {
      alert("Error: " + error.message);
    } else {
      closeModal();
      fetchData();
    }
  };

  const eliminarDispositivo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Evita abrir el editor al borrar
    if (!confirm("¿Eliminar este dispositivo del inventario?")) return;
    const { error } = await supabase.from('dispositivos').delete().eq('id', id);
    if (!error) fetchData();
  };

  const openEdit = (disp: any) => {
    if (!canEdit) return;
    setEditMode(true);
    setSelectedId(disp.id);
    setForm({
      nombre_equipo: disp.nombre_equipo,
      tipo: disp.tipo,
      marca: disp.marca || "",
      modelo: disp.modelo || "",
      serie_imei: disp.serie_imei || "",
      numero_telefono: disp.numero_telefono || "",
      asignado_a: disp.asignado_a || "",
      estado: disp.estado || "operativo"
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditMode(false);
    setSelectedId(null);
    setForm({ nombre_equipo: "", tipo: "Notebook", marca: "", modelo: "", serie_imei: "", numero_telefono: "", asignado_a: "", estado: "operativo" });
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
            <Plus size={16} /> Nuevo Registro
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
        <input type="text" placeholder="Buscar por serie, modelo o dueño..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[1.2rem] text-sm outline-none focus:ring-2 focus:ring-[#00338d]/10 transition-all" onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dispositivos.filter(d => 
          d.nombre_equipo.toLowerCase().includes(searchTerm.toLowerCase()) || 
          d.serie_imei?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.perfiles?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
        ).map((disp) => (
          <div 
            key={disp.id} 
            onClick={() => openEdit(disp)}
            className={`bg-white border border-slate-100 rounded-[2.2rem] p-7 shadow-sm transition-all relative group cursor-pointer ${canEdit ? 'hover:border-blue-200 hover:shadow-md' : ''}`}
          >
            {canEdit && (
              <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); openEdit(disp); }} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl"><Edit3 size={14} /></button>
                <button onClick={(e) => eliminarDispositivo(disp.id, e)} className="p-2 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-xl"><Trash2 size={14} /></button>
              </div>
            )}

            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${disp.tipo === 'Telefono' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-[#00338d]'}`}>
              {disp.tipo === 'Telefono' ? <Smartphone size={24} /> : <Laptop size={24} />}
            </div>

            <h4 className="font-black text-slate-800 uppercase text-sm mb-1 tracking-tight">{disp.nombre_equipo}</h4>
            <div className="space-y-1 mb-6">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{disp.marca} {disp.modelo}</p>
                <p className="text-[10px] font-medium text-slate-400 flex items-center gap-1"><Hash size={10}/> {disp.serie_imei}</p>
            </div>

            <div className="pt-5 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white text-[9px] font-black">
                        {disp.perfiles?.nombre?.substring(0,2).toUpperCase() || '??'}
                    </div>
                    <span className="text-[11px] font-black text-slate-800 uppercase">{disp.perfiles?.nombre || 'DISPONIBLE'}</span>
                </div>
                <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${disp.estado === 'operativo' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {disp.estado}
                </span>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL UNIFICADO (CREAR / EDITAR) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200 relative">
            <button onClick={closeModal} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500"><X size={20} /></button>
            
            <h3 className="text-xl font-black text-[#00338d] uppercase italic mb-8">
                {editMode ? 'Editar Información' : 'Registrar Nuevo Equipo'}
            </h3>

            <div className="space-y-5">
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Nombre del Dispositivo</label>
                <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all mt-1" placeholder="Ej: Notebook Contabilidad 01" value={form.nombre_equipo} onChange={(e) => setForm({...form, nombre_equipo: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Tipo</label>
                    <select className="w-full p-4 bg-slate-50 rounded-2xl text-sm mt-1 outline-none" value={form.tipo} onChange={(e) => setForm({...form, tipo: e.target.value})}>
                        <option value="Notebook">Notebook</option>
                        <option value="Telefono">Teléfono</option>
                    </select>
                </div>
                <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Marca</label>
                    <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl text-sm mt-1 outline-none" placeholder="HP, Lenovo, Samsung..." value={form.marca} onChange={(e) => setForm({...form, marca: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Modelo</label>
                    <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl text-sm mt-1 outline-none" value={form.modelo} onChange={(e) => setForm({...form, modelo: e.target.value})} />
                </div>
                <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Serie / IMEI</label>
                    <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl text-sm mt-1 outline-none font-mono" value={form.serie_imei} onChange={(e) => setForm({...form, serie_imei: e.target.value})} />
                </div>
              </div>

              {form.tipo === 'Telefono' && (
                <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Número de Teléfono</label>
                    <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl text-sm mt-1 outline-none" placeholder="+569..." value={form.numero_telefono} onChange={(e) => setForm({...form, numero_telefono: e.target.value})} />
                </div>
              )}

              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Asignar a Trabajador</label>
                <select className="w-full p-4 bg-slate-50 rounded-2xl text-sm mt-1 font-bold text-[#00338d] outline-none" value={form.asignado_a} onChange={(e) => setForm({...form, asignado_a: e.target.value})}>
                  <option value="">STOCK (SIN ASIGNAR)</option>
                  {usuarios.map(u => (
                    <option key={u.user_id} value={u.user_id}>{u.nombre} - {u.email}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-10 flex gap-4">
              <button onClick={handleSave} className="flex-1 py-5 bg-[#00338d] text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-900/20 hover:bg-blue-800 transition-all flex items-center justify-center gap-2">
                <Save size={16} /> {editMode ? 'Guardar Cambios' : 'Registrar Equipo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}