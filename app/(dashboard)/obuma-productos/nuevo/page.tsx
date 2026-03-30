"use client";
import { useState, useEffect } from "react";
import { Copy, Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react";

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  // Estados para las listas dinámicas
  const [categorias, setCategorias] = useState<any[]>([]);
  const [subcategorias, setSubcategorias] = useState<any[]>([]);

  const [form, setForm] = useState({
    nombre: "",
    tipo: "Producto",
    sku: "",
    categoria_id: "",
    subcategoria_id: "",
    precio_costo: 0,
    incluye_iva_costo: false,
    precio_venta: 0,
    incluye_iva_venta: false,
    se_puede_vender: false,
    se_puede_comprar: false,
    se_mantiene_stock: false,
  });

  // Cargar categorías y subcategorías desde Obuma al entrar
  useEffect(() => {
    async function loadData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);
        
        const cats = await resCat.json();
        const subs = await resSub.json();
        
        setCategorias(cats.data || []);
        setSubcategorias(subs.data || []);
      } catch (err) {
        console.error("Error cargando datos de Obuma");
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

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
        setStatus({ type: 'success', msg: 'Producto creado exitosamente en Obuma' });
        setForm({ ...form, nombre: "", sku: "", precio_costo: 0, precio_venta: 0 });
      } else {
        const result = await res.json();
        throw new Error(result.message || 'Error al crear producto');
      }
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-slate-100 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-8 font-black uppercase italic">Nuevo producto</h2>
      
      {status && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-bold">{status.msg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nombre */}
        <div className="flex items-center gap-4">
          <label className="w-32 text-[10px] font-black uppercase text-slate-400">Nombre <span className="text-rose-500">*</span></label>
          <input 
            required
            type="text" 
            placeholder="Nombre"
            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
            value={form.nombre}
            onChange={(e) => setForm({...form, nombre: e.target.value})}
          />
        </div>

        {/* Tipo y SKU */}
        <div className="grid grid-cols-2 gap-8">
          <div className="flex items-center gap-4">
            <label className="w-32 text-[10px] font-black uppercase text-slate-400">Tipo <span className="text-rose-500">*</span></label>
            <select 
              className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none font-bold"
              value={form.tipo}
              onChange={(e) => setForm({...form, tipo: e.target.value})}
            >
              <option value="Producto">Producto</option>
              <option value="Servicio">Servicio</option>
              <option value="Kit">Kit</option>
              <option value="Fabricación">Fabricación</option>
              <option value="Virtual">Virtual</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="w-16 text-[10px] font-black uppercase text-slate-400">SKU:</label>
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder="SKU"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm pr-10 outline-none"
                value={form.sku}
                onChange={(e) => setForm({...form, sku: e.target.value})}
              />
              <Copy className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer" size={16} />
            </div>
          </div>
        </div>

        {/* Categoría y Subcategoría DINÁMICAS */}
        <div className="grid grid-cols-2 gap-8">
          <div className="flex items-center gap-4">
            <label className="w-32 text-[10px] font-black uppercase text-slate-400">Categoría <span className="text-rose-500">*</span></label>
            <select 
              required
              className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
              value={form.categoria_id}
              onChange={(e) => setForm({...form, categoria_id: e.target.value})}
            >
              <option value="">{loadingData ? "Cargando..." : "Selecciona una categoria"}</option>
              {categorias.map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="w-32 text-[10px] font-black uppercase text-slate-400">Subcategoria <span className="text-rose-500">*</span></label>
            <select 
              required
              className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
              value={form.subcategoria_id}
              onChange={(e) => setForm({...form, subcategoria_id: e.target.value})}
            >
              <option value="">{loadingData ? "Cargando..." : "Selecciona una subcategoria"}</option>
              {subcategorias.map((sub: any) => (
                <option key={sub.id} value={sub.id}>{sub.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Precios */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="w-32 text-[10px] font-black uppercase text-slate-400">Precio Costo <span className="text-rose-500">*</span></label>
            <div className="flex items-center gap-2">
               <span className="text-slate-400 font-bold">$</span>
               <input 
                type="number" 
                className="w-40 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none font-bold text-blue-600"
                value={form.precio_costo}
                onChange={(e) => setForm({...form, precio_costo: Number(e.target.value)})}
              />
            </div>
            <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 cursor-pointer ml-4">
              <input 
                type="checkbox" 
                className="rounded border-slate-300 text-blue-600"
                checked={form.incluye_iva_costo}
                onChange={(e) => setForm({...form, incluye_iva_costo: e.target.checked})}
              />
              ¿Incluye IVA?
            </label>
          </div>
          <div className="flex items-center gap-4">
            <label className="w-32 text-[10px] font-black uppercase text-slate-400">Precio Venta <span className="text-rose-500">*</span></label>
            <div className="flex items-center gap-2">
               <span className="text-slate-400 font-bold">$</span>
               <input 
                type="number" 
                className="w-40 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none font-bold text-blue-600"
                value={form.precio_venta}
                onChange={(e) => setForm({...form, precio_venta: Number(e.target.value)})}
              />
            </div>
            <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 cursor-pointer ml-4">
              <input 
                type="checkbox" 
                className="rounded border-slate-300 text-blue-600"
                checked={form.incluye_iva_venta}
                onChange={(e) => setForm({...form, incluye_iva_venta: e.target.checked})}
              />
              ¿Incluye IVA?
            </label>
          </div>
        </div>

        {/* Checkboxes de estado */}
        <div className="flex gap-10 pt-4 ml-32">
          {["vender", "comprar", "stock"].map((tipo) => (
            <label key={tipo} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 cursor-pointer">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-slate-300"
                checked={(form as any)[`se_puede_${tipo}`] || (form as any)[`se_mantiene_${tipo}`]}
                onChange={(e) => {
                   const key = tipo === "stock" ? "se_mantiene_stock" : `se_puede_${tipo}`;
                   setForm({...form, [key]: e.target.checked});
                }}
              />
              ¿Se puede {tipo}?
            </label>
          ))}
        </div>

        {/* Botón Guardar */}
        <div className="flex justify-end pt-6">
          <button 
            type="submit" 
            disabled={loading || loadingData}
            className="bg-[#00338d] hover:bg-blue-800 text-white px-10 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Guardar en Obuma
          </button>
        </div>
      </form>
    </div>
  );
}