"use client";
import { useEffect, useState } from "react";
import { Loader2, Save, Package, Tag, DollarSign, CheckCircle } from "lucide-react";

export default function FormularioNuevoProducto() {
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCats, setFetchingCats] = useState(true);
  
  const [form, setForm] = useState({
    nombre: "",
    tipo: "Producto",
    sku: "",
    categoria_id: "",
    subcategoria_id: "",
    precio_costo: 0,
    precio_venta: 0,
    incluye_iva_costo: false,
    incluye_iva_venta: false
  });

  // 1. Cargar categorías de Obuma al montar el componente
  useEffect(() => {
    async function loadCategorias() {
      try {
        const res = await fetch('/api/obuma/categorias');
        const data = await res.json();
        setCategorias(data);
      } catch (err) {
        console.error("Error cargando categorías:", err);
      } finally {
        setFetchingCats(false);
      }
    }
    loadCategorias();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/obuma/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const result = await res.json();

      if (result.status === "success" || result.data) {
        const nuevoSku = result.data.producto_codigo_comercial || "Generado por Obuma";
        alert(`¡Producto creado con éxito!\nSKU: ${nuevoSku}`);
        // Aquí podrías limpiar el formulario o redireccionar
      } else {
        alert("Error de Obuma: " + (result.message || "No se pudo crear"));
      }
    } catch (error) {
      alert("Error de conexión con el Proxy");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
      <h2 className="text-2xl font-black text-slate-800 uppercase italic mb-8 border-b pb-4">
        Nuevo Producto <span className="text-blue-600 text-sm not-italic ml-2 opacity-50">Integración Obuma</span>
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* FILA 1: NOMBRE */}
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombre *</label>
          <input 
            required
            type="text" 
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:border-blue-400 transition-all"
            placeholder="Nombre del producto"
            value={form.nombre}
            onChange={(e) => setForm({...form, nombre: e.target.value})}
          />
        </div>

        {/* FILA 2: TIPO Y SKU */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Tipo *</label>
            <select 
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold"
              value={form.tipo}
              onChange={(e) => setForm({...form, tipo: e.target.value})}
            >
              <option value="Producto">Producto</option>
              <option value="Servicio">Servicio</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">SKU (Opcional)</label>
            <div className="relative">
              <input 
                type="text" 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none font-mono"
                placeholder="Dejar vacío para auto-generar"
                value={form.sku}
                onChange={(e) => setForm({...form, sku: e.target.value})}
              />
              <Package className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            </div>
          </div>
        </div>

        {/* FILA 3: CATEGORÍA */}
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Categoría *</label>
          <select 
            required
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm"
            value={form.categoria_id}
            onChange={(e) => setForm({...form, categoria_id: e.target.value})}
          >
            <option value="">{fetchingCats ? "Cargando categorías..." : "Selecciona una categoría"}</option>
            {categorias.map((cat: any) => (
              <option key={cat.producto_categoria_id} value={cat.producto_categoria_id}>
                {cat.producto_categoria_nombre}
              </option>
            ))}
          </select>
        </div>

        {/* FILA 4: PRECIOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-blue-50/30 rounded-3xl border border-blue-100/50">
          <div>
            <label className="text-[10px] font-black uppercase text-blue-600 ml-1">Precio Costo (Neto) *</label>
            <div className="relative mt-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input 
                required
                type="number" 
                className="w-full pl-8 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-sm outline-none"
                value={form.precio_costo}
                onChange={(e) => setForm({...form, precio_costo: Number(e.target.value)})}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-blue-600 ml-1">Precio Venta (Neto) *</label>
            <div className="relative mt-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input 
                required
                type="number" 
                className="w-full pl-8 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-sm outline-none"
                value={form.precio_venta}
                onChange={(e) => setForm({...form, precio_venta: Number(e.target.value)})}
              />
            </div>
          </div>
        </div>

        <button 
          disabled={loading}
          type="submit" 
          className="w-full py-5 bg-[#00338d] text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 hover:bg-blue-800 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
          {loading ? 'Sincronizando con Obuma...' : 'Guardar Producto en Obuma'}
        </button>
      </form>
    </div>
  );
}