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

  const [nameData, setNameData] = useState({ articulo: "", especificacion: "", medida: "", unidad: "MT" });
  
  const [form, setForm] = useState({
    nombre_completo: "",
    sku: "",
    categoria_id: "",
    subcategoria_id: "",
    precio_venta: 0,
    imagen_data: "",
    imagen_nombre: ""
  });

  const unidades = ["MT", "KG", "GL", "MM", '"', "L", "UN", "ROL", "SET"];

  // Carga inicial con manejo de errores robusto
  useEffect(() => {
    async function loadData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);

        if (!resCat.ok || !resSub.ok) throw new Error("Error en la respuesta del servidor");

        const dCat = await resCat.json();
        const dSub = await resSub.json();
        
        setCategorias(Array.isArray(dCat) ? dCat : []);
        setAllSubcategorias(Array.isArray(dSub) ? dSub : []);
      } catch (err) { 
        console.error("Error al cargar datos:", err);
        setStatus({ type: 'error', msg: "Fallo conexión con Obuma API" }); 
      }
    }
    loadData();
  }, []);

  // Generador de nombre automático
  useEffect(() => {
    const clean = (t: string) => t.toUpperCase().trim();
    const parts = [
      clean(nameData.articulo),
      clean(nameData.especificacion),
      nameData.medida ? `${clean(nameData.medida)}${nameData.unidad}` : ""
    ].filter(Boolean);
    const nombreFinal = parts.join(" ");
    setForm(prev => ({ ...prev, nombre_completo: nombreFinal }));
  }, [nameData]);

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
      
      // Lógica de prefijos (50 estándar, 70 para Mayorista/B2B)
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
        setForm(prev => ({ ...prev, imagen_data: base64Pure, imagen_nombre: file.name }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!form.sku || !form.nombre_completo) {
      setStatus({ type: 'error', msg: "Faltan datos obligatorios (SKU o Nombre)" });
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
          venta_incluye_iva: true,
          se_mantiene_stock: true,
          se_puede_vender: true
        }),
      });

      if (res.ok) {
        setStatus({ type: 'success', msg: `Producto ${form.sku} creado con éxito` });
        // Limpieza de campos de nombre pero manteniendo categoría para velocidad
        setNameData({ articulo: "", especificacion: "", medida: "", unidad: "MT" });
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        // Actualizar SKU para el siguiente ingreso
        await solicitarNuevoSku(form.subcategoria_id);
      } else {
        const errData = await res.json();
        setStatus({ type: 'error', msg: errData.error || "Error al sincronizar con Obuma" });
      }
    } catch (error) { 
      setStatus({ type: 'error', msg: "Error crítico de red" }); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 selection:bg-blue-100 antialiased">
      <div className="max-w-[1200px] mx-auto p-4 md:p-10">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                <PackagePlus size={20} />
              </div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic">Registro Maestro</h1>
            </div>
            <p className="text-slate-400 text-[10px] font-bold tracking-[4px] uppercase mt-2 ml-1">Chile Business Intelligence</p>
          </div>
          
          <div className="flex items-center gap-4 bg-white p-2 pr-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-2 h-2 rounded-full animate-pulse ml-2 ${status?.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Status: Obuma Online</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 space-y-6">
            <section className="bg-white rounded-[48px] shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
              <div className="p-8 md:p-12 space-y-10">
                <div className="space-y-2 group">
                  <label className="text-[10px] font-black text-blue-500 uppercase tracking-[2px] ml-1">Artículo Principal</label>
                  <input 
                    type="text"
                    placeholder="NOMBRE DEL PRODUCTO..."
                    className="w-full text-4xl md:text-5xl font-black tracking-tighter outline-none placeholder:text-slate-100 uppercase transition-all"
                    value={nameData.articulo}
                    onChange={(e) => setNameData({...nameData, articulo: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] ml-1">Descripción Técnica</label>
                  <textarea 
                    rows={2}
                    placeholder="DETALLES, MARCA O MATERIAL..."
                    className="w-full text-xl font-bold text-slate-600 outline-none resize-none placeholder:text-slate-100 uppercase"
                    value={nameData.especificacion}
                    onChange={(e) => setNameData({...nameData, especificacion: e.target.value})}
                  />
                </div>

                <div className="pt-8 border-t border-slate-50 flex flex-wrap items-center gap-4">
                  <div className="bg-slate-50 p-2 rounded-3xl flex items-center border border-slate-100">
                    <input 
                      type="text"
                      placeholder="Medida"
                      className="w-28 bg-transparent p-3 text-2xl font-black text-center outline-none border-r border-slate-200"
                      value={nameData.medida}
                      onChange={(e) => setNameData({...nameData, medida: e.target.value})}
                    />
                    <div className="flex gap-1 px-4 overflow-x-auto max-w-[340px] no-scrollbar">
                      {unidades.map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setNameData({...nameData, unidad: u})}
                          className={`px-4 py-2 rounded-2xl text-[11px] font-black transition-all ${nameData.unidad === u ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200'}`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="min-w-0 w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    <span className="text-[9px] font-bold text-blue-400 uppercase tracking-[3px]">Previsualización Obuma</span>
                  </div>
                  <h3 className="text-white font-black truncate text-2xl md:text-3xl uppercase tracking-tighter italic">
                    {form.nombre_completo || "COMPLETAR DATOS..."}
                  </h3>
                </div>
                <div className="bg-blue-600 p-4 rounded-3xl shadow-lg flex-shrink-0">
                  <ChevronRight className="text-white" size={32} />
                </div>
              </div>
            </section>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group relative h-72 bg-white rounded-[48px] border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all overflow-hidden shadow-sm"
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} className="w-full h-full object-contain p-10" alt="Preview" />
                  <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                     <button 
                      onClick={(e) => {e.stopPropagation(); setImagePreview(null); setForm(prev=>({...prev, imagen_data: ""}));}} 
                      className="p-4 bg-red-500 text-white rounded-full shadow-2xl transition-transform hover:scale-110"
                    >
                      <X size={24}/>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto border border-slate-100">
                    <Camera className="text-slate-300 group-hover:text-blue-500 transition-colors" size={32}/>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[3px]">Click para subir imagen</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImage} />
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-[48px] shadow-lg border border-slate-100">
              <div className="flex items-center gap-2 mb-6">
                <DollarSign className="text-emerald-500" size={18}/>
                <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Precio Bruto</h2>
              </div>
              <div className="relative">
                <input 
                  type="number"
                  className="w-full bg-slate-50 p-6 rounded-[32px] text-4xl font-black outline-none border border-transparent focus:bg-white focus:border-emerald-100 transition-all"
                  value={form.precio_venta}
                  onChange={(e) => setForm({...form, precio_venta: Number(e.target.value)})}
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-200 text-xl">CLP</span>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[48px] shadow-lg border border-slate-100 space-y-8">
              <div className="flex items-center gap-2">
                <Layers className="text-blue-500" size={18}/>
                <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Jerarquía</h2>
              </div>
              
              <div className="space-y-4">
                <select 
                  className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs outline-none border border-slate-100"
                  value={form.categoria_id}
                  onChange={(e) => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}
                >
                  <option value="">Categoría...</option>
                  {categorias.map((c: any) => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                </select>

                <select 
                  disabled={!form.categoria_id}
                  className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-xs outline-none border border-slate-100 disabled:opacity-20 transition-opacity"
                  value={form.subcategoria_id}
                  onChange={(e) => solicitarNuevoSku(e.target.value)}
                >
                  <option value="">Subcategoría...</option>
                  {subCategoriasFiltradas.map((s: any) => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
                </select>
              </div>

              <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">SKU Sugerido</p>
                  <p className="text-3xl font-black tracking-tighter text-blue-600 italic leading-none">
                    {generatingSku ? "..." : (form.sku || "----")}
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => solicitarNuevoSku(form.subcategoria_id)} 
                  disabled={!form.subcategoria_id}
                  className="p-4 bg-slate-900 text-white rounded-2xl hover:scale-105 transition-all disabled:bg-slate-200"
                >
                  <RefreshCcw size={20} className={generatingSku ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            <button 
              onClick={handleSubmit}
              disabled={loading || !form.sku || !form.nombre_completo}
              className="group w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white p-8 rounded-[48px] font-black text-xs uppercase tracking-[5px] shadow-2xl transition-all active:scale-95 flex flex-col items-center gap-3"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={28}/>
              ) : (
                <>
                  <span>Sincronizar Maestro</span>
                  <div className="w-12 h-1.5 bg-white/30 rounded-full group-hover:w-24 transition-all duration-500"/>
                </>
              )}
            </button>

            {status && (
              <div className={`p-6 rounded-[32px] border-2 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                {status.type === 'success' ? <Check size={24} className="flex-shrink-0"/> : <AlertCircle size={24} className="flex-shrink-0"/>}
                <p className="text-xs font-black uppercase tracking-tight">{status.msg}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}