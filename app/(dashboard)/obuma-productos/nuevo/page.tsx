"use client";
import { useEffect, useState } from "react";
import { Loader2, Package, CheckCircle, ArrowLeft, Info } from "lucide-react";
import Link from "next/link";

interface Categoria {
  producto_categoria_id: string;
  producto_categoria_nombre: string;
}

export default function NuevoProductoObuma() {
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
    incluye_iva_costo: false,
    incluye_iva_venta: false
  });

  useEffect(() => {
    async function loadCategorias() {
      try {
        const res = await fetch('/api/obuma/categorias');
        const data = await res.json();
        setCategorias(Array.isArray(data) ? data : []);
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
        alert(`¡Producto creado con éxito en Obuma!`);
        setForm({ ...form, nombre: "", sku: "", precio_costo: 0, precio_venta: 0 });
      } else {
        alert("Error de Obuma: " + (result.message || "No se pudo crear"));
      }
    } catch (error) {
      alert("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* BOTÓN VOLVER */}
      <Link 
        href="/obuma-productos" 
        className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors mb-6 w-fit"
      >
        <ArrowLeft size={14} />
        Volver al listado
      </Link>

      <div className="bg-white rounded-[3rem] p-12 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-10 border-b pb-6">
          <div>
            <h2 className="text-3xl font-black text-slate-800 uppercase italic">
              Nuevo Producto
            </h2>
            <p className="text-blue-600 text-[10px] font-bold uppercase tracking-widest mt-1">
              Sincronización Directa Obuma ERP
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-3xl">
            <Package className="text-blue-600" size={32} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SECCIÓN: INFORMACIÓN BÁSICA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-2 block">Nombre del Producto *</label>
              <input 
                required
                type="text" 
                className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm outline-none focus:border-blue-400 focus:bg-white transition-all shadow-sm"
                placeholder="Ej: MARTILLO CARPINTERO MANGO MADERA..."
                value={form.nombre}
                onChange={(e) => setForm({...form, nombre: e.target.value})}
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-2 block">Tipo de Ítem *</label>
              <select 
                className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-bold outline-none cursor-pointer"
                value={form.tipo}
                onChange={(e) => setForm({...form, tipo: e.target.value})}
              >
                <option value="Producto">Producto (Inventariable)</option>
                <option value="Servicio">Servicio</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-2 block">SKU / Código Comercial</label>
              <input 
                type="text" 
                className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-mono outline-none"
                placeholder="Dejar vacío para auto-generar"
                value={form.sku}
                onChange={(e) => setForm({...form, sku: e.target.value})}
              />
            </div>
          </div>

          {/* SECCIÓN: CATEGORIZACIÓN */}
          <div className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-4 block italic">Clasificación en Sistema</label>
            <select 
              required
              className="w-full p-5 bg-white border border-slate-200 rounded-[1.5rem] text-sm outline-none shadow-sm"
              value={form.categoria_id}
              onChange={(e) => setForm({...form, categoria_id: e.target.value})}
            >
              <option value="">{fetchingCats ? "Cargando categorías..." : "Selecciona una categoría oficial"}</option>
              {categorias.map((cat) => (
                <option key={cat.producto_categoria_id} value={cat.producto_categoria_id}>
                  {cat.producto_categoria_nombre}
                </option>
              ))}
            </select>
          </div>

          {/* SECCIÓN: PRECIOS (ESTILO GRUPO ICA) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 bg-blue-50/40 rounded-[3rem] border border-blue-100/50">
            <div>
              <label className="text-[10px] font-black uppercase text-blue-700 ml-2 mb-2 block">Precio Costo (Neto) *</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-300 font-bold">$</span>
                <input 
                  required
                  type="number" 
                  className="w-full pl-10 pr-5 py-5 bg-white border border-blue-100 rounded-[1.5rem] text-sm outline-none focus:ring-2 ring-blue-200 transition-all font-bold"
                  value={form.precio_costo}
                  onChange={(e) => setForm({...form, precio_costo: Number(e.target.value)})}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-blue-700 ml-2 mb-2 block">Precio Venta (Neto) *</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-300 font-bold">$</span>
                <input 
                  required
                  type="number" 
                  className="w-full pl-10 pr-5 py-5 bg-white border border-blue-100 rounded-[1.5rem] text-sm outline-none focus:ring-2 ring-blue-200 transition-all font-bold"
                  value={form.precio_venta}
                  onChange={(e) => setForm({...form, precio_venta: Number(e.target.value)})}
                />
              </div>
            </div>
            <div className="md:col-span-2 flex items-center gap-2 text-[10px] text-blue-400 font-bold uppercase italic px-2">
              <Info size={12} />
              Los precios se sincronizarán como valores netos (sin IVA) según configuración de Obuma.
            </div>
          </div>

          {/* BOTÓN DE ACCIÓN */}
          <button 
            disabled={loading}
            type="submit" 
            className="w-full py-6 bg-[#00338d] text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl shadow-blue-900/30 flex items-center justify-center gap-4 hover:bg-blue-800 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
            {loading ? 'Sincronizando con Obuma...' : 'Crear Producto en ERP'}
          </button>
        </form>
      </div>
    </div>
  );
}