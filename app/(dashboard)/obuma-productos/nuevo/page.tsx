"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, PackagePlus, RefreshCcw, AlertCircle, Check, DollarSign, Layers, Tag, BarChart3, Info } from "lucide-react";

interface Categoria {
  producto_categoria_id: string | number;
  producto_categoria_nombre: string;
}

interface Subcategoria {
  producto_subcategoria_id: string | number;
  producto_subcategoria_nombre: string;
  rel_producto_categoria_id: string | number;
}

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<Subcategoria[]>([]);

  const [nameParts, setNameParts] = useState({ 
    c1: "", c2: "", c3: "", unit: "MT", c4: "" 
  });

  const [form, setForm] = useState({
    nombre_completo: "",
    sku: "", 
    categoria_id: "",
    subcategoria_id: "",
    precio_costo: 0,
    precio_venta: 0,
    venta_incluye_iva: true,
    costo_incluye_iva: true,
    se_puede_vender: true,
    se_puede_comprar: true,
    se_mantiene_stock: true,
  });

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
        setStatus({ type: 'error', msg: "Error al conectar con la API" });
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    const clean = (t: any) => (t ? String(t).toUpperCase().trim() : "");
    const parts = [
      clean(nameParts.c1),
      clean(nameParts.c2),
      nameParts.c3 ? `${clean(nameParts.c3)} ${clean(nameParts.unit)}` : "",
      clean(nameParts.c4)
    ].filter(p => p !== "");
    setForm(prev => ({ ...prev, nombre_completo: parts.join(" ") }));
  }, [nameParts]);

  const subCategoriasFiltradas = useMemo(() => {
    if (!form.categoria_id) return [];
    return allSubcategorias.filter(s => 
      String(s.rel_producto_categoria_id) === String(form.categoria_id)
    );
  }, [allSubcategorias, form.categoria_id]);

  const solicitarNuevoSku = async (subId: string) => {
    if (!subId) {
        setForm(prev => ({ ...prev, subcategoria_id: "", sku: "" }));
        return;
    }
    setGeneratingSku(true);
    setForm(prev => ({ ...prev, subcategoria_id: subId }));
    try {
      const cat = categorias.find(c => String(c.producto_categoria_id) === String(form.categoria_id));
      const prefijo = cat?.producto_categoria_nombre?.toUpperCase().includes("MERCADO PUBLICO") ? "60" : "50";
      const res = await fetch(`/api/obuma/siguiente-sku?prefijoSub=${prefijo}${subId}`);
      const data = await res.json();
      if (data.sku) setForm(prev => ({ ...prev, sku: String(data.sku) }));
    } catch (err) { 
      setStatus({ type: 'error', msg: "No se pudo generar SKU" });
    } finally { 
      setGeneratingSku(false); 
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre_completo || !form.sku || !form.categoria_id || !form.subcategoria_id) {
      setStatus({ type: 'error', msg: "Faltan campos obligatorios" });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/obuma/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, nombre_completo: form.nombre_completo.toUpperCase() }),
      });
      if (res.ok) {
        setStatus({ type: 'success', msg: `Producto ${form.sku} creado` });
        setNameParts({ c1: "", c2: "", c3: "", unit: "MT", c4: "" });
        setForm(prev => ({ ...prev, precio_costo: 0, precio_venta: 0 }));
        await solicitarNuevoSku(form.subcategoria_id);
      }
    } catch (error) { 
      setStatus({ type: 'error', msg: "Error de servidor" }); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 lg:p-8 text-slate-800">
      <div className="max-w-[1200px] mx-auto">
        
        {/* HEADER SIMPLE */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <PackagePlus className="text-blue-600" /> Maestro de Productos
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Obuma Cloud Sync</p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black text-emerald-700 uppercase">Sistema Online</span>
          </div>
        </div>

        {/* GRID PRINCIPAL REPARADO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LADO IZQUIERDO (Identidad y Clasificación) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* SECCIÓN 1: NOMBRE */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6">
                <Tag className="text-blue-600" size={18} />
                <h2 className="font-bold text-sm uppercase tracking-tight">1. Definición de Nombre</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input placeholder="TIPO" className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:ring-2 ring-blue-500/20" value={nameParts.c1} onChange={e => setNameParts({...nameParts, c1: e.target.value})} />
                <input placeholder="ATRIBUTO" className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:ring-2 ring-blue-500/20" value={nameParts.c2} onChange={e => setNameParts({...nameParts, c2: e.target.value})} />
                <input placeholder="MEDIDA" className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 ring-blue-500/20" value={nameParts.c3} onChange={e => setNameParts({...nameParts, c3: e.target.value})} />
                <select className="p-3 bg-slate-100 rounded-xl font-bold text-xs outline-none" value={nameParts.unit} onChange={e => setNameParts({...nameParts, unit: e.target.value})}>
                  <option value="MT">MT</option><option value="KG">KG</option><option value="UN">UN</option><option value="MM">MM</option>
                </select>
                <input placeholder="MARCA/COLOR" className="col-span-2 md:col-span-4 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 ring-blue-500/20" value={nameParts.c4} onChange={e => setNameParts({...nameParts, c4: e.target.value})} />
              </div>

              {/* PREVIEW COMPACTO */}
              <div className="mt-6 p-4 bg-slate-900 rounded-2xl border-l-4 border-blue-500 shadow-inner">
                <span className="text-blue-400 text-[9px] font-black uppercase block mb-1">Vista Previa:</span>
                <p className="text-white font-bold text-lg uppercase truncate leading-tight">
                  {form.nombre_completo || "..."}
                </p>
              </div>
            </div>

            {/* SECCIÓN 2: CLASIFICACIÓN */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6">
                <Layers className="text-indigo-600" size={18} />
                <h2 className="font-bold text-sm uppercase tracking-tight">2. Categorización y SKU</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500" value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}>
                    <option value="">Categoría...</option>
                    {categorias.map(c => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                  </select>
                  <select disabled={!form.categoria_id} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 disabled:opacity-50" value={form.subcategoria_id} onChange={e => solicitarNuevoSku(e.target.value)}>
                    <option value="">Subcategoría...</option>
                    {subCategoriasFiltradas.map(s => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
                  </select>
                </div>
                
                {/* SKU BOX */}
                <div className="bg-indigo-600 rounded-2xl p-4 flex flex-col items-center justify-center text-white relative">
                  <span className="text-[9px] font-black uppercase opacity-60 mb-2 tracking-widest">Código SKU</span>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-black">{generatingSku ? "..." : (form.sku || "---")}</span>
                    <button onClick={() => solicitarNuevoSku(form.subcategoria_id)} disabled={!form.subcategoria_id} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
                      <RefreshCcw size={16} className={generatingSku ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* LADO DERECHO (Precios y Acción) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 sticky top-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="text-emerald-600" size={18} />
                <h2 className="font-bold text-sm uppercase tracking-tight">3. Comercial</h2>
              </div>

              <div className="space-y-4">
                {/* COSTO */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input type="number" placeholder="COSTO" className="w-full pl-8 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none" value={form.precio_costo} onChange={e => setForm({...form, precio_costo: Number(e.target.value)})} />
                  </div>
                  <label className="flex items-center gap-2 px-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={form.costo_incluye_iva} onChange={e => setForm({...form, costo_incluye_iva: e.target.checked})} />
                    <span className="text-[10px] font-black">IVA</span>
                  </label>
                </div>

                {/* VENTA */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" size={14} />
                    <input type="number" placeholder="VENTA" className="w-full pl-8 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-black text-sm outline-none" value={form.precio_venta} onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} />
                  </div>
                  <label className="flex items-center gap-2 px-3 bg-blue-600 text-white rounded-xl cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-white" checked={form.venta_incluye_iva} onChange={e => setForm({...form, venta_incluye_iva: e.target.checked})} />
                    <span className="text-[10px] font-black">IVA</span>
                  </label>
                </div>

                {/* CHECKBOXES */}
                <div className="grid grid-cols-1 gap-2 pt-2">
                  {[
                    {k:'se_puede_vender', l:'Permitir Venta'}, 
                    {k:'se_mantiene_stock', l:'Controlar Stock'}
                  ].map(i => (
                    <label key={i.k} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer">
                      <span className="text-[10px] font-black uppercase text-slate-500">{i.l}</span>
                      <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={(form as any)[i.k]} onChange={e => setForm({...form, [i.k as any]: e.target.checked})} />
                    </label>
                  ))}
                </div>

                {/* STATUS */}
                {status && (
                  <div className={`p-4 rounded-2xl flex items-center gap-3 border ${status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                    {status.type === 'success' ? <Check size={18}/> : <AlertCircle size={18}/>}
                    <p className="text-[10px] font-black uppercase leading-tight">{status.msg}</p>
                  </div>
                )}

                {/* BOTÓN FINAL */}
                <button 
                  onClick={handleSubmit}
                  disabled={loading || !form.sku || !form.nombre_completo}
                  className="w-full bg-[#00338d] hover:bg-blue-900 disabled:bg-slate-200 disabled:text-slate-400 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <PackagePlus size={20} />}
                  <span className="text-xs">Finalizar Registro</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}