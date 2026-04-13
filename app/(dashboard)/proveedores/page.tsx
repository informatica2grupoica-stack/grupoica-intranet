'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, Search, Loader2, MapPin, 
  X, Phone, Info, Landmark, Calendar, 
  Star, Mail, Globe, ExternalLink, ChevronRight, Save
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

  // Verificar rol de usuario y cargar datos
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
    if (!window.confirm("¿Estás seguro de eliminar este proveedor?")) return;
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
    p.nombre_empresa.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.categoria.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.rut_empresa && p.rut_empresa.includes(busqueda))
  );

  return (
    <div className="min-h-screen bg-[#fafafa] p-6 lg:p-12 text-slate-900 font-sans">
      <div className="max-w-[1600px] mx-auto">
        
        {/* HEADER */}
        <header className="mb-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-light tracking-tight text-slate-800">
              Directorio de <span className="font-semibold text-blue-600">Proveedores</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Gestión de suministros para {canEditOrDelete ? 'Administradores' : 'Consulta'}</p>
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
          
          {/* FORMULARIO LATERAL */}
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

              <div className="space-y-6">
                <section className="space-y-3">
                  <label className="text-[10px] font-bold text-blue-500 uppercase">Empresa & Rubro</label>
                  <input required placeholder="Nombre de la empresa" value={nuevo.nombre_empresa} onChange={e => setNuevo({...nuevo, nombre_empresa: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm focus:bg-white focus:border-blue-200 outline-none transition-all" />
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="RUT (12.345.678-9)" value={nuevo.rut_empresa} onChange={e => setNuevo({...nuevo, rut_empresa: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm focus:bg-white focus:border-blue-200 outline-none transition-all" />
                    <input required placeholder="Categoría" value={nuevo.categoria} onChange={e => setNuevo({...nuevo, categoria: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm focus:bg-white focus:border-blue-200 outline-none transition-all" />
                  </div>
                </section>

                <section className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Contacto Directo</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Nombre contacto" value={nuevo.nombre_contacto} onChange={e => setNuevo({...nuevo, nombre_contacto: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm outline-none transition-all" />
                    <input placeholder="Teléfono" value={nuevo.telefono} onChange={e => setNuevo({...nuevo, telefono: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm outline-none transition-all" />
                  </div>
                  <input placeholder="Email" value={nuevo.email_contacto} onChange={e => setNuevo({...nuevo, email_contacto: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm outline-none transition-all" />
                </section>

                <section className="space-y-3">
                  <label className="text-[10px] font-bold text-green-600 uppercase">Datos de Pago</label>
                  <input placeholder="Banco" value={nuevo.banco_nombre} onChange={e => setNuevo({...nuevo, banco_nombre: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm outline-none transition-all" />
                  <input placeholder="Nº de cuenta" value={nuevo.cuenta_numero} onChange={e => setNuevo({...nuevo, cuenta_numero: e.target.value})} className="w-full bg-slate-50 border border-transparent rounded-xl p-3 text-sm outline-none transition-all" />
                </section>

                <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all flex justify-center items-center gap-2 text-sm shadow-lg shadow-blue-100">
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Registrar Proveedor'}
                </button>
              </div>
            </div>
          </form>

          {/* LISTADO DE TARJETAS MODIFICADAS (TODO EL CONTENIDO) */}
          <div className="xl:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-2 gap-6">
              {filtrados.map((prov) => (
                <div 
                  key={prov.id} 
                  onClick={() => { setSeleccionado(prov); setEditando(false); }}
                  className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-xl transition-all cursor-pointer group flex flex-col gap-5"
                >
                  {/* Header de Tarjeta */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-md uppercase tracking-wider">
                        {prov.categoria}
                      </span>
                      <h3 className="font-semibold text-slate-800 text-xl group-hover:text-blue-600 transition-colors">
                        {prov.nombre_empresa}
                      </h3>
                      <p className="text-xs text-slate-400">{prov.tipo_servicio || 'Servicio General'}</p>
                    </div>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={12} className={prov.calificacion >= s ? "fill-amber-400 text-amber-400" : "text-slate-100"} />
                      ))}
                    </div>
                  </div>

                  {/* Grid de Info Interna */}
                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50">
                    <div className="space-y-3">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Contacto & RRSS</p>
                      <div className="space-y-2 text-slate-600">
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-slate-300" />
                          <span className="text-xs truncate">{prov.email_contacto || 'No registra'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-slate-300" />
                          <span className="text-xs">{prov.telefono || 'Sin fono'}</span>
                        </div>
                        {prov.sitio_web && (
                          <div className="flex items-center gap-2 text-blue-500">
                            <Globe size={14} />
                            <span className="text-xs truncate">Sitio Web</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Ubicación</p>
                      <div className="space-y-1">
                        <div className="flex items-start gap-2 text-slate-600">
                          <MapPin size={14} className="text-rose-300 mt-0.5" />
                          <span className="text-xs leading-tight">{prov.direccion || 'Sin dirección'}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 ml-6">{prov.comuna || 'Chile'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Datos Financieros Estilizados */}
                  <div className="flex items-center justify-between gap-4 bg-slate-50 p-3 rounded-2xl">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">RUT</span>
                      <span className="text-xs font-mono text-slate-700">{prov.rut_empresa || '--'}</span>
                    </div>
                    <div className="h-8 w-[1px] bg-slate-200"></div>
                    <div className="flex flex-col flex-1">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">Banco / Cuenta</span>
                      <span className="text-xs text-slate-700 truncate font-medium">
                        {prov.banco_nombre ? `${prov.banco_nombre} - ${prov.cuenta_numero}` : 'Sin datos de pago'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-xl shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <ChevronRight size={14} />
                    </div>
                  </div>

                  {prov.observaciones && (
                    <div className="flex items-center gap-2 text-[10px] text-amber-600 bg-amber-50/50 p-2 rounded-lg">
                      <Info size={12} />
                      <span className="italic line-clamp-1">{prov.observaciones}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- DRAWER DE DETALLE / EDICIÓN --- */}
      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-white h-full rounded-[2rem] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">{seleccionado.categoria}</p>
                {editando ? (
                  <input 
                    className="text-2xl font-semibold text-slate-800 border-b-2 border-blue-500 outline-none" 
                    value={seleccionado.nombre_empresa} 
                    onChange={e => setSeleccionado({...seleccionado, nombre_empresa: e.target.value})}
                  />
                ) : (
                  <h2 className="text-2xl font-semibold text-slate-800">{seleccionado.nombre_empresa}</h2>
                )}
              </div>
              <button onClick={() => { setSeleccionado(null); setEditando(false); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">RUT Empresa</p>
                  {editando ? (
                    <input className="font-semibold bg-transparent border-b border-slate-200 outline-none w-full" value={seleccionado.rut_empresa} onChange={e => setSeleccionado({...seleccionado, rut_empresa: e.target.value})} />
                  ) : (
                    <p className="font-semibold">{seleccionado.rut_empresa || 'No informado'}</p>
                  )}
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Calificación</p>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(s => <Star key={s} size={14} className={seleccionado.calificacion >= s ? "fill-amber-400 text-amber-400" : "text-slate-200"} onClick={() => editando && setSeleccionado({...seleccionado, calificacion: s})} />)}
                  </div>
                </div>
              </div>

              {/* Contacto Editable */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">Canales de Contacto</h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-4 bg-blue-50/50 rounded-xl space-y-3">
                    <div className="flex items-center gap-3">
                      <Mail size={16} className="text-blue-500"/>
                      {editando ? (
                        <input className="text-xs bg-transparent border-b border-blue-200 outline-none w-full" value={seleccionado.email_contacto} onChange={e => setSeleccionado({...seleccionado, email_contacto: e.target.value})} />
                      ) : (
                        <p className="text-xs font-semibold">{seleccionado.email_contacto || 'Sin email'}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone size={16} className="text-blue-500"/>
                      {editando ? (
                        <input className="text-xs bg-transparent border-b border-blue-200 outline-none w-full" value={seleccionado.telefono} onChange={e => setSeleccionado({...seleccionado, telefono: e.target.value})} />
                      ) : (
                        <p className="text-xs font-semibold">{seleccionado.telefono || 'Sin fono'}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Finanzas Editables */}
              <div className="p-6 bg-slate-900 rounded-[2rem] text-white">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-4">Datos Bancarios</p>
                {editando ? (
                  <div className="space-y-4">
                    <input className="w-full bg-white/10 border-b border-white/20 p-2 text-sm outline-none" value={seleccionado.banco_nombre} onChange={e => setSeleccionado({...seleccionado, banco_nombre: e.target.value})} placeholder="Banco" />
                    <input className="w-full bg-white/10 border-b border-white/20 p-2 text-xl font-mono outline-none" value={seleccionado.cuenta_numero} onChange={e => setSeleccionado({...seleccionado, cuenta_numero: e.target.value})} placeholder="Nº Cuenta" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold">{seleccionado.banco_nombre} - {seleccionado.cuenta_tipo}</p>
                    <p className="text-2xl font-mono tracking-wider mt-2">{seleccionado.cuenta_numero || '0000 0000 0000'}</p>
                  </>
                )}
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="p-8 border-t border-slate-50 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-300 uppercase flex items-center gap-2"><Calendar size={14}/> {seleccionado.created_at ? new Date(seleccionado.created_at).toLocaleDateString() : 'Reciente'}</span>
              
              <div className="flex gap-2">
                {canEditOrDelete && (
                  <>
                    {editando ? (
                      <button 
                        onClick={actualizarProveedor}
                        disabled={loading}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg"
                      >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar Cambios
                      </button>
                    ) : (
                      <button 
                        onClick={() => setEditando(true)}
                        className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
                      >
                        Editar Ficha
                      </button>
                    )}
                    <button 
                      onClick={() => eliminarProveedor(seleccionado.id)}
                      className="px-5 py-2.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-600 hover:text-white transition-all"
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}