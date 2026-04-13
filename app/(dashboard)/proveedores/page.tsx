'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, Search, Loader2, MapPin, 
  X, Phone, Info, Landmark, Calendar, 
  Star, Mail, Globe, ExternalLink, ChevronRight, Save, Trash2, Edit3, CreditCard, Tag
} from 'lucide-react';

export default function SeccionProveedores() {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  
  const [nuevo, setNuevo] = useState({
    nombre_empresa: '', rut_empresa: '', categoria: '', tipo_servicio: '',
    nombre_contacto: '', email_contacto: '', telefono: '', sitio_web: '',
    direccion: '', comuna: '', ciudad: '', condiciones_pago: 'Contado',
    banco_nombre: '', cuenta_tipo: 'Corriente', cuenta_numero: '', 
    observaciones: '', calificacion: 5, activo: true
  });

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserRole(session.user.user_metadata?.role || 'user');
      }
    };
    getSession();
    cargarProveedores();
  }, []);

  const cargarProveedores = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('proveedores').select('*').order('created_at', { ascending: false });
    if (!error) setProveedores(data || []);
    setLoading(false);
  };

  const guardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('proveedores').insert([nuevo]);
    if (error) alert("Error: " + error.message);
    else {
      resetForm();
      cargarProveedores();
    }
    setLoading(false);
  };

  const eliminarProveedor = async (id: string) => {
    if (!window.confirm("¿Estás seguro de eliminar permanentemente este proveedor?")) return;
    setLoading(true);
    const { error } = await supabase.from('proveedores').delete().eq('id', id);
    if (error) alert("Error al eliminar: " + error.message);
    else {
      setSeleccionado(null);
      cargarProveedores();
    }
    setLoading(false);
  };

  const actualizarProveedor = async () => {
    setLoading(true);
    const { error } = await supabase.from('proveedores').update(seleccionado).eq('id', seleccionado.id);
    if (error) alert("Error al actualizar: " + error.message);
    else {
      setEditando(false);
      cargarProveedores();
    }
    setLoading(false);
  };

  const resetForm = () => {
    setNuevo({
      nombre_empresa: '', rut_empresa: '', categoria: '', tipo_servicio: '',
      nombre_contacto: '', email_contacto: '', telefono: '', sitio_web: '',
      direccion: '', comuna: '', ciudad: '', condiciones_pago: 'Contado',
      banco_nombre: '', cuenta_tipo: 'Corriente', cuenta_numero: '', 
      observaciones: '', calificacion: 5, activo: true
    });
  };

  const canEditOrDelete = userRole === 'admin' || userRole === 'super_user';

  const filtrados = proveedores.filter(p => 
    p.nombre_empresa?.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.categoria?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.rut_empresa?.includes(busqueda)
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 lg:p-8 text-slate-900 font-sans">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <header className="mb-10 flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <Building2 className="text-blue-600" /> Directorio de Proveedores
            </h1>
            <p className="text-slate-400 text-sm">Registro y control de suministros industriales</p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              placeholder="Buscar por nombre, RUT o categoría..." 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all"
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* FORMULARIO DE INGRESO (TODOS LOS CAMPOS) */}
          <div className="xl:col-span-4">
            <form onSubmit={guardarProveedor} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-6 sticky top-8">
              <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-blue-600">Nuevo Proveedor</h2>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={16} className={nuevo.calificacion >= s ? "fill-amber-400 text-amber-400" : "text-slate-200 cursor-pointer"} onClick={() => setNuevo({...nuevo, calificacion: s})} />
                  ))}
                </div>
              </div>

              <div className="space-y-5 max-h-[60vh] overflow-y-auto px-1 custom-scrollbar">
                {/* Bloque 1: Identificación */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identificación de Empresa</span>
                  <input required placeholder="Nombre Fantasía / Razón Social" value={nuevo.nombre_empresa} onChange={e => setNuevo({...nuevo, nombre_empresa: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="RUT Empresa" value={nuevo.rut_empresa} onChange={e => setNuevo({...nuevo, rut_empresa: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-4 text-sm outline-none" />
                    <input required placeholder="Categoría (Ej: Construcción)" value={nuevo.categoria} onChange={e => setNuevo({...nuevo, categoria: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-4 text-sm outline-none" />
                  </div>
                </div>

                {/* Bloque 2: Contacto */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contacto & Localización</span>
                  <input placeholder="Nombre de Contacto" value={nuevo.nombre_contacto} onChange={e => setNuevo({...nuevo, nombre_contacto: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm outline-none" />
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Teléfono" value={nuevo.telefono} onChange={e => setNuevo({...nuevo, telefono: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-4 text-sm outline-none" />
                    <input placeholder="Email" value={nuevo.email_contacto} onChange={e => setNuevo({...nuevo, email_contacto: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-4 text-sm outline-none" />
                  </div>
                  <input placeholder="Dirección Completa" value={nuevo.direccion} onChange={e => setNuevo({...nuevo, direccion: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm outline-none" />
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Comuna" value={nuevo.comuna} onChange={e => setNuevo({...nuevo, comuna: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-4 text-sm outline-none" />
                    <input placeholder="Ciudad" value={nuevo.ciudad} onChange={e => setNuevo({...nuevo, ciudad: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-4 text-sm outline-none" />
                  </div>
                </div>

                {/* Bloque 3: Financiero */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Información de Pago</span>
                  <select value={nuevo.condiciones_pago} onChange={e => setNuevo({...nuevo, condiciones_pago: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm outline-none">
                    <option value="Contado">Contado</option>
                    <option value="30 días">30 días</option>
                    <option value="60 días">60 días</option>
                    <option value="Transferencia">Transferencia Inmediata</option>
                  </select>
                  <input placeholder="Nombre del Banco" value={nuevo.banco_nombre} onChange={e => setNuevo({...nuevo, banco_nombre: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm outline-none" />
                  <div className="grid grid-cols-2 gap-3">
                    <select value={nuevo.cuenta_tipo} onChange={e => setNuevo({...nuevo, cuenta_tipo: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-4 text-sm outline-none">
                      <option value="Corriente">Corriente</option>
                      <option value="Vista / RUT">Vista / RUT</option>
                      <option value="Ahorro">Ahorro</option>
                    </select>
                    <input placeholder="Nº de Cuenta" value={nuevo.cuenta_numero} onChange={e => setNuevo({...nuevo, cuenta_numero: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-4 text-sm outline-none" />
                  </div>
                </div>

                <textarea placeholder="Observaciones adicionales..." value={nuevo.observaciones} onChange={e => setNuevo({...nuevo, observaciones: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm outline-none h-24 resize-none" />
              </div>

              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl hover:bg-blue-700 transition-all flex justify-center items-center gap-2 shadow-xl shadow-blue-100 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" /> : 'Registrar en Base de Datos'}
              </button>
            </form>
          </div>

          {/* LISTADO DE PROVEEDORES */}
          <div className="xl:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtrados.map((prov) => (
                <div 
                  key={prov.id} 
                  onClick={() => { setSeleccionado(prov); setEditando(false); }}
                  className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all cursor-pointer group relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">
                      {prov.categoria}
                    </div>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => <Star key={s} size={10} className={prov.calificacion >= s ? "fill-amber-400 text-amber-400" : "text-slate-100"} />)}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-1 truncate">{prov.nombre_empresa}</h3>
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-6">
                    <MapPin size={12} /> {prov.comuna || 'Ubicación no definida'}
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                      RUT
                      <span className="block text-slate-700 font-mono mt-1 text-xs">{prov.rut_empresa || '--'}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                      Contacto
                      <span className="block text-slate-700 mt-1 text-xs truncate">{prov.nombre_contacto || '--'}</span>
                    </div>
                  </div>

                  <div className="absolute bottom-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="text-blue-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL / DRAWER DE DETALLE Y EDICIÓN --- */}
      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white h-full rounded-[3rem] shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 overflow-hidden">
            
            {/* Header Modal */}
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                  <Building2 size={28} />
                </div>
                <div>
                  {editando ? (
                    <input className="text-2xl font-bold text-slate-800 border-b-2 border-blue-600 outline-none bg-transparent" value={seleccionado.nombre_empresa} onChange={e => setSeleccionado({...seleccionado, nombre_empresa: e.target.value})} />
                  ) : (
                    <h2 className="text-2xl font-bold text-slate-800">{seleccionado.nombre_empresa}</h2>
                  )}
                  <p className="text-sm text-slate-400">{seleccionado.categoria} • ID: {seleccionado.id.split('-')[0]}</p>
                </div>
              </div>
              <button onClick={() => { setSeleccionado(null); setEditando(false); }} className="p-3 hover:bg-white rounded-2xl transition-all text-slate-400 hover:text-slate-800 shadow-sm">
                <X size={24} />
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              
              {/* Información General */}
              <section className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 tracking-widest"><Info size={14}/> Datos Base</h4>
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <label className="text-[9px] font-bold text-blue-500 uppercase">RUT Empresa</label>
                      {editando ? <input className="w-full bg-transparent text-sm outline-none font-bold" value={seleccionado.rut_empresa} onChange={e => setSeleccionado({...seleccionado, rut_empresa: e.target.value})} /> : <p className="text-sm font-bold text-slate-700">{seleccionado.rut_empresa || 'No informado'}</p>}
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <label className="text-[9px] font-bold text-blue-500 uppercase">Categoría</label>
                      {editando ? <input className="w-full bg-transparent text-sm outline-none font-bold" value={seleccionado.categoria} onChange={e => setSeleccionado({...seleccionado, categoria: e.target.value})} /> : <p className="text-sm font-bold text-slate-700">{seleccionado.categoria || 'Sin categoría'}</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 tracking-widest"><Star size={14}/> Calificación</h4>
                  <div className="flex gap-2 bg-slate-50 p-6 rounded-2xl justify-center items-center">
                    {[1,2,3,4,5].map(s => <Star key={s} size={24} className={seleccionado.calificacion >= s ? "fill-amber-400 text-amber-400" : "text-slate-200 cursor-pointer"} onClick={() => editando && setSeleccionado({...seleccionado, calificacion: s})} />)}
                  </div>
                </div>
              </section>

              {/* Contacto Detallado */}
              <section className="space-y-4">
                <h4 className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 tracking-widest"><Phone size={14}/> Canales de Comunicación</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border border-slate-100 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Nombre Contacto</p>
                    {editando ? <input className="w-full text-sm outline-none font-medium" value={seleccionado.nombre_contacto} onChange={e => setSeleccionado({...seleccionado, nombre_contacto: e.target.value})} /> : <p className="text-sm font-medium">{seleccionado.nombre_contacto || '---'}</p>}
                  </div>
                  <div className="p-4 border border-slate-100 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Teléfono</p>
                    {editando ? <input className="w-full text-sm outline-none font-medium" value={seleccionado.telefono} onChange={e => setSeleccionado({...seleccionado, telefono: e.target.value})} /> : <p className="text-sm font-medium">{seleccionado.telefono || '---'}</p>}
                  </div>
                  <div className="p-4 border border-slate-100 rounded-2xl col-span-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Correo Electrónico</p>
                    {editando ? <input className="w-full text-sm outline-none font-medium" value={seleccionado.email_contacto} onChange={e => setSeleccionado({...seleccionado, email_contacto: e.target.value})} /> : <p className="text-sm font-medium text-blue-600 underline">{seleccionado.email_contacto || '---'}</p>}
                  </div>
                </div>
              </section>

              {/* Datos Bancarios (Estilo Tarjeta) */}
              <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <CreditCard size={120} />
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-10">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Datos de Transferencia</h4>
                    <Landmark size={20} className="text-blue-400" />
                  </div>
                  <div className="space-y-6">
                    <div>
                      {editando ? (
                        <div className="grid grid-cols-2 gap-4">
                          <input className="bg-white/10 border-b border-white/20 p-2 text-xs outline-none" placeholder="Banco" value={seleccionado.banco_nombre} onChange={e => setSeleccionado({...seleccionado, banco_nombre: e.target.value})} />
                          <input className="bg-white/10 border-b border-white/20 p-2 text-xs outline-none" placeholder="Tipo de Cuenta" value={seleccionado.cuenta_tipo} onChange={e => setSeleccionado({...seleccionado, cuenta_tipo: e.target.value})} />
                        </div>
                      ) : (
                        <p className="text-lg font-bold">{seleccionado.banco_nombre || 'BANCO NO REGISTRADO'} <span className="text-slate-500 font-light">• {seleccionado.cuenta_tipo}</span></p>
                      )}
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-500 font-bold uppercase mb-1 tracking-widest">Número de Cuenta</p>
                      {editando ? (
                        <input className="w-full bg-white/10 border-b border-white/20 p-2 text-xl font-mono outline-none" value={seleccionado.cuenta_numero} onChange={e => setSeleccionado({...seleccionado, cuenta_numero: e.target.value})} />
                      ) : (
                        <p className="text-2xl font-mono tracking-[0.15em]">{seleccionado.cuenta_numero || '0000 0000 0000 0000'}</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Notas y Footer de Datos */}
              <section className="p-6 bg-amber-50 rounded-3xl border border-amber-100">
                <h4 className="text-[10px] font-black uppercase text-amber-700 mb-2">Observaciones Internas</h4>
                {editando ? <textarea className="w-full bg-transparent text-sm outline-none h-20 resize-none" value={seleccionado.observaciones} onChange={e => setSeleccionado({...seleccionado, observaciones: e.target.value})} /> : <p className="text-sm text-amber-900 italic">{seleccionado.observaciones || 'Sin notas adicionales para este proveedor.'}</p>}
              </section>
            </div>

            {/* Footer Modal Acciones */}
            <div className="p-8 border-t border-slate-50 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase">
                <Calendar size={14}/> Creado: {new Date(seleccionado.created_at).toLocaleDateString()}
              </div>
              
              <div className="flex gap-3">
                {canEditOrDelete && (
                  <>
                    {editando ? (
                      <button 
                        onClick={actualizarProveedor}
                        disabled={loading}
                        className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                      >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Actualizar Ficha
                      </button>
                    ) : (
                      <button 
                        onClick={() => setEditando(true)}
                        className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black hover:bg-slate-200 transition-all flex items-center gap-2"
                      >
                        <Edit3 size={16} /> Editar
                      </button>
                    )}
                    <button 
                      onClick={() => eliminarProveedor(seleccionado.id)}
                      className="px-4 py-3 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                      title="Eliminar Proveedor"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Estilos para el scrollbar personalizado */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
      `}</style>
    </div>
  );
}