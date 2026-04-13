'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, Search, Loader2, MapPin, X, Phone, Star, 
  Trash2, Edit3, Save, Plus, CheckCircle2, AlertCircle,
  Landmark, CreditCard, Mail, Globe, Info, Calendar
} from 'lucide-react';

export default function SeccionProveedores() {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
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

  const filtrados = proveedores.filter(p => 
    p.nombre_empresa?.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.categoria?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.rut_empresa?.includes(busqueda)
  );

  return (
    <div className="min-h-screen bg-[#FDFDFD] p-4 lg:p-10 text-slate-900 font-sans">
      
      {/* ALERTAS */}
      {alert && (
        <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in fade-in zoom-in duration-300 ${alert.type === 'success' ? 'bg-white border-emerald-100 text-emerald-600' : 'bg-white border-rose-100 text-rose-600'}`}>
          {alert.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-bold">{alert.msg}</span>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 p-3 rounded-2xl text-white">
              <Building2 size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-800 uppercase">Directorio Central</h1>
              <p className="text-slate-400 font-medium">Panel de Suministros y Proveedores</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar RUT, Empresa o Categoría..." 
                className="w-full bg-slate-100 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-100 transition-all outline-none"
              />
            </div>
            <button 
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 text-white p-4 rounded-2xl hover:bg-slate-900 transition-all shadow-xl shadow-blue-100"
            >
              {showForm ? <X size={24} /> : <Plus size={24} />}
            </button>
          </div>
        </div>

        {/* FORMULARIO DE INGRESO COMPLETO (BASE DE DATOS TOTAL) */}
        {showForm && (
          <form onSubmit={guardarProveedor} className="mb-12 bg-white border border-slate-100 p-8 rounded-[3rem] shadow-2xl animate-in slide-in-from-top duration-500 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
            <h2 className="text-xl font-black mb-8 text-slate-800 flex items-center gap-2">
              <Plus className="text-blue-600" /> REGISTRAR NUEVA FICHA TÉCNICA
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* Bloque Identificación */}
              <div className="md:col-span-2 space-y-4">
                <p className="text-[10px] font-black text-blue-600 tracking-[0.2em] uppercase">Identificación Principal</p>
                <input required placeholder="Razón Social / Nombre Fantasía" value={nuevo.nombre_empresa} onChange={e => setNuevo({...nuevo, nombre_empresa: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none border border-transparent focus:border-blue-200" />
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="RUT Empresa" value={nuevo.rut_empresa} onChange={e => setNuevo({...nuevo, rut_empresa: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                  <input required placeholder="Categoría (Ej: Construcción)" value={nuevo.categoria} onChange={e => setNuevo({...nuevo, categoria: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                </div>
              </div>

              {/* Bloque Contacto */}
              <div className="md:col-span-2 space-y-4">
                <p className="text-[10px] font-black text-blue-600 tracking-[0.2em] uppercase">Canales de Contacto</p>
                <input placeholder="Nombre de Contacto" value={nuevo.nombre_contacto} onChange={e => setNuevo({...nuevo, nombre_contacto: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Teléfono" value={nuevo.telefono} onChange={e => setNuevo({...nuevo, telefono: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                  <input placeholder="Email Corporativo" value={nuevo.email_contacto} onChange={e => setNuevo({...nuevo, email_contacto: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                </div>
              </div>

              {/* Bloque Localización */}
              <div className="md:col-span-2 space-y-4">
                <p className="text-[10px] font-black text-blue-600 tracking-[0.2em] uppercase">Ubicación</p>
                <input placeholder="Dirección" value={nuevo.direccion} onChange={e => setNuevo({...nuevo, direccion: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-4">
                  <input placeholder="Comuna" value={nuevo.comuna} onChange={e => setNuevo({...nuevo, comuna: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                  <input placeholder="Sitio Web" value={nuevo.sitio_web} onChange={e => setNuevo({...nuevo, sitio_web: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                </div>
              </div>

              {/* Bloque Financiero */}
              <div className="md:col-span-2 space-y-4">
                <p className="text-[10px] font-black text-blue-600 tracking-[0.2em] uppercase">Datos Bancarios y Pago</p>
                <div className="grid grid-cols-2 gap-4">
                  <select value={nuevo.condiciones_pago} onChange={e => setNuevo({...nuevo, condiciones_pago: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none">
                    <option value="Contado">Contado</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="30 días">30 días</option>
                    <option value="60 días">60 días</option>
                  </select>
                  <input placeholder="Banco" value={nuevo.banco_nombre} onChange={e => setNuevo({...nuevo, banco_nombre: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <select value={nuevo.cuenta_tipo} onChange={e => setNuevo({...nuevo, cuenta_tipo: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none">
                    <option value="Corriente">Corriente</option>
                    <option value="Vista / RUT">Vista / RUT</option>
                  </select>
                  <input placeholder="Número de Cuenta" value={nuevo.cuenta_numero} onChange={e => setNuevo({...nuevo, cuenta_numero: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm outline-none" />
                </div>
              </div>
            </div>

            <textarea placeholder="Observaciones adicionales, notas de crédito o detalles operativos..." value={nuevo.observaciones} onChange={e => setNuevo({...nuevo, observaciones: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm outline-none h-24 mb-6 resize-none" />

            <div className="flex justify-end gap-4">
              <button type="button" onClick={() => setShowForm(false)} className="px-8 py-3 text-sm font-bold text-slate-400 hover:text-slate-800 transition-all">Descartar</button>
              <button type="submit" className="bg-slate-900 text-white px-12 py-3 rounded-2xl text-sm font-black shadow-lg hover:bg-blue-600 transition-all">FINALIZAR REGISTRO</button>
            </div>
          </form>
        )}

        {/* LISTADO DE TARJETAS (INFO TOTAL) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filtrados.map((prov) => (
            <div 
              key={prov.id}
              className="group bg-white border border-slate-100 p-8 rounded-[3rem] hover:shadow-2xl transition-all duration-500 relative overflow-hidden"
            >
              {/* Header Tarjeta */}
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{prov.categoria}</span>
                    <span className="text-slate-300 text-[10px] font-bold">ID: {prov.id.split('-')[0]}</span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 leading-tight">{prov.nombre_empresa}</h3>
                  <p className="text-slate-400 font-mono text-xs">{prov.rut_empresa}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setSeleccionado(prov)} className="p-3 bg-slate-50 text-slate-400 hover:bg-blue-600 hover:text-white rounded-2xl transition-all"><Edit3 size={18} /></button>
                  <button onClick={() => eliminarProveedor(prov.id)} className="p-3 bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white rounded-2xl transition-all"><Trash2 size={18} /></button>
                </div>
              </div>

              {/* Cuerpo Tarjeta - Info Total */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Phone size={14} className="text-blue-500" /> <span className="text-xs font-bold">{prov.telefono || 'Sin fono'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <Mail size={14} className="text-blue-500" /> <span className="text-xs font-bold truncate">{prov.email_contacto || 'Sin email'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <MapPin size={14} className="text-blue-500" /> <span className="text-xs font-bold">{prov.comuna || 'Sin ubicación'}</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-[2rem] space-y-2">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Info de Pago</p>
                  <p className="text-xs font-black text-slate-700">{prov.condiciones_pago}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                    <Landmark size={12} /> {prov.banco_nombre || 'S/B'}
                  </div>
                </div>
              </div>

              {/* Observaciones en Tarjeta */}
              {prov.observaciones && (
                <div className="mb-6 p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                  <p className="text-[10px] text-amber-700 italic font-medium leading-relaxed">"{prov.observaciones}"</p>
                </div>
              )}

              {/* Footer Tarjeta */}
              <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <Star 
                      key={s} 
                      size={14} 
                      className={`${prov.calificacion >= s ? "fill-amber-400 text-amber-400" : "text-slate-100 hover:text-amber-200"} cursor-pointer transition-colors`}
                      onClick={() => actualizarCampoRapido(prov.id, 'calificacion', s)}
                    />
                  ))}
                </div>
                <button onClick={() => setSeleccionado(prov)} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:mr-2 transition-all">Ver Ficha →</button>
              </div>
            </div>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={48} /></div>
        )}
      </div>

      {/* MODAL DE EDICIÓN (FONDO GRIS EN CAMPOS PARA CONTRASTE) */}
      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl bg-white rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-2xl font-black text-slate-800">EDITAR EXPEDIENTE</h2>
              <button onClick={() => setSeleccionado(null)} className="p-3 bg-white shadow-sm rounded-2xl text-slate-400"><X /></button>
            </div>

            <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-100 rounded-2xl">
                  <label className="text-[9px] font-black uppercase text-blue-600 mb-1 block">Razón Social</label>
                  <input className="w-full bg-transparent font-bold outline-none text-slate-800" value={seleccionado.nombre_empresa} onChange={e => setSeleccionado({...seleccionado, nombre_empresa: e.target.value})} />
                </div>
                <div className="p-4 bg-slate-100 rounded-2xl">
                  <label className="text-[9px] font-black uppercase text-blue-600 mb-1 block">RUT Empresa</label>
                  <input className="w-full bg-transparent font-bold outline-none text-slate-800" value={seleccionado.rut_empresa} onChange={e => setSeleccionado({...seleccionado, rut_empresa: e.target.value})} />
                </div>
                <div className="p-4 bg-slate-100 rounded-2xl">
                  <label className="text-[9px] font-black uppercase text-blue-600 mb-1 block">Email Contacto</label>
                  <input className="w-full bg-transparent font-bold outline-none text-slate-800" value={seleccionado.email_contacto} onChange={e => setSeleccionado({...seleccionado, email_contacto: e.target.value})} />
                </div>
                <div className="p-4 bg-slate-100 rounded-2xl">
                  <label className="text-[9px] font-black uppercase text-blue-600 mb-1 block">Teléfono</label>
                  <input className="w-full bg-transparent font-bold outline-none text-slate-800" value={seleccionado.telefono} onChange={e => setSeleccionado({...seleccionado, telefono: e.target.value})} />
                </div>
                <div className="p-4 bg-slate-100 rounded-2xl col-span-2">
                  <label className="text-[9px] font-black uppercase text-blue-600 mb-1 block">Datos Bancarios (Banco - Tipo - Número)</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <input className="bg-white/50 rounded-lg p-1 text-xs outline-none" value={seleccionado.banco_nombre} onChange={e => setSeleccionado({...seleccionado, banco_nombre: e.target.value})} />
                    <input className="bg-white/50 rounded-lg p-1 text-xs outline-none" value={seleccionado.cuenta_tipo} onChange={e => setSeleccionado({...seleccionado, cuenta_tipo: e.target.value})} />
                    <input className="bg-white/50 rounded-lg p-1 text-xs outline-none" value={seleccionado.cuenta_numero} onChange={e => setSeleccionado({...seleccionado, cuenta_numero: e.target.value})} />
                  </div>
                </div>
                <div className="p-4 bg-slate-100 rounded-2xl col-span-2">
                  <label className="text-[9px] font-black uppercase text-blue-600 mb-1 block">Notas Internas</label>
                  <textarea className="w-full bg-transparent font-medium outline-none text-slate-800 h-20 resize-none" value={seleccionado.observaciones} onChange={e => setNuevo({...seleccionado, observaciones: e.target.value})} />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={async () => {
                    const { error } = await supabase.from('proveedores').update(seleccionado).eq('id', seleccionado.id);
                    if (!error) { showAlert("Expediente Actualizado", "success"); cargarProveedores(); setSeleccionado(null); }
                  }}
                  className="flex-1 bg-slate-900 text-white py-5 rounded-[2rem] font-black flex items-center justify-center gap-2 hover:bg-blue-600 transition-all"
                >
                  <Save size={20} /> ACTUALIZAR DATOS
                </button>
                <button 
                  onClick={() => eliminarProveedor(seleccionado.id)}
                  className="px-8 bg-rose-50 text-rose-500 rounded-[2rem] hover:bg-rose-500 hover:text-white transition-all"
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
      `}</style>
    </div>
  );
}