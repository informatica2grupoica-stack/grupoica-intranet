'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2, AlertCircle, Check, Mail, Phone, MapPin, Building, Users, MapPinned, RefreshCcw } from 'lucide-react';
import Link from 'next/link';

interface ClienteForm {
  razon_social: string;
  rut: string;
  email: string;
  telefono: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  es_extranjero: boolean;
  extranjero_id: string;
  estado: boolean;
}

interface Contacto {
  cc_id: string;
  cc_nombres: string;
  cc_apellidos: string;
  cc_email: string;
  cc_telefono_movil: string;
  cc_cargo: string;
}

interface Direccion {
  cd_id: string;
  cd_direccion: string;
  cd_comuna: string;
  cd_ciudad: string;
  cd_tipo: string;
}

export default function EditarClientePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  
  const [loading, setLoading] = useState(false);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [mostrarContactos, setMostrarContactos] = useState(false);
  const [mostrarDirecciones, setMostrarDirecciones] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [form, setForm] = useState<ClienteForm>({
    razon_social: '',
    rut: '',
    email: '',
    telefono: '',
    direccion: '',
    comuna: '',
    ciudad: '',
    es_extranjero: false,
    extranjero_id: '',
    estado: true
  });

  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);

  // Función para cargar cliente
  const cargarCliente = useCallback(async (forceRefresh = false) => {
    if (!id) return;
    
    setCargandoDatos(true);
    setStatus(null);
    
    try {
      const refreshParam = forceRefresh ? '?refresh=true' : '';
      console.log(`📡 Cargando cliente ID: ${id}`);
      const res = await fetch(`/api/obuma/clientes/${id}${refreshParam}`);
      const data = await res.json();
      console.log("📦 Datos recibidos:", data);
      
      if (data.success && data.cliente) {
        const c = data.cliente;
        setForm({
          razon_social: c.razon_social || '',
          rut: c.rut || '',
          email: c.email || '',
          telefono: c.telefono || '',
          direccion: c.direccion || '',
          comuna: c.comuna || '',
          ciudad: c.ciudad || '',
          es_extranjero: c.es_extranjero || false,
          extranjero_id: c.extranjero_id || '',
          estado: c.estado !== false
        });
        setContactos(c.contactos || []);
        setDirecciones(c.direcciones || []);
        console.log(`✅ Cliente cargado: ${c.razon_social}`);
      } else {
        setStatus({ type: 'error', msg: data.error || 'Cliente no encontrado' });
      }
    } catch (error) {
      console.error("Error cargando cliente:", error);
      setStatus({ type: 'error', msg: 'Error de conexión al cargar el cliente' });
    } finally {
      setCargandoDatos(false);
      setRefreshing(false);
    }
  }, [id]);

  // Cargar datos del cliente al montar el componente
  useEffect(() => {
    cargarCliente();
  }, [cargarCliente]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.razon_social) {
      setStatus({ type: 'error', msg: 'La razón social es requerida' });
      return;
    }
    
    if (!form.email) {
      setStatus({ type: 'error', msg: 'El email es requerido' });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch(`/api/obuma/clientes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', msg: '¡Cliente actualizado exitosamente!' });
        // Recargar datos para mostrar cambios
        setTimeout(() => {
          cargarCliente();
        }, 500);
        // Redirigir después de 2 segundos
        setTimeout(() => {
          router.push('/obuma-clientes');
        }, 2000);
      } else {
        setStatus({ type: 'error', msg: data.error || 'Error al actualizar cliente' });
      }
    } catch (error) {
      console.error("Error actualizando:", error);
      setStatus({ type: 'error', msg: 'Error de conexión al actualizar' });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await cargarCliente(true);
  };

  if (cargandoDatos) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-[#00338d] mx-auto mb-4" size={48} />
          <p className="text-slate-500 text-sm">Cargando datos del cliente...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-6 lg:p-12">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter italic uppercase">Editar Cliente</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
              {form.razon_social || 'Sin nombre'} • ID: {id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-[#00338d] transition-all shadow-sm disabled:opacity-50"
              title="Recargar datos"
            >
              {refreshing ? <Loader2 size={20} className="animate-spin" /> : <RefreshCcw size={20} />}
            </button>
            <Link 
              href="/obuma-clientes" 
              className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-[#00338d] transition-all shadow-sm"
            >
              <ArrowLeft size={20} />
            </Link>
          </div>
        </div>

        {/* Mensaje de estado */}
        {status && (
          <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-sm font-black uppercase italic ${
            status.type === 'success' 
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
              : 'bg-rose-50 text-rose-600 border border-rose-100'
          }`}>
            <div className="flex items-center gap-3">
              {status.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
              {status.msg}
            </div>
            {status.type === 'success' && (
              <Link href="/obuma-clientes" className="text-[10px] underline">
                Volver al listado
              </Link>
            )}
          </div>
        )}

        {/* Información adicional */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMostrarContactos(!mostrarContactos)}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left hover:border-blue-200 transition-all group"
          >
            <Users size={18} className="text-blue-500 mb-1 group-hover:scale-110 transition-transform" />
            <div className="text-xl md:text-2xl font-black text-slate-800">{contactos.length}</div>
            <p className="text-[8px] md:text-[9px] text-slate-400 uppercase font-bold">Contactos</p>
          </button>
          <button
            onClick={() => setMostrarDirecciones(!mostrarDirecciones)}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left hover:border-purple-200 transition-all group"
          >
            <MapPinned size={18} className="text-purple-500 mb-1 group-hover:scale-110 transition-transform" />
            <div className="text-xl md:text-2xl font-black text-slate-800">{direcciones.length}</div>
            <p className="text-[8px] md:text-[9px] text-slate-400 uppercase font-bold">Direcciones</p>
          </button>
        </div>

        {/* Modal de contactos */}
        {mostrarContactos && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMostrarContactos(false)}>
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white p-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Contactos del Cliente</h3>
                <button onClick={() => setMostrarContactos(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="p-4 space-y-3">
                {contactos.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No hay contactos registrados</p>
                ) : (
                  contactos.map((c) => (
                    <div key={c.cc_id} className="p-3 bg-slate-50 rounded-xl">
                      <p className="font-bold text-slate-700">{c.cc_nombres} {c.cc_apellidos}</p>
                      <p className="text-xs text-slate-500 mt-1">{c.cc_cargo}</p>
                      <p className="text-xs text-blue-600 mt-1 break-all">{c.cc_email}</p>
                      <p className="text-xs text-slate-500">{c.cc_telefono_movil}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de direcciones */}
        {mostrarDirecciones && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMostrarDirecciones(false)}>
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white p-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Direcciones del Cliente</h3>
                <button onClick={() => setMostrarDirecciones(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="p-4 space-y-3">
                {direcciones.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No hay direcciones registradas</p>
                ) : (
                  direcciones.map((d) => (
                    <div key={d.cd_id} className="p-3 bg-slate-50 rounded-xl">
                      <p className="font-bold text-slate-700 break-words">{d.cd_direccion}</p>
                      <p className="text-xs text-slate-500 mt-1">{d.cd_comuna}, {d.cd_ciudad}</p>
                      <span className="inline-block mt-1 text-[9px] font-black bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                        {d.cd_tipo === 'facturacion' ? 'Facturación' : 'Despacho'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Formulario de edición */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl md:rounded-[2.5rem] p-6 md:p-8 shadow-xl border border-slate-200 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                <Building size={12} className="inline mr-1" /> Razón Social *
              </label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                value={form.razon_social}
                onChange={(e) => setForm({...form, razon_social: e.target.value})}
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                {form.es_extranjero ? 'ID Extranjero' : 'RUT'}
              </label>
              <input
                type="text"
                className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 outline-none cursor-not-allowed"
                value={form.es_extranjero ? form.extranjero_id : form.rut}
                disabled
              />
              <p className="text-[8px] text-slate-400 mt-1">El RUT no se puede modificar</p>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                <Mail size={12} className="inline mr-1" /> Email *
              </label>
              <input
                type="email"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                value={form.email}
                onChange={(e) => setForm({...form, email: e.target.value})}
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                <Phone size={12} className="inline mr-1" /> Teléfono
              </label>
              <input
                type="tel"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                value={form.telefono}
                onChange={(e) => setForm({...form, telefono: e.target.value})}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                <MapPin size={12} className="inline mr-1" /> Dirección
              </label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                value={form.direccion}
                onChange={(e) => setForm({...form, direccion: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Comuna</label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                value={form.comuna}
                onChange={(e) => setForm({...form, comuna: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Ciudad</label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                value={form.ciudad}
                onChange={(e) => setForm({...form, ciudad: e.target.value})}
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.estado}
                  onChange={(e) => setForm({...form, estado: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300 text-[#00338d] focus:ring-[#00338d]"
                />
                <span className="text-xs font-bold text-slate-600">Cliente activo</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
            <Link 
              href="/obuma-clientes" 
              className="px-6 py-3 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-slate-100 transition-all"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-8 py-3 bg-[#00338d] text-white rounded-xl text-xs font-black uppercase shadow-lg hover:bg-blue-800 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}