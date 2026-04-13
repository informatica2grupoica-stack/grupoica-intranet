'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // Asegúrate de tener configurado tu cliente
import { Truck, Plus, UserPlus, Mail, Search, Trash2, Loader2, MapPin } from 'lucide-react';

export default function SeccionTransporte() {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  
  // Estado del Formulario
  const [nuevo, setNuevo] = useState({
    nombre: '', rut: '', direccion: '', correo: '', 
    vendedor: '', descripcion: '', tipo: 'Camión',
    contactos: [{ nombre: '', telefono: '' }]
  });

  // 1. Cargar datos desde Supabase
  const cargarProveedores = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proveedores_transporte')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error) setProveedores(data || []);
    setLoading(false);
  };

  useEffect(() => { cargarProveedores(); }, []);

  // 2. Lógica para manejar contactos dinámicos
  const agregarFilaContacto = () => {
    setNuevo({ ...nuevo, contactos: [...nuevo.contactos, { nombre: '', telefono: '' }] });
  };

  const actualizarContacto = (idx: number, campo: string, valor: string) => {
    const nuevosContactos = [...nuevo.contactos];
    nuevosContactos[idx] = { ...nuevosContactos[idx], [campo]: valor };
    setNuevo({ ...nuevo, contactos: nuevosContactos });
  };

  // 3. Guardar en Supabase
  const guardarProveedor = async () => {
    if (!nuevo.nombre) return alert("El nombre es obligatorio");
    setLoading(true);

    const { error } = await supabase
      .from('proveedores_transporte')
      .insert([nuevo]);

    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      setNuevo({
        nombre: '', rut: '', direccion: '', correo: '', 
        vendedor: '', descripcion: '', tipo: 'Camión',
        contactos: [{ nombre: '', telefono: '' }]
      });
      cargarProveedores();
    }
    setLoading(false);
  };

  const proveedoresFiltrados = proveedores.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    (p.rut && p.rut.includes(busqueda))
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] p-8 text-slate-900">
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-10 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
              <Truck size={40} className="text-orange-600" /> PROVEEDORES DE TRANSPORTE
            </h1>
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1">Directorio Logístico Supabase</p>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <input 
              placeholder="Buscar transportista..." 
              className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 font-bold text-sm shadow-sm"
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* FORMULARIO LATERAL */}
          <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 h-fit sticky top-8">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-orange-600 mb-6 flex items-center gap-2">
              <Plus size={16} strokeWidth={3} /> Nuevo Registro
            </h2>
            
            <div className="space-y-5">
              <div className="group">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 transition-colors group-focus-within:text-orange-600">Nombre / Empresa</label>
                <input 
                  value={nuevo.nombre} onChange={e => setNuevo({...nuevo, nombre: e.target.value})}
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 outline-none transition-all" 
                  placeholder="Transportes SpA" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">RUT</label>
                  <input 
                    value={nuevo.rut} onChange={e => setNuevo({...nuevo, rut: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold" placeholder="77.xxx.xxx-k" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo</label>
                  <select 
                    value={nuevo.tipo} onChange={e => setNuevo({...nuevo, tipo: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold"
                  >
                    <option>Camión</option>
                    <option>Flete</option>
                    <option>Courier</option>
                  </select>
                </div>
              </div>

              {/* Sección de Contactos Dinámicos */}
              <div className="bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-[10px] font-black uppercase text-slate-500">Contactos / Choferes</label>
                  <button onClick={agregarFilaContacto} className="bg-orange-600 text-white p-1 rounded-lg hover:scale-110 transition">
                    <UserPlus size={14} />
                  </button>
                </div>
                {nuevo.contactos.map((c, idx) => (
                  <div key={idx} className="flex gap-2 mb-2 animate-in fade-in zoom-in duration-200">
                    <input 
                      placeholder="Nombre" 
                      className="w-1/2 p-3 bg-white rounded-xl text-xs font-bold border-none"
                      onChange={(e) => actualizarContacto(idx, 'nombre', e.target.value)}
                      value={c.nombre}
                    />
                    <input 
                      placeholder="Fono" 
                      className="w-1/2 p-3 bg-white rounded-xl text-xs font-bold border-none"
                      onChange={(e) => actualizarContacto(idx, 'telefono', e.target.value)}
                      value={c.telefono}
                    />
                  </div>
                ))}
              </div>

              <button 
                onClick={guardarProveedor}
                disabled={loading}
                className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-orange-600 transition-all shadow-xl shadow-slate-200 active:scale-95 flex justify-center items-center gap-2 uppercase text-[11px] tracking-widest"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Registrar en Base de Datos'}
              </button>
            </div>
          </div>

          {/* LISTADO DE RESULTADOS */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {proveedoresFiltrados.map((prov) => (
                <div key={prov.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
                      <Truck size={28} />
                    </div>
                    <span className="text-[10px] font-black bg-slate-900 text-white px-4 py-1.5 rounded-full uppercase tracking-widest">
                      {prov.tipo}
                    </span>
                  </div>
                  
                  <h3 className="font-black text-xl text-slate-800 mb-1 leading-tight group-hover:text-orange-600 transition-colors">
                    {prov.nombre}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mb-6 flex items-center gap-1">
                    {prov.rut || 'RUT NO REGISTRADO'}
                  </p>

                  <div className="space-y-3 mb-6">
                    {prov.contactos?.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                        <span className="text-[11px] font-black text-slate-600 uppercase tracking-tighter">{c.nombre}</span>
                        <span className="text-[11px] font-bold text-orange-600">{c.telefono}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-5 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex gap-3">
                       {prov.correo && <Mail size={16} className="text-slate-300" />}
                       {prov.direccion && <MapPin size={16} className="text-slate-300" />}
                    </div>
                    <button className="text-slate-200 hover:text-rose-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}