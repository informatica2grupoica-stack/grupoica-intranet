"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, PackagePlus, RefreshCcw, AlertCircle, Check, DollarSign, Layers, Tag, BarChart3 } from "lucide-react";

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  const [categorias, setCategorias] = useState([]);
  const [allSubcategorias, setAllSubcategorias] = useState([]);

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

  // Carga de datos inicial
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
        setStatus({ type: 'error', msg: "Error de conexión con la base de datos" });
      }
    }
    loadData();
  }, []);

  // Construcción del nombre
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
    return allSubcategorias.filter(s => String(s.rel_producto_categoria_id) === String(form.categoria_id));
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
      setStatus({ type: 'error', msg: "Error al generar SKU" });
    } finally { 
      setGeneratingSku(false); 
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/obuma/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, nombre_completo: form.nombre_completo.toUpperCase() }),
      });
      if (res.ok) {
        setStatus({ type: 'success', msg: "Producto registrado exitosamente" });
        setNameParts({ c1: "", c2: "", c3: "", unit: "MT", c4: "" });
        setForm(prev => ({ ...prev, precio_costo: 0, precio_venta: 0 }));
      } else {
        setStatus({ type: 'error', msg: "Obuma rechazó los datos. Verifique campos." });
      }
    } catch (error) { 
      setStatus({ type: 'error', msg: "Error de servidor" }); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-6 lg:p-12 text-slate-700">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Nuevo producto</h1>
          <p className="text-slate-500 text-sm">Registro centralizado para Obuma Cloud</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 space-y-8">
            
            {/* 1. SECCIÓN NOMBRE */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
              <label className="text-sm font-semibold pt-2">Nombre <span className="text-red-500">*</span></label>
              <div className="md:col-span-3 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input placeholder="TIPO" className="f-input" value={nameParts.c1} onChange={e => setNameParts({...nameParts, c1: e.target.value})} />
                  <input placeholder="ATRIBUTO" className="f-input" value={nameParts.c2} onChange={e => setNameParts({...nameParts, c2: e.target.value})} />
                  <input placeholder="MEDIDA" className="f-input" value={nameParts.c3} onChange={e => setNameParts({...nameParts, c3: e.target.value})} />
                  <select className="f-input bg-slate-50" value={nameParts.unit} onChange={e => setNameParts({...nameParts, unit: e.target.value})}>
                    <option value="MT">MT</option><option value="KG">KG</option><option value="UN">UN</option><option value="MM">MM</option>
                  </select>
                </div>
                <input placeholder="MARCA / COLOR" className="f-input w-full" value={nameParts.c4} onChange={e => setNameParts({...nameParts, c4: e.target.value})} />
                <div className="p-3 bg-slate-900 rounded text-white text-xs font-mono uppercase tracking-wider">
                  <span className="text-slate-500 mr-2">PREVIEW:</span>
                  {form.nombre_completo || "---"}
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* 2. CLASIFICACIÓN Y SKU */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-4 md:col-span-2">
                <div className="grid grid-cols-1 gap-4">
                  <label className="text-sm font-semibold">Categoría <span className="text-red-500">*</span></label>
                  <select className="f-input" value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}>
                    <option value="">Selecciona una categoría</option>
                    {categorias.map((c:any) => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-4 md:col-span-2">
                <div className="grid grid-cols-1 gap-4">
                  <label className="text-sm font-semibold">Subcategoría <span className="text-red-500">*</span></label>
                  <select disabled={!form.categoria_id} className="f-input" value={form.subcategoria_id} onChange={e => solicitarNuevoSku(e.target.value)}>
                    <option value="">Selecciona una subcategoria</option>
                    {subCategoriasFiltradas.map((s:any) => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <label className="text-sm font-semibold pt-2">SKU</label>
              <div className="md:col-span-3">
                <div className="relative max-w-xs">
                  <input readOnly value={form.sku} placeholder="Auto-generado" className="f-input w-full pr-10 bg-slate-50 font-mono text-blue-700" />
                  <button type="button" onClick={() => solicitarNuevoSku(form.subcategoria_id)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600">
                    <RefreshCcw size={16} className={generatingSku ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* 3. PRECIOS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-semibold">Precio Costo <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input type="number" className="f-input w-full pl-7" value={form.precio_costo} onChange={e => setForm({...form, precio_costo: Number(e.target.value)})} />
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input type="checkbox" className="rounded border-slate-300 text-blue-600" checked={form.costo_incluye_iva} onChange={e => setForm({...form, costo_incluye_iva: e.target.checked})} />
                    ¿Incluye IVA?
                  </label>
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-semibold text-blue-700">Precio Venta <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400">$</span>
                    <input type="number" className="f-input w-full pl-7 border-blue-200 bg-blue-50/30" value={form.precio_venta} onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} />
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input type="checkbox" className="rounded border-slate-300 text-blue-600" checked={form.venta_incluye_iva} onChange={e => setForm({...form, venta_incluye_iva: e.target.checked})} />
                    ¿Incluye IVA?
                  </label>
                </div>
              </div>
            </div>

            {/* 4. CONFIGURACIÓN */}
            <div className="flex flex-wrap gap-6 py-2">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300" checked={form.se_puede_vender} onChange={e => setForm({...form, se_puede_vender: e.target.checked})} />
                ¿Se puede vender?
              </label>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300" checked={form.se_puede_comprar} onChange={e => setForm({...form, se_puede_comprar: e.target.checked})} />
                ¿Se puede comprar?
              </label>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300" checked={form.se_mantiene_stock} onChange={e => setForm({...form, se_mantiene_stock: e.target.checked})} />
                ¿Se mantiene stock?
              </label>
            </div>

          </div>

          {/* FOOTER CON ACCIONES */}
          <div className="bg-slate-50 px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-slate-200">
            <div className="flex-1">
              {status && (
                <div className={`flex items-center gap-2 text-sm font-bold ${status.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {status.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  {status.msg}
                </div>
              )}
            </div>
            <button 
              type="submit"
              disabled={loading || !form.sku || !form.nombre_completo}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-10 py-2.5 rounded-md font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : null}
              {loading ? 'Procesando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .f-input {
          @apply border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-300;
        }
      `}</style>
    </div>
  );
}