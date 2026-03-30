"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Laptop, 
  Smartphone, 
  Plus, 
  Search, 
  User, 
  Hash, 
  Loader2,
  Trash2,
  Monitor,
  X,
  Mail,
  Info
} from "lucide-react";

export default function DispositivosPage() {
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false); 
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);

  // ESTADO PARA EL FORMULARIO COMPLETO (KIT)
  const [formKit, setFormKit] = useState({
    trabajador_id: "",
    // Datos Notebook
    nb_modelo: "",
    nb_serie: "",
    nb_marca: "HP", // Por defecto
    // Datos Telefono
    ph_modelo: "",
    ph_imei: "",
    ph_numero: "",
    ph_marca: "Samsung"
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

  const handleSaveKit = async () => {
    if (!formKit.trabajador_id) return alert("Debes seleccionar un trabajador");
    
    const itemsParaSubir = [];

    // Si llenó datos de Notebook, preparamos el registro
    if (formKit.nb_serie) {
      itemsParaSubir.push({
        nombre_equipo: `Notebook - ${formKit.nb_modelo}`,
        tipo: "Notebook",
        marca: formKit.nb_marca,
        modelo: formKit.nb_modelo,
        serie_imei: formKit.nb_serie,
        asignado_a: formKit.trabajador_id,
        estado: "operativo"
      });
    }

    // Si llenó datos de Teléfono, preparamos el registro
    if (formKit.ph_imei) {
      itemsParaSubir.push({
        nombre_equipo: `Teléfono - ${formKit.ph_modelo}`,
        tipo: "Telefono",
        marca: formKit.ph_marca,
        modelo: formKit.ph_modelo,
        serie_imei: formKit.ph_imei,
        numero_telefono: formKit.ph_numero,
        asignado_a: formKit.trabajador_id,
        estado: "operativo"
      });
    }

    if (itemsParaSubir.length === 0) return alert("Ingresa al menos un número de serie o IMEI");

    const { error } = await supabase.from('dispositivos').insert(itemsParaSubir);
    
    if (error) {
      alert("Error al registrar: " + error.message);
    } else {
      setShowModal(false);
      setFormKit({ trabajador_id: "", nb_modelo: "", nb_serie: "", nb_marca: "HP", ph_modelo: "", ph_imei: "", ph_numero: "", ph_marca: "Samsung" });
      fetchData();
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="animate-spin text-[#00338d]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Inventario Tecnológico</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Asignación de Kits de Trabajo</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)} className="bg-[#00338d] text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/20">
            <Plus size={16} /> Registrar Entrega (Kit)
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input type="text" placeholder="Buscar por serie, trabajador o modelo..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[1.2rem] text-sm outline-none shadow-sm" onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {/* GRID DE DISPOSITIVOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dispositivos.filter(d => 
          d.nombre_equipo.toLowerCase().includes(searchTerm.toLowerCase()) || 
          d.serie_imei?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.perfiles?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
        ).map((disp) => (
          <div key={disp.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all group relative">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl ${disp.tipo === 'Telefono' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                {disp.tipo === 'Telefono' ? <Smartphone size={20} /> : <Laptop size={20} />}
              </div>
              <span className="text-[9px] font-black uppercase px-3 py-1 bg-slate-100 text-slate-500 rounded-lg">{disp.estado}</span>
            </div>
            <h4 className="font-black text-slate-800 uppercase text-sm mb-1">{disp.nombre_equipo}</h4>
            <div className="space-y-1 mb-4 text-[10px] font-bold text-slate-400 uppercase">
               <p>Marca: {disp.marca}</p>
               <p>Serie/IMEI: <span className="text-slate-600">{disp.serie_imei}</span></p>
            </div>
            <div className="pt-4 border-t border-slate-50 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#00338d] flex items-center justify-center text-white text-[10px] font-black">
                    {disp.perfiles?.nombre?.substring(0,2).toUpperCase() || '??'}
                </div>
                <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Asignado a:</p>
                    <p className="text-[11px] font-black text-[#00338d] uppercase">{disp.perfiles?.nombre || 'STOCK'}</p>
                </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL FICHA DE ENTREGA COMPLETA */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-[#00338d] uppercase italic">Ficha de Entrega de Equipos</h3>
                <button onClick={() => setShowModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"><X size={20} /></button>
            </div>

            <div className="space-y-8">
              {/* SECCIÓN 1: USUARIO */}
              <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                <div className="flex items-center gap-2 mb-4 text-[#00338d]">
                    <User size={18} />
                    <span className="text-xs font-black uppercase tracking-widest">Datos del Trabajador</span>
                </div>
                <select 
                  className="w-full p-4 bg-white border-transparent rounded-2xl text-sm font-bold text-[#00338d] shadow-sm outline-none"
                  value={formKit.trabajador_id}
                  onChange={(e) => setFormKit({...formKit, trabajador_id: e.target.value})}
                >
                  <option value="">Selecciona al trabajador para asignar...</option>
                  {usuarios.map(u => (
                    <option key={u.user_id} value={u.user_id}>{u.nombre} - ({u.email})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* SECCIÓN 2: NOTEBOOK */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Laptop size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Datos Notebook</span>
                    </div>
                    <input type="text" placeholder="Marca (Ej: Lenovo, HP)" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" onChange={(e) => setFormKit({...formKit, nb_marca: e.target.value})} />
                    <input type="text" placeholder="Modelo del Equipo" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => setFormKit({...formKit, nb_modelo: e.target.value})} />
                    <input type="text" placeholder="Número de Serie (S/N)" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono" onChange={(e) => setFormKit({...formKit, nb_serie: e.target.value})} />
                </div>

                {/* SECCIÓN 3: TELÉFONO */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Smartphone size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Datos Teléfono Móvil</span>
                    </div>
                    <input type="text" placeholder="Modelo (Ej: Galaxy A54)" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => setFormKit({...formKit, ph_modelo: e.target.value})} />
                    <input type="text" placeholder="IMEI del Equipo" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono" onChange={(e) => setFormKit({...formKit, ph_imei: e.target.value})} />
                    <input type="text" placeholder="Número de Teléfono (+569...)" className="w-full p-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => setFormKit({...formKit, ph_numero: e.target.value})} />
                </div>
              </div>

              <div className="pt-6">
                <button 
                    onClick={handleSaveKit}
                    className="w-full py-5 bg-[#00338d] text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-blue-900/30 hover:bg-blue-800 hover:scale-[1.01] transition-all"
                >
                    Finalizar y Registrar Entrega
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}