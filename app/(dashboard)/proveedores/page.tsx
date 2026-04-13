'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, Search, Loader2, MapPin, X, Phone, Star, 
  Trash2, Edit3, Save, Plus, ChevronDown, CheckCircle2, AlertCircle
} from 'lucide-react';

export default function SeccionProveedores() {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<any | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [alert, setAlert] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const [nuevo, setNuevo] = useState({
    nombre_empresa: '', rut_empresa: '', categoria: '', tipo_servicio: '',
    nombre_contacto: '', email_contacto: '', telefono: '', sitio_web: '',
    direccion: '', comuna: '', ciudad: '', condiciones_pago: 'Contado',
    banco_nombre: '', cuenta_tipo: 'Corriente', cuenta_numero: '', 
    observaciones: '', calificacion: 5, activo: true
  });

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
      setNuevo({ ...nuevo, nombre_empresa: '', rut_empresa: '', categoria: '' }); // Reset básico
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
      cargarProveedores();
    }
  };

  const actualizarCampoRapido = async (id: string, campo: string, valor: any) => {
    const { error } = await supabase.from('proveedores').update({ [campo]: valor }).eq('id', id);
    if (!error) cargarProveedores();
  };

  const filtrados = proveedores.filter(p => 
    p.nombre_empresa?.toLowerCase().includes(busqueda.toLowerCase()) || 
    p.categoria?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FDFDFD] p-6 lg:p-12 text-slate-900">
      
      {/* ALERTAS FLOTANTES */}
      {alert && (
        <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in fade-in zoom-in duration-300 ${alert.type === 'success' ? 'bg-white border-emerald-100 text-emerald-600' : 'bg-white border-rose-100 text-rose-600'}`}>
          {alert.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-bold">{alert.msg}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        
        {/* HEADER MINIMALISTA */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-light tracking-tight text-slate-800">Proveedores</h1>
            <p className="text-slate-400 font-medium">Gestión de base de datos industrial</p>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Filtrar por nombre..." 
                className="w-full bg-slate-100/50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-100 transition-all outline-none"
              />
            </div>
            <button 
              onClick={() => setShowForm(!showForm)}
              className="bg-slate-900 text-white p-3 rounded-2xl hover:bg-blue-600 transition-all shadow-lg"
            >
              {showForm ? <X size={24} /> : <Plus size={24} />}
            </button>
          </div>
        </div>

        {/* FORMULARIO GHOST (Se despliega suavemente) */}
        {showForm && (
          <form onSubmit={guardarProveedor} className="mb-12 bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm animate-in slide-in-from-top duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Razón Social</label>
                <input required value={nuevo.nombre_empresa} onChange={e => setNuevo({...nuevo, nombre_empresa: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">RUT</label>
                <input value={nuevo.rut_empresa} onChange={e => setNuevo({...nuevo, rut_empresa: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Categoría</label>
                <input required value={nuevo.categoria} onChange={e => setNuevo({...nuevo, categoria: e.target.value})} className="w-full bg-slate-50 border-none rounded-xl p-3 text-sm outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 text-sm font-bold text-slate-400">Cancelar</button>
              <button type="submit" className="bg-blue-600 text-white px-8 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 transition-all">Guardar Proveedor</button>
            </div>
          </form>
        )}

        {/* GRID DE TARJETAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtrados.map((prov) => (
            <div 
              key={prov.id}
              className="group bg-white border border-slate-100 p-6 rounded-[2rem] hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 relative flex flex-col justify-between min-h-[220px]"
            >
              {/* ACCIONES RÁPIDAS (Top Right) */}
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setSeleccionado(prov)}
                  className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-all"
                >
                  <Edit3 size={16} />
                </button>
                <button 
                  onClick={() => eliminarProveedor(prov.id)}
                  className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">{prov.categoria || 'S/C'}</span>
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 mb-1 leading-tight">{prov.nombre_empresa}</h3>
                <p className="text-slate-400 text-xs font-mono mb-4">{prov.rut_empresa}</p>
                
                <div className="flex items-center gap-3 text-slate-500 mb-6">
                  <div className="flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-full text-[11px] font-bold">
                    <MapPin size={12} className="text-blue-500" /> {prov.comuna || 'Chile'}
                  </div>
                  {prov.telefono && (
                    <div className="flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-full text-[11px] font-bold">
                      <Phone size={12} className="text-emerald-500" /> {prov.telefono}
                    </div>
                  )}
                </div>
              </div>

              {/* FOOTER DE TARJETA: Rating rápido */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <Star 
                      key={s} 
                      size={12} 
                      className={`${prov.calificacion >= s ? "fill-amber-400 text-amber-400" : "text-slate-100 hover:text-amber-200"} cursor-pointer transition-colors`}
                      onClick={() => actualizarCampoRapido(prov.id, 'calificacion', s)}
                    />
                  ))}
                </div>
                <button 
                  onClick={() => setSeleccionado(prov)}
                  className="text-[10px] font-black uppercase text-blue-600 hover:tracking-widest transition-all"
                >
                  Ver Ficha Completa →
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-blue-600" size={40} />
          </div>
        )}
      </div>

      {/* --- MODAL DE EDICIÓN / DETALLE (RE-ESTILIZADO) --- */}
      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-md p-4">
          <div className="w-full max-w-lg bg-white rounded-[3rem] shadow-2xl p-8 animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Editar Proveedor</h2>
              <button onClick={() => setSeleccionado(null)} className="p-2 hover:bg-slate-100 rounded-full transition-all"><X /></button>
            </div>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <label className="text-[9px] font-black uppercase text-blue-600">Nombre Empresa</label>
                  <input className="w-full bg-transparent font-bold outline-none mt-1" value={seleccionado.nombre_empresa} onChange={e => setSeleccionado({...seleccionado, nombre_empresa: e.target.value})} />
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <label className="text-[9px] font-black uppercase text-blue-600">Contacto Directo</label>
                  <input className="w-full bg-transparent font-bold outline-none mt-1" value={seleccionado.nombre_contacto} onChange={e => setSeleccionado({...seleccionado, nombre_contacto: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <label className="text-[9px] font-black uppercase text-blue-600">Email</label>
                    <input className="w-full bg-transparent font-bold outline-none mt-1" value={seleccionado.email_contacto} onChange={e => setSeleccionado({...seleccionado, email_contacto: e.target.value})} />
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <label className="text-[9px] font-black uppercase text-blue-600">Teléfono</label>
                    <input className="w-full bg-transparent font-bold outline-none mt-1" value={seleccionado.telefono} onChange={e => setSeleccionado({...seleccionado, telefono: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* BOTONES DE ACCIÓN EN MODAL */}
              <div className="pt-6 flex gap-3">
                <button 
                  onClick={async () => {
                    const { error } = await supabase.from('proveedores').update(seleccionado).eq('id', seleccionado.id);
                    if (!error) { showAlert("Actualizado", "success"); cargarProveedores(); setSeleccionado(null); }
                  }}
                  className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
                >
                  <Save size={18} /> Guardar Cambios
                </button>
                <button 
                  onClick={() => eliminarProveedor(seleccionado.id)}
                  className="px-6 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
      `}</style>
    </div>
  );
}