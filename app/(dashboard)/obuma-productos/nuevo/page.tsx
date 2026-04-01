"use client";

import { useState, useEffect, useMemo } from "react";
import { Save, Loader2, PackagePlus, RefreshCcw, AlertCircle, Check, DollarSign, Layers, Tag, BarChart3, Info } from "lucide-react";

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

  // 3. Filtrado de Subcategorías
  const subCategoriasFiltradas = useMemo(() => {
    if (!form.categoria_id) return [];
    return allSubcategorias.filter(s => 
      String(s.rel_producto_categoria_id) === String(form.categoria_id)
    );
  }, [allSubcategorias, form.categoria_id]);

  // 4. Generador de SKU
  const solicitarNuevoSku = async (subId: string) => {
    if (!subId || subId === "") {
        setForm(prev => ({ ...prev, subcategoria_id: "", sku: "" }));
        return;
    }

    setGeneratingSku(true);
    setForm(prev => ({ ...prev, subcategoria_id: subId }));

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
        const currentSub = form.subcategoria_id;
        setNameParts({ c1: "", c2: "", c3: "", unit: "MT", c4: "" });
        setForm(prev => ({ ...prev, precio_costo: 0, precio_venta: 0 }));
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
    <div className="min-h-screen bg-[#f1f5f9] p-6 lg:p-12 text-slate-800 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <PackagePlus className="text-blue-600" size={36} />
              Maestro de Productos
            </h1>
            <p className="text-slate-500 font-medium mt-1 uppercase text-xs tracking-widest">Sincronización directa Obuma ERP</p>
          </div>
          <div className="flex items-center gap-2 bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-slate-200">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Servidor Activo</span>
          </div>
        </div>

        {/* CONTENEDOR PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* COLUMNA IZQUIERDA: DEFINICIÓN (6 COLUMNAS) */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 transition-all">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <Tag size={22} />
                </div>
                <h2 className="text-lg font-bold text-slate-800">1. Identidad y Nombre</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block">Tipo de Producto</label>
                  <input placeholder="TIPO" className="w-full p-4 bg-slate-50 border border-transparent rounded-2xl font-bold uppercase text-sm outline-none focus:bg-white focus:border-blue-500 transition-all" value={nameParts.c1} onChange={e => setNameParts({...nameParts, c1: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block">Atributo</label>
                  <input placeholder="ATRIBUTO" className="w-full p-4 bg-slate-50 border border-transparent rounded-2xl font-bold uppercase text-sm outline-none focus:bg-white focus:border-blue-500 transition-all" value={nameParts.c2} onChange={e => setNameParts({...nameParts, c2: e.target.value})} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block">Medida / Marca / Color</label>
                  <div className="flex gap-2">
                    <input placeholder="MEDIDA" className="flex-1 p-4 bg-slate-50 border border-transparent rounded-2xl font-bold text-sm outline-none focus:bg-white focus:border-blue-500 transition-all" value={nameParts.c3} onChange={e => setNameParts({...nameParts, c3: e.target.value})} />
                    <select className="p-4 bg-slate-100 rounded-2xl font-bold text-xs outline-none cursor-pointer hover:bg-slate-200 transition-colors" value={nameParts.unit} onChange={e => setNameParts({...nameParts, unit: e.target.value})}>
                      <option value="MT">MT</option><option value="KG">KG</option><option value="UN">UN</option><option value="MM">MM</option>
                    </select>
                    <input placeholder="MARCA/COLOR" className="flex-1 p-4 bg-slate-50 border border-transparent rounded-2xl font-bold text-sm outline-none focus:bg-white focus:border-blue-500 transition-all" value={nameParts.c4} onChange={e => setNameParts({...nameParts, c4: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* VISTA PREVIA NOMBRE */}
              <div className="mt-8 p-7 bg-slate-900 rounded-[2rem] relative overflow-hidden group border-b-8 border-blue-600 shadow-xl">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Info size={100} color="white" />
                </div>
                <span className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] block mb-2">Nombre Final para Facturación:</span>
                <p className="text-white text-3xl font-black uppercase tracking-tight break-words leading-tight">
                  {form.nombre_completo || "ESPERANDO DATOS..."}
                </p>
              </div>
            </div>

            {/* SECCIÓN 2: CATEGORIZACIÓN */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Layers size={22} />
                </div>
                <h2 className="text-lg font-bold text-slate-800">2. Clasificación</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block">Categoría Padre</label>
                    <select className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all" value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}>
                      <option value="">-- Seleccionar Categoría --</option>
                      {categorias.map(c => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block">Subcategoría</label>
                    <select disabled={!form.categoria_id} className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-sm outline-none focus:bg-white focus:border-indigo-500 disabled:opacity-30 transition-all" value={form.subcategoria_id} onChange={e => solicitarNuevoSku(e.target.value)}>
                      <option value="">-- Seleccionar Subcategoría --</option>
                      {subCategoriasFiltradas.map(s => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
                    </select>
                  </div>
                </div>

                {/* SKU CARD */}
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2.5rem] p-8 text-center shadow-lg shadow-blue-200 flex flex-col items-center justify-center min-h-[220px] group transition-transform hover:scale-[1.01]">
                  <span className="text-indigo-200 text-[10px] font-black uppercase tracking-[0.3em] mb-4">SKU Autogenerado</span>
                  <div className="flex items-center gap-6">
                    <span className="text-6xl font-black text-white tracking-tighter">
                      {generatingSku ? "..." : (form.sku || "---")}
                    </span>
                    <button type="button" onClick={() => solicitarNuevoSku(form.subcategoria_id)} disabled={!form.subcategoria_id || generatingSku} className="p-4 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all active:scale-90 disabled:opacity-20">
                      <RefreshCcw size={28} className={generatingSku ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: VALORES Y ACCIÓN (4 COLUMNAS) */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 sticky top-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <BarChart3 size={22} />
                </div>
                <h2 className="text-lg font-bold text-slate-800">3. Comercial</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block">Precio de Costo</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input type="number" className="w-full pl-10 p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-slate-300 transition-all text-lg" value={form.precio_costo} onChange={e => setForm({...form, precio_costo: Number(e.target.value)})} />
                    </div>
                    <label className="flex flex-col items-center justify-center px-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100">
                      <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={form.costo_incluye_iva} onChange={e => setForm({...form, costo_incluye_iva: e.target.checked})} />
                      <span className="text-[9px] font-black mt-1">IVA</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-blue-600 uppercase ml-2 block">Precio de Venta</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600" size={18} />
                      <input type="number" className="w-full pl-10 p-4 bg-blue-50 text-blue-700 border-2 border-transparent rounded-2xl font-black outline-none focus:border-blue-500 transition-all text-xl" value={form.precio_venta} onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} />
                    </div>
                    <label className="flex flex-col items-center justify-center px-4 bg-blue-600 rounded-2xl text-white cursor-pointer shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors">
                      <input type="checkbox" className="w-5 h-5 accent-white" checked={form.venta_incluye_iva} onChange={e => setForm({...form, venta_incluye_iva: e.target.checked})} />
                      <span className="text-[9px] font-black mt-1">IVA</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  {[
                    {k:'se_puede_vender', l:'Permitir Venta'}, 
                    {k:'se_puede_comprar', l:'Permitir Compra'}, 
                    {k:'se_mantiene_stock', l:'Controlar Stock'}
                  ].map(i => (
                    <label key={i.k} className="flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-all cursor-pointer group">
                      <span className="text-[11px] font-black uppercase text-slate-500 group-hover:text-blue-600">{i.l}</span>
                      <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={(form as any)[i.k]} onChange={e => setForm({...form, [i.k as any]: e.target.checked})} />
                    </label>
                  ))}
                </div>

                {/* STATUS MESSAGES */}
                {status && (
                  <div className={`p-5 rounded-3xl flex items-center gap-4 border-2 animate-in fade-in slide-in-from-top-4 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                    {status.type === 'success' ? <Check className="text-emerald-500" size={24}/> : <AlertCircle className="text-rose-500" size={24}/>}
                    <p className="text-xs font-black uppercase tracking-tight">{status.msg}</p>
                  </div>
                )}

                {/* SUBMIT BUTTON */}
                <button 
                  onClick={handleSubmit}
                  disabled={loading || !form.sku || !form.nombre_completo || !form.categoria_id || !form.subcategoria_id}
                  className="w-full bg-[#00338d] hover:bg-blue-900 disabled:bg-slate-200 disabled:text-slate-400 text-white py-7 rounded-[2.5rem] font-black uppercase tracking-[0.3em] shadow-2xl shadow-blue-200 flex items-center justify-center gap-4 transition-all active:scale-[0.97] group overflow-hidden relative"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  {loading ? <Loader2 className="animate-spin" size={24} /> : <PackagePlus size={24} />}
                  <span className="relative z-10 text-sm">Crear Producto</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}