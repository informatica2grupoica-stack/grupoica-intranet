"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Loader2, RefreshCcw, AlertCircle, Check, ArrowLeft, Save, Globe } from "lucide-react";
import Link from "next/link";

interface Categoria {
  producto_categoria_id: string;
  producto_categoria_nombre: string;
}

interface Subcategoria {
  producto_subcategoria_id: string;
  producto_subcategoria_nombre: string;
  rel_producto_categoria_id: string;
}

interface FormState {
  c1: string;
  c2: string;
  c3: string;
  c4: string;
  nombre_completo: string;
  tipo: string;
  sku: string;
  categoria_id: string;
  subcategoria_id: string;
  precio_costo: number;
  precio_venta: number;
  venta_incluye_iva: boolean;
  costo_incluye_iva: boolean;
  se_puede_vender: boolean;
  se_puede_comprar: boolean;
  se_mantiene_stock: boolean;
  enviar_a_dime: boolean; // NUEVO: Flag para la web
}

const initialState: FormState = {
  c1: "", c2: "", c3: "", c4: "",
  nombre_completo: "",
  tipo: "Producto",
  sku: "",
  categoria_id: "",
  subcategoria_id: "",
  precio_costo: 0,
  precio_venta: 0,
  venta_incluye_iva: false, 
  costo_incluye_iva: false,
  se_puede_vender: true,
  se_puede_comprar: true,
  se_mantiene_stock: true,
  enviar_a_dime: true, // Por defecto activado para subir a Dime
};

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<Subcategoria[]>([]);
  const [form, setForm] = useState<FormState>(initialState);

  useEffect(() => {
    async function loadData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);
        const dataCat = await resCat.json();
        const dataSub = await resSub.json();
        setCategorias(Array.isArray(dataCat) ? dataCat : []);
        setAllSubcategorias(Array.isArray(dataSub) ? dataSub : []);
      } catch (err) { 
        setStatus({ type: 'error', msg: "Error de conexión con Obuma" });
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    const limpiar = (t: string) => (t || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const nombreConstruido = [limpiar(form.c1), limpiar(form.c2), form.c3 ? `${limpiar(form.c3)} MT` : "", limpiar(form.c4)].filter(Boolean).join(" ");
    if (nombreConstruido !== form.nombre_completo) setForm(prev => ({ ...prev, nombre_completo: nombreConstruido }));
  }, [form.c1, form.c2, form.c3, form.c4]);

  const subCategoriasFiltradas = useMemo(() => {
    if (!form.categoria_id) return [];
    return allSubcategorias.filter(s => String(s.rel_producto_categoria_id) === String(form.categoria_id));
  }, [allSubcategorias, form.categoria_id]);

  const solicitarNuevoSku = async (subId: string) => {
    if (!subId) return;
    setGeneratingSku(true);
    setForm(prev => ({ ...prev, subcategoria_id: subId }));
    try {
      const cat = categorias.find(c => String(c.producto_categoria_id) === String(form.categoria_id));
      const prefijo = cat?.producto_categoria_nombre?.toUpperCase().includes("MERCADO PUBLICO") ? "60" : "50";
      const res = await fetch(`/api/obuma/siguiente-sku?prefijoSub=${prefijo}${subId}`);
      const data = await res.json();
      if (data.sku) setForm(prev => ({ ...prev, sku: String(data.sku) }));
    } catch (err) { 
      setStatus({ type: 'error', msg: "Error al generar SKU" });
    } finally { setGeneratingSku(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/obuma/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', msg: "¡Producto creado en Obuma!" });
        setForm({ ...initialState, categoria_id: form.categoria_id, subcategoria_id: form.subcategoria_id });
      } else {
        setStatus({ type: 'error', msg: result.error || "Error al guardar" });
      }
    } catch (error) { setStatus({ type: 'error', msg: "Error crítico de servidor" }); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-12 text-slate-700 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between px-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter italic uppercase">Nuevo Producto</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Panel de Creación Directa Obuma</p>
          </div>
          <Link href="/obuma-productos" className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-[#00338d] transition-all shadow-sm"><ArrowLeft size={20} /></Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-200 space-y-8">
          
          {/* BANNER NOMBRE */}
          <div className="p-6 bg-[#00338d] rounded-3xl text-white shadow-lg flex justify-between items-center">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase opacity-60">Nombre final Obuma</label>
              <div className="text-xl font-black uppercase italic">{form.nombre_completo || "Esperando datos..."}</div>
            </div>
            <div className="bg-emerald-400/20 px-5 py-2 rounded-full text-[10px] font-black italic border border-emerald-400/30 uppercase">Chile Marketplace Sync</div>
          </div>

          {/* GRID NOMBRE */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['c1', 'c2', 'c3', 'c4'] as const).map((f, i) => (
              <div key={f} className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">{i+1}. {f === 'c1' ? 'Tipo' : f === 'c2' ? 'Atributo' : f === 'c3' ? 'Medida' : 'Marca'}</label>
                <input className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold uppercase outline-none focus:border-[#00338d] focus:bg-white transition-all shadow-sm" value={form[f]} onChange={(e) => setForm(prev => ({...prev, [f]: e.target.value}))} />
              </div>
            ))}
          </div>

          {/* DATOS MAESTROS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Tipo de Item</label>
              <select className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none cursor-pointer" value={form.tipo} onChange={(e) => setForm(prev => ({...prev, tipo: e.target.value}))}>
                <option value="Producto">Producto</option>
                <option value="Servicio">Servicio</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-[#00338d] uppercase ml-2">SKU Obuma</label>
              <div className="relative">
                <input readOnly className="w-full p-4 bg-blue-50/50 border border-blue-100 rounded-2xl text-xs font-black italic text-[#00338d] outline-none" value={form.sku || "Auto-generado"} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">{generatingSku ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <RefreshCcw size={16} className="text-blue-300" />}</div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Categoría Principal *</label>
              <select className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none cursor-pointer" value={form.categoria_id} onChange={(e) => setForm(prev => ({...prev, categoria_id: e.target.value, subcategoria_id: ""}))} required>
                <option value="">Seleccionar...</option>
                {categorias.map((cat) => <option key={cat.producto_categoria_id} value={String(cat.producto_categoria_id)}>{cat.producto_categoria_nombre}</option>)}
              </select>
            </div>
          </div>

          {/* PRECIOS CON LOGICA DE IVA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Subcategoria *</label>
              <select className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none" disabled={!form.categoria_id} value={form.subcategoria_id} onChange={(e) => solicitarNuevoSku(e.target.value)} required>
                <option value="">Seleccionar...</option>
                {subCategoriasFiltradas.map((sub) => <option key={sub.producto_subcategoria_id} value={String(sub.producto_subcategoria_id)}>{sub.producto_subcategoria_nombre}</option>)}
              </select>
            </div>

            {/* PRECIO COSTO */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center px-2">
                <label className="text-[10px] font-black text-slate-400 uppercase italic">Precio Costo</label>
                <button type="button" onClick={() => setForm(prev => ({ ...prev, costo_incluye_iva: !prev.costo_incluye_iva }))} className={`text-[8px] font-black px-2 py-0.5 rounded-md border transition-all ${form.costo_incluye_iva ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                  {form.costo_incluye_iva ? 'CON IVA' : 'NETO'}
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input type="number" className="w-full p-4 pl-8 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none" value={form.precio_costo} onChange={(e) => setForm(prev => ({...prev, precio_costo: Number(e.target.value)}))} />
              </div>
            </div>

            {/* PRECIO VENTA */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center px-2">
                <label className="text-[10px] font-black text-[#00338d] uppercase italic">Precio Venta</label>
                <button type="button" onClick={() => setForm(prev => ({ ...prev, venta_incluye_iva: !prev.venta_incluye_iva }))} className={`text-[8px] font-black px-2 py-0.5 rounded-md border transition-all ${form.venta_incluye_iva ? 'bg-[#00338d] text-white border-blue-900' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                  {form.venta_incluye_iva ? 'CON IVA (BRUTO)' : 'NETO'}
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00338d] font-black">$</span>
                <input type="number" className="w-full p-4 pl-8 bg-white border-2 border-[#00338d] rounded-2xl text-sm font-black text-[#00338d] outline-none shadow-md" value={form.precio_venta} onChange={(e) => setForm(prev => ({...prev, precio_venta: Number(e.target.value)}))} />
              </div>
            </div>
          </div>

          {/* OPCIONES STOCK Y WEB */}
          <div className="flex flex-wrap items-center gap-8 py-4 px-2 border-t border-slate-100">
            {(['se_puede_vender', 'se_puede_comprar', 'se_mantiene_stock'] as const).map((key) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" className="w-5 h-5 rounded-lg border-slate-300 text-[#00338d] focus:ring-0" checked={form[key]} onChange={e => setForm(prev => ({...prev, [key]: e.target.checked}))} />
                <span className="text-[10px] font-black uppercase text-slate-500 group-hover:text-slate-800 transition-colors">{key.replace(/_/g, ' ')}</span>
              </label>
            ))}

            {/* SELECTOR WEB DIME */}
            <div className="h-6 w-[1px] bg-slate-200 hidden md:block"></div>
            <label className="flex items-center gap-3 cursor-pointer group bg-orange-50 px-4 py-2 rounded-xl border border-orange-100 hover:bg-orange-100 transition-all">
              <input type="checkbox" className="w-5 h-5 rounded-lg border-orange-300 text-orange-600 focus:ring-0" checked={form.enviar_a_dime} onChange={e => setForm(prev => ({...prev, enviar_a_dime: e.target.checked}))} />
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-orange-600" />
                <span className="text-[10px] font-black uppercase text-orange-700">Sincronizar con Dime (Web)</span>
              </div>
            </label>
          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              {status && (
                <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-sm font-black uppercase italic ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                  {status.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />} {status.msg}
                </div>
              )}
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <Link href="/obuma-productos" className="flex-1 md:flex-none px-8 py-4 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:bg-slate-100 text-center">Cancelar</Link>
              <button type="submit" disabled={loading || !form.sku || !form.nombre_completo} className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-[#00338d] text-white px-16 py-5 rounded-3xl text-xs font-black uppercase shadow-[0_10px_30px_rgba(0,51,141,0.3)] hover:bg-blue-800 transition-all disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Crear en Obuma
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}