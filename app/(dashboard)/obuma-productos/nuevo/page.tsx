"use client";
import { useState, useEffect } from "react";
import { Save, Loader2, PackagePlus, RefreshCcw, AlertCircle, Check } from "lucide-react";

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  const [categorias, setCategorias] = useState<any[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<any[]>([]);

  // Estados para los componentes del nombre (Captura 2)
  const [nameParts, setNameParts] = useState({ c1: "", c2: "", c3: "", unit: "MT", c4: "" });

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

  // 1. Carga inicial
  useEffect(() => {
    async function loadData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);
        setCategorias(await resCat.json());
        setAllSubcategorias(await resSub.json());
      } catch (err) { console.error("Error cargando datos base"); }
    }
    loadData();
  }, []);

  // 2. Lógica de construcción de nombre (ZING ZING 34 MT ORO)
  useEffect(() => {
    const clean = (t: string) => t.toUpperCase().trim();
    const full = [
      clean(nameParts.c1),
      clean(nameParts.c2),
      nameParts.c3 ? `${clean(nameParts.c3)} ${nameParts.unit}` : "",
      clean(nameParts.c4)
    ].filter(Boolean).join(" ");
    
    setForm(prev => ({ ...prev, nombre_completo: full }));
  }, [nameParts]);

  // 3. Generador de SKU
  const solicitarNuevoSku = async (subId: string) => {
    if (!subId || !form.categoria_id) return;
    setGeneratingSku(true);
    try {
      const cat = categorias.find(c => String(c.producto_categoria_id) === String(form.categoria_id));
      const nombreCat = cat?.producto_categoria_nombre?.toUpperCase() || "";
      let prefijo = nombreCat.includes("MERCADO PUBLICO") ? "60" : "50";
      
      const res = await fetch(`/api/obuma/siguiente-sku?prefijoSub=${prefijo}${subId}`);
      const data = await res.json();
      if (data.sku) setForm(prev => ({ ...prev, sku: data.sku, subcategoria_id: subId }));
    } catch (err) { console.error("Error SKU"); }
    finally { setGeneratingSku(false); }
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
      if (res.ok) {
        setStatus({ type: 'success', msg: `CREADO: ${form.sku}` });
        const subIdActual = form.subcategoria_id;
        setNameParts({ c1: "", c2: "", c3: "", unit: "MT", c4: "" });
        setForm(prev => ({ ...prev, precio_costo: 0, precio_venta: 0 }));
        await solicitarNuevoSku(subIdActual);
      } else {
        const err = await res.json();
        setStatus({ type: 'error', msg: err.error || "Error Obuma" });
      }
    } catch (error) { setStatus({ type: 'error', msg: "Error conexión" }); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-[#f8fafc] min-h-screen font-sans text-slate-700">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
        
        {/* BLOQUE 1: COMPONENTES DEL NOMBRE (Capture 2) */}
        <div className="p-8 space-y-8">
          <div className="space-y-4">
            <h2 className="text-[10px] font-black text-blue-500 uppercase italic tracking-widest">1. Componentes del Nombre</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <input placeholder="TIPO" className="p-4 bg-slate-50 border rounded-2xl font-bold uppercase text-sm focus:ring-2 ring-blue-100 outline-none" value={nameParts.c1} onChange={e => setNameParts({...nameParts, c1: e.target.value})} />
              <input placeholder="ATRIBUTO" className="p-4 bg-slate-50 border rounded-2xl font-bold uppercase text-sm focus:ring-2 ring-blue-100 outline-none" value={nameParts.c2} onChange={e => setNameParts({...nameParts, c2: e.target.value})} />
              <div className="flex gap-2 col-span-1 md:col-span-2">
                <input placeholder="MEDIDA" className="flex-1 p-4 bg-slate-50 border rounded-2xl font-bold uppercase text-sm outline-none" value={nameParts.c3} onChange={e => setNameParts({...nameParts, c3: e.target.value})} />
                <select className="p-4 bg-slate-50 border rounded-2xl font-bold text-xs outline-none cursor-pointer" value={nameParts.unit} onChange={e => setNameParts({...nameParts, unit: e.target.value})}>
                  <option value="MT">MT</option><option value="KG">KG</option><option value="UN">UN</option>
                </select>
                <input placeholder="MARCA/COLOR" className="flex-1 p-4 bg-slate-50 border rounded-2xl font-bold uppercase text-sm outline-none" value={nameParts.c4} onChange={e => setNameParts({...nameParts, c4: e.target.value})} />
              </div>
            </div>
            <div className="p-4 bg-slate-900 rounded-2xl text-center">
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em]">Vista previa en Obuma</span>
              <p className="text-white font-black italic uppercase text-lg tracking-tight mt-1">{form.nombre_completo || "ESPERANDO DATOS..."}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* BLOQUE 2: CLASIFICACIÓN & SKU */}
            <div className="space-y-4">
              <h2 className="text-[10px] font-black text-blue-500 uppercase italic tracking-widest">2. Clasificación Categoría</h2>
              <div className="space-y-3">
                <select required className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 transition-all" value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}>
                  <option value="">Selecciona una categoría</option>
                  {categorias.map(c => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                </select>
                <select required className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 transition-all" value={form.subcategoria_id} onChange={e => solicitarNuevoSku(e.target.value)}>
                  <option value="">Selecciona una subcategoría</option>
                  {allSubcategorias.filter(s => String(s.rel_producto_categoria_id) === String(form.categoria_id)).map(s => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
                </select>
              </div>

              <div className="mt-6 p-8 bg-blue-50/50 border-2 border-dashed border-blue-200 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">SKU Asignado</span>
                <div className="flex items-center gap-4">
                  <span className="text-4xl font-black text-[#00338d] tracking-tighter">{form.sku || "---"}</span>
                  <button type="button" onClick={() => solicitarNuevoSku(form.subcategoria_id)} className="p-2 hover:bg-blue-100 rounded-full transition-all text-blue-400">
                    <RefreshCcw size={24} className={generatingSku ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
            </div>

            {/* BLOQUE 3: PRECIOS & FLAGS (Capture 2 derecha) */}
            <div className="space-y-4">
              <h2 className="text-[10px] font-black text-blue-500 uppercase italic tracking-widest">3. Precios y Valores</h2>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                    <input type="number" placeholder="COSTO" className="w-full pl-8 p-4 bg-white border-2 border-slate-100 rounded-2xl font-bold outline-none" value={form.precio_costo} onChange={e => setForm({...form, precio_costo: Number(e.target.value)})} />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-4 rounded-2xl border border-slate-100">
                    <input type="checkbox" className="w-5 h-5 accent-[#00338d]" checked={form.costo_incluye_iva} onChange={e => setForm({...form, costo_incluye_iva: e.target.checked})} />
                    <span className="text-[10px] font-black uppercase">IVA Inc.</span>
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                    <input type="number" placeholder="VENTA" className="w-full pl-8 p-4 bg-white border-2 border-slate-100 rounded-2xl font-bold outline-none border-b-4 border-b-blue-500" value={form.precio_venta} onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-4 rounded-2xl border border-slate-100">
                    <input type="checkbox" className="w-5 h-5 accent-[#00338d]" checked={form.venta_incluye_iva} onChange={e => setForm({...form, venta_incluye_iva: e.target.checked})} />
                    <span className="text-[10px] font-black uppercase">IVA Inc.</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-4">
                {[
                  { k: 'se_puede_vender', l: '¿Se puede vender?' },
                  { k: 'se_puede_comprar', l: '¿Se puede comprar?' },
                  { k: 'se_mantiene_stock', l: '¿Mantiene stock?' }
                ].map(item => (
                  <label key={item.k} className="flex justify-between items-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors">
                    <span className="text-[11px] font-black uppercase italic tracking-tight">{item.l}</span>
                    <input type="checkbox" className="w-6 h-6 accent-blue-600" checked={(form as any)[item.k]} onChange={e => setForm({...form, [item.k]: e.target.checked})} />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {status && (
            <div className={`p-5 rounded-3xl flex items-center gap-4 border-2 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
              <div className={`p-2 rounded-full ${status.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'} text-white`}>
                {status.type === 'success' ? <Check size={18}/> : <AlertCircle size={18}/>}
              </div>
              <span className="font-black uppercase text-xs tracking-wider">{status.msg}</span>
            </div>
          )}

          <button 
            onClick={handleSubmit}
            disabled={loading || !form.sku || !form.nombre_completo}
            className="w-full bg-[#00338d] hover:bg-[#00266b] text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] disabled:opacity-50 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : <PackagePlus size={24} />}
            Finalizar y Crear Producto
          </button>
        </div>
      </div>
    </div>
  );
}