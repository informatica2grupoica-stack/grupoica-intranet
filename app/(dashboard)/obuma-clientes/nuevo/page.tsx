'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, AlertCircle, Check, Mail, Phone, MapPin, Building, User, Globe, CreditCard, Briefcase, Tag, Users, MapPinned, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function NuevoClientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  const [form, setForm] = useState({
    // Datos de Facturación
    rut: '',
    razon_social: '',
    nombre_fantasia: '',
    giro_comercial: '',
    direccion: '',
    comuna: '',
    region: '',
    es_extranjero: false,
    extranjero_id: '',
    
    // Datos Comerciales
    lista_precio_id: '',
    tipo_cliente: '',
    tipo_despacho: '',
    medio_despacho: '',
    credito_aprobado: 0,
    dias_pago: 0,
    plazo_pago: 0,
    vendedor: '',
    forma_pago: '',
    centro_costo: '',
    
    // Datos de Contacto
    nombre_contacto: '',
    telefono: '',
    celular: '',
    email: '',
    sitio_web: '',
    
    // Flags
    activo: true,
    agente_retenedor: false,
    bloqueado: false,
    facturar_cta_cte: false,
    
    // Observaciones
    observacion: ''
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
      const payload: any = {
        cliente_rut: form.es_extranjero ? '' : form.rut,
        cliente_razon_social: form.razon_social,
        cliente_email: form.email,
        cliente_telefono: form.telefono,
        cliente_direccion: form.direccion,
        cliente_comuna: form.comuna,
        cliente_ciudad: form.region,
        estado: form.activo ? '1' : '0'
      };
      
      // Campos opcionales
      if (form.nombre_fantasia) payload.cliente_nombre_fantasia = form.nombre_fantasia;
      if (form.giro_comercial) payload.cliente_giro_comercial = form.giro_comercial;
      if (form.nombre_contacto) payload.cliente_contacto = form.nombre_contacto;
      if (form.celular) payload.cliente_celular = form.celular;
      if (form.sitio_web) payload.cliente_sitio_web = form.sitio_web;
      if (form.observacion) payload.cliente_observacion = form.observacion;
      if (form.agente_retenedor) payload.cliente_agente_retenedor = '1';
      if (form.bloqueado) payload.cliente_bloqueado = '1';
      if (form.facturar_cta_cte) payload.cliente_facturar_cta_cte = '1';
      if (form.credito_aprobado > 0) payload.cliente_credito_aprobado = form.credito_aprobado;
      if (form.dias_pago > 0) payload.cliente_dias_pago = form.dias_pago;
      if (form.plazo_pago > 0) payload.cliente_plazo_pago = form.plazo_pago;
      
      if (form.es_extranjero) {
        payload.cliente_extranjero = '1';
        payload.cliente_extranjero_id = form.extranjero_id;
      }

      const res = await fetch('/api/obuma/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
      console.error("Error:", error);
      setStatus({ type: 'error', msg: 'Error de conexión' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-6 lg:p-12">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter italic uppercase">Nuevo Cliente</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Registro en Obuma</p>
          </div>
          <Link href="/obuma-clientes" className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-[#00338d] transition-all shadow-sm">
            <ArrowLeft size={20} />
          </Link>
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
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl md:rounded-[2.5rem] p-6 md:p-8 shadow-xl border border-slate-200 space-y-8">
          
          {/* ========== DATOS DE FACTURACIÓN ========== */}
          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <Building size={18} className="text-[#00338d]" />
              <h2 className="text-sm font-black uppercase text-slate-600">Datos de Facturación</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Cliente Extranjero */}
              <div className="md:col-span-2">
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

              {/* RUT o ID Extranjero */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  {form.es_extranjero ? 'ID Extranjero' : 'RUT Cliente'} *
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                  placeholder={form.es_extranjero ? 'Pasaporte o ID' : '12.345.678-9'}
                  value={form.es_extranjero ? form.extranjero_id : form.rut}
                  onChange={(e) => {
                    if (form.es_extranjero) {
                      setForm({...form, extranjero_id: e.target.value});
                    } else {
                      setForm({...form, rut: e.target.value});
                    }
                  }}
                  required={!form.es_extranjero}
                />
              </div>

              {/* Razón Social */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Razón Social *
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                  placeholder="Nombre de la empresa o persona"
                  value={form.razon_social}
                  onChange={(e) => setForm({...form, razon_social: e.target.value})}
                  required
                />
              </div>

              {/* Nombre Fantasía */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Nombre Fantasía
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                  placeholder="Nombre comercial"
                  value={form.nombre_fantasia}
                  onChange={(e) => setForm({...form, nombre_fantasia: e.target.value})}
                />
              </div>

              {/* Giro Comercial */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Giro Comercial
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                  placeholder="Ej: SERVICIOS PERSONALES DE EDUCACION"
                  value={form.giro_comercial}
                  onChange={(e) => setForm({...form, giro_comercial: e.target.value})}
                />
              </div>

              {/* Dirección */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
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
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                  value={form.comuna}
                  onChange={(e) => setForm({...form, comuna: e.target.value})}
                />
              </div>

              {/* Región */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Región</label>
                <select
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                  value={form.region}
                  onChange={(e) => setForm({...form, region: e.target.value})}
                >
                  <option value="">Seleccionar región...</option>
                  <option value="Región de Arica y Parinacota">Región de Arica y Parinacota</option>
                  <option value="Región de Tarapacá">Región de Tarapacá</option>
                  <option value="Región de Antofagasta">Región de Antofagasta</option>
                  <option value="Región de Atacama">Región de Atacama</option>
                  <option value="Región de Coquimbo">Región de Coquimbo</option>
                  <option value="Región de Valparaíso">Región de Valparaíso</option>
                  <option value="Región Metropolitana">Región Metropolitana</option>
                  <option value="Región de O'Higgins">Región de O'Higgins</option>
                  <option value="Región del Maule">Región del Maule</option>
                  <option value="Región de Ñuble">Región de Ñuble</option>
                  <option value="Región del Biobío">Región del Biobío</option>
                  <option value="Región de La Araucanía">Región de La Araucanía</option>
                  <option value="Región de Los Ríos">Región de Los Ríos</option>
                  <option value="Región de Los Lagos">Región de Los Lagos</option>
                  <option value="Región de Aysén">Región de Aysén</option>
                  <option value="Región de Magallanes">Región de Magallanes</option>
                </select>
              </div>
            </div>
          </div>

          {/* ========== DATOS COMERCIALES ========== */}
          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <Briefcase size={18} className="text-[#00338d]" />
              <h2 className="text-sm font-black uppercase text-slate-600">Datos Comerciales</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Crédito Aprobado
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                  <input
                    type="number"
                    className="w-full pl-8 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                    placeholder="0"
                    value={form.credito_aprobado}
                    onChange={(e) => setForm({...form, credito_aprobado: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Días de Pago
                </label>
                <input
                  type="number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                  placeholder="0"
                  value={form.dias_pago}
                  onChange={(e) => setForm({...form, dias_pago: parseInt(e.target.value) || 0})}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Plazo de Pago (días)
                </label>
                <input
                  type="number"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                  placeholder="0"
                  value={form.plazo_pago}
                  onChange={(e) => setForm({...form, plazo_pago: parseInt(e.target.value) || 0})}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Vendedor
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                  placeholder="Nombre del vendedor"
                  value={form.vendedor}
                  onChange={(e) => setForm({...form, vendedor: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Forma de Pago
                </label>
                <select
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                  value={form.forma_pago}
                  onChange={(e) => setForm({...form, forma_pago: e.target.value})}
                >
                  <option value="">Seleccionar...</option>
                  <option value="Contado">Contado</option>
                  <option value="Crédito">Crédito</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Centro Costo
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                  placeholder="Centro de costo"
                  value={form.centro_costo}
                  onChange={(e) => setForm({...form, centro_costo: e.target.value})}
                />
              </div>
            </div>

            {/* Flags Comerciales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.agente_retenedor}
                  onChange={(e) => setForm({...form, agente_retenedor: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300 text-[#00338d]"
                />
                <span className="text-[10px] font-bold text-slate-600">Agente Retenedor</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.facturar_cta_cte}
                  onChange={(e) => setForm({...form, facturar_cta_cte: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300 text-[#00338d]"
                />
                <span className="text-[10px] font-bold text-slate-600">Facturar a Cuenta Corriente</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.bloqueado}
                  onChange={(e) => setForm({...form, bloqueado: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300 text-[#00338d]"
                />
                <span className="text-[10px] font-bold text-slate-600">Cliente Bloqueado</span>
              </label>
            </div>
          </div>

          {/* ========== DATOS DE CONTACTO ========== */}
          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <Users size={18} className="text-[#00338d]" />
              <h2 className="text-sm font-black uppercase text-slate-600">Datos de Contacto</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Nombre de Contacto *
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                  placeholder="Nombre de la persona de contacto"
                  value={form.nombre_contacto}
                  onChange={(e) => setForm({...form, nombre_contacto: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Teléfono *
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    className="w-full pl-9 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                    placeholder="+56 2 1234 5678"
                    value={form.telefono}
                    onChange={(e) => setForm({...form, telefono: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Celular
                </label>
                <input
                  type="tel"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                  placeholder="+56 9 1234 5678"
                  value={form.celular}
                  onChange={(e) => setForm({...form, celular: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Email *
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    className="w-full pl-9 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                    placeholder="cliente@empresa.cl"
                    value={form.email}
                    onChange={(e) => setForm({...form, email: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                  Sitio Web
                </label>
                <input
                  type="url"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all"
                  placeholder="https://www.empresa.cl"
                  value={form.sitio_web}
                  onChange={(e) => setForm({...form, sitio_web: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* ========== OBSERVACIONES ========== */}
          <div>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
              <AlertCircle size={18} className="text-[#00338d]" />
              <h2 className="text-sm font-black uppercase text-slate-600">Observaciones</h2>
            </div>
            
            <textarea
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-[#00338d] focus:bg-white transition-all resize-none"
              rows={3}
              placeholder="Notas internas sobre el cliente..."
              value={form.observacion}
              onChange={(e) => setForm({...form, observacion: e.target.value})}
            />
          </div>

          {/* ========== ESTADO ========== */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({...form, activo: e.target.checked})}
                className="w-4 h-4 rounded border-slate-300 text-[#00338d] focus:ring-[#00338d]"
              />
              <span className="text-xs font-bold text-slate-600">Cliente activo</span>
            </label>
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