"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Loader2, RefreshCcw, AlertCircle, Check } from "lucide-react";

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

  const [form, setForm] = useState({
    tipo: "Producto", // Campo rescatado según imagen
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
        setStatus({ type: 'error', msg: "Error de conexión con Obuma" });
      }
    }
    loadData();
  }, []);

  // 2. Filtrado de subcategorías
  const subCategoriasFiltradas = useMemo(() => {
    if (!form.categoria_id) return [];
    return allSubcategorias.filter(s => String(s.rel_producto_categoria_id) === String(form.categoria_id));
  }, [allSubcategorias, form.categoria_id]);

  // 3. Lógica de SKU
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

  // 4. Envío del formulario
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
        setForm({
          ...form,
          nombre_completo: "",
          sku: "",
          precio_costo: 0,
          precio_venta: 0
        });
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
          <p className="text-slate-500 text-sm">Registro centralizado de existencias</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 space-y-6">
            
            {/* FILA 1: NOMBRE (UN SOLO INPUT) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              <label className="text-sm font-semibold">Nombre <span className="text-red-500">*</span></label>
              <div className="md:col-span-3">
                <input 
                  placeholder="Ej: CORTAR CARTON PLASTICO 10" 
                  className="f-input w-full uppercase" 
                  value={form.nombre_completo} 
                  onChange={e => setForm({...form, nombre_completo: e.target.value})} 
                  required
                />
              </div>
            </div>

            {/* FILA 2: TIPO Y SKU */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <label className="text-sm font-semibold">Tipo <span className="text-red-500">*</span></label>
                <select 
                  className="f-input w-full" 
                  value={form.tipo} 
                  onChange={e => setForm({...form, tipo: e.target.value})}
                >
                  <option value="Producto">Producto</option>
                  <option value="Servicio">Servicio</option>
                  <option value="Insumo">Insumo</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <label className="text-sm font-semibold">SKU</label>
                <div className="relative">
                  <input 
                    readOnly 
                    value={form.sku} 
                    placeholder="SKU" 
                    className="f-input w-full pr-10 bg-slate-50 font-mono font-bold text-blue-600" 
                  />
                  <button 
                    type="button"
                    onClick={() => solicitarNuevoSku(form.subcategoria_id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    <RefreshCcw size={16} className={generatingSku ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
            </div>

            {/* FILA 3: CATEGORÍA Y SUBCATEGORÍA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <label className="text-sm font-semibold">Categoría <span className="text-red-500">*</span></label>
                <select 
                  className="f-input w-full" 
                  value={form.categoria_id} 
                  onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}
                  required
                >
                  <option value="">Selecciona...</option>
                  {categorias.map((c) => (
                    <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <label className="text-sm font-semibold">Subcategoria <span className="text-red-500">*</span></label>
                <select 
                  disabled={!form.categoria_id} 
                  className="f-input w-full disabled:bg-slate-50" 
                  value={form.subcategoria_id} 
                  onChange={e => solicitarNuevoSku(e.target.value)}
                  required
                >
                  <option value="">Selecciona...</option>
                  {subCategoriasFiltradas.map((s) => (
                    <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* FILA 4: PRECIOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <label className="text-sm font-semibold">Precio Costo <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input 
                      type="number" 
                      className="f-input w-full pl-7" 
                      value={form.precio_costo} 
                      onChange={e => setForm({...form, precio_costo: Number(e.target.value)})} 
                    />
                  </div>
                  <label className="flex items-center gap-1 text-[11px] whitespace-nowrap cursor-pointer">
                    <input type="checkbox" checked={form.costo_incluye_iva} onChange={e => setForm({...form, costo_incluye_iva: e.target.checked})} />
                    ¿Incluye IVA?
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <label className="text-sm font-semibold">Precio Venta <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input 
                      type="number" 
                      className="f-input w-full pl-7" 
                      value={form.precio_venta} 
                      onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} 
                    />
                  </div>
                  <label className="flex items-center gap-1 text-[11px] whitespace-nowrap cursor-pointer">
                    <input type="checkbox" checked={form.venta_incluye_iva} onChange={e => setForm({...form, venta_incluye_iva: e.target.checked})} />
                    ¿Incluye IVA?
                  </label>
                </div>
              </div>
            </div>

            {/* FILA 5: CHECKBOXES DE CONFIGURACIÓN */}
            <div className="flex flex-wrap gap-6 pt-4 border-t border-slate-50">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300" checked={form.se_puede_vender} onChange={e => setForm({...form, se_puede_vender: e.target.checked})} />
                ¿Se puede vender?
              </label>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300" checked={form.se_puede_comprar} onChange={e => setForm({...form, se_puede_comprar: e.target.checked})} />
                ¿Se puede comprar?
              </label>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300" checked={form.se_mantiene_stock} onChange={e => setForm({...form, se_mantiene_stock: e.target.checked})} />
                ¿Se mantiene stock?
              </label>
            </div>

          </div>

          {/* FOOTER: BOTÓN Y STATUS */}
          <div className="bg-slate-50 px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-200">
            <div className="flex-1">
              {status && (
                <div className={`flex items-center gap-2 text-sm font-bold ${status.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {status.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  {status.msg}
                </div>
              )}
            </div>
            <button 
              type="submit"
              disabled={loading || !form.sku || !form.nombre_completo}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-10 py-2.5 rounded-md font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 min-w-[160px]"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : null}
              {loading ? 'Procesando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        .f-input {
          @apply border border-slate-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-300;
        }
      `}</style>
    </div>
  );
}