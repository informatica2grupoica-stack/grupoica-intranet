'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, AlertCircle, Check, Mail, Phone, MapPin, Building, User, Globe } from 'lucide-react';
import Link from 'next/link';

export default function NuevoClientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  const [form, setForm] = useState({
    razon_social: '',
    rut: '',
    email: '',
    telefono: '',
    direccion: '',
    comuna: '',
    ciudad: '',
    es_extranjero: false,
    extranjero_id: ''
  });

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
    
    if (!form.es_extranjero && !form.rut) {
      setStatus({ type: 'error', msg: 'El RUT es requerido' });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/obuma/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', msg: '¡Cliente creado exitosamente!' });
        setTimeout(() => {
          router.push('/obuma-clientes');
        }, 1500);
      } else {
        setStatus({ type: 'error', msg: data.error || 'Error al crear cliente' });
      }
    } catch (error) {
      setStatus({ type: 'error', msg: 'Error de conexión' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-12">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter italic uppercase">Nuevo Cliente</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Registro en Obuma</p>
          </div>
          <Link href="/obuma-clientes" className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-[#00338d] transition-all shadow-sm">
            <ArrowLeft size={20} />
          </Link>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-200 space-y-6">
          
          {/* Estado del formulario */}
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

          {/* Tipo de cliente */}
          <div className="bg-slate-50 rounded-2xl p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.es_extranjero}
                onChange={(e) => setForm({...form, es_extranjero: e.target.checked, rut: ''})}
                className="w-4 h-4 rounded border-slate-300 text-[#00338d]"
              />
              <span className="text-xs font-bold text-slate-600">Cliente Extranjero (sin RUT chileno)</span>
            </label>
          </div>

          {/* Campos del formulario */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Razón Social */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                <Building size={12} className="inline mr-1" /> Razón Social *
              </label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
                placeholder="Nombre de la empresa o persona"
                value={form.razon_social}
                onChange={(e) => setForm({...form, razon_social: e.target.value})}
                required
              />
            </div>

            {/* RUT o ID Extranjero */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                {form.es_extranjero ? 'ID Extranjero *' : 'RUT *'}
              </label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
                placeholder={form.es_extranjero ? 'Pasaporte o ID' : '12.345.678-9'}
                value={form.es_extranjero ? form.extranjero_id : form.rut}
                onChange={(e) => {
                  if (form.es_extranjero) {
                    setForm({...form, extranjero_id: e.target.value});
                  } else {
                    setForm({...form, rut: e.target.value});
                  }
                }}
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                <Mail size={12} className="inline mr-1" /> Email *
              </label>
              <input
                type="email"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
                placeholder="cliente@empresa.cl"
                value={form.email}
                onChange={(e) => setForm({...form, email: e.target.value})}
                required
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                <Phone size={12} className="inline mr-1" /> Teléfono
              </label>
              <input
                type="tel"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
                placeholder="+56 2 1234 5678"
                value={form.telefono}
                onChange={(e) => setForm({...form, telefono: e.target.value})}
              />
            </div>

            {/* Dirección */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                <MapPin size={12} className="inline mr-1" /> Dirección
              </label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
                placeholder="Calle, número, oficina"
                value={form.direccion}
                onChange={(e) => setForm({...form, direccion: e.target.value})}
              />
            </div>

            {/* Comuna */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Comuna</label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
                placeholder="Santiago"
                value={form.comuna}
                onChange={(e) => setForm({...form, comuna: e.target.value})}
              />
            </div>

            {/* Ciudad */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Ciudad</label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
                placeholder="Santiago"
                value={form.ciudad}
                onChange={(e) => setForm({...form, ciudad: e.target.value})}
              />
            </div>
          </div>

          {/* Botones */}
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
              Crear Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}