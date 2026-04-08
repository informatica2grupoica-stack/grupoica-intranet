"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Loader2, PackagePlus, RefreshCcw, Check, AlertCircle, 
  Tag, Layers, DollarSign, BarChart3, ChevronRight 
} from "lucide-react";

interface Categoria {
  producto_categoria_id: string | number;
  producto_categoria_nombre: string;
}

interface Subcategoria {
  producto_subcategoria_id: string | number;
  producto_subcategoria_nombre: string;
  rel_producto_categoria_id: string | number;
}

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<Subcategoria[]>([]);

  // Piezas para armar el nombre
  const [nameParts, setNameParts] = useState({ 
    c1: "", c2: "", c3: "", unit: "MT", c4: "" 
  });

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
  });

  // Carga de categorías y subcategorías
  useEffect(() => {
    async function loadData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);
        setCategorias(await resCat.json());
        setAllSubcategorias(await resSub.json());
      } catch (err) {
        setStatus({ type: 'error', msg: "Error de conexión con Obuma" });
      }
    }
    loadData();
  }, []);

  // Construcción automática del nombre
  useEffect(() => {
    const clean = (t: any) => (t ? String(t).toUpperCase().trim() : "");
    const parts = [
      clean(nameParts.c1),
      clean(nameParts.c2),
      nameParts.c3 ? `${clean(nameParts.c3)} ${clean(nameParts.unit)}` : "",
      clean(nameParts.c4)
    ].filter(p => p !== "");
    setForm(prev => ({ ...prev, nombre_completo: parts.join(" ") }));
  }, [nameParts]);

  const subCategoriasFiltradas = useMemo(() => {
    return allSubcategorias.filter(s => String(s.rel_producto_categoria_id) === String(form.categoria_id));
  }, [allSubcategorias, form.categoria_id]);

  const solicitarNuevoSku = async (subId: string) => {
    setForm(prev => ({ ...prev, subcategoria_id: subId }));
    if (!subId) return;
    
    setGeneratingSku(true);
    try {
      const cat = categorias.find(c => String(c.producto_categoria_id) === String(form.categoria_id));
      const prefijo = cat?.producto_categoria_nombre?.toUpperCase().includes("MERCADO PUBLICO") ? "60" : "50";
      const res = await fetch(`/api/obuma/siguiente-sku?prefijoSub=${prefijo}${subId}`);
      const data = await res.json();
      if (data.sku) setForm(prev => ({ ...prev, sku: String(data.sku) }));
    } catch (err) {
      setStatus({ type: 'error', msg: "No se pudo generar el SKU" });
    } finally {
      setGeneratingSku(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.nombre_completo || !form.sku || !form.categoria_id) {
      setStatus({ type: 'error', msg: "Nombre, SKU y Categoría son obligatorios" });
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

      if (res.ok) {
        setStatus({ type: 'success', msg: `Producto ${form.sku} creado exitosamente` });
        // Limpiar solo lo necesario para el siguiente producto
        setNameParts({ c1: "", c2: "", c3: "", unit: "MT", c4: "" });
        setForm(prev => ({ ...prev, precio_costo: 0, precio_venta: 0 }));
        await solicitarNuevoSku(form.subcategoria_id);
      } else {
        const err = await res.json();
        setStatus({ type: 'error', msg: err.error || "Error al crear producto" });
      }
    } catch (error) {
      setStatus({ type: 'error', msg: "Error crítico de servidor" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] p-4 lg:p-10 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Minimalista */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
                <PackagePlus className="text-white" size={24} />
              </div>
              REGISTRO DE PRODUCTOS
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2 ml-14">Chile Marketplace Sync</p>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase text-slate-600">Conexión Activa</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Columna Izquierda: Identidad */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Bloque de Nombre */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-6 text-slate-400">
                <Tag size={16} />
                <h2 className="text-[10px] font-black uppercase tracking-widest">Identidad del Producto</h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <input placeholder="TIPO" className="input-minimal" value={nameParts.c1} onChange={e => setNameParts({...nameParts, c1: e.target.value})} />
                <input placeholder="ATRIBUTO" className="input-minimal" value={nameParts.c2} onChange={e => setNameParts({...nameParts, c2: e.target.value})} />
                <input placeholder="MEDIDA" className="input-minimal" value={nameParts.c3} onChange={e => setNameParts({...nameParts, c3: e.target.value})} />
                <select className="input-minimal bg-slate-100 border-none" value={nameParts.unit} onChange={e => setNameParts({...nameParts, unit: e.target.value})}>
                  {["MT", "KG", "UN", "MM", "CC", "LT"].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <input placeholder="MARCA / COLOR / DETALLE EXTRA" className="col-span-2 md:col-span-4 input-minimal" value={nameParts.c4} onChange={e => setNameParts({...nameParts, c4: e.target.value})} />
              </div>

              <div className="bg-slate-900 rounded-3xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <PackagePlus size={80} className="text-white" />
                </div>
                <span className="text-blue-400 text-[9px] font-black uppercase tracking-widest block mb-2">Resultado Final</span>
                <p className="text-white text-xl font-bold uppercase leading-snug break-words">
                  {form.nombre_completo || "Esperando datos..."}
                </p>
              </div>
            </div>

            {/* Bloque de Categoría */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-6 text-slate-400">
                <Layers size={16} />
                <h2 className="text-[10px] font-black uppercase tracking-widest">Clasificación Técnica</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <select className="select-minimal" value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}>
                  <option value="">Categoría Principal</option>
                  {categorias.map(c => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                </select>
                <select disabled={!form.categoria_id} className="select-minimal disabled:opacity-30" value={form.subcategoria_id} onChange={e => solicitarNuevoSku(e.target.value)}>
                  <option value="">Subcategoría</option>
                  {subCategoriasFiltradas.map(s => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Precios y Acción */}
          <div className="space-y-6">
            
            {/* Bloque SKU */}
            <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-200 flex flex-col items-center text-center">
              <span className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-3">SKU Sincronizado</span>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-black tabular-nums">{generatingSku ? "..." : (form.sku || "----")}</span>
                <button onClick={() => solicitarNuevoSku(form.subcategoria_id)} disabled={!form.subcategoria_id} className="p-2 bg-white/20 rounded-full hover:bg-white/40 transition-all">
                  <RefreshCcw size={20} className={generatingSku ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {/* Bloque Comercial */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-2 mb-2 text-slate-400">
                <BarChart3 size={16} />
                <h2 className="text-[10px] font-black uppercase tracking-widest">Precios e IVA</h2>
              </div>
              
              <div className="space-y-4">
                <div className="price-input-group">
                  <span className="text-[10px] font-black text-slate-400 block mb-2 uppercase">Costo Unitario</span>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input type="number" className="w-full pl-10 pr-4 py-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none focus:ring-2 ring-blue-500/10" value={form.precio_costo} onChange={e => setForm({...form, precio_costo: Number(e.target.value)})} />
                    </div>
                    <label className="checkbox-iva">
                      <input type="checkbox" checked={form.costo_incluye_iva} onChange={e => setForm({...form, costo_incluye_iva: e.target.checked})} />
                      <span>IVA</span>
                    </label>
                  </div>
                </div>

                <div className="price-input-group">
                  <span className="text-[10px] font-black text-blue-600 block mb-2 uppercase">Precio de Venta</span>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600" size={14} />
                      <input type="number" className="w-full pl-10 pr-4 py-4 bg-blue-50 border border-blue-100 rounded-2xl font-black text-blue-700 text-lg outline-none" value={form.precio_venta} onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} />
                    </div>
                    <label className="checkbox-iva bg-blue-600 text-white border-blue-600">
                      <input type="checkbox" checked={form.venta_incluye_iva} onChange={e => setForm({...form, venta_incluye_iva: e.target.checked})} />
                      <span>IVA</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Botón de Acción */}
              <div className="pt-4 space-y-4">
                {status && (
                  <div className={`p-4 rounded-2xl flex items-center gap-3 border ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                    {status.type === 'success' ? <Check size={16}/> : <AlertCircle size={16}/>}
                    <p className="text-[10px] font-black uppercase leading-tight">{status.msg}</p>
                  </div>
                )}

                <button 
                  onClick={handleSubmit}
                  disabled={loading || !form.sku || !form.nombre_completo}
                  className="group w-full bg-slate-900 hover:bg-black disabled:bg-slate-200 disabled:text-slate-400 text-white py-6 rounded-3xl font-black text-[11px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                  REGISTRAR PRODUCTO
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .input-minimal {
          @apply p-4 bg-slate-50 border border-transparent rounded-2xl font-bold text-xs outline-none focus:bg-white focus:border-blue-500 transition-all uppercase;
        }
        .select-minimal {
          @apply p-4 bg-slate-50 border border-transparent rounded-2xl font-bold text-xs outline-none focus:bg-white focus:border-blue-500 transition-all;
        }
        .checkbox-iva {
          @apply flex flex-col items-center justify-center p-2 min-w-[50px] border border-slate-200 rounded-2xl cursor-pointer transition-all hover:bg-slate-100;
        }
        .checkbox-iva span {
          @apply text-[9px] font-black mt-1;
        }
        .checkbox-iva input {
          @apply w-4 h-4 accent-blue-600;
        }
      `}</style>
    </div>
  );
}