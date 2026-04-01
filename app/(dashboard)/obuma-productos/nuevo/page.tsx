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

  // 1. Carga Inicial de datos
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
        console.error("Error cargando datos de Obuma", err);
        setStatus({ type: 'error', msg: "Error al conectar con la API de categorías" });
      }
    }
    loadData();
  }, []);

  // 2. Lógica de Construcción de Nombre Dinámico
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

  // 3. Filtrado de Subcategorías (MEJORADO)
  const subCategoriasFiltradas = useMemo(() => {
    if (!form.categoria_id) return [];
    return allSubcategorias.filter(s => 
      String(s.rel_producto_categoria_id) === String(form.categoria_id)
    );
  }, [allSubcategorias, form.categoria_id]);

  // 4. Generador de SKU (MEJORADO)
  const solicitarNuevoSku = async (subId: string) => {
    if (!subId || subId === "") {
        setForm(prev => ({ ...prev, subcategoria_id: "", sku: "" }));
        return;
    }

    setGeneratingSku(true);
    setForm(prev => ({ ...prev, subcategoria_id: subId })); // Guardar la subcat inmediatamente

    try {
      const cat = categorias.find(c => String(c.producto_categoria_id) === String(form.categoria_id));
      const nombreCat = cat?.producto_categoria_nombre?.toUpperCase() || "";
      const prefijo = nombreCat.includes("MERCADO PUBLICO") ? "60" : "50";
      
      const res = await fetch(`/api/obuma/siguiente-sku?prefijoSub=${prefijo}${subId}`);
      const data = await res.json();
      
      if (data.sku) {
        setForm(prev => ({ ...prev, sku: String(data.sku) }));
      } else {
        throw new Error("No se generó SKU");
      }
    } catch (err) { 
      console.error("Error obteniendo SKU");
      setStatus({ type: 'error', msg: "No se pudo autogenerar el SKU" });
    } finally { 
      setGeneratingSku(false); 
    }
  };

  // 5. Envío de Formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.nombre_completo || !form.sku || !form.categoria_id || !form.subcategoria_id) {
      setStatus({ type: 'error', msg: "Nombre, SKU, Categoría y Subcategoría son obligatorios" });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/obuma/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          nombre_completo: String(form.nombre_completo).toUpperCase(),
          sku: String(form.sku)
        }),
      });

      const responseData = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', msg: `Producto ${form.sku} creado exitosamente` });
        
        // Mantener la categoría y subcategoría para el siguiente producto
        const currentSub = form.subcategoria_id;
        
        // Limpiar solo los campos de identidad y precios
        setNameParts({ c1: "", c2: "", c3: "", unit: "MT", c4: "" });
        setForm(prev => ({ ...prev, precio_costo: 0, precio_venta: 0 }));
        
        // Pedir un nuevo SKU para la misma subcategoría
        await solicitarNuevoSku(currentSub);
      } else {
        setStatus({ type: 'error', msg: responseData.error || "Error al guardar en Obuma" });
      }
    } catch (error) { 
      setStatus({ type: 'error', msg: "Error de conexión con el servidor" }); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 bg-[#f8fafc] min-h-screen text-slate-800">
      <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-10 space-y-10">
          
          {/* SECCIÓN 1: NOMBRE */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
                <div className="w-1.5 h-5 bg-blue-600 rounded-full"></div>
                <h2 className="text-xs font-black text-blue-600 uppercase tracking-widest">1. Definición del Producto</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <input placeholder="TIPO" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase text-sm outline-none focus:ring-2 ring-blue-100 transition-all" value={nameParts.c1} onChange={e => setNameParts({...nameParts, c1: e.target.value})} />
              <input placeholder="ATRIBUTO" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase text-sm outline-none focus:ring-2 ring-blue-100 transition-all" value={nameParts.c2} onChange={e => setNameParts({...nameParts, c2: e.target.value})} />
              <div className="flex gap-2 col-span-2">
                <input placeholder="MEDIDA" className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={nameParts.c3} onChange={e => setNameParts({...nameParts, c3: e.target.value})} />
                <select className="p-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-xs outline-none cursor-pointer" value={nameParts.unit} onChange={e => setNameParts({...nameParts, unit: e.target.value})}>
                  <option value="MT">MT</option><option value="KG">KG</option><option value="UN">UN</option><option value="MM">MM</option>
                </select>
                <input placeholder="MARCA/COLOR" className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={nameParts.c4} onChange={e => setNameParts({...nameParts, c4: e.target.value})} />
              </div>
            </div>
            <div className="p-5 bg-slate-900 rounded-[1.5rem] border-b-4 border-blue-500 shadow-inner">
               <p className="text-blue-400 text-[9px] font-black uppercase mb-1 tracking-widest">Vista previa en sistema:</p>
               <p className="text-white font-bold text-xl uppercase tracking-tight truncate">
                 {form.nombre_completo || "ESPERANDO DATOS..."}
               </p>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* SECCIÓN 2: CATEGORÍAS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-5 bg-blue-600 rounded-full"></div>
                <h2 className="text-xs font-black text-blue-600 uppercase">2. Categorización</h2>
              </div>
              <div className="space-y-3">
                <select 
                  required 
                  className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 transition-all" 
                  value={form.categoria_id} 
                  onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}
                >
                  <option value="">-- Seleccionar Categoría --</option>
                  {categorias.map(c => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                </select>

                <select 
                  required 
                  disabled={!form.categoria_id} 
                  className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 disabled:opacity-50 transition-all" 
                  value={form.subcategoria_id} 
                  onChange={e => solicitarNuevoSku(e.target.value)}
                >
                  <option value="">-- Seleccionar Subcategoría --</option>
                  {subCategoriasFiltradas.map(s => (
                    <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>
                        {s.producto_subcategoria_nombre}
                    </option>
                  ))}
                </select>
                {form.categoria_id && subCategoriasFiltradas.length === 0 && (
                    <p className="text-[10px] text-rose-500 font-bold px-2">Esta categoría no tiene subcategorías asociadas.</p>
                )}
              </div>

              <div className="mt-4 p-8 bg-gradient-to-br from-blue-50 to-white rounded-[2rem] border-2 border-dashed border-blue-200 flex flex-col items-center group">
                <span className="text-[10px] font-black text-blue-500 uppercase mb-2 tracking-tighter">SKU Autogenerado</span>
                <div className="flex items-center gap-5">
                  <span className="text-5xl font-black text-slate-900 tracking-tighter">
                    {generatingSku ? "..." : (form.sku || "---")}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => solicitarNuevoSku(form.subcategoria_id)}
                    className="p-3 bg-white rounded-full shadow-lg hover:shadow-blue-200 text-blue-600 transition-all active:scale-90 disabled:opacity-50"
                    disabled={!form.subcategoria_id || generatingSku}
                  >
                    <RefreshCcw size={22} className={generatingSku ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
            </section>

            {/* SECCIÓN 3: PRECIOS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-5 bg-blue-600 rounded-full"></div>
                <h2 className="text-xs font-black text-blue-600 uppercase">3. Valores y Estados</h2>
              </div>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="number" placeholder="COSTO" className="w-full pl-10 p-4 bg-white border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-slate-300" value={form.precio_costo} onChange={e => setForm({...form, precio_costo: Number(e.target.value)})} />
                  </div>
                  <label className="flex items-center gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[10px] font-black cursor-pointer select-none">
                    <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={form.costo_incluye_iva} onChange={e => setForm({...form, costo_incluye_iva: e.target.checked})} /> IVA
                  </label>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600" size={16} />
                    <input type="number" placeholder="VENTA" className="w-full pl-10 p-4 bg-white border-2 border-blue-100 rounded-2xl font-black text-blue-700 outline-none focus:border-blue-500" value={form.precio_venta} onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} />
                  </div>
                  <label className="flex items-center gap-2 p-4 bg-blue-600 rounded-2xl text-white text-[10px] font-black cursor-pointer select-none shadow-md">
                    <input type="checkbox" className="w-4 h-4 accent-white" checked={form.venta_incluye_iva} onChange={e => setForm({...form, venta_incluye_iva: e.target.checked})} /> IVA
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-2">
                   {[
                     {k:'se_puede_vender', l:'Permitir Venta'}, 
                     {k:'se_puede_comprar', l:'Permitir Compra'}, 
                     {k:'se_mantiene_stock', l:'Controlar Stock'}
                   ].map(i => (
                     <label key={i.k} className="flex justify-between items-center p-3.5 bg-slate-50 hover:bg-white border border-slate-100 rounded-xl transition-colors cursor-pointer group">
                        <span className="text-[11px] font-bold uppercase text-slate-500 group-hover:text-blue-600">{i.l}</span>
                        <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={(form as any)[i.k]} onChange={e => setForm({...form, [i.k]: e.target.checked})} />
                     </label>
                   ))}
                </div>
              </div>
            </section>
          </div>

          {/* MENSAJES DE ESTADO */}
          {status && (
            <div className={`p-5 rounded-2xl flex items-center gap-3 border-2 animate-in fade-in slide-in-from-bottom-4 ${
                status.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {status.type === 'success' ? <Check className="text-emerald-500" size={24}/> : <AlertCircle className="text-rose-500" size={24}/>}
              <div className="flex flex-col">
                  <span className="font-black text-xs uppercase tracking-widest">{status.type === 'success' ? 'Éxito' : 'Error'}</span>
                  <p className="text-sm font-medium">{status.msg}</p>
              </div>
            </div>
          )}

          <button 
            onClick={handleSubmit}
            disabled={loading || !form.sku || !form.nombre_completo || !form.categoria_id || !form.subcategoria_id}
            className="w-full bg-[#00338d] hover:bg-blue-900 disabled:bg-slate-200 disabled:text-slate-500 text-white py-7 rounded-[2.5rem] font-black uppercase tracking-[0.3em] shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98]"
          >
            {loading ? <Loader2 className="animate-spin" size={28} /> : <PackagePlus size={28} />}
            FINALIZAR Y CREAR EN OBUMA
          </button>
        </div>
      </div>
    </div>
  );
}