'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Building2, Plus, UserPlus, Mail, Search, Trash2, Loader2, MapPin, CreditCard, Globe } from 'lucide-react';

export default function SeccionProveedores() {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  
  // Estado alineado EXACTAMENTE con las columnas de tu SQL
  const [nuevo, setNuevo] = useState({
    nombre_empresa: '', 
    rut_empresa: '', 
    categoria: '', 
    tipo_servicio: '',
    nombre_contacto: '', 
    email_contacto: '', 
    telefono: '', 
    sitio_web: '',
    direccion: '', 
    comuna: '', 
    ciudad: '',
    condiciones_pago: 'Contado',
    banco_nombre: '',
    cuenta_tipo: 'Corriente',
    cuenta_numero: '',
    observaciones: ''
  });

  const cargarProveedores = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error) setProveedores(data || []);
    setLoading(false);
  };

  useEffect(() => { cargarProveedores(); }, []);

  const guardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevo.nombre_empresa || !nuevo.categoria) return alert("Nombre y Categoría son obligatorios");
    setLoading(true);

    const { error } = await supabase.from('proveedores').insert([nuevo]);

    if (error) {
      alert("Error: " + error.message);
    } else {
      // Reset completo del formulario
      setNuevo({
        nombre_empresa: '', rut_empresa: '', categoria: '', tipo_servicio: '',
        nombre_contacto: '', email_contacto: '', telefono: '', sitio_web: '',
        direccion: '', comuna: '', ciudad: '', condiciones_pago: 'Contado',
        banco_nombre: '', cuenta_tipo: 'Corriente', cuenta_numero: '', observaciones: ''
      });
      cargarProveedores();
    }
    setLoading(false);
  };

  const filtrados = proveedores.filter(p => 
    p.nombre_empresa.toLowerCase().includes(busqueda.toLowerCase()) || 
    (p.rut_empresa && p.rut_empresa.includes(busqueda)) ||
    (p.categoria && p.categoria.toLowerCase().includes(busqueda.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 text-slate-900">
      <div className="max-w-[1600px] mx-auto">
        
        <header className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3 italic text-slate-900 uppercase">
              <Building2 size={38} className="text-blue-600" /> Registro Maestro Proveedores
            </h1>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] mt-1">Chile - Talagante Operaciones</p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              placeholder="Buscar por Empresa, RUT o Rubro..." 
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 font-bold text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* FORMULARIO DE ALTA (Columna Izquierda) */}
          <form onSubmit={guardarProveedor} className="xl:col-span-4 space-y-4 bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 h-fit">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-6">Información General</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Razón Social</label>
                <input required value={nuevo.nombre_empresa} onChange={e => setNuevo({...nuevo, nombre_empresa: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold outline-none" placeholder="Nombre de la empresa" />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">RUT Empresa</label>
                <input value={nuevo.rut_empresa} onChange={e => setNuevo({...nuevo, rut_empresa: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" placeholder="12.345.678-9" />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Rubro / Categoría</label>
                <input required value={nuevo.categoria} onChange={e => setNuevo({...nuevo, categoria: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" placeholder="Ej: Ferretería" />
              </div>
            </div>

            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 pt-4 mb-2">Contacto Directo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={nuevo.nombre_contacto} onChange={e => setNuevo({...nuevo, nombre_contacto: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" placeholder="Nombre Contacto" />
              <input value={nuevo.telefono} onChange={e => setNuevo({...nuevo, telefono: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" placeholder="Teléfono" />
              <div className="md:col-span-2">
                <input value={nuevo.email_contacto} onChange={e => setNuevo({...nuevo, email_contacto: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" placeholder="Email (ventas@empresa.cl)" />
              </div>
            </div>

            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 pt-4 mb-2">Datos Bancarios / Pago</h2>
            <div className="grid grid-cols-1 gap-4">
               <input value={nuevo.banco_nombre} onChange={e => setNuevo({...nuevo, banco_nombre: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" placeholder="Nombre del Banco" />
               <div className="grid grid-cols-2 gap-4">
                 <input value={nuevo.cuenta_numero} onChange={e => setNuevo({...nuevo, cuenta_numero: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" placeholder="Nº de Cuenta" />
                 <select value={nuevo.condiciones_pago} onChange={e => setNuevo({...nuevo, condiciones_pago: e.target.value})} className="bg-slate-50 border-none rounded-xl p-4 text-sm font-bold outline-none">
                    <option>Contado</option>
                    <option>Transferencia</option>
                    <option>30 días</option>
                    <option>60 días</option>
                 </select>
               </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-blue-600 transition-all flex justify-center items-center gap-2 uppercase text-[11px] tracking-[0.3em] mt-6 shadow-xl active:scale-95">
              {loading ? <Loader2 className="animate-spin" /> : 'Sincronizar con Base de Datos'}
            </button>
          </form>

          {/* GRILLA DE PROVEEDORES (Columna Derecha) */}
          <div className="xl:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtrados.map((prov) => (
                <div key={prov.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Building2 size={24} /></div>
                    <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg uppercase tracking-widest">{prov.categoria}</span>
                  </div>

                  <h3 className="font-black text-lg text-slate-800 uppercase leading-tight mb-1">{prov.nombre_empresa}</h3>
                  <p className="text-[11px] font-bold text-slate-400 mb-4 tracking-tighter italic">{prov.rut_empresa || 'RUT PENDIENTE'}</p>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Contacto</p>
                      <p className="text-[11px] font-bold text-slate-700 truncate">{prov.nombre_contacto || 'No asignado'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Teléfono</p>
                      <p className="text-[11px] font-bold text-blue-600">{prov.telefono || 'Sin fono'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-slate-50 justify-between">
                    <div className="flex gap-2">
                      <div title="Email" className="p-2 hover:bg-blue-50 rounded-lg text-slate-300 hover:text-blue-500 transition-all cursor-pointer"><Mail size={16} /></div>
                      <div title="Ubicación" className="p-2 hover:bg-blue-50 rounded-lg text-slate-300 hover:text-blue-500 transition-all cursor-pointer"><MapPin size={16} /></div>
                      <div title="Banco" className={`p-2 rounded-lg ${prov.cuenta_numero ? 'text-green-500' : 'text-slate-200'}`}><CreditCard size={16} /></div>
                    </div>
                    <button className="p-2 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
            
            {filtrados.length === 0 && !loading && (
              <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No hay proveedores que coincidan</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}