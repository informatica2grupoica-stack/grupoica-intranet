"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Loader2, RefreshCcw, AlertCircle, Check } from "lucide-react";

// Definición de interfaces para robustez de tipos
interface Categoria {
  producto_categoria_id: string;
  producto_categoria_nombre: string;
}

interface Subcategoria {
  producto_subcategoria_id: string;
  producto_subcategoria_nombre: string;
  rel_producto_categoria_id: string;
}

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<Subcategoria[]>([]);

  const [nameParts, setNameParts] = useState({ 
    c1: "", c2: "", c3: "", unit: "MT", c4: "" 
  });

  const [form, setForm] = useState({
    nombre_completo: "",
    sku: "", 
    categoria_id: "",
    subcategoria_id: "",
    precio_costo: 0,
    precio_venta: 0,
    venta_incluye_iva: true,
    costo_incluye_iva: true,
    se_puede_vender: true,
    se_puede_comprar: true,
    se_mantiene_stock: true,
  });

  // 1. Carga de datos inicial
  useEffect(() => {
    async function loadData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);
        const dataCat = await resCat.json();
        const dataSub = await resSub.json();
        setCategorias(Array.isArray(dataCat) ? dataCat : []);
        setAllSubcategorias(Array.isArray(dataSub) ? dataSub : []);
      } catch (err) { 
        setStatus({ type: 'error', msg: "Error de conexión con la base de datos" });
      }
    }
    loadData();
  }, []);

  // 2. Construcción del nombre automático
  useEffect(() => {
    const clean = (t: string) => (t ? String(t).toUpperCase().trim() : "");
    const parts = [
      clean(nameParts.c1),
      clean(nameParts.c2),
      nameParts.c3 ? `${clean(nameParts.c3)} ${clean(nameParts.unit)}` : "",
      clean(nameParts.c4)
    ].filter(p => p !== "");
    setForm(prev => ({ ...prev, nombre_completo: parts.join(" ") }));
  }, [nameParts]);

  // 3. Filtrado de subcategorías
  const subCategoriasFiltradas = useMemo(() => {
    if (!form.categoria_id) return [];
    return allSubcategorias.filter(s => String(s.rel_producto_categoria_id) === String(form.categoria_id));
  }, [allSubcategorias, form.categoria_id]);

  // 4. Lógica de SKU
  const solicitarNuevoSku = async (subId: string) => {
    if (!subId) {
        setForm(prev => ({ ...prev, subcategoria_id: "", sku: "" }));
        return;
    }
    setGeneratingSku(true);
    setForm(prev => ({ ...prev, subcategoria_id: subId }));
    try {
      const cat = categorias.find(c => String(c.producto_categoria_id) === String(form.categoria_id));
      const prefijo = cat?.producto_categoria_nombre?.toUpperCase().includes("MERCADO PUBLICO") ? "60" : "50";
      const res = await fetch(`/api/obuma/siguiente-sku?prefijoSub=${prefijo}${subId}`);
      const data = await res.json();
      if (data.sku) setForm(prev => ({ ...prev, sku: String(data.sku) }));
    } catch (err) { 
      setStatus({ type: 'error', msg: "Error al generar SKU" });
    } finally { 
      setGeneratingSku(false); 
    }
  };

  // 5. Envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/obuma/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, nombre_completo: form.nombre_completo.toUpperCase() }),
      });
      
      const result = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', msg: "Producto registrado exitosamente" });
        // Limpiar campos de nombre y precios
        setNameParts({ c1: "", c2: "", c3: "", unit: "MT", c4: "" });
        setForm(prev => ({ ...prev, precio_costo: 0, precio_venta: 0 }));
      } else {
        setStatus({ type: 'error', msg: result.error || "Obuma rechazó los datos" });
      }
    } catch (error) { 
      setStatus({ type: 'error', msg: "Error crítico de servidor" }); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-6 lg:p-12 text-slate-700">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Nuevo producto</h1>
          <p className="text-slate-500 text-sm">Registro de existencias - Grupo ICA</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 space-y-8">
            
            {/* SECCIÓN 1: IDENTIDAD */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
              <label className="text-sm font-semibold pt-2">Nombre del Producto <span className="text-red-500">*</span></label>
              <div className="md:col-span-3 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input placeholder="TIPO" className="f-input" value={nameParts.c1} onChange={e => setNameParts({...nameParts, c1: e.target.value})} />
                  <input placeholder="ATRIBUTO" className="f-input" value={nameParts.c2} onChange={e => setNameParts({...nameParts, c2: e.target.value})} />
                  <input placeholder="MEDIDA" className="f-input" value={nameParts.c3} onChange={e => setNameParts({...nameParts, c3: e.target.value})} />
                  <select className="f-input bg-slate-50 font-medium" value={nameParts.unit} onChange={e => setNameParts({...nameParts, unit: e.target.value})}>
                    <option value="MT">MT</option><option value="KG">KG</option><option value="UN">UN</option><option value="MM">MM</option>
                  </select>
                </div>
                <input placeholder="MARCA / DETALLES ADICIONALES" className="f-input w-full" value={nameParts.c4} onChange={e => setNameParts({...nameParts, c4: e.target.value})} />
                <div className="p-3 bg-slate-800 rounded flex items-center gap-3">
                  <span className="text-slate-400 text-[10px] font-bold uppercase">Resultado:</span>
                  <span className="text-white text-xs font-mono uppercase truncate">{form.nombre_completo || "Esperando datos..."}</span>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* SECCIÓN 2: CATEGORIZACIÓN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Categoría Principal <span className="text-red-500">*</span></label>
                <select className="f-input w-full" value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}>
                  <option value="">Seleccione...</option>
                  {categorias.map((c) => (
                    <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Subcategoría <span className="text-red-500">*</span></label>
                <select disabled={!form.categoria_id} className="f-input w-full disabled:bg-slate-50" value={form.subcategoria_id} onChange={e => solicitarNuevoSku(e.target.value)}>
                  <option value="">Seleccione...</option>
                  {subCategoriasFiltradas.map((s) => (
                    <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <label className="text-sm font-semibold pt-2">Código SKU</label>
              <div className="md:col-span-3">
                <div className="relative max-w-[240px]">
                  <input readOnly value={form.sku} placeholder="Generando..." className="f-input w-full pr-10 bg-slate-50 font-mono font-bold text-blue-600" />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {generatingSku ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <RefreshCcw size={16} className="text-slate-300" />}
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* SECCIÓN 3: VALORES COMERCIALES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-600">Costo Unitario</label>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input type="number" className="f-input w-full pl-7" value={form.precio_costo} onChange={e => setForm({...form, precio_costo: Number(e.target.value)})} />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600" checked={form.costo_incluye_iva} onChange={e => setForm({...form, costo_incluye_iva: e.target.checked})} />
                    IVA
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-blue-800">Precio de Venta</label>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 text-sm">$</span>
                    <input type="number" className="f-input w-full pl-7 border-blue-200 bg-blue-50/20 font-bold text-blue-900" value={form.precio_venta} onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600" checked={form.venta_incluye_iva} onChange={e => setForm({...form, venta_incluye_iva: e.target.checked})} />
                    IVA
                  </label>
                </div>
              </div>
            </div>

            {/* SECCIÓN 4: PARÁMETROS OPERATIVOS */}
            <div className="flex flex-wrap gap-8 py-2 border-t border-slate-50 pt-6">
              {[
                { id: 'se_puede_vender', label: 'Venta Habilitada' },
                { id: 'se_puede_comprar', label: 'Compra Habilitada' },
                { id: 'se_mantiene_stock', label: 'Control de Inventario' }
              ].map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-tight cursor-pointer hover:text-blue-600 transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 accent-blue-600" 
                    checked={(form as any)[item.id]} 
                    onChange={e => setForm({...form, [item.id]: e.target.checked})} 
                  />
                  {item.label}
                </label>
              ))}
            </div>

          </div>

          {/* BOTONERA Y ALERTAS */}
          <div className="bg-slate-50 px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-slate-200">
            <div className="min-h-[24px]">
              {status && (
                <div className={`flex items-center gap-2 text-sm font-bold ${status.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {status.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                  {status.msg}
                </div>
              )}
            </div>
            <button 
              type="submit"
              disabled={loading || !form.sku || !form.nombre_completo}
              className="bg-[#0046ad] hover:bg-[#003585] disabled:bg-slate-300 text-white px-12 py-3 rounded font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-3 uppercase tracking-wider"
            >
              {loading && <Loader2 className="animate-spin" size={18} />}
              {loading ? 'Guardando...' : 'Registrar Producto'}
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        .f-input {
          height: 42px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 0 12px;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.2s ease;
          background-color: #fff;
        }
        .f-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .f-input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }
      `}</style>
    </div>
  );
}