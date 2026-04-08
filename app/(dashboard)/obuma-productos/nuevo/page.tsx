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
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<Subcategoria[]>([]);

  // Partes del nombre para el generador automático
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
    imagen_data: "",
    imagen_nombre: ""
  });

  // --- 1. LÓGICA DE IMAGEN (Optimización Base64) ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Límite de 3MB para no saturar el JSON del POST
      if (file.size > 3 * 1024 * 1024) {
        setStatus({ type: 'error', msg: "La imagen es muy pesada (Máx 3MB)" });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Full = reader.result as string;
        setImagePreview(base64Full);
        
        // Obuma requiere el base64 PURO (sin el prefijo data:image/...)
        const base64Clean = base64Full.split(',')[1];
        
        setForm(prev => ({ 
          ...prev, 
          imagen_data: base64Clean,
          imagen_nombre: file.name
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setForm(prev => ({ ...prev, imagen_data: "", imagen_nombre: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- 2. CARGA DE DATOS INICIALES ---
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
        setStatus({ type: 'error', msg: "Error al conectar con la API de Categorías" });
      }
    }
    loadData();
  }, []);

  // --- 3. CONSTRUICTOR DE NOMBRE AUTOMÁTICO ---
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

  // --- 4. GENERADOR DE SKU INTELIGENTE ---
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
      
      // Lógica de prefijos según tu mercado
      let prefijo = "50";
      if (nombreCat.includes("MERCADO PUBLICO")) prefijo = "60";
      if (nombreCat.includes("MAYORISTA")) prefijo = "70";

      const res = await fetch(`/api/obuma/siguiente-sku?prefijoSub=${prefijo}${subId}`);
      const data = await res.json();
      if (data.sku) setForm(prev => ({ ...prev, sku: String(data.sku) }));
    } catch (err) { 
      setStatus({ type: 'error', msg: "Error generando SKU" });
    } finally { 
      setGeneratingSku(false); 
    }
  };

  // --- 5. ENVÍO FINAL ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre_completo || !form.sku || !form.categoria_id || !form.subcategoria_id) {
      setStatus({ type: 'error', msg: "Faltan campos obligatorios (Nombre, SKU, Categoría)" });
      return;
    }
    
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
        setStatus({ type: 'success', msg: `Producto ${form.sku} creado con éxito` });
        
        // Reset parcial: Limpiamos nombre y foto, pero mantenemos categoría para el siguiente producto
        setNameParts({ c1: "", c2: "", c3: "", unit: "MT", c4: "" });
        removeImage();
        setForm(prev => ({ 
            ...prev, 
            precio_costo: 0, 
            precio_venta: 0, 
            imagen_data: "", 
            imagen_nombre: "" 
        }));
        
        // Pedimos el siguiente SKU de la misma subcategoría de inmediato
        await solicitarNuevoSku(form.subcategoria_id);
      } else {
        setStatus({ type: 'error', msg: result.error || "Error en el servidor" });
      }
    } catch (error) { 
      setStatus({ type: 'error', msg: "Error crítico de conexión" }); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4 lg:p-8">
      <div className="max-w-[1100px] mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
              <PackagePlus size={32} className="text-blue-600" /> 
              MAESTRO DE PRODUCTOS
            </h1>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Panel de Control Mayorista Constructor</p>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
             <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse ml-2"></div>
             <span className="text-[10px] font-black text-slate-600 uppercase pr-2">Obuma Cloud Sync</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* COLUMNA IZQUIERDA: CONFIGURACIÓN */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* SECCIÓN 1: NOMBRE */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-blue-600 p-2 rounded-lg text-white"><Tag size={20}/></div>
                <h2 className="font-black text-slate-800 uppercase text-sm tracking-tight">1. Construcción de Identidad</h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Tipo</label>
                  <input placeholder="Ej: TUBO" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase text-xs focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" value={nameParts.c1} onChange={e => setNameParts({...nameParts, c1: e.target.value})} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Atributo</label>
                  <input placeholder="Ej: PVC" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase text-xs focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" value={nameParts.c2} onChange={e => setNameParts({...nameParts, c2: e.target.value})} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Medida</label>
                  <input placeholder="Ej: 110" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" value={nameParts.c3} onChange={e => setNameParts({...nameParts, c3: e.target.value})} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Unidad</label>
                  <select className="p-4 bg-slate-100 rounded-2xl font-black text-xs outline-none cursor-pointer" value={nameParts.unit} onChange={e => setNameParts({...nameParts, unit: e.target.value})}>
                    <option value="MT">MT</option><option value="KG">KG</option><option value="UN">UN</option><option value="MM">MM</option>
                  </select>
                </div>
                <div className="col-span-2 md:col-span-4 flex flex-col gap-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Marca o Detalle Adicional</label>
                  <input placeholder="Ej: TIGRE CLASE 10" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" value={nameParts.c4} onChange={e => setNameParts({...nameParts, c4: e.target.value})} />
                </div>
              </div>

              <div className="mt-8 p-6 bg-slate-900 rounded-[2rem] border-b-8 border-blue-600 shadow-xl">
                <span className="text-blue-400 text-[10px] font-black uppercase tracking-widest block mb-2">Vista Previa Nombre:</span>
                <p className="text-white font-black text-xl uppercase leading-none break-words">
                  {form.nombre_completo || "SIN NOMBRE"}
                </p>
              </div>
            </div>

            {/* SECCIÓN 2: CATEGORIZACIÓN */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-indigo-600 p-2 rounded-lg text-white"><Layers size={20}/></div>
                <h2 className="font-black text-slate-800 uppercase text-sm tracking-tight">2. Ubicación en Catálogo</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:border-indigo-500" value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}>
                    <option value="">Categoría Principal...</option>
                    {categorias.map(c => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                  </select>
                  
                  <select disabled={!form.categoria_id} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs outline-none disabled:opacity-50 focus:border-indigo-500" value={form.subcategoria_id} onChange={e => solicitarNuevoSku(e.target.value)}>
                    <option value="">Subcategoría...</option>
                    {subCategoriasFiltradas.map(s => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
                  </select>
                </div>
                
                <div className="bg-indigo-50 rounded-3xl p-6 border-2 border-indigo-100 flex flex-col items-center justify-center relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-2 opacity-10 text-indigo-600"><Tag size={60}/></div>
                   <span className="text-[10px] font-black text-indigo-400 uppercase mb-1 z-10">SKU Sugerido</span>
                   <div className="flex items-center gap-4 z-10">
                      <span className="text-4xl font-black text-indigo-900 tracking-tighter">
                        {generatingSku ? <Loader2 className="animate-spin text-indigo-400"/> : (form.sku || "---")}
                      </span>
                      {form.subcategoria_id && (
                        <button onClick={() => solicitarNuevoSku(form.subcategoria_id)} className="p-2 bg-indigo-600 text-white rounded-full hover:rotate-180 transition-all duration-500">
                          <RefreshCcw size={14} />
                        </button>
                      )}
                   </div>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: MULTIMEDIA Y PRECIOS */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200 sticky top-8">
              
              {/* IMAGEN PRODUCTO */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Camera className="text-blue-600" size={18} />
                  <h2 className="font-black text-xs uppercase text-slate-500">Imagen del Producto</h2>
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative group cursor-pointer border-4 border-dashed rounded-[2rem] h-64 flex flex-col items-center justify-center transition-all ${imagePreview ? 'border-transparent bg-slate-100' : 'border-slate-100 hover:border-blue-400 hover:bg-blue-50/50'}`}
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-contain p-4 drop-shadow-md" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeImage(); }}
                        className="absolute top-4 right-4 bg-rose-500 p-3 rounded-2xl text-white shadow-lg hover:scale-110 transition-transform"
                      >
                        <X size={20} />
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <div className="bg-white shadow-xl text-blue-600 p-6 rounded-3xl inline-block mb-4 group-hover:scale-110 transition-transform">
                        <Camera size={32} />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Click para cargar</p>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                </div>
              </div>

              {/* PRECIO Y ACCIÓN */}
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-2">
                    <BarChart3 size={14}/> Precio de Venta (Con IVA)
                  </label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-xl">$</div>
                    <input 
                      type="number" 
                      placeholder="0" 
                      className="w-full pl-12 p-5 bg-emerald-50 text-emerald-700 border-2 border-transparent rounded-3xl font-black text-2xl outline-none focus:border-emerald-500 transition-all" 
                      value={form.precio_venta} 
                      onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} 
                    />
                  </div>
                </div>

                {status && (
                  <div className={`p-5 rounded-3xl flex items-start gap-3 border-2 animate-in fade-in slide-in-from-top-4 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                    {status.type === 'success' ? <Check className="mt-1" size={20}/> : <AlertCircle className="mt-1" size={20}/>}
                    <p className="text-xs font-black uppercase leading-tight">{status.msg}</p>
                  </div>
                )}

                <button 
                  onClick={handleSubmit}
                  disabled={loading || !form.sku || !form.nombre_completo}
                  className="w-full bg-[#00338d] hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-xl shadow-blue-900/20 active:scale-[0.98] transition-all"
                >
                  {loading ? <Loader2 className="animate-spin" size={24} /> : <PackagePlus size={24} />}
                  <span className="text-sm">Sincronizar con Obuma</span>
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}