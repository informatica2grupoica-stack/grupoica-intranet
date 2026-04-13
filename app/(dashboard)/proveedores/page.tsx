'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, Search, Loader2, MapPin, X, Phone, Star, 
  Trash2, Edit3, Save, Plus, CheckCircle2, AlertCircle,
  Landmark, CreditCard, Mail, Globe, Info, ChevronDown, ChevronUp,
  Briefcase, DollarSign, Map
} from 'lucide-react';

export default function SeccionProveedores() {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [seleccionado, setSeleccionado] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [alert, setAlert] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const initialFormState = {
    nombre_empresa: '', rut_empresa: '', categoria: '', tipo_servicio: '',
    nombre_contacto: '', email_contacto: '', telefono: '', sitio_web: '',
    direccion: '', comuna: '', ciudad: '', condiciones_pago: 'Contado',
    banco_nombre: '', cuenta_tipo: 'Corriente', cuenta_numero: '', 
    observaciones: '', calificacion: 5, activo: true
  };

  const [nuevo, setNuevo] = useState(initialFormState);

  useEffect(() => {
    cargarProveedores();
  }, []);

  const showAlert = (msg: string, type: 'success' | 'error') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 3000);
  };

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
    if (error) showAlert(error.message, 'error');
    else {
      showAlert("Proveedor registrado con éxito", "success");
      setNuevo(initialFormState);
      cargarProveedores();
      setShowForm(false);
    }
    setLoading(false);
  };

  const eliminarProveedor = async (id: string) => {
    if (!window.confirm("¿Eliminar este proveedor permanentemente?")) return;
    const { error } = await supabase.from('proveedores').delete().eq('id', id);
    if (error) showAlert("Error al eliminar", "error");
    else {
      showAlert("Eliminado correctamente", "success");
      setSeleccionado(null);
      cargarProveedores();
    }
  };

  const actualizarCampoRapido = async (id: string, campo: string, valor: any) => {
    const { error } = await supabase.from('proveedores').update({ [campo]: valor }).eq('id', id);
    if (!error) cargarProveedores();
  };

  const categoriasUnicas = ["Todas", ...new Set(proveedores.map(p => p.categoria).filter(Boolean))];

  const filtrados = proveedores.filter(p => {
    const cumpleBusqueda = p.nombre_empresa?.toLowerCase().includes(busqueda.toLowerCase()) || p.rut_empresa?.includes(busqueda);
    const cumpleCategoria = categoriaFiltro === "Todas" || p.categoria === categoriaFiltro;
    return cumpleBusqueda && cumpleCategoria;
  });

  return (
    <div className="min-h-screen bg-[#FDFDFD] p-4 lg:p-10 text-slate-900 font-sans">
      
      {alert && (
        <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in fade-in zoom-in duration-300 ${alert.type === 'success' ? 'bg-white border-emerald-100 text-emerald-600' : 'bg-white border-rose-100 text-rose-600'}`}>
          {alert.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-bold">{alert.msg}</span>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto">
        
        {/* HEADER Y FILTROS AJUSTADOS PARA NOTEBOOKS */}
        <div className="flex flex-col space-y-6 mb-8 lg:mb-12">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-slate-900 p-3 rounded-2xl text-white shadow-xl shadow-slate-200 shrink-0">
                <Building2 size={32} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-800 uppercase">Central de Proveedores</h1>
                <p className="text-slate-400 font-medium text-[10px] md:text-sm uppercase tracking-widest">Base de Datos Industrial</p>
              </div>
            </div>
            
            {/* Contenedor de búsqueda y filtros con mejor wrap */}
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 min-w-[200px] md:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar..." 
                  className="w-full bg-slate-100 border-none rounded-2xl py-3 md:py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
              
              <select 
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="bg-slate-100 border-none rounded-2xl py-3 md:py-4 px-4 md:px-6 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-blue-100 outline-none appearance-none cursor-pointer min-w-[120px]"
              >
                {categoriasUnicas.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>

              <button 
                onClick={() => setShowForm(!showForm)}
                className="bg-blue-600 text-white p-3 md:p-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-100 flex items-center gap-2"
              >
                {showForm ? <X size={24} /> : <Plus size={24} />}
                <span className="hidden sm:inline font-bold text-sm">{showForm ? 'Cerrar' : 'Agregar'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* FORMULARIO DE CREACIÓN */}
        {showForm && (
          <form onSubmit={guardarProveedor} className="mb-12 bg-white border border-slate-100 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-2xl animate-in slide-in-from-top duration-500 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
            <h2 className="text-xl font-black mb-8 text-slate-800 flex items-center gap-2">NUEVA FICHA DE PROVEEDOR</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="md:col-span-2 space-y-4">
                <p className="text-[10px] font-black text-blue-600 tracking-widest uppercase">General</p>
                <input required placeholder="Razón Social" value={nuevo.nombre_empresa} onChange={e => setNuevo({...nuevo, nombre_empresa: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none border border-transparent focus:border-blue-200" />
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="RUT Empresa" value={nuevo.rut_empresa} onChange={e => setNuevo({...nuevo, rut_empresa: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                  <input required placeholder="Categoría" value={nuevo.categoria} onChange={e => setNuevo({...nuevo, categoria: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                </div>
                <input placeholder="Tipo de Servicio (Ej: Cemento, Flete)" value={nuevo.tipo_servicio} onChange={e => setNuevo({...nuevo, tipo_servicio: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
              </div>

              <div className="md:col-span-2 space-y-4">
                <p className="text-[10px] font-black text-blue-600 tracking-widest uppercase">Contacto y Web</p>
                <input placeholder="Nombre de Contacto" value={nuevo.nombre_contacto} onChange={e => setNuevo({...nuevo, nombre_contacto: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Teléfono" value={nuevo.telefono} onChange={e => setNuevo({...nuevo, telefono: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                  <input placeholder="Email" value={nuevo.email_contacto} onChange={e => setNuevo({...nuevo, email_contacto: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                </div>
                <input placeholder="Sitio Web (https://...)" value={nuevo.sitio_web} onChange={e => setNuevo({...nuevo, sitio_web: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
              </div>

              <div className="md:col-span-2 space-y-4">
                <p className="text-[10px] font-black text-blue-600 tracking-widest uppercase">Ubicación</p>
                <input placeholder="Dirección" value={nuevo.direccion} onChange={e => setNuevo({...nuevo, direccion: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Comuna" value={nuevo.comuna} onChange={e => setNuevo({...nuevo, comuna: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                  <input placeholder="Ciudad" value={nuevo.ciudad} onChange={e => setNuevo({...nuevo, ciudad: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                </div>
              </div>

              <div className="md:col-span-2 space-y-4">
                <p className="text-[10px] font-black text-blue-600 tracking-widest uppercase">Financiero</p>
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Condiciones Pago (Contado, 30 días)" value={nuevo.condiciones_pago} onChange={e => setNuevo({...nuevo, condiciones_pago: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                  <input placeholder="Banco" value={nuevo.banco_nombre} onChange={e => setNuevo({...nuevo, banco_nombre: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <select value={nuevo.cuenta_tipo} onChange={e => setNuevo({...nuevo, cuenta_tipo: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none">
                    <option value="Corriente">Corriente</option>
                    <option value="Vista">Vista / RUT</option>
                  </select>
                  <input placeholder="Número de Cuenta" value={nuevo.cuenta_numero} onChange={e => setNuevo({...nuevo, cuenta_numero: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                </div>
              </div>
            </div>

            <textarea placeholder="Observaciones..." value={nuevo.observaciones} onChange={e => setNuevo({...nuevo, observaciones: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm outline-none h-24 mb-6" />

            <div className="flex justify-end gap-4">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 md:px-8 py-3 text-sm font-bold text-slate-400">Cancelar</button>
              <button type="submit" className="bg-slate-900 text-white px-6 md:px-12 py-3 rounded-2xl text-sm font-black shadow-lg hover:bg-blue-600 transition-all">GUARDAR PROVEEDOR</button>
            </div>
          </form>
        )}

        {/* LISTADO DE TARJETAS */}
        <div className="space-y-4">
          {filtrados.map((prov) => (
            <div key={prov.id} className="group bg-white border border-slate-100 rounded-[1.5rem] md:rounded-[2rem] hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center text-blue-600 font-black shrink-0">
                    {prov.nombre_empresa?.charAt(0) || 'P'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base md:text-lg font-black text-slate-800 leading-none mb-2 uppercase truncate">{prov.nombre_empresa}</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded-md uppercase shrink-0">{prov.categoria}</span>
                      <span className="text-[10px] md:text-xs font-mono text-slate-400 truncate">{prov.rut_empresa}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 md:gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-none pt-4 md:pt-0">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pago</span>
                    <span className="text-xs font-black text-slate-600">{prov.condiciones_pago || 'No def.'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setExpandedCard(expandedCard === prov.id ? null : prov.id)}
                      className="flex items-center gap-2 px-3 md:px-4 py-2 bg-slate-50 text-slate-500 rounded-xl text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-all"
                    >
                      {expandedCard === prov.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      <span className="hidden xs:inline">{expandedCard === prov.id ? 'Cerrar' : 'Ver Todo'}</span>
                    </button>
                    <button onClick={() => setSeleccionado(prov)} className="p-2 text-slate-300 hover:text-blue-600 transition-all"><Edit3 size={18} /></button>
                    <button onClick={() => eliminarProveedor(prov.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={18} /></button>
                  </div>
                </div>
              </div>

              {/* VISTA DETALLADA */}
              {expandedCard === prov.id && (
                <div className="p-6 md:p-8 bg-slate-50/50 border-t border-slate-50 animate-in slide-in-from-top-4 duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="space-y-4">
                      <h4 className="flex items-center gap-2 text-[11px] font-black text-blue-600 uppercase tracking-widest"><Mail size={14}/> Contacto Directo</h4>
                      <div className="bg-white p-4 rounded-2xl space-y-3 shadow-sm">
                        <p className="text-sm font-bold text-slate-700">{prov.nombre_contacto || 'No registrado'}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-2"><Phone size={12}/> {prov.telefono || 'Sin fono'}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-2"><Mail size={12}/> {prov.email_contacto || 'Sin email'}</p>
                        {prov.sitio_web && <p className="text-xs text-blue-500 truncate"><Globe size={12} className="inline mr-2"/>{prov.sitio_web}</p>}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="flex items-center gap-2 text-[11px] font-black text-blue-600 uppercase tracking-widest"><Map size={14}/> Localización</h4>
                      <div className="bg-white p-4 rounded-2xl space-y-3 shadow-sm text-xs text-slate-600 font-medium">
                        <p>{prov.direccion || 'Sin dirección'}</p>
                        <p className="font-bold">{prov.comuna}, {prov.ciudad}</p>
                        <div className="pt-2 flex gap-1">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={14} className={prov.calificacion >= s ? "fill-amber-400 text-amber-400" : "text-slate-100"} />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 sm:col-span-2 lg:col-span-1">
                      <h4 className="flex items-center gap-2 text-[11px] font-black text-blue-600 uppercase tracking-widest"><DollarSign size={14}/> Datos de Pago</h4>
                      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                          <span className="text-[10px] text-slate-400 uppercase">Banco</span>
                          <span className="text-xs font-bold">{prov.banco_nombre || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                          <span className="text-[10px] text-slate-400 uppercase">Cuenta</span>
                          <span className="text-xs font-bold">{prov.cuenta_tipo}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-400 uppercase">Número</span>
                          <span className="text-xs font-mono font-bold tracking-widest">{prov.cuenta_numero || '****'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {prov.observaciones && (
                    <div className="mt-8 p-4 bg-white rounded-2xl border border-slate-100 text-xs italic text-slate-500">
                      <strong>Nota:</strong> {prov.observaciones}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={48} /></div>
        )}
      </div>

      {/* MODAL DE EDICIÓN */}
      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-2 md:p-4">
          <div className="w-full max-w-3xl bg-white rounded-[2rem] md:rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 md:p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-800">EDITAR PROVEEDOR</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sincronización con Base de Datos</p>
              </div>
              <button onClick={() => setSeleccionado(null)} className="p-2 md:p-3 bg-white shadow-sm rounded-2xl text-slate-400"><X /></button>
            </div>

            <div className="p-6 md:p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-100 rounded-2xl">
                  <label className="text-[9px] font-black uppercase text-blue-600 block mb-1">Nombre Empresa</label>
                  <input className="w-full bg-transparent font-bold outline-none" value={seleccionado.nombre_empresa} onChange={e => setSeleccionado({...seleccionado, nombre_empresa: e.target.value})} />
                </div>
                <div className="p-4 bg-slate-100 rounded-2xl">
                  <label className="text-[9px] font-black uppercase text-blue-600 block mb-1">RUT Empresa</label>
                  <input className="w-full bg-transparent font-bold outline-none" value={seleccionado.rut_empresa} onChange={e => setSeleccionado({...seleccionado, rut_empresa: e.target.value})} />
                </div>
                <div className="p-4 bg-slate-100 rounded-2xl">
                  <label className="text-[9px] font-black uppercase text-blue-600 block mb-1">Categoría</label>
                  <input className="w-full bg-transparent font-bold outline-none" value={seleccionado.categoria} onChange={e => setSeleccionado({...seleccionado, categoria: e.target.value})} />
                </div>
                <div className="p-4 bg-slate-100 rounded-2xl">
                  <label className="text-[9px] font-black uppercase text-blue-600 block mb-1">Servicio</label>
                  <input className="w-full bg-transparent font-bold outline-none" value={seleccionado.tipo_servicio} onChange={e => setSeleccionado({...seleccionado, tipo_servicio: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-100 rounded-2xl">
                  <label className="text-[9px] font-black uppercase text-blue-600 block mb-1">Nombre Contacto</label>
                  <input className="w-full bg-transparent font-bold outline-none" value={seleccionado.nombre_contacto} onChange={e => setSeleccionado({...seleccionado, nombre_contacto: e.target.value})} />
                </div>
                <div className="p-4 bg-slate-100 rounded-2xl">
                  <label className="text-[9px] font-black uppercase text-blue-600 block mb-1">Teléfono</label>
                  <input className="w-full bg-transparent font-bold outline-none" value={seleccionado.telefono} onChange={e => setSeleccionado({...seleccionado, telefono: e.target.value})} />
                </div>
                <div className="p-4 bg-slate-100 rounded-2xl col-span-1 md:col-span-2">
                  <label className="text-[9px] font-black uppercase text-blue-600 block mb-1">Dirección Completa</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input className="flex-[2] bg-white/50 rounded-lg p-2 text-xs outline-none" value={seleccionado.direccion} onChange={e => setSeleccionado({...seleccionado, direccion: e.target.value})} />
                    <input className="flex-1 bg-white/50 rounded-lg p-2 text-xs outline-none" value={seleccionado.comuna} placeholder="Comuna" onChange={e => setSeleccionado({...seleccionado, comuna: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-900 rounded-[2rem] text-white">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Información de Transferencia</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[8px] uppercase text-slate-500 block mb-1">Banco</label>
                    <input className="w-full bg-slate-800 rounded-lg p-2 text-xs font-bold outline-none" value={seleccionado.banco_nombre} onChange={e => setSeleccionado({...seleccionado, banco_nombre: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[8px] uppercase text-slate-500 block mb-1">Tipo Cuenta</label>
                    <input className="w-full bg-slate-800 rounded-lg p-2 text-xs font-bold outline-none" value={seleccionado.cuenta_tipo} onChange={e => setSeleccionado({...seleccionado, cuenta_tipo: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[8px] uppercase text-slate-500 block mb-1">N° Cuenta</label>
                    <input className="w-full bg-slate-800 rounded-lg p-2 text-xs font-bold outline-none" value={seleccionado.cuenta_numero} onChange={e => setSeleccionado({...seleccionado, cuenta_numero: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={async () => {
                    const { error } = await supabase.from('proveedores').update(seleccionado).eq('id', seleccionado.id);
                    if (!error) { showAlert("Proveedor actualizado en DB", "success"); cargarProveedores(); setSeleccionado(null); }
                    else { showAlert(error.message, 'error'); }
                  }}
                  className="flex-1 bg-blue-600 text-white py-4 md:py-5 rounded-2xl md:rounded-[2rem] font-black flex items-center justify-center gap-2 hover:bg-slate-900 transition-all shadow-xl shadow-blue-100"
                >
                  <Save size={20} /> GUARDAR CAMBIOS
                </button>
                <button 
                  onClick={() => eliminarProveedor(seleccionado.id)}
                  className="py-4 md:py-0 px-8 bg-rose-50 text-rose-500 rounded-2xl md:rounded-[2rem] hover:bg-rose-500 hover:text-white transition-all flex justify-center items-center"
                >
                  <Trash2 size={24} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        @media (max-width: 400px) {
          .xs\:inline { display: inline; }
        }
      `}</style>
    </div>
  );
}