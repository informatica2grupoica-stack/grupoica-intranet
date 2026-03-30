"use client";
import { useEffect, useState } from "react";
// Importamos solo lo básico para asegurar que no falten librerías
import { Loader2, Package, CheckCircle } from "lucide-react";

// INTERFAZ CRÍTICA: Sin esto, Next.js 16 fallará el build
interface Categoria {
  producto_categoria_id: string;
  producto_categoria_nombre: string;
}

export default function FormularioNuevoProducto() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCats, setFetchingCats] = useState(true);
  
  const [form, setForm] = useState({
    nombre: "",
    tipo: "Producto",
    sku: "",
    categoria_id: "",
    precio_costo: 0,
    precio_venta: 0,
  });

  useEffect(() => {
    async function loadCategorias() {
      try {
        const res = await fetch('/api/obuma/categorias');
        const data = await res.json();
        // Validación de array para evitar errores de .map
        setCategorias(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error:", err);
        setCategorias([]);
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
      
      if (result && (result.status === "success" || result.data)) {
        alert("¡Producto creado!");
        setForm(prev => ({ ...prev, nombre: "", sku: "" }));
      } else {
        alert("Error: " + (result.message || "Revisa los datos"));
      }
    } catch (error) {
      alert("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 mt-10">
      <h2 className="text-2xl font-black text-slate-800 uppercase italic mb-8 border-b pb-4">
        Nuevo Producto <span className="text-blue-600 text-sm not-italic ml-2 opacity-50 font-normal">Obuma Sync</span>
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400">Nombre *</label>
          <input 
            required
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none"
            value={form.nombre}
            onChange={(e) => setForm({...form, nombre: e.target.value})}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Tipo</label>
            <select 
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm"
              value={form.tipo}
              onChange={(e) => setForm({...form, tipo: e.target.value})}
            >
              <option value="Producto">Producto</option>
              <option value="Servicio">Servicio</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">SKU</label>
            <input 
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm"
              placeholder="Auto-generar"
              value={form.sku}
              onChange={(e) => setForm({...form, sku: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-slate-400">Categoría *</label>
          <select 
            required
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm"
            value={form.categoria_id}
            onChange={(e) => setForm({...form, categoria_id: e.target.value})}
          >
            <option value="">{fetchingCats ? "Cargando..." : "Seleccionar"}</option>
            {categorias.map((cat) => (
              <option key={cat.producto_categoria_id} value={cat.producto_categoria_id}>
                {cat.producto_categoria_nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-6 p-6 bg-blue-50/30 rounded-3xl border border-blue-100/50">
          <input 
            type="number" placeholder="Costo Neto"
            className="p-4 bg-white border border-slate-100 rounded-2xl text-sm"
            onChange={(e) => setForm({...form, precio_costo: Number(e.target.value)})}
          />
          <input 
            type="number" placeholder="Venta Neto"
            className="p-4 bg-white border border-slate-100 rounded-2xl text-sm"
            onChange={(e) => setForm({...form, precio_venta: Number(e.target.value)})}
          />
        </div>

        <button 
          disabled={loading}
          className="w-full py-5 bg-[#00338d] text-white rounded-[1.5rem] font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3"
        >
          {loading ? <Loader2 className="animate-spin" /> : <CheckCircle />}
          {loading ? 'Enviando...' : 'Guardar en Obuma'}
        </button>
      </form>
    </div>
  );
}