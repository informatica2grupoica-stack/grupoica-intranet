"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Loader2, PackagePlus, RefreshCcw, AlertCircle, Check, 
  Camera, X, Layers, ShoppingCart, Warehouse, BadgePercent 
} from "lucide-react";

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
    precio_costo: 0,
    costo_incluye_iva: true,
    precio_venta: 0,
    venta_incluye_iva: true,
    se_puede_vender: true,
    se_puede_comprar: true,
    se_mantiene_stock: true,
    imagen_data: "",
    imagen_nombre: ""
  });

  // Carga de categorías
  useEffect(() => {
    async function loadData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);
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
      const cat = categorias.find((c: any) => String(c.producto_categoria_id) === String(form.categoria_id));
      const nombreCat = cat?.producto_categoria_nombre?.toUpperCase() || "";
      const prefijo = nombreCat.includes("MAYORISTA") ? "70" : "50";
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
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        setForm(prev => ({ 
          ...prev, 
          imagen_data: base64, // Enviamos con prefijo, el backend lo limpia
          imagen_nombre: file.name 
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!form.sku || !form.nombre_completo) {
      setStatus({ type: 'error', msg: "Faltan campos obligatorios" });
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
        setForm(prev => ({ ...prev, nombre_completo: "", precio_venta: 0, precio_costo: 0 }));
        setImagePreview(null);
        await solicitarNuevoSku(form.subcategoria_id);
      } else {
        setStatus({ type: 'error', msg: result.error || "Error en Obuma" });
      }
    } catch (error) { 
      setStatus({ type: 'error', msg: "Error de red" }); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 antialiased font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* HEADER TIPO DASHBOARD */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
              <PackagePlus className="text-blue-600" size={28} />
              NUEVO PRODUCTO
            </h1>
            <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mt-1">Gestión Centralizada / Obuma ERP</p>
          </div>
          <div className="flex gap-2">
             <div className="px-4 py-2 bg-blue-50 rounded-xl flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-blue-700 uppercase">Sucursal Casa Matriz</span>
             </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUMNA IZQUIERDA: DATOS PRINCIPALES */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre del Producto *</label>
                <input 
                  type="text"
                  placeholder="Ej: ALICATE UNIVERSAL 7 PULGADAS"
                  className="w-full bg-slate-50 p-4 rounded-2xl text-lg font-bold outline-none border border-transparent focus:bg-white focus:border-blue-200 transition-all uppercase"
                  value={form.nombre_completo}
                  onChange={(e) => setForm({...form, nombre_completo: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Categoría</label>
                  <select 
                    className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none border border-slate-100 cursor-pointer"
                    value={form.categoria_id}
                    onChange={(e) => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map((c: any) => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Subcategoría</label>
                  <select 
                    disabled={!form.categoria_id}
                    className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none border border-slate-100 disabled:opacity-50 cursor-pointer"
                    value={form.subcategoria_id}
                    onChange={(e) => solicitarNuevoSku(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {subCategoriasFiltradas.map((s: any) => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
                  </select>
                </div>
              </div>
            </section>

            {/* PRECIOS - ESTILO CICA */}
            <section className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <BadgePercent size={14} className="text-blue-500" /> Precios de Costo
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number"
                    className="flex-1 bg-slate-50 p-4 rounded-2xl font-black text-xl outline-none"
                    value={form.precio_costo}
                    onChange={(e) => setForm({...form, precio_costo: Number(e.target.value)})}
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="w-5 h-5 rounded-lg" checked={form.costo_incluye_iva} onChange={(e) => setForm({...form, costo_incluye_iva: e.target.checked})} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">¿IVA?</span>
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-wider flex items-center gap-2">
                  <ShoppingCart size={14} /> Precio de Venta Público
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number"
                    className="flex-1 bg-blue-50 p-4 rounded-2xl font-black text-xl text-blue-700 outline-none border border-blue-100"
                    value={form.precio_venta}
                    onChange={(e) => setForm({...form, precio_venta: Number(e.target.value)})}
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="w-5 h-5 rounded-lg" checked={form.venta_incluye_iva} onChange={(e) => setForm({...form, venta_incluye_iva: e.target.checked})} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">¿IVA?</span>
                  </label>
                </div>
              </div>
            </section>
          </div>

          {/* COLUMNA DERECHA: SKU, IMAGEN Y ESTADOS */}
          <div className="space-y-6">
            {/* CARD SKU */}
            <div className="bg-slate-900 p-6 rounded-[32px] text-white space-y-4 shadow-xl shadow-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">SKU Identificador</span>
                <button onClick={() => solicitarNuevoSku(form.subcategoria_id)} className="text-blue-400 hover:text-blue-300">
                  <RefreshCcw size={18} className={generatingSku ? "animate-spin" : ""} />
                </button>
              </div>
              <div className="text-3xl font-black tracking-tighter text-blue-400 italic">
                {form.sku || "--- --- ---"}
              </div>
            </div>

            {/* CARD IMAGEN */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group aspect-square bg-white rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all overflow-hidden relative"
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} className="w-full h-full object-contain p-4" alt="Preview" />
                  <button 
                    onClick={(e) => {e.stopPropagation(); setImagePreview(null);}} 
                    className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full shadow-lg"
                  >
                    <X size={14}/>
                  </button>
                </>
              ) : (
                <div className="text-center">
                  <Camera className="text-slate-300 mx-auto mb-2" size={32}/>
                  <span className="text-[10px] font-black text-slate-400 uppercase">Añadir Foto</span>
                </div>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImage} />
            </div>

            {/* CONFIGURACIÓN DE ESTADOS */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Parámetros de Sistema</label>
              {[
                { label: "¿Se vende?", key: "se_puede_vender" },
                { label: "¿Se compra?", key: "se_puede_comprar" },
                { label: "¿Control Stock?", key: "se_mantiene_stock" },
              ].map((item) => (
                <label key={item.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <span className="text-xs font-bold text-slate-600 uppercase">{item.label}</span>
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded-md accent-blue-600"
                    checked={(form as any)[item.key]} 
                    onChange={(e) => setForm({...form, [item.key]: e.target.checked})} 
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER ACCIÓN */}
        <div className="flex flex-col gap-4">
          <button 
            onClick={handleSubmit}
            disabled={loading || !form.sku}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-6 rounded-[32px] font-black text-sm uppercase tracking-[4px] shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 className="animate-spin" /> : "REGISTRAR EN OBUMA ERP"}
          </button>

          {status && (
            <div className={`p-5 rounded-[24px] border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
              {status.type === 'success' ? <Check size={18}/> : <AlertCircle size={18}/>}
              <p className="text-xs font-black uppercase tracking-tight">{status.msg}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}