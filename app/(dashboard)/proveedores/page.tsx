'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, Plus, Mail, Search, Trash2, Loader2, MapPin, 
  CreditCard, Globe, X, Phone, Info, Landmark, Calendar, 
  Star, Tag, Truck, Briefcase 
} from 'lucide-react';

export default function SeccionProveedores() {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<any | null>(null);
  
  const [nuevo, setNuevo] = useState({
    nombre_empresa: '', rut_empresa: '', categoria: '', tipo_servicio: '',
    nombre_contacto: '', email_contacto: '', telefono: '', sitio_web: '',
    direccion: '', comuna: '', ciudad: '', condiciones_pago: 'Contado',
    banco_nombre: '', cuenta_tipo: 'Corriente', cuenta_numero: '', 
    observaciones: '', calificacion: 5, activo: true
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
    setLoading(true);
    const { error } = await supabase.from('proveedores').insert([nuevo]);
    if (error) alert("Error: " + error.message);
    else {
      setNuevo({
        nombre_empresa: '', rut_empresa: '', categoria: '', tipo_servicio: '',
        nombre_contacto: '', email_contacto: '', telefono: '', sitio_web: '',
        direccion: '', comuna: '', ciudad: '', condiciones_pago: 'Contado',
        banco_nombre: '', cuenta_tipo: 'Corriente', cuenta_numero: '', 
        observaciones: '', calificacion: 5, activo: true
      });
      cargarProveedores();
    }
    setLoading(false);
  };

  const filtrados = proveedores.filter(p => 
    p.nombre_empresa.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.categoria.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.rut_empresa && p.rut_empresa.includes(busqueda))
  );

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4 md:p-8 text-slate-900">
      <div className="max-w-[1700px] mx-auto">
        
        <header className="mb-8 flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter italic text-slate-900 uppercase flex items-center gap-3">
              <Briefcase size={44} className="text-blue-600" /> Sistema de Proveedores
            </h1>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.3em] mt-1 ml-1">Control Maestro de Insumos y Servicios</p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              placeholder="Buscar por Empresa, RUT o Rubro..." 
              className="w-full bg-white border-2 border-slate-200 rounded-2xl py-4 pl-12 pr-4 font-bold text-sm shadow-sm outline-none focus:border-blue-500 transition-all"
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* FORMULARIO COMPLETO (BASE DE DATOS 1:1) */}
          <form onSubmit={guardarProveedor} className="xl:col-span-4 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl h-fit max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-xs font-black uppercase tracking-[0.4em] text-blue-600">Nuevo Registro Maestro</h2>
               <div className="flex items-center gap-1">
                 {[1,2,3,4,5].map(s => (
                   <Star key={s} size={14} className={nuevo.calificacion >= s ? "fill-amber-400 text-amber-400" : "text-slate-200"} onClick={() => setNuevo({...nuevo, calificacion: s})} />
                 ))}
               </div>
            </div>
            
            <div className="space-y-6">
              {/* Bloque 1: Identificación */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest border-b pb-1">Identificación</p>
                <input required placeholder="Razón Social *" value={nuevo.nombre_empresa} onChange={e => setNuevo({...nuevo, nombre_empresa: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold outline-none focus:ring-2 focus:ring-blue-500/20" />
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="RUT Empresa" value={nuevo.rut_empresa} onChange={e => setNuevo({...nuevo, rut_empresa: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" />
                  <input required placeholder="Categoría / Rubro *" value={nuevo.categoria} onChange={e => setNuevo({...nuevo, categoria: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" />
                </div>
                <input placeholder="Tipo de Servicio (Detalle)" value={nuevo.tipo_servicio} onChange={e => setNuevo({...nuevo, tipo_servicio: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" />
              </div>

              {/* Bloque 2: Contacto & Web */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest border-b pb-1">Contacto & Redes</p>
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Nombre Contacto" value={nuevo.nombre_contacto} onChange={e => setNuevo({...nuevo, nombre_contacto: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" />
                  <input placeholder="Teléfono" value={nuevo.telefono} onChange={e => setNuevo({...nuevo, telefono: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" />
                </div>
                <input placeholder="Email Contacto" value={nuevo.email_contacto} onChange={e => setNuevo({...nuevo, email_contacto: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" />
                <input placeholder="Sitio Web (https://...)" value={nuevo.sitio_web} onChange={e => setNuevo({...nuevo, sitio_web: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" />
              </div>

              {/* Bloque 3: Ubicación */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest border-b pb-1">Ubicación</p>
                <input placeholder="Dirección" value={nuevo.direccion} onChange={e => setNuevo({...nuevo, direccion: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" />
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Comuna" value={nuevo.comuna} onChange={e => setNuevo({...nuevo, comuna: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" />
                  <input placeholder="Ciudad" value={nuevo.ciudad} onChange={e => setNuevo({...nuevo, ciudad: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" />
                </div>
              </div>

              {/* Bloque 4: Financiero */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest border-b pb-1">Información Financiera</p>
                <input placeholder="Banco" value={nuevo.banco_nombre} onChange={e => setNuevo({...nuevo, banco_nombre: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" />
                <div className="grid grid-cols-2 gap-4">
                  <select value={nuevo.cuenta_tipo} onChange={e => setNuevo({...nuevo, cuenta_tipo: e.target.value})} className="bg-slate-50 border-none rounded-xl p-4 text-sm font-bold outline-none">
                    <option>Corriente</option>
                    <option>Vista</option>
                    <option>Ahorro</option>
                  </select>
                  <input placeholder="Nº Cuenta" value={nuevo.cuenta_numero} onChange={e => setNuevo({...nuevo, cuenta_numero: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold" />
                </div>
                <select value={nuevo.condiciones_pago} onChange={e => setNuevo({...nuevo, condiciones_pago: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-sm font-bold outline-none">
                    <option>Contado</option>
                    <option>Transferencia</option>
                    <option>30 días</option>
                    <option>60 días</option>
                </select>
              </div>

              <textarea placeholder="Observaciones adicionales..." value={nuevo.observaciones} onChange={e => setNuevo({...nuevo, observaciones: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-4 text-base font-bold h-24 resize-none" />

              <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-blue-600 transition-all flex justify-center items-center gap-2 uppercase text-[11px] tracking-[0.3em] shadow-xl">
                {loading ? <Loader2 className="animate-spin" /> : 'Sincronizar Proveedor'}
              </button>
            </div>
          </form>

          {/* LISTADO DE TARJETAS */}
          <div className="xl:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtrados.map((prov) => (
                <div 
                  key={prov.id} 
                  onClick={() => setSeleccionado(prov)}
                  className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-slate-900 text-white rounded-2xl group-hover:bg-blue-600 transition-colors">
                      <Building2 size={28} />
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg uppercase tracking-widest">{prov.categoria}</span>
                      <div className="flex gap-0.5 mt-2 justify-end">
                        {[1,2,3,4,5].map(s => <Star key={s} size={10} className={prov.calificacion >= s ? "fill-amber-400 text-amber-400" : "text-slate-200"} />)}
                      </div>
                    </div>
                  </div>

                  <h3 className="font-black text-xl text-slate-800 uppercase leading-tight mb-1">{prov.nombre_empresa}</h3>
                  <p className="text-xs font-bold text-slate-400 mb-6 italic">{prov.tipo_servicio || 'Servicio general'}</p>

                  <div className="space-y-3 pt-4 border-t border-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase">RUT</span>
                      <span className="text-[11px] font-bold">{prov.rut_empresa || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Contacto</span>
                      <span className="text-[11px] font-bold text-blue-600 uppercase italic">{prov.nombre_contacto || '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL DRAWER DE DETALLE TOTAL --- */}
      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-white h-full rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-500">
            
            <div className="p-10 bg-slate-900 text-white flex justify-between items-start relative">
              <div className="absolute top-0 right-0 p-10 opacity-10"><Building2 size={120} /></div>
              <div className="relative z-10">
                <span className="text-[10px] font-black bg-blue-600 px-4 py-2 rounded-full uppercase tracking-[0.2em]">{seleccionado.categoria}</span>
                <h2 className="text-4xl font-black uppercase italic mt-6 leading-none">{seleccionado.nombre_empresa}</h2>
                <p className="text-blue-400 font-bold text-sm mt-2 tracking-widest italic">{seleccionado.tipo_servicio}</p>
              </div>
              <button onClick={() => setSeleccionado(null)} className="relative z-10 p-4 bg-white/10 hover:bg-red-500 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
              
              {/* Bloque: Datos Base */}
              <div className="grid grid-cols-2 gap-8">
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2"><Info size={14}/> Identificación Oficial</p>
                  <p className="text-sm font-bold">RUT: <span className="text-slate-900 ml-2">{seleccionado.rut_empresa || 'N/A'}</span></p>
                  <p className="text-sm font-bold mt-2">Web: <a href={seleccionado.sitio_web} className="text-blue-600 underline ml-2">{seleccionado.sitio_web || 'N/A'}</a></p>
                </div>
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2"><Star size={14}/> Evaluación</p>
                  <div className="flex gap-1 mb-2">
                    {[1,2,3,4,5].map(s => <Star key={s} size={18} className={seleccionado.calificacion >= s ? "fill-amber-400 text-amber-400" : "text-slate-200"} />)}
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase italic">Estado: <span className={seleccionado.activo ? "text-green-500" : "text-red-500"}>{seleccionado.activo ? 'ACTIVO' : 'INACTIVO'}</span></p>
                </div>
              </div>

              {/* Bloque: Comunicación y Localización */}
              <div className="space-y-6">
                 <h3 className="text-[11px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2 border-b pb-2"><Phone size={16}/> Canales de Comunicación</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-2xl">
                      <p className="text-[9px] font-black text-blue-400 uppercase">Contacto</p>
                      <p className="text-sm font-bold uppercase">{seleccionado.nombre_contacto || '-'}</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-2xl">
                      <p className="text-[9px] font-black text-blue-400 uppercase">Fono</p>
                      <p className="text-sm font-bold">{seleccionado.telefono || '-'}</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-2xl">
                      <p className="text-[9px] font-black text-blue-400 uppercase">Email</p>
                      <p className="text-[11px] font-bold truncate">{seleccionado.email_contacto || '-'}</p>
                    </div>
                 </div>
                 <div className="p-6 bg-slate-50 rounded-[2rem] flex items-center gap-4">
                    <div className="p-4 bg-white rounded-2xl shadow-sm"><MapPin className="text-red-500" size={24}/></div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{seleccionado.direccion || 'Sin dirección'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{seleccionado.comuna}, {seleccionado.ciudad}</p>
                    </div>
                 </div>
              </div>

              {/* Bloque: Finanzas */}
              <div className="space-y-6">
                 <h3 className="text-[11px] font-black uppercase text-green-600 tracking-widest flex items-center gap-2 border-b pb-2"><Landmark size={16}/> Información de Pagos</h3>
                 <div className="bg-green-50/50 p-8 rounded-[2.5rem] border-2 border-dashed border-green-100 grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-[9px] font-black text-green-600 uppercase mb-1">Banco y Tipo</p>
                      <p className="text-lg font-black text-slate-800">{seleccionado.banco_nombre} - {seleccionado.cuenta_tipo}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-green-600 uppercase mb-1">Condición de Pago</p>
                      <p className="text-lg font-black text-slate-800">{seleccionado.condiciones_pago}</p>
                    </div>
                    <div className="col-span-2">
                       <p className="text-[9px] font-black text-green-600 uppercase mb-1">Número de Cuenta</p>
                       <p className="text-3xl font-black font-mono tracking-tighter text-slate-900">{seleccionado.cuenta_numero || 'NO REGISTRADO'}</p>
                    </div>
                 </div>
              </div>

              {/* Notas */}
              <div className="bg-amber-50 p-8 rounded-[2rem]">
                 <p className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-2 mb-4"><Info size={16}/> Bitácora / Observaciones</p>
                 <p className="text-sm font-bold text-slate-700 italic leading-relaxed">
                   {seleccionado.observaciones || 'No hay observaciones adicionales para este proveedor.'}
                 </p>
              </div>

            </div>

            <div className="p-10 bg-white border-t flex justify-between items-center">
               <div className="flex items-center gap-2 text-slate-300 text-[10px] font-black uppercase">
                 <Calendar size={14}/> Alta: {new Date(seleccionado.created_at).toLocaleDateString()}
               </div>
               <div className="flex gap-4">
                  <button className="bg-rose-50 text-rose-600 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all">Eliminar</button>
                  <button className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl">Editar Ficha</button>
               </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}