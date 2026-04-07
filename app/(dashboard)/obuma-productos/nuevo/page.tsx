"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, PackagePlus, RefreshCcw, AlertCircle, Check, DollarSign, Layers, Tag, BarChart3, Camera, X } from "lucide-react";

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
  
  // --- NUEVOS ESTADOS PARA IMAGEN ---
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    imagen_data: "" // Para enviar a la API de Obuma
  });

  // --- LÓGICA DE CARGA DE ARCHIVO ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImagePreview(base64String);
        setForm(prev => ({ ...prev, imagen_data: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setForm(prev => ({ ...prev, imagen_data: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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

  // --- LÓGICA DE SKU ACTUALIZADA (70 para B2B) ---
  const solicitarNuevoSku = async (subId: string) => {
    if (!subId) {
        setForm(prev => ({ ...prev, subcategoria_id: "", sku: "" }));
        return;
    }
    setGeneratingSku(true);
    setForm(prev => ({ ...prev, subcategoria_id: subId }));
    try {
      const cat = categorias.find(c => String(c.producto_categoria_id) === String(form.categoria_id));
      const nombreCat = cat?.producto_categoria_nombre?.toUpperCase() || "";
      
      let prefijo = "50"; // Por defecto
      if (nombreCat.includes("MERCADO PUBLICO")) prefijo = "60";
      if (nombreCat.includes("MAYORISTA CONSTRUCTOR B2B")) prefijo = "70"; // Nueva regla

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
        setStatus({ type: 'success', msg: `Producto ${form.sku} creado exitosamente` });
        // Reset parcial
        setNameParts({ c1: "", c2: "", c3: "", unit: "MT", c4: "" });
        removeImage();
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
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <PackagePlus className="text-blue-600" /> Maestro de Productos
            </h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Intranet Mayorista Constructor</p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black text-emerald-700 uppercase">Obuma Sync Activo</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          <div className="lg:col-span-7 space-y-6">
            {/* 1. DEFINICIÓN DE NOMBRE */}
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
                <input placeholder="MARCA O DETALLE ADICIONAL" className="col-span-2 md:col-span-4 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 ring-blue-500/20" value={nameParts.c4} onChange={e => setNameParts({...nameParts, c4: e.target.value})} />
              </div>

              <div className="mt-6 p-4 bg-slate-900 rounded-2xl border-l-4 border-blue-500 shadow-inner">
                <span className="text-blue-400 text-[9px] font-black uppercase block mb-1">Resultado Final:</span>
                <p className="text-white font-bold text-lg uppercase truncate leading-tight">
                  {form.nombre_completo || "Esperando datos..."}
                </p>
              </div>
            </div>

            {/* 2. CLASIFICACIÓN */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6">
                <Layers className="text-indigo-600" size={18} />
                <h2 className="font-bold text-sm uppercase tracking-tight">2. Categorización</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500" value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}>
                    <option value="">Seleccione Categoría...</option>
                    {categorias.map(c => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                  </select>
                  <select disabled={!form.categoria_id} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 disabled:opacity-50" value={form.subcategoria_id} onChange={e => solicitarNuevoSku(e.target.value)}>
                    <option value="">Seleccione Subcategoría...</option>
                    {subCategoriasFiltradas.map(s => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
                  </select>
                </div>
                
                <div className="bg-indigo-600 rounded-2xl p-4 flex flex-col items-center justify-center text-white shadow-md">
                  <span className="text-[9px] font-black uppercase opacity-60 mb-1 tracking-widest text-center">SKU ASIGNADO</span>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black tracking-tighter">{generatingSku ? "..." : (form.sku || "---")}</span>
                    <button onClick={() => solicitarNuevoSku(form.subcategoria_id)} disabled={!form.subcategoria_id} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
                      <RefreshCcw size={16} className={generatingSku ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 sticky top-6">
              
              {/* SECCIÓN IMAGEN */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Camera className="text-blue-600" size={18} />
                  <h2 className="font-bold text-sm uppercase tracking-tight">Foto del Producto</h2>
                </div>
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative group cursor-pointer border-2 border-dashed rounded-3xl h-56 flex flex-col items-center justify-center transition-all overflow-hidden ${imagePreview ? 'border-transparent bg-slate-50' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50'}`}
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-contain p-2" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeImage(); }}
                          className="bg-red-500 p-2 rounded-full text-white hover:scale-110 transition-transform"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6">
                      <div className="bg-blue-50 text-blue-600 p-4 rounded-full inline-block mb-3">
                        <Camera size={28} />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Click para seleccionar foto</p>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                </div>
              </div>

              {/* SECCIÓN PRECIOS */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="text-emerald-600" size={18} />
                  <h2 className="font-bold text-sm uppercase tracking-tight">Valores Comerciales</h2>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" size={14} />
                        <input type="number" placeholder="PRECIO VENTA NETO" className="w-full pl-8 p-3 bg-blue-50 text-blue-700 border-2 border-transparent rounded-xl font-black text-sm outline-none focus:border-blue-200" value={form.precio_venta} onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-400 uppercase">Venta</span>
                    </div>
                </div>

                {status && (
                  <div className={`p-4 rounded-2xl flex items-center gap-3 border ${status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                    {status.type === 'success' ? <Check size={18}/> : <AlertCircle size={18}/>}
                    <p className="text-[10px] font-black uppercase leading-tight">{status.msg}</p>
                  </div>
                )}

                <button 
                  onClick={handleSubmit}
                  disabled={loading || !form.sku || !form.nombre_completo}
                  className="w-full bg-[#00338d] hover:bg-blue-900 disabled:bg-slate-200 disabled:text-slate-400 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-900/10 flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <PackagePlus size={20} />}
                  <span className="text-xs">Sincronizar con Obuma</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}