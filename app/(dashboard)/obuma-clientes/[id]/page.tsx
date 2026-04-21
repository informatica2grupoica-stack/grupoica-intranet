'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2, AlertCircle, Check, Mail, Phone, MapPin, Building, User, Globe, Users, MapPinned } from 'lucide-react';
import Link from 'next/link';

export default function EditarClientePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  
  const [loading, setLoading] = useState(false);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [mostrarContactos, setMostrarContactos] = useState(false);
  const [mostrarDirecciones, setMostrarDirecciones] = useState(false);
  
  const [form, setForm] = useState({
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

  const [contactos, setContactos] = useState<any[]>([]);
  const [direcciones, setDirecciones] = useState<any[]>([]);

  // Cargar datos del cliente
  useEffect(() => {
    const cargarCliente = async () => {
      if (!id) return;
      
      try {
        const res = await fetch(`/api/obuma/clientes/${id}`);
        const data = await res.json();
        
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
        }
      } catch (error) {
        console.error("Error cargando cliente:", error);
        setStatus({ type: 'error', msg: 'Error al cargar el cliente' });
      } finally {
        setCargandoDatos(false);
      }
    };
    
    cargarCliente();
  }, [id]);

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
        setTimeout(() => {
          router.push('/obuma-clientes');
        }, 1500);
      } else {
        setStatus({ type: 'error', msg: data.error || 'Error al actualizar cliente' });
      }
    } catch (error) {
      setStatus({ type: 'error', msg: 'Error de conexión' });
    } finally {
      setLoading(false);
    }
  };

  if (cargandoDatos) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#00338d]" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-12">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter italic uppercase">Editar Cliente</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">{form.razon_social}</p>
          </div>
          <Link href="/obuma-clientes" className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-[#00338d] transition-all shadow-sm">
            <ArrowLeft size={20} />
          </Link>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMostrarContactos(!mostrarContactos)}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left hover:border-blue-200 transition-all"
          >
            <Users size={18} className="text-blue-500 mb-1" />
            <div className="text-xl font-black text-slate-800">{contactos.length}</div>
            <p className="text-[9px] text-slate-400 uppercase font-bold">Contactos</p>
          </button>
          <button
            onClick={() => setMostrarDirecciones(!mostrarDirecciones)}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left hover:border-blue-200 transition-all"
          >
            <MapPinned size={18} className="text-purple-500 mb-1" />
            <div className="text-xl font-black text-slate-800">{direcciones.length}</div>
            <p className="text-[9px] text-slate-400 uppercase font-bold">Direcciones</p>
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-200 space-y-6">
          
          {status && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black uppercase italic ${
              status.type === 'success' 
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                : 'bg-rose-50 text-rose-600 border border-rose-100'
            }`}>
              {status.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
              {status.msg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                <Building size={12} className="inline mr-1" /> Razón Social *
              </label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
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
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                value={form.es_extranjero ? form.extranjero_id : form.rut}
                disabled
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                <Mail size={12} className="inline mr-1" /> Email *
              </label>
              <input
                type="email"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
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
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
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
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
                value={form.direccion}
                onChange={(e) => setForm({...form, direccion: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Comuna</label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
                value={form.comuna}
                onChange={(e) => setForm({...form, comuna: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Ciudad</label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
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
                  className="w-4 h-4 rounded border-slate-300 text-[#00338d]"
                />
                <span className="text-xs font-bold text-slate-600">Cliente activo</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
            <Link href="/obuma-clientes" className="px-6 py-3 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-slate-100 transition-all">
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