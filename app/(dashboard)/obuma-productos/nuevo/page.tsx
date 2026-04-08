"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, PackagePlus, RefreshCcw, AlertCircle, Check, DollarSign, Layers, Tag, Camera, X, Box, Ruler } from "lucide-react";

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

  // Estado consolidado para el nombre
  const [nameData, setNameData] = useState({ 
    articulo: "", 
    especificacion: "", 
    medida: "", 
    unidad: "MT" 
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

  // Carga de Imagen con limpieza inmediata
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setStatus({ type: 'error', msg: "Imagen muy pesada (máx 5MB)" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImagePreview(base64String);
        // Enviamos el base64 sin el prefijo para no corromper la API
        const base64Pure = base64String.split(',')[1];
        setForm(prev => ({ ...prev, imagen_data: base64Pure, imagen_nombre: file.name }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setForm(prev => ({ ...prev, imagen_data: "", imagen_nombre: "" }));
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

  // Constructor de nombre automático
  useEffect(() => {
    const clean = (t: string) => t.toUpperCase().trim();
    const parts = [
      clean(nameData.articulo),
      clean(nameData.especificacion),
      nameData.medida ? `${clean(nameData.medida)}${nameData.unidad}` : ""
    ].filter(Boolean);
    setForm(prev => ({ ...prev, nombre_completo: parts.join(" ") }));
  }, [nameData]);

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
      const nombreCat = cat?.producto_categoria_nombre?.toUpperCase() || "";
      
      let prefijo = "50";
      if (nombreCat.includes("MERCADO PUBLICO")) prefijo = "60";
      if (nombreCat.includes("MAYORISTA CONSTRUCTOR B2B")) prefijo = "70";

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
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/obuma/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      
      if (res.ok) {
        setStatus({ type: 'success', msg: `Producto ${form.sku} creado exitosamente` });
        setNameData({ articulo: "", especificacion: "", medida: "", unidad: "MT" });
        removeImage();
        setForm(prev => ({ ...prev, precio_costo: 0, precio_venta: 0 }));
        await solicitarNuevoSku(form.subcategoria_id);
      } else {
        setStatus({ type: 'error', msg: data.error || "Error al crear" });
      }
    } catch (error) { 
      setStatus({ type: 'error', msg: "Error de red" }); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] p-4 lg:p-12 text-slate-800 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Minimalista */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <PackagePlus size={18} />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Nuevo Producto</h1>
            </div>
            <p className="text-slate-500 font-medium text-sm">Maestro de Inventario • Mayorista Constructor</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
             <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Obuma Cloud Sync</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Columna Izquierda: Datos */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Nombre y Medidas */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6">
                <Tag className="text-blue-600" size={18} />
                <h2 className="font-bold text-xs uppercase tracking-widest text-slate-400">Identificación</h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase ml-1 text-slate-400">Artículo Principal</label>
                    <input 
                      placeholder="Ej: TUBO PVC, CEMENTO, MALLA" 
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold uppercase text-sm outline-none focus:ring-2 ring-blue-500/10 transition-all"
                      value={nameData.articulo} 
                      onChange={e => setNameData({...nameData, articulo: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase ml-1 text-slate-400">Dimensión / Peso</label>
                    <div className="flex gap-2">
                      <input 
                        placeholder="Ej: 110, 25, 3/4" 
                        className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none"
                        value={nameData.medida} 
                        onChange={e => setNameData({...nameData, medida: e.target.value})} 
                      />
                      <select 
                        className="w-24 p-4 bg-slate-100 rounded-2xl font-bold text-xs outline-none cursor-pointer"
                        value={nameData.unidad} 
                        onChange={e => setNameData({...nameData, unidad: e.target.value})}
                      >
                        <option value="MT">MT</option>
                        <option value="KG">KG</option>
                        <option value="GL">GL</option>
                        <option value="MM">MM</option>
                        <option value='"'>" (PULG)</option>
                        <option value="L">LTS</option>
                        <option value="UN">UN</option>
                        <option value="ROL">ROL</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase ml-1 text-slate-400">Especificaciones Técnicas (Texto Libre)</label>
                  <input 
                    placeholder="Ej: CLASE 10 HIDRÁULICO C/CAMPANA GRIS" 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold uppercase text-sm outline-none focus:ring-2 ring-blue-500/10"
                    value={nameData.especificacion} 
                    onChange={e => setNameData({...nameData, especificacion: e.target.value})} 
                  />
                </div>

                <div className="mt-4 p-5 bg-slate-900 rounded-2xl">
                  <span className="text-blue-400 text-[9px] font-black uppercase block mb-1">Preview en Obuma:</span>
                  <p className="text-white font-bold text-lg leading-tight uppercase">
                    {form.nombre_completo || "SIN NOMBRE..."}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Categoría y SKU */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6">
                <Layers className="text-blue-600" size={18} />
                <h2 className="font-bold text-xs uppercase tracking-widest text-slate-400">Categorización</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-500"
                    value={form.categoria_id} 
                    onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}
                  >
                    <option value="">Categoría Principal...</option>
                    {categorias.map(c => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                  </select>
                  
                  <select 
                    disabled={!form.categoria_id} 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none disabled:opacity-30"
                    value={form.subcategoria_id} 
                    onChange={e => solicitarNuevoSku(e.target.value)}
                  >
                    <option value="">Subcategoría...</option>
                    {subCategoriasFiltradas.map(s => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
                  </select>
                </div>

                <div className="bg-blue-50 rounded-2xl p-6 flex flex-col items-center justify-center border border-blue-100">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Código SKU</span>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-black text-blue-900 tracking-tighter">
                      {generatingSku ? <Loader2 className="animate-spin" /> : (form.sku || "---")}
                    </span>
                    <button 
                      onClick={() => solicitarNuevoSku(form.subcategoria_id)}
                      disabled={!form.subcategoria_id}
                      className="p-2 bg-white rounded-full text-blue-600 shadow-sm hover:shadow-md transition-all active:scale-90"
                    >
                      <RefreshCcw size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Foto y Acción */}
          <div className="space-y-6">
            
            {/* Foto del Producto */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
               <div className="flex items-center gap-2 mb-4">
                <Camera className="text-blue-600" size={16} />
                <h2 className="font-bold text-xs uppercase tracking-widest text-slate-400">Multimedia</h2>
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`relative aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden ${imagePreview ? 'border-transparent bg-slate-50' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'}`}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-contain p-2" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeImage(); }}
                      className="absolute top-2 right-2 bg-white/90 p-2 rounded-full text-red-500 shadow-md hover:bg-red-50"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <Camera size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Subir Foto</p>
                  </div>
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
              </div>
            </div>

            {/* Precios y Envío */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="text-emerald-600" size={16} />
                <h2 className="font-bold text-xs uppercase tracking-widest text-slate-400">Precio</h2>
              </div>
              
              <div className="relative mb-6">
                <input 
                  type="number" 
                  placeholder="0" 
                  className="w-full p-4 pl-10 bg-slate-900 text-white rounded-2xl font-black text-xl outline-none"
                  value={form.precio_venta} 
                  onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} 
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">$</span>
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Venta Neto</span>
              </div>

              {status && (
                <div className={`mb-4 p-4 rounded-xl flex items-center gap-2 border ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                  {status.type === 'success' ? <Check size={16}/> : <AlertCircle size={16}/>}
                  <span className="text-[10px] font-black uppercase leading-tight">{status.msg}</span>
                </div>
              )}

              <button 
                onClick={handleSubmit}
                disabled={loading || !form.sku || !form.nombre_completo}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[2px] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3 transition-all active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <PackagePlus size={18} />}
                Sincronizar Maestro
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}