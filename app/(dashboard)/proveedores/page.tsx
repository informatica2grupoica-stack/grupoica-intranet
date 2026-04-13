'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, Search, Loader2, MapPin, 
  X, Phone, Info, Landmark, Calendar, 
  Star, Mail, Globe, ExternalLink, ChevronRight
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
    <div className="min-h-screen bg-[#fafafa] p-6 lg:p-12 text-slate-900 font-sans">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER MINIMALISTA */}
        <header className="mb-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-light tracking-tight text-slate-800">
              Directorio de <span className="font-semibold text-blue-600">Proveedores</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Gestión centralizada de servicios y logística</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              placeholder="Buscar proveedor..." 
              className="w-full bg-white border border-slate-200 rounded-full py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all shadow-sm"
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
          
          {/* FORMULARIO LATERAL (LIMPIO) */}
          <form onSubmit={guardarProveedor} className="xl:col-span-4 space-y-4 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Nuevo Registro</h2>
                <div className="flex gap-1">
                   {[1,2,3,4,5].map(s => (
                     <Star key={s} size={14} className={nuevo.calificacion >= s ? "fill-blue-500 text-blue-500" : "text-slate-100"} onClick={() => setNuevo({...nuevo, calificacion: s})} />
                   ))}
                </div>
              </div>

              {/* Secciones del Formulario */}
              <div className="space-y-6">
                <section className="space-y-3">
                  <label className="text-[10px] font-bold text-blue-500 uppercase">Empresa & Rubro</label>
                  <input required placeholder="Nombre de la empresa" value={nuevo.nombre_empresa} onChange={e => setNuevo({...nuevo, nombre_empresa: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm focus:bg-white focus:border-blue-200 outline-none transition-all" />
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="RUT (12.345.678-9)" value={nuevo.rut_empresa} onChange={e => setNuevo({...nuevo, rut_empresa: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm focus:bg-white focus:border-blue-200 outline-none transition-all" />
                    <input required placeholder="Categoría" value={nuevo.categoria} onChange={e => setNuevo({...nuevo, categoria: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm focus:bg-white focus:border-blue-200 outline-none transition-all" />
                  </div>
                  <input placeholder="Detalle del servicio" value={nuevo.tipo_servicio} onChange={e => setNuevo({...nuevo, tipo_servicio: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm focus:bg-white focus:border-blue-200 outline-none transition-all" />
                </section>

                <section className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Contacto Directo</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Nombre contacto" value={nuevo.nombre_contacto} onChange={e => setNuevo({...nuevo, nombre_contacto: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm outline-none transition-all" />
                    <input placeholder="Teléfono" value={nuevo.telefono} onChange={e => setNuevo({...nuevo, telefono: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm outline-none transition-all" />
                  </div>
                  <input placeholder="Email" value={nuevo.email_contacto} onChange={e => setNuevo({...nuevo, email_contacto: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm outline-none transition-all" />
                  <input placeholder="Sitio Web" value={nuevo.sitio_web} onChange={e => setNuevo({...nuevo, sitio_web: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm outline-none transition-all" />
                </section>

                <section className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Localización</label>
                  <input placeholder="Dirección completa" value={nuevo.direccion} onChange={e => setNuevo({...nuevo, direccion: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm outline-none transition-all" />
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Comuna" value={nuevo.comuna} onChange={e => setNuevo({...nuevo, comuna: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm outline-none transition-all" />
                    <input placeholder="Ciudad" value={nuevo.ciudad} onChange={e => setNuevo({...nuevo, ciudad: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm outline-none transition-all" />
                  </div>
                </section>

                <section className="space-y-3">
                  <label className="text-[10px] font-bold text-green-600 uppercase">Datos de Pago</label>
                  <input placeholder="Banco" value={nuevo.banco_nombre} onChange={e => setNuevo({...nuevo, banco_nombre: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm outline-none transition-all" />
                  <div className="grid grid-cols-2 gap-3">
                    <select value={nuevo.cuenta_tipo} onChange={e => setNuevo({...nuevo, cuenta_tipo: e.target.value})} className="bg-slate-50 border border-transparent rounded-xl p-3 text-xs font-semibold outline-none">
                      <option>Corriente</option>
                      <option>Vista</option>
                      <option>Ahorro</option>
                    </select>
                    <input placeholder="Nº de cuenta" value={nuevo.cuenta_numero} onChange={e => setNuevo({...nuevo, cuenta_numero: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm outline-none transition-all" />
                  </div>
                  <select value={nuevo.condiciones_pago} onChange={e => setNuevo({...nuevo, condiciones_pago: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-xs font-semibold outline-none">
                      <option>Contado</option>
                      <option>Transferencia</option>
                      <option>30 días</option>
                      <option>60 días</option>
                  </select>
                </section>

                <textarea placeholder="Notas internas..." value={nuevo.observaciones} onChange={e => setNuevo({...nuevo, observaciones: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm h-20 resize-none outline-none transition-all" />

                <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all flex justify-center items-center gap-2 text-sm shadow-lg shadow-blue-100">
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Registrar Proveedor'}
                </button>
              </div>
            </div>
          </form>

          {/* LISTADO DE TARJETAS MINIMALISTAS */}
          <div className="xl:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
              {filtrados.map((prov) => (
                <div 
                  key={prov.id} 
                  onClick={() => setSeleccionado(prov)}
                  className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-md uppercase tracking-wider">{prov.categoria}</span>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => <Star key={s} size={10} className={prov.calificacion >= s ? "fill-amber-400 text-amber-400" : "text-slate-100"} />)}
                      </div>
                    </div>
                    <h3 className="font-semibold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{prov.nombre_empresa}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{prov.tipo_servicio || 'Servicio estándar'}</p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                    <div className="text-[10px] text-slate-400 font-medium">
                      <span className="block uppercase tracking-tighter">RUT</span>
                      <span className="text-slate-600">{prov.rut_empresa || '--'}</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- DRAWER DE DETALLE (MINIMALISTA) --- */}
      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-white h-full rounded-[2rem] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">{seleccionado.categoria}</p>
                <h2 className="text-2xl font-semibold text-slate-800">{seleccionado.nombre_empresa}</h2>
              </div>
              <button onClick={() => setSeleccionado(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              
              {/* Info básica */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">RUT Empresa</p>
                  <p className="font-semibold">{seleccionado.rut_empresa || 'No informado'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Calificación</p>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(s => <Star key={s} size={14} className={seleccionado.calificacion >= s ? "fill-amber-400 text-amber-400" : "text-slate-200"} />)}
                  </div>
                </div>
              </div>

              {/* Contacto */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Phone size={14}/> Contacto & Enlaces
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center gap-4 p-3 border border-slate-100 rounded-xl">
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-500"><Mail size={18}/></div>
                    <div>
                      <p className="text-xs font-semibold">{seleccionado.nombre_contacto || 'Sin contacto'}</p>
                      <p className="text-xs text-slate-400">{seleccionado.email_contacto || '-'}</p>
                    </div>
                  </div>
                  {seleccionado.sitio_web && (
                    <a href={seleccionado.sitio_web} target="_blank" className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400"><Globe size={18}/></div>
                        <span className="text-xs font-semibold">Sitio Web Oficial</span>
                      </div>
                      <ExternalLink size={14} className="text-slate-300"/>
                    </a>
                  )}
                </div>
              </div>

              {/* Ubicación */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <MapPin size={14}/> Ubicación
                </h4>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                  <div className="mt-1 text-red-400"><MapPin size={18}/></div>
                  <div>
                    <p className="text-sm font-semibold">{seleccionado.direccion || 'Sin dirección registrada'}</p>
                    <p className="text-xs text-slate-400">{seleccionado.comuna}, {seleccionado.ciudad}</p>
                  </div>
                </div>
              </div>

              {/* Financiero */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Landmark size={14}/> Datos de Facturación
                </h4>
                <div className="p-6 bg-slate-900 rounded-[2rem] text-white">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">Banco</p>
                      <p className="text-sm font-semibold">{seleccionado.banco_nombre}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-slate-500 uppercase">Tipo</p>
                      <p className="text-sm font-semibold">{seleccionado.cuenta_tipo}</p>
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Número de cuenta</p>
                  <p className="text-2xl font-mono tracking-wider">{seleccionado.cuenta_numero || '0000 0000 0000'}</p>
                  <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 uppercase">Condiciones</span>
                    <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-full">{seleccionado.condiciones_pago}</span>
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              {seleccionado.observaciones && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[10px] font-bold text-amber-600 uppercase mb-2 flex items-center gap-2"><Info size={14}/> Notas internas</p>
                  <p className="text-xs text-amber-800 italic leading-relaxed">{seleccionado.observaciones}</p>
                </div>
              )}

            </div>

            <div className="p-8 border-t border-slate-50 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-300 uppercase flex items-center gap-2"><Calendar size={14}/> Creado el {new Date(seleccionado.created_at).toLocaleDateString()}</span>
              <div className="flex gap-2">
                <button className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all">Editar</button>
                <button className="px-5 py-2.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-600 hover:text-white transition-all">Eliminar</button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}