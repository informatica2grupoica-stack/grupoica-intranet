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
  Tablet,
  Monitor
} from "lucide-react";

export default function DispositivosPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [nuevoItem, setNuevoItem] = useState({
    nombre_equipo: "",
    tipo: "Notebook",
    marca: "",
    modelo: "",
    serie_imei: "",
    numero_telefono: "",
    asignado_a: "", // Se manejará como string vacío o UUID
    notas: ""
  });

  useEffect(() => {
    checkRoleAndFetchData();
  }, []);

  const checkRoleAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('user_id', session.user.id)
      .single();
    
    setIsAdmin(perfil?.rol === 'admin');

    const [resDisp, resUsers] = await Promise.all([
      supabase.from('dispositivos').select('*, perfiles(nombre)').order('created_at', { ascending: false }),
      supabase.from('perfiles').select('user_id, nombre').order('nombre', { ascending: true })
    ]);

    setDispositivos(resDisp.data || []);
    setUsuarios(resUsers.data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!isAdmin) return alert("No tienes permisos");
    if (!nuevoItem.nombre_equipo || !nuevoItem.serie_imei) return alert("Nombre e IMEI/Serie son obligatorios");
    
    // Ajustar asignado_a: si está vacío, enviamos null para la DB
    const dataToInsert = {
      ...nuevoItem,
      asignado_a: nuevoItem.asignado_a === "" ? null : nuevoItem.asignado_a
    };

    const { error } = await supabase.from('dispositivos').insert([dataToInsert]);
    
    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      setShowModal(false);
      setNuevoItem({
        nombre_equipo: "",
        tipo: "Notebook",
        marca: "",
        modelo: "",
        serie_imei: "",
        numero_telefono: "",
        asignado_a: "",
        notas: ""
      });
      checkRoleAndFetchData();
    }
  };

  const eliminarDispositivo = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este registro?")) return;
    const { error } = await supabase.from('dispositivos').delete().eq('id', id);
    if (!error) checkRoleAndFetchData();
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="animate-spin text-[#00338d]" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Inventario Tecnológico</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Grupo ICA - Soporte Informático</p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => setShowModal(true)}
            className="bg-[#00338d] text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-blue-900/20"
          >
            <Plus size={16} /> Registrar Equipo
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Buscar por serie, modelo o nombre..." 
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dispositivos.filter(d => 
          d.nombre_equipo.toLowerCase().includes(searchTerm.toLowerCase()) || 
          d.serie_imei?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.perfiles?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
        ).map((disp) => (
          <div key={disp.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all group relative">
            {isAdmin && (
              <button 
                onClick={() => eliminarDispositivo(disp.id)}
                className="absolute top-6 right-6 p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>
            )}

            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl ${disp.tipo === 'Telefono' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                {disp.tipo === 'Telefono' ? <Smartphone size={20} /> : disp.tipo === 'Notebook' ? <Laptop size={20} /> : <Monitor size={20} />}
              </div>
              <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg ${disp.estado === 'operativo' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {disp.estado}
              </span>
            </div>

            <h4 className="font-black text-slate-800 uppercase text-sm mb-1">{disp.nombre_equipo}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-4">{disp.marca} {disp.modelo}</p>

            <div className="space-y-2 border-t border-slate-50 pt-4">
              <div className="flex items-center gap-2 text-slate-500">
                <Hash size={14} className="text-slate-300" />
                <span className="text-[11px] font-medium">S/N: {disp.serie_imei}</span>
              </div>
              {disp.numero_telefono && (
                <div className="flex items-center gap-2 text-slate-500">
                  <Smartphone size={14} className="text-slate-300" />
                  <span className="text-[11px] font-medium">Línea: {disp.numero_telefono}</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-50">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${disp.perfiles ? 'bg-[#00338d]' : 'bg-slate-300'}`}>
                  {disp.perfiles ? disp.perfiles.nombre.substring(0,2).toUpperCase() : '??'}
                </div>
                <span className={`text-[11px] font-black uppercase ${disp.perfiles ? 'text-[#00338d]' : 'text-slate-400'}`}>
                  {disp.perfiles?.nombre || 'STOCK DISPONIBLE'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black text-[#00338d] uppercase italic mb-6">Nuevo Activo Tecnológico</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre descriptivo</label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-slate-50 border-transparent rounded-xl text-sm mt-1 focus:bg-white focus:border-blue-500 transition-all outline-none" 
                  placeholder="Ej: Laptop Contabilidad 01"
                  value={nuevoItem.nombre_equipo}
                  onChange={(e) => setNuevoItem({...nuevoItem, nombre_equipo: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Tipo de Equipo</label>
                <select 
                  className="w-full p-3 bg-slate-50 border-transparent rounded-xl text-sm mt-1 outline-none"
                  value={nuevoItem.tipo}
                  onChange={(e) => setNuevoItem({...nuevoItem, tipo: e.target.value})}
                >
                  <option value="Notebook">Notebook</option>
                  <option value="Telefono">Teléfono</option>
                  <option value="Tablet">Tablet</option>
                  <option value="Impresora">Impresora</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">IMEI / Serie</label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-slate-50 border-transparent rounded-xl text-sm mt-1 outline-none" 
                  value={nuevoItem.serie_imei}
                  onChange={(e) => setNuevoItem({...nuevoItem, serie_imei: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Asignar a:</label>
                <select 
                  className="w-full p-3 bg-slate-50 border-transparent rounded-xl text-sm mt-1 font-bold text-[#00338d] outline-none"
                  value={nuevoItem.asignado_a}
                  onChange={(e) => setNuevoItem({...nuevoItem, asignado_a: e.target.value})}
                >
                  <option value="">-- QUEDAR EN STOCK --</option>
                  {usuarios.map(u => (
                    <option key={u.user_id} value={u.user_id}>{u.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Número Móvil</label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-slate-50 border-transparent rounded-xl text-sm mt-1 outline-none" 
                  placeholder="+569..."
                  value={nuevoItem.numero_telefono}
                  onChange={(e) => setNuevoItem({...nuevoItem, numero_telefono: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowModal(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Cerrar</button>
              <button onClick={handleSave} className="flex-1 py-4 bg-[#00338d] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-all">Registrar Activo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}