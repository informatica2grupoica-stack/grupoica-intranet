"use client";
import { useState, useEffect } from "react";
import { Save, Loader2, PackagePlus, RefreshCcw, AlertCircle } from "lucide-react";

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  const [categorias, setCategorias] = useState<any[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<any[]>([]);
  const [filteredSubcategorias, setFilteredSubcategorias] = useState<any[]>([]);

  const [form, setForm] = useState({
    nombre: "",
    sku: "", 
    categoria_id: "",
    subcategoria_id: "",
    precio_costo: 0,
    precio_venta: 0,
    // ... otros campos por defecto
  });

  // 1. Cargar Categorías al iniciar
  useEffect(() => {
    async function loadData() {
      const [resCat, resSub] = await Promise.all([
        fetch('/api/obuma/categorias'),
        fetch('/api/obuma/subcategorias')
      ]);
      setCategorias(await resCat.json());
      setAllSubcategorias(await resSub.json());
    }
    loadData();
  }, []);

  // 2. Generador de SKU (La lógica de 50/60)
  const solicitarNuevoSku = async (subId: string) => {
    if (!subId || !form.categoria_id) return;
    setGeneratingSku(true);
    try {
      const cat = categorias.find(c => String(c.producto_categoria_id) === String(form.categoria_id));
      const nombreCat = cat?.producto_categoria_nombre?.toUpperCase() || "";
      
      // Lógica de prefijo según categoría
      let prefijo = nombreCat.includes("MERCADO PUBLICO") ? "60" : "50";
      const prefijoCompleto = `${prefijo}${subId}`;

      const res = await fetch(`/api/obuma/siguiente-sku?prefijoSub=${prefijoCompleto}`);
      const data = await res.json();
      
      if (data.sku) {
        setForm(prev => ({ ...prev, sku: data.sku, subcategoria_id: subId }));
      }
    } catch (err) {
      console.error("Error obteniendo SKU");
    } finally {
      setGeneratingSku(false);
    }
  };

  // 3. Al enviar (Submit)
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
        setStatus({ type: 'success', msg: `PRODUCTO CREADO: ${form.sku}` });
        
        // --- AQUÍ ESTÁ EL TRUCO: Refrescar SKU para el siguiente ---
        const subIdActual = form.subcategoria_id;
        // Limpiamos pero mantenemos categoría para seguir creando rápido
        setForm(prev => ({ ...prev, nombre: "", sku: "", precio_costo: 0, precio_venta: 0 }));
        await solicitarNuevoSku(subIdActual); 
        
      } else {
        setStatus({ type: 'error', msg: result.error || "Error al crear" });
      }
    } catch (error) {
      setStatus({ type: 'error', msg: "Error de conexión" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 font-sans">
      <div className="bg-white rounded-[1.5rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-6 bg-[#00338d] text-white flex justify-between items-center">
          <h1 className="text-xl font-black italic uppercase tracking-tighter">Crear Producto Grupo ICA</h1>
          <PackagePlus size={24} />
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Categorización */}
          <div className="grid grid-cols-2 gap-4">
            <select 
              required 
              className="p-3 bg-slate-50 border rounded-xl font-bold text-xs"
              value={form.categoria_id}
              onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}
            >
              <option value="">Categoría</option>
              {categorias.map(c => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
            </select>

            <select 
              required 
              className="p-3 bg-slate-50 border rounded-xl font-bold text-xs"
              value={form.subcategoria_id}
              onChange={e => solicitarNuevoSku(e.target.value)}
            >
              <option value="">Subcategoría</option>
              {allSubcategorias
                .filter(s => String(s.rel_producto_categoria_id) === String(form.categoria_id))
                .map(s => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
            </select>
          </div>

          {/* Visualizador de SKU */}
          <div className="bg-blue-50 p-6 rounded-2xl border-2 border-dashed border-blue-200 text-center">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">SKU Sugerido (Desde 203)</span>
            <div className="flex items-center justify-center gap-4 mt-2">
              <span className="text-3xl font-black text-[#00338d] tracking-tighter">{form.sku || "---"}</span>
              <button type="button" onClick={() => solicitarNuevoSku(form.subcategoria_id)} className="text-blue-300 hover:text-blue-600 transition-colors">
                <RefreshCcw size={20} className={generatingSku ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Resto de campos... (Nombre, Precios) */}
          <input 
            required 
            placeholder="NOMBRE DEL PRODUCTO" 
            className="w-full p-4 bg-slate-50 border rounded-xl font-black uppercase text-sm outline-none focus:border-blue-500"
            value={form.nombre}
            onChange={e => setForm({...form, nombre: e.target.value.toUpperCase()})}
          />

          {status && (
            <div className={`p-4 rounded-xl flex items-center gap-3 border ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
              <AlertCircle size={20}/>
              <span className="font-black uppercase text-xs">{status.msg}</span>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading || !form.sku}
            className="w-full bg-[#00338d] hover:bg-[#00266b] text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            Finalizar y Guardar
          </button>
        </form>
      </div>
    </div>
  );
}