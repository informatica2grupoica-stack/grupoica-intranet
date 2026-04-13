'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, Plus, UserPlus, Mail, Search, Trash2, Loader2, 
  MapPin, CreditCard, Globe, X, Phone, Info, Landmark, Calendar
} from 'lucide-react';

export default function SeccionProveedores() {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<any | null>(null); // Para el Modal
  
  const [nuevo, setNuevo] = useState({
    nombre_empresa: '', rut_empresa: '', categoria: '', tipo_servicio: '',
    nombre_contacto: '', email_contacto: '', telefono: '', sitio_web: '',
    direccion: '', comuna: '', ciudad: '', condiciones_pago: 'Contado',
    banco_nombre: '', cuenta_tipo: 'Corriente', cuenta_numero: '', observaciones: ''
  });

  const cargarProveedores = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('proveedores').select('*').order('created_at', { ascending: false });
    if (!error) setProveedores(data || []);
    setLoading(false);
  };

  useEffect(() => { cargarProveedores(); }, []);

  const guardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevo.nombre_empresa || !nuevo.categoria) return alert("Nombre y Categoría son obligatorios");
    setLoading(true);
    const { error } = await supabase.from('proveedores').insert([nuevo]);
    if (error) alert("Error: " + error.message);
    else {
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
              <Building2 size={38} className="text-blue-600" /> Operaciones Hub - Proveedores
            </h1>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] mt-1">Gestión Centralizada Chile</p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              placeholder="Buscar..." 
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 font-bold text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* FORMULARIO */}
          <form onSubmit={guardarProveedor} className="xl:col-span-4 space-y-4 bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-xl h-fit">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-6">Nuevo Registro</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Razón Social</label>
                <input required value={nuevo.nombre_empresa} onChange={e => setNuevo({...nuevo, nombre_empresa: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">RUT</label>
                <input value={nuevo.rut_empresa} onChange={e => setNuevo({...nuevo, rut_empresa: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Rubro</label>
                <input required value={nuevo.categoria} onChange={e => setNuevo({...nuevo, categoria: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Dirección Completa</label>
                <input value={nuevo.direccion} onChange={e => setNuevo({...nuevo, direccion: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" placeholder="Av. Libertador #123, Talagante" />
              </div>
            </div>

            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 pt-4 mb-2">Contacto</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={nuevo.nombre_contacto} onChange={e => setNuevo({...nuevo, nombre_contacto: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" placeholder="Nombre" />
              <input value={nuevo.telefono} onChange={e => setNuevo({...nuevo, telefono: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" placeholder="Teléfono" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-blue-600 transition-all flex justify-center items-center gap-2 uppercase text-[11px] tracking-[0.3em] mt-6 shadow-xl">
              {loading ? <Loader2 className="animate-spin" /> : 'Sincronizar Datos'}
            </button>
          </form>

          {/* GRILLA */}
          <div className="xl:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtrados.map((prov) => (
                <div 
                  key={prov.id} 
                  onClick={() => setSeleccionado(prov)} // ABRIR DETALLE AL CLICK
                  className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer group relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <Building2 size={24} />
                    </div>
                    <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg uppercase tracking-widest">{prov.categoria}</span>
                  </div>

                  <h3 className="font-black text-lg text-slate-800 uppercase leading-tight mb-1">{prov.nombre_empresa}</h3>
                  <p className="text-[11px] font-bold text-slate-400 mb-4 tracking-tighter italic">{prov.rut_empresa || 'RUT PENDIENTE'}</p>

                  <div className="flex items-center gap-2 pt-4 border-t border-slate-50 justify-between text-slate-300">
                    <div className="flex gap-3">
                      <Mail size={16} className={prov.email_contacto ? "text-blue-400" : ""} />
                      <MapPin size={16} className={prov.direccion ? "text-orange-400" : ""} />
                      <CreditCard size={16} className={prov.cuenta_numero ? "text-green-400" : ""} />
                    </div>
                    <span className="text-[10px] font-black uppercase text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">Ver Detalles →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL DE DETALLES (DRAWER) --- */}
      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-xl bg-white h-full rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-500">
            
            {/* Header Modal */}
            <div className="p-8 bg-slate-50 flex justify-between items-start border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black bg-blue-600 text-white px-4 py-1.5 rounded-full uppercase tracking-widest">{seleccionado.categoria}</span>
                <h2 className="text-3xl font-black text-slate-900 uppercase italic mt-4 leading-none">{seleccionado.nombre_empresa}</h2>
                <p className="text-slate-400 font-bold text-sm mt-1">{seleccionado.rut_empresa}</p>
              </div>
              <button onClick={() => setSeleccionado(null)} className="p-3 bg-white hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all shadow-sm">
                <X size={24} />
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              
              {/* Sección: Contacto */}
              <section className="space-y-4">
                <h4 className="flex items-center gap-2 text-xs font-black text-blue-600 uppercase tracking-widest border-b border-slate-100 pb-2">
                  <UserPlus size={16} /> Datos de Contacto
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Responsable</p>
                    <p className="font-bold">{seleccionado.nombre_contacto || 'No especificado'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Teléfono</p>
                    <p className="font-bold text-blue-600 flex items-center gap-2"><Phone size={14} /> {seleccionado.telefono || 'Sin registro'}</p>
                  </div>
                  <div className="md:col-span-2 bg-slate-50 p-4 rounded-2xl flex items-center gap-3">
                    <Mail size={18} className="text-slate-400" />
                    <p className="font-bold text-slate-600">{seleccionado.email_contacto || 'Sin correo registrado'}</p>
                  </div>
                </div>
              </section>

              {/* Sección: Ubicación */}
              <section className="space-y-4">
                <h4 className="flex items-center gap-2 text-xs font-black text-orange-600 uppercase tracking-widest border-b border-slate-100 pb-2">
                  <MapPin size={16} /> Ubicación Geográfica
                </h4>
                <div className="bg-slate-50 p-5 rounded-2xl space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="text-slate-400 mt-1" size={18} />
                    <p className="font-bold text-slate-700">{seleccionado.direccion || 'Dirección no registrada'}</p>
                  </div>
                  <div className="flex gap-4 pl-8">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">Comuna: <span className="text-slate-900">{seleccionado.comuna || '-'}</span></p>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">Ciudad: <span className="text-slate-900">{seleccionado.ciudad || '-'}</span></p>
                  </div>
                </div>
              </section>

              {/* Sección: Pago */}
              <section className="space-y-4">
                <h4 className="flex items-center gap-2 text-xs font-black text-green-600 uppercase tracking-widest border-b border-slate-100 pb-2">
                  <Landmark size={16} /> Información Bancaria
                </h4>
                <div className="bg-green-50/50 border border-green-100 p-6 rounded-[2rem] grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-black text-green-600/60 uppercase">Banco</p>
                    <p className="font-black text-slate-800">{seleccionado.banco_nombre || 'No asignado'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-green-600/60 uppercase">Condición</p>
                    <p className="font-black text-slate-800">{seleccionado.condiciones_pago}</p>
                  </div>
                  <div className="col-span-2 bg-white p-4 rounded-xl shadow-sm border border-green-100 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">{seleccionado.cuenta_tipo}</p>
                      <p className="text-lg font-black font-mono tracking-widest text-slate-900">{seleccionado.cuenta_numero || '0000-0000-0000'}</p>
                    </div>
                    <CreditCard className="text-green-600" size={32} />
                  </div>
                </div>
              </section>

              {/* Observaciones */}
              {seleccionado.observaciones && (
                <section className="space-y-3">
                   <h4 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                    <Info size={16} /> Notas Adicionales
                  </h4>
                  <div className="bg-slate-50 p-6 rounded-2xl italic text-slate-600 text-sm font-medium leading-relaxed">
                    "{seleccionado.observaciones}"
                  </div>
                </section>
              )}

            </div>

            {/* Footer Modal */}
            <div className="p-8 bg-white border-t border-slate-100 flex justify-between items-center">
               <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                 <Calendar size={14}/> Registrado: {new Date(seleccionado.created_at).toLocaleDateString()}
               </p>
               <button className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all active:scale-95 shadow-lg">
                 Editar Proveedor
               </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}