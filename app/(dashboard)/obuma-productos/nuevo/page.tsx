"use client";
import { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  const [categorias, setCategorias] = useState<any[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<any[]>([]);
  const [filteredSubcategorias, setFilteredSubcategorias] = useState<any[]>([]);

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
    se_puede_vender: true,
    se_puede_comprar: true,
    se_mantiene_stock: true,
  });

  // 1. CARGA INICIAL DE DATOS
  useEffect(() => {
    async function loadObumaData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);
        
        const cats = await resCat.json();
        const subs = await resSub.json();
        
        setCategorias(Array.isArray(cats) ? cats : []);
        setAllSubcategorias(Array.isArray(subs) ? subs : []);
      } catch (err) {
        console.error("Error cargando datos de Obuma");
      } finally {
        setLoadingData(false);
      }
    }
    loadObumaData();
  }, []);

  // 2. FILTRADO DE SUBCATEGORÍAS DINÁMICO
  useEffect(() => {
    if (form.categoria_id) {
      const filtradas = allSubcategorias.filter(
        sub => String(sub.rel_producto_categoria_id) === String(form.categoria_id)
      );
      setFilteredSubcategorias(filtradas);
    } else {
      setFilteredSubcategorias([]);
    }
  }, [form.categoria_id, allSubcategorias]);

  // 3. ENVÍO DE FORMULARIO (CON MEJORA DE CAPTURA DE SKU)
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

      const result = await res.json();

      if (res.ok) {
        // Obra extrae el SKU que Obuma generó automáticamente (o el que tú pusiste)
        const skuAsignado = result.data?.producto_codigo_comercial || "EXITOSO";
        
        setStatus({ 
          type: 'success', 
          msg: `PRODUCTO CREADO EXITOSAMENTE. SKU ASIGNADO: ${skuAsignado}` 
        });

        // Limpiar campos para nueva entrada, manteniendo categorías
        setForm({ 
          ...form, 
          nombre: "", 
          sku: "", 
          precio_costo: 0, 
          precio_venta: 0, 
          categoria_id: "", 
          subcategoria_id: "" 
        });
      } else {
        throw new Error(result.error || 'Error al crear producto');
      }
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-slate-100 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-8 font-black uppercase italic tracking-tighter">
        Sincronización Intranet - Obuma
      </h2>
      
      {status && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
          {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-bold uppercase">{status.msg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* NOMBRE */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase text-slate-400 italic">Nombre del Producto *</label>
          <input 
            required
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold uppercase outline-none focus:border-[#00338d]"
            placeholder="EJ: CEMENTO POLPAICO 25KG"
            value={form.nombre}
            onChange={(e) => setForm({...form, nombre: e.target.value.toUpperCase()})}
          />
        </div>

        {/* CATEGORÍA Y SUBCATEGORÍA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 italic">Categoría (Mercado Público/Mayorista) *</label>
            <select 
              required
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none appearance-none"
              value={form.categoria_id}
              onChange={(e) => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}
            >
              <option value="">{loadingData ? "Cargando..." : "Selecciona Categoría"}</option>
              {categorias.map((cat) => (
                <option key={cat.producto_categoria_id} value={cat.producto_categoria_id}>
                  {cat.producto_categoria_nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 italic">Subcategoría (Ferretería/Jardín/etc) *</label>
            <select 
              required
              disabled={!form.categoria_id}
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none disabled:opacity-50 appearance-none"
              value={form.subcategoria_id}
              onChange={(e) => setForm({...form, subcategoria_id: e.target.value})}
            >
              <option value="">{form.categoria_id ? "Selecciona Subcategoría" : "Primero elige categoría"}</option>
              {filteredSubcategorias.map((sub) => (
                <option key={sub.producto_subcategoria_id} value={sub.producto_subcategoria_id}>
                  {sub.producto_subcategoria_nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TIPO Y SKU */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 italic">Tipo de Ítem *</label>
            <select 
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold"
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
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 italic">SKU (Opcional - Vacío para Autogenerar)</label>
            <input 
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono placeholder:font-sans uppercase"
              placeholder="DEJAR VACÍO PARA CORRELATIVO"
              value={form.sku}
              onChange={(e) => setForm({...form, sku: e.target.value})}
            />
          </div>
        </div>

        {/* PRECIOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 italic">Precio Costo Neto *</label>
            <div className="relative">
              <span className="absolute left-4 top-4 text-slate-400 font-bold">$</span>
              <input 
                type="number"
                required
                className="w-full p-4 pl-8 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold"
                value={form.precio_costo}
                onChange={(e) => setForm({...form, precio_costo: Number(e.target.value)})}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 italic">Precio Venta Neto *</label>
            <div className="relative">
              <span className="absolute left-4 top-4 text-slate-400 font-bold">$</span>
              <input 
                type="number"
                required
                className="w-full p-4 pl-8 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold"
                value={form.precio_venta}
                onChange={(e) => setForm({...form, precio_venta: Number(e.target.value)})}
              />
            </div>
          </div>
        </div>

        {/* INDICADORES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.se_puede_vender} onChange={(e) => setForm({...form, se_puede_vender: e.target.checked})} className="w-5 h-5 accent-[#00338d]" />
            <span className="text-xs font-bold text-slate-600 uppercase italic">¿Se puede vender?</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.se_puede_comprar} onChange={(e) => setForm({...form, se_puede_comprar: e.target.checked})} className="w-5 h-5 accent-[#00338d]" />
            <span className="text-xs font-bold text-slate-600 uppercase italic">¿Se puede comprar?</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.se_mantiene_stock} onChange={(e) => setForm({...form, se_mantiene_stock: e.target.checked})} className="w-5 h-5 accent-[#00338d]" />
            <span className="text-xs font-bold text-slate-600 uppercase italic">¿Se mantiene stock?</span>
          </label>
        </div>

        {/* BOTÓN FINAL */}
        <div className="flex justify-end pt-8">
          <button 
            type="submit" 
            disabled={loading || loadingData}
            className="bg-[#00338d] hover:bg-[#00266b] text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Crear en Obuma
          </button>
        </div>
      </form>
    </div>
  );
}