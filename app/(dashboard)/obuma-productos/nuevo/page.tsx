"use client";

import { useState, useEffect, useMemo } from "react";
import { Save, Loader2, PackagePlus, RefreshCcw, AlertCircle, Check, DollarSign } from "lucide-react";

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

  // 1. Carga Inicial
  useEffect(() => {
    async function loadData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);
        setCategorias(await resCat.json());
        setAllSubcategorias(await resSub.json());
      } catch (err) { 
        console.error("Error cargando categorías");
      }
    }
    loadData();
  }, []);

  // 2. Construcción de Nombre (Con guardas para evitar Undefined)
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
    return allSubcategorias.filter(s => String(s.rel_producto_categoria_id) === String(form.categoria_id));
  }, [allSubcategorias, form.categoria_id]);

  // 3. Generador de SKU
  const solicitarNuevoSku = async (subId: string) => {
    if (!subId || !form.categoria_id) return;
    setGeneratingSku(true);
    try {
      const cat = categorias.find(c => String(c.producto_categoria_id) === String(form.categoria_id));
      const nombreCat = cat?.producto_categoria_nombre?.toUpperCase() || "";
      const prefijo = nombreCat.includes("MERCADO PUBLICO") ? "60" : "50";
      
      const res = await fetch(`/api/obuma/siguiente-sku?prefijoSub=${prefijo}${subId}`);
      const data = await res.json();
      if (data.sku) setForm(prev => ({ ...prev, sku: String(data.sku), subcategoria_id: subId }));
    } catch (err) { 
      console.error("Error obteniendo SKU");
    } finally { 
      setGeneratingSku(false); 
    }
  };

  // 4. Envío Protegido
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // VALIDACIÓN PREVIA: No enviar si faltan datos críticos que el backend usa con .toUpperCase()
    if (!form.nombre_completo || !form.sku || !form.categoria_id) {
      setStatus({ type: 'error', msg: "Faltan datos obligatorios (Nombre, SKU o Categoría)" });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/obuma/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Enviamos strings explícitos para evitar que el backend reciba null/undefined
        body: JSON.stringify({
          ...form,
          nombre_completo: String(form.nombre_completo),
          sku: String(form.sku),
          categoria_id: String(form.categoria_id),
          subcategoria_id: String(form.subcategoria_id)
        }),
      });

      const responseData = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', msg: `¡LISTO! SKU: ${form.sku} creado.` });
        const lastSub = form.subcategoria_id;
        setNameParts({ c1: "", c2: "", c3: "", unit: "MT", c4: "" });
        setForm(prev => ({ ...prev, precio_costo: 0, precio_venta: 0 }));
        await solicitarNuevoSku(lastSub);
      } else {
        // Aquí capturamos el error detallado del backend
        setStatus({ type: 'error', msg: responseData.error || "Error 500: Revisa los campos." });
      }
    } catch (error) { 
      setStatus({ type: 'error', msg: "Error de red o servidor no disponible." }); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 bg-[#f8fafc] min-h-screen">
      <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-10 space-y-10">
          
          {/* SECCIÓN 1: NOMBRE */}
          <section className="space-y-4">
            <h2 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em]">1. Definición del Producto</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <input placeholder="TIPO" className="p-4 bg-slate-50 border rounded-2xl font-bold uppercase text-sm outline-none focus:ring-2 ring-blue-100" value={nameParts.c1} onChange={e => setNameParts({...nameParts, c1: e.target.value})} />
              <input placeholder="ATRIBUTO" className="p-4 bg-slate-50 border rounded-2xl font-bold uppercase text-sm outline-none focus:ring-2 ring-blue-100" value={nameParts.c2} onChange={e => setNameParts({...nameParts, c2: e.target.value})} />
              <div className="flex gap-2 col-span-2">
                <input placeholder="MEDIDA" className="flex-1 p-4 bg-slate-50 border rounded-2xl font-bold text-sm outline-none" value={nameParts.c3} onChange={e => setNameParts({...nameParts, c3: e.target.value})} />
                <select className="p-4 bg-slate-100 border rounded-2xl font-bold text-xs outline-none" value={nameParts.unit} onChange={e => setNameParts({...nameParts, unit: e.target.value})}>
                  <option value="MT">MT</option><option value="KG">KG</option><option value="UN">UN</option>
                </select>
                <input placeholder="MARCA" className="flex-1 p-4 bg-slate-50 border rounded-2xl font-bold text-sm outline-none" value={nameParts.c4} onChange={e => setNameParts({...nameParts, c4: e.target.value})} />
              </div>
            </div>
            <div className="p-5 bg-slate-900 rounded-2xl">
               <p className="text-blue-400 text-[10px] font-bold uppercase mb-1">Nombre Resultante:</p>
               <p className="text-white font-bold text-lg uppercase tracking-tight">{form.nombre_completo || "ESCRIBA LOS DATOS ARRIBA..."}</p>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* SECCIÓN 2: CATEGORÍAS */}
            <section className="space-y-4">
              <h2 className="text-[11px] font-black text-blue-600 uppercase">2. Categorización</h2>
              <div className="space-y-3">
                <select required className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500" value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}>
                  <option value="">-- Seleccionar Categoría --</option>
                  {categorias.map(c => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                </select>
                <select required disabled={!form.categoria_id} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 disabled:opacity-50" value={form.subcategoria_id} onChange={e => solicitarNuevoSku(e.target.value)}>
                  <option value="">-- Seleccionar Subcategoría --</option>
                  {subCategoriasFiltradas.map(s => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
                </select>
              </div>
              <div className="mt-4 p-8 bg-blue-50 rounded-[2rem] border-2 border-dashed border-blue-200 flex flex-col items-center">
                <span className="text-[10px] font-bold text-blue-500 uppercase mb-2">SKU Generado</span>
                <div className="flex items-center gap-4">
                  <span className="text-4xl font-black text-blue-900">{form.sku || "---"}</span>
                  <button type="button" onClick={() => solicitarNuevoSku(form.subcategoria_id)} className="p-2 bg-white rounded-full shadow hover:bg-blue-100 transition-colors">
                    <RefreshCcw size={20} className={generatingSku ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
            </section>

            {/* SECCIÓN 3: PRECIOS */}
            <section className="space-y-4">
              <h2 className="text-[11px] font-black text-blue-600 uppercase">3. Valores y Estados</h2>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input type="number" placeholder="COSTO" className="flex-1 p-4 bg-white border-2 border-slate-100 rounded-2xl font-bold outline-none" value={form.precio_costo} onChange={e => setForm({...form, precio_costo: Number(e.target.value)})} />
                  <label className="flex items-center gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[10px] font-bold">
                    <input type="checkbox" checked={form.costo_incluye_iva} onChange={e => setForm({...form, costo_incluye_iva: e.target.checked})} /> IVA
                  </label>
                </div>
                <div className="flex gap-2">
                  <input type="number" placeholder="VENTA" className="flex-1 p-4 bg-white border-2 border-blue-100 rounded-2xl font-bold text-blue-700 outline-none" value={form.precio_venta} onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} />
                  <label className="flex items-center gap-2 p-4 bg-blue-600 rounded-2xl text-white text-[10px] font-bold">
                    <input type="checkbox" className="accent-white" checked={form.venta_incluye_iva} onChange={e => setForm({...form, venta_incluye_iva: e.target.checked})} /> IVA
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-2">
                   {[{k:'se_puede_vender', l:'Venta'}, {k:'se_puede_comprar', l:'Compra'}, {k:'se_mantiene_stock', l:'Stock'}].map(i => (
                     <label key={i.k} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[11px] font-bold uppercase text-slate-500">{i.l}</span>
                        <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={(form as any)[i.k]} onChange={e => setForm({...form, [i.k]: e.target.checked})} />
                     </label>
                   ))}
                </div>
              </div>
            </section>
          </div>

          {status && (
            <div className={`p-4 rounded-2xl flex items-center gap-3 border-2 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              {status.type === 'success' ? <Check size={20}/> : <AlertCircle size={20}/>}
              <span className="font-bold text-sm uppercase">{status.msg}</span>
            </div>
          )}

          <button 
            onClick={handleSubmit}
            disabled={loading || !form.sku || !form.nombre_completo || !form.categoria_id}
            className="w-full bg-[#00338d] hover:bg-blue-900 disabled:bg-slate-200 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-4 transition-all"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : <PackagePlus size={24} />}
            CREAR PRODUCTO EN OBUMA
          </button>
        </div>
      </div>
    </div>
  );
}