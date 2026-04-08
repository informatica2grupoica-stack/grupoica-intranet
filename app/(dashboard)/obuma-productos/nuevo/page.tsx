"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, PackagePlus, RefreshCcw, AlertCircle, Check, DollarSign, Camera, X, Layers, ChevronRight } from "lucide-react";

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categorias, setCategorias] = useState<any[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<any[]>([]);

  const [form, setForm] = useState({
    nombre_completo: "",
    sku: "",
    categoria_id: "",
    subcategoria_id: "",
    precio_venta: 0,
    imagen_data: "",
    imagen_nombre: ""
  });

  // Carga inicial de datos desde la API
  useEffect(() => {
    async function loadData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);
        if (!resCat.ok || !resSub.ok) throw new Error();
        const dCat = await resCat.json();
        const dSub = await resSub.json();
        setCategorias(Array.isArray(dCat) ? dCat : []);
        setAllSubcategorias(Array.isArray(dSub) ? dSub : []);
      } catch (err) { 
        setStatus({ type: 'error', msg: "Fallo conexión con Obuma API" }); 
      }
    }
    loadData();
  }, []);

  const subCategoriasFiltradas = useMemo(() => 
    allSubcategorias.filter((s: any) => String(s.rel_producto_categoria_id) === String(form.categoria_id))
  , [allSubcategorias, form.categoria_id]);

  const solicitarNuevoSku = async (subId: string) => {
    if (!subId) return;
    setGeneratingSku(true);
    setForm(prev => ({ ...prev, subcategoria_id: subId }));
    
    try {
      const cat: any = categorias.find((c: any) => String(c.producto_categoria_id) === String(form.categoria_id));
      const nombreCat = cat?.producto_categoria_nombre?.toUpperCase() || "";
      
      let prefijo = "50";
      if (nombreCat.includes("MAYORISTA") || nombreCat.includes("B2B")) prefijo = "70";

      const res = await fetch(`/api/obuma/siguiente-sku?prefijoSub=${prefijo}${subId}`);
      const data = await res.json();
      if (data.sku) setForm(prev => ({ ...prev, sku: String(data.sku) }));
    } catch (err) { 
      setStatus({ type: 'error', msg: "Error al generar SKU" }); 
    } finally { 
      setGeneratingSku(false); 
    }
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setStatus({ type: 'error', msg: "Imagen muy pesada (Máx 5MB)" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        const base64Pure = base64.split(',')[1];
        // Sanitizamos el nombre del archivo para evitar errores en la API
        const cleanFileName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
        setForm(prev => ({ ...prev, imagen_data: base64Pure, imagen_nombre: cleanFileName }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!form.sku || !form.nombre_completo) {
      setStatus({ type: 'error', msg: "SKU y Nombre son obligatorios" });
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
          nombre_completo: form.nombre_completo.toUpperCase().trim(),
          venta_incluye_iva: true,
          se_mantiene_stock: true,
          se_puede_vender: true
        }),
      });

      if (res.ok) {
        setStatus({ type: 'success', msg: `Producto ${form.sku} sincronizado` });
        setForm(prev => ({ ...prev, nombre_completo: "", precio_venta: 0 }));
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await solicitarNuevoSku(form.subcategoria_id);
      } else {
        const errData = await res.json();
        setStatus({ type: 'error', msg: errData.error || "Error en Obuma" });
      }
    } catch (error) { 
      setStatus({ type: 'error', msg: "Fallo de red" }); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-blue-100 antialiased font-sans">
      <div className="max-w-[900px] mx-auto p-6 md:p-12">
        
        {/* HEADER */}
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase italic flex items-center gap-3">
              <PackagePlus className="text-blue-600" size={32} />
              Nuevo Producto
            </h1>
            <p className="text-slate-400 text-[10px] font-bold tracking-[3px] uppercase mt-1">Maestro de Inventario Chile</p>
          </div>
          <div className="hidden md:flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase text-slate-500">API Obuma Activa</span>
          </div>
        </header>

        <div className="space-y-8">
          
          {/* SECCIÓN 1: IDENTIDAD DEL PRODUCTO */}
          <section className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-8 md:p-10 space-y-8">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-blue-600 uppercase tracking-widest ml-1">Nombre Completo del Producto</label>
                <input 
                  type="text"
                  placeholder="EJ: ALICATE METÁLICO 12CM PROFESIONAL..."
                  className="w-full text-3xl md:text-4xl font-black tracking-tighter outline-none placeholder:text-slate-200 uppercase"
                  value={form.nombre_completo}
                  onChange={(e) => setForm({...form, nombre_completo: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-50">
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Precio Venta (Bruto)</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-300 text-xl">$</span>
                    <input 
                      type="number"
                      className="w-full bg-slate-50 p-5 pl-12 rounded-3xl text-2xl font-black outline-none border border-transparent focus:bg-white focus:border-blue-100 transition-all"
                      value={form.precio_venta}
                      onChange={(e) => setForm({...form, precio_venta: Number(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">SKU Generado</label>
                  <div className="bg-slate-900 p-5 rounded-3xl flex items-center justify-between shadow-lg">
                    <span className="text-2xl font-black text-blue-400 italic tracking-tighter">
                      {generatingSku ? "..." : (form.sku || "----")}
                    </span>
                    <button 
                      type="button"
                      onClick={() => solicitarNuevoSku(form.subcategoria_id)}
                      disabled={!form.subcategoria_id || generatingSku}
                      className="text-white hover:rotate-180 transition-transform duration-500 disabled:opacity-20"
                    >
                      <RefreshCcw size={20} className={generatingSku ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECCIÓN 2: CATEGORIZACIÓN Y FOTO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="text-blue-500" size={18}/>
                <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Jerarquía Obuma</h2>
              </div>
              
              <div className="space-y-4">
                <select 
                  className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-sm outline-none border border-slate-100 appearance-none cursor-pointer"
                  value={form.categoria_id}
                  onChange={(e) => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}
                >
                  <option value="">Seleccionar Categoría...</option>
                  {categorias.map((c: any) => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                </select>

                <select 
                  disabled={!form.categoria_id}
                  className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-sm outline-none border border-slate-100 disabled:opacity-30 appearance-none cursor-pointer"
                  value={form.subcategoria_id}
                  onChange={(e) => solicitarNuevoSku(e.target.value)}
                >
                  <option value="">Seleccionar Subcategoría...</option>
                  {subCategoriasFiltradas.map((s: any) => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
                </select>
              </div>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group relative h-full min-h-[200px] bg-white rounded-[40px] border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all overflow-hidden"
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} className="w-full h-full object-contain p-6" alt="Preview" />
                  <button 
                    onClick={(e) => {e.stopPropagation(); setImagePreview(null); setForm(prev=>({...prev, imagen_data: ""}));}} 
                    className="absolute top-4 right-4 p-3 bg-red-500 text-white rounded-full shadow-lg"
                  >
                    <X size={16}/>
                  </button>
                </>
              ) : (
                <div className="text-center space-y-2">
                  <Camera className="text-slate-300 mx-auto" size={32}/>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subir Imagen</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImage} />
            </div>
          </div>

          {/* BOTÓN FINAL */}
          <div className="space-y-4">
            <button 
              onClick={handleSubmit}
              disabled={loading || !form.sku || !form.nombre_completo}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white p-8 rounded-[40px] font-black text-sm uppercase tracking-[4px] shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-4"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Sincronizar con Obuma"}
            </button>

            {status && (
              <div className={`p-6 rounded-3xl border flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                {status.type === 'success' ? <Check size={20}/> : <AlertCircle size={20}/>}
                <p className="text-[11px] font-black uppercase tracking-tight">{status.msg}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}