"use client";
import { useState, useEffect } from "react";
import { Copy, Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react";

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  // Lista dinámica de subcategorías desde Obuma
  const [subcategorias, setSubcategorias] = useState<any[]>([]);

  const [form, setForm] = useState({
    nombre: "",
    tipo: "Producto",
    sku: "",
    subcategoria_id: "",
    precio_costo: 0,
    incluye_iva_costo: false,
    precio_venta: 0,
    incluye_iva_venta: false,
    se_puede_vender: true,
    se_puede_comprar: true,
    se_mantiene_stock: true,
  });

  // Cargar subcategorías desde tu API de Obuma al iniciar
  useEffect(() => {
    async function loadData() {
      try {
        const resSub = await fetch('/api/obuma/subcategorias');
        const data = await resSub.json();
        
        // Obuma suele entregar un array directamente o dentro de .data
        const lista = Array.isArray(data) ? data : (data.data || []);
        setSubcategorias(lista);
      } catch (err) {
        console.error("Error cargando subcategorías de Obuma");
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
        setStatus({ type: 'success', msg: 'Producto creado y sincronizado en Obuma' });
        // Reset parcial del formulario
        setForm({ ...form, nombre: "", sku: "", precio_costo: 0, precio_venta: 0 });
      } else {
        const result = await res.json();
        throw new Error(result.message || 'Error al comunicar con Obuma');
      }
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-slate-100 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-8 font-black uppercase italic tracking-tight">
        Agregar Producto a Obuma
      </h2>
      
      {status && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
          status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
        }`}>
          {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-bold">{status.msg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nombre del Producto */}
        <div className="flex items-center gap-4">
          <label className="w-40 text-[10px] font-black uppercase text-slate-400 italic">Nombre Producto <span className="text-rose-500">*</span></label>
          <input 
            required
            type="text" 
            placeholder="EJ: CABLE ELECTRICO 2.5MM"
            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00338d] transition-colors uppercase"
            value={form.nombre}
            onChange={(e) => setForm({...form, nombre: e.target.value.toUpperCase()})}
          />
        </div>

        {/* Tipo y SKU */}
        <div className="grid grid-cols-2 gap-8">
          <div className="flex items-center gap-4">
            <label className="w-40 text-[10px] font-black uppercase text-slate-400 italic">Tipo <span className="text-rose-500">*</span></label>
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
            <label className="w-16 text-[10px] font-black uppercase text-slate-400 italic">SKU:</label>
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder="Código SKU"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm pr-10 outline-none font-mono"
                value={form.sku}
                onChange={(e) => setForm({...form, sku: e.target.value})}
              />
              <Copy className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-[#00338d]" size={16} />
            </div>
          </div>
        </div>

        {/* Subcategoría Dinámica de Obuma */}
        <div className="flex items-center gap-4">
          <label className="w-40 text-[10px] font-black uppercase text-slate-400 italic">Subcategoría <span className="text-rose-500">*</span></label>
          <select 
            required
            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#00338d]"
            value={form.subcategoria_id}
            onChange={(e) => setForm({...form, subcategoria_id: e.target.value})}
          >
            <option value="">{loadingData ? "Conectando con Obuma..." : "— Seleccionar Subcategoría —"}</option>
            {subcategorias.map((sub: any) => (
              <option key={sub.subcategoria_id} value={sub.subcategoria_id}>
                {sub.subcategoria_nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Precios con diseño mejorado */}
        <div className="grid grid-cols-2 gap-8 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 italic">Costo de Compra</label>
            <div className="flex items-center gap-3">
               <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-xl px-3 outline-within:border-blue-400">
                 <span className="text-slate-400 font-bold mr-2">$</span>
                 <input 
                  type="number" 
                  className="w-full py-3 text-sm outline-none font-bold text-slate-700"
                  value={form.precio_costo}
                  onChange={(e) => setForm({...form, precio_costo: Number(e.target.value)})}
                />
               </div>
               <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  checked={form.incluye_iva_costo}
                  onChange={(e) => setForm({...form, incluye_iva_costo: e.target.checked})}
                />
                + IVA
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 italic">Precio de Venta</label>
            <div className="flex items-center gap-3">
               <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-xl px-3">
                 <span className="text-slate-400 font-bold mr-2">$</span>
                 <input 
                  type="number" 
                  className="w-full py-3 text-sm outline-none font-bold text-[#00338d]"
                  value={form.precio_venta}
                  onChange={(e) => setForm({...form, precio_venta: Number(e.target.value)})}
                />
               </div>
               <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  checked={form.incluye_iva_venta}
                  onChange={(e) => setForm({...form, incluye_iva_venta: e.target.checked})}
                />
                + IVA
              </label>
            </div>
          </div>
        </div>

        {/* Checkboxes de estado (Venta/Compra/Stock) */}
        <div className="flex justify-center gap-12 pt-4">
          {[
            { label: "Vender", key: "se_puede_vender" },
            { label: "Comprar", key: "se_puede_comprar" },
            { label: "Stock", key: "se_mantiene_stock" }
          ].map((item) => (
            <label key={item.key} className="flex items-center gap-3 text-[10px] font-black uppercase text-slate-500 cursor-pointer hover:text-[#00338d] transition-colors">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded-lg border-slate-300 text-[#00338d] focus:ring-0"
                checked={(form as any)[item.key]}
                onChange={(e) => setForm({...form, [item.key]: e.target.checked})}
              />
              {item.label}
            </label>
          ))}
        </div>

        {/* Botón Guardar */}
        <div className="flex justify-end pt-6 border-t border-slate-100">
          <button 
            type="submit" 
            disabled={loading || loadingData}
            className="bg-[#00338d] hover:bg-blue-900 text-white px-12 py-4 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl hover:shadow-blue-200/50 flex items-center gap-3 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Sincronizar con Obuma
          </button>
        </div>
      </form>
    </div>
  );
}