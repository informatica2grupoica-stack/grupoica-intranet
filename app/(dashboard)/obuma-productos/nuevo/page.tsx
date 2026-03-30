"use client";
import { useState, useEffect } from "react";
import { Copy, Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react";

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  // Listas de Obuma
  const [categorias, setCategorias] = useState<any[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<any[]>([]); // Todas
  const [filteredSubcategorias, setFilteredSubcategorias] = useState<any[]>([]); // Las que se muestran

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
        
        // Obuma devuelve los datos en la propiedad 'data'
        setCategorias(cats.data || []);
        setAllSubcategorias(subs.data || []);
      } catch (err) {
        console.error("Error cargando datos de Obuma");
      } finally {
        setLoadingData(false);
      }
    }
    loadObumaData();
  }, []);

  // 2. FILTRAR SUBCATEGORIAS CUANDO CAMBIA LA CATEGORIA
  useEffect(() => {
    if (form.categoria_id) {
      // Obuma usa 'rel_producto_categoria_id' para enlazar subcategorías
      const filtradas = allSubcategorias.filter(
        sub => sub.rel_producto_categoria_id === form.categoria_id
      );
      setFilteredSubcategorias(filtradas);
    } else {
      setFilteredSubcategorias([]);
    }
  }, [form.categoria_id, allSubcategorias]);

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
          <label className="text-[10px] font-black uppercase text-slate-400 italic">Nombre del Producto</label>
          <input 
            required
            type="text" 
            placeholder="EJ: CEMENTO POLPAICO 25KG"
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-[#00338d] font-bold uppercase"
            value={form.nombre}
            onChange={(e) => setForm({...form, nombre: e.target.value.toUpperCase()})}
          />
        </div>

        {/* CATEGORÍA Y SUBCATEGORÍA (Lógica de Obuma) */}
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 italic">Categoría (Mercado Público/Mayorista)</label>
            <select 
              required
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
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
            <label className="text-[10px] font-black uppercase text-slate-400 italic">Subcategoría (Ferretería/Jardín/etc)</label>
            <select 
              required
              disabled={!form.categoria_id}
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none disabled:opacity-50"
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
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 italic">Tipo de Ítem</label>
            <select 
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold"
              value={form.tipo}
              onChange={(e) => setForm({...form, tipo: e.target.value})}
            >
              <option value="Producto">Producto</option>
              <option value="Servicio">Servicio</option>
              <option value="Kit">Kit</option>
              <option value="Fabricación">Fabricación</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 italic">SKU</label>
            <input 
              type="text" 
              placeholder="Código interno"
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono"
              value={form.sku}
              onChange={(e) => setForm({...form, sku: e.target.value})}
            />
          </div>
        </div>

        {/* BOTÓN GUARDAR */}
        <div className="flex justify-end pt-6">
          <button 
            type="submit" 
            disabled={loading || loadingData}
            className="bg-[#00338d] hover:bg-blue-900 text-white px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center gap-3 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            Crear en Obuma
          </button>
        </div>
      </form>
    </div>
  );
}