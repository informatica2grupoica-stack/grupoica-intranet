"use client";

import { useState, useEffect, useMemo } from "react";
import { Save, Loader2, PackagePlus, RefreshCcw, AlertCircle, Check, DollarSign } from "lucide-react";

// --- Interfaces de Datos ---
interface Categoria {
  producto_categoria_id: string | number;
  producto_categoria_nombre: string;
}

interface Subcategoria {
  producto_subcategoria_id: string | number;
  producto_subcategoria_nombre: string;
  rel_producto_categoria_id: string | number;
}

interface FormState {
  nombre_completo: string;
  sku: string;
  categoria_id: string;
  subcategoria_id: string;
  precio_costo: number;
  precio_venta: number;
  venta_incluye_iva: boolean;
  costo_incluye_iva: boolean;
  se_puede_vender: boolean;
  se_puede_comprar: boolean;
  se_mantiene_stock: boolean;
}

export default function NuevoProductoForm() {
  // --- Estados ---
  const [loading, setLoading] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<Subcategoria[]>([]);

  const [nameParts, setNameParts] = useState({ 
    c1: "", c2: "", c3: "", unit: "MT", c4: "" 
  });

  const [form, setForm] = useState<FormState>({
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

  // --- 1. Carga de Datos Inicial ---
  useEffect(() => {
    async function loadData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);
        if (!resCat.ok || !resSub.ok) throw new Error("Error en servidor");
        
        setCategorias(await resCat.json());
        setAllSubcategorias(await resSub.json());
      } catch (err) { 
        setStatus({ type: 'error', msg: "No se pudieron cargar las categorías" });
      }
    }
    loadData();
  }, []);

  // --- 2. Lógica de Construcción de Nombre ---
  useEffect(() => {
    const clean = (t: string) => t.toUpperCase().trim();
    const parts = [
      clean(nameParts.c1),
      clean(nameParts.c2),
      nameParts.c3 ? `${clean(nameParts.c3)} ${nameParts.unit}` : "",
      clean(nameParts.c4)
    ].filter(Boolean);
    
    setForm(prev => ({ ...prev, nombre_completo: parts.join(" ") }));
  }, [nameParts]);

  // --- 3. Filtrado de Subcategorías (Memoizado) ---
  const subCategoriasFiltradas = useMemo(() => {
    return allSubcategorias.filter(s => 
      String(s.rel_producto_categoria_id) === String(form.categoria_id)
    );
  }, [allSubcategorias, form.categoria_id]);

  // --- 4. Generador de SKU ---
  const solicitarNuevoSku = async (subId: string) => {
    if (!subId || !form.categoria_id) return;
    
    setGeneratingSku(true);
    try {
      const cat = categorias.find(c => String(c.producto_categoria_id) === String(form.categoria_id));
      const nombreCat = cat?.producto_categoria_nombre?.toUpperCase() || "";
      const prefijo = nombreCat.includes("MERCADO PUBLICO") ? "60" : "50";
      
      const res = await fetch(`/api/obuma/siguiente-sku?prefijoSub=${prefijo}${subId}`);
      const data = await res.json();
      
      if (data.sku) {
        setForm(prev => ({ ...prev, sku: data.sku, subcategoria_id: subId }));
      }
    } catch (err) { 
      console.error("Error SKU:", err);
    } finally { 
      setGeneratingSku(false); 
    }
  };

  // --- 5. Envío de Formulario ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/obuma/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setStatus({ type: 'success', msg: `PRODUCTO CREADO: ${form.sku}` });
        const subIdActual = form.subcategoria_id;
        
        // Reset parcial para facilitar carga continua
        setNameParts({ c1: "", c2: "", c3: "", unit: "MT", c4: "" });
        setForm(prev => ({ ...prev, precio_costo: 0, precio_venta: 0 }));
        
        // Auto-solicitar el siguiente SKU para la misma subcategoría
        await solicitarNuevoSku(subIdActual);
      } else {
        const err = await res.json();
        setStatus({ type: 'error', msg: err.error || "Error al procesar en Obuma" });
      }
    } catch (error) { 
      setStatus({ type: 'error', msg: "Fallo de conexión con el servidor" }); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 bg-[#f8fafc] min-h-screen font-sans text-slate-800">
      <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200/60 overflow-hidden">
        
        <div className="p-6 md:p-10 space-y-10">
          
          {/* SECCIÓN 1: NOMBRE DINÁMICO */}
          <section className="space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-600 rounded-full" />
              <h2 className="text-[11px] font-black text-blue-600 uppercase tracking-widest">1. Construcción de Identidad</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <input 
                placeholder="TIPO (Ej: TUBO)" 
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase text-sm focus:ring-2 ring-blue-50 focus:bg-white outline-none transition-all" 
                value={nameParts.c1} 
                onChange={e => setNameParts({...nameParts, c1: e.target.value})} 
              />
              <input 
                placeholder="ATRIBUTO (Ej: PVC)" 
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase text-sm focus:ring-2 ring-blue-50 focus:bg-white outline-none transition-all" 
                value={nameParts.c2} 
                onChange={e => setNameParts({...nameParts, c2: e.target.value})} 
              />
              <div className="flex gap-2 col-span-2 md:col-span-2">
                <input 
                  placeholder="MEDIDA" 
                  className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase text-sm outline-none focus:bg-white transition-all" 
                  value={nameParts.c3} 
                  onChange={e => setNameParts({...nameParts, c3: e.target.value})} 
                />
                <select 
                  className="p-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-xs outline-none cursor-pointer hover:bg-slate-200 transition-colors" 
                  value={nameParts.unit} 
                  onChange={e => setNameParts({...nameParts, unit: e.target.value})}
                >
                  <option value="MT">MT</option>
                  <option value="KG">KG</option>
                  <option value="UN">UN</option>
                  <option value="MM">MM</option>
                </select>
                <input 
                  placeholder="COLOR/MARCA" 
                  className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase text-sm outline-none focus:bg-white transition-all" 
                  value={nameParts.c4} 
                  onChange={e => setNameParts({...nameParts, c4: e.target.value})} 
                />
              </div>
              <div className="hidden md:flex items-center justify-center bg-blue-50 rounded-2xl border border-blue-100 p-2">
                <PackagePlus className="text-blue-400" size={20} />
              </div>
            </div>

            {/* PREVIEW TIPO TERMINAL */}
            <div className="p-5 bg-slate-900 rounded-[1.5rem] shadow-inner relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">
                <Check className="text-emerald-400" size={14} />
              </div>
              <span className="text-[9px] font-bold text-blue-400/80 uppercase tracking-[0.3em]">Nombre en Base de Datos</span>
              <p className="text-white font-mono font-bold uppercase text-xl tracking-tight mt-1 truncate">
                {form.nombre_completo || "SIN NOMBRE..."}
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            
            {/* SECCIÓN 2: CLASIFICACIÓN */}
            <section className="space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-blue-600 rounded-full" />
                <h2 className="text-[11px] font-black text-blue-600 uppercase tracking-widest">2. Clasificación & SKU</h2>
              </div>
              
              <div className="space-y-3">
                <select 
                  required 
                  className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 focus:ring-4 ring-blue-50 transition-all appearance-none" 
                  value={form.categoria_id} 
                  onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}
                >
                  <option value="">Selecciona Categoría...</option>
                  {categorias.map(c => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
                </select>

                <select 
                  required 
                  disabled={!form.categoria_id}
                  className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 focus:ring-4 ring-blue-50 transition-all disabled:opacity-50" 
                  value={form.subcategoria_id} 
                  onChange={e => solicitarNuevoSku(e.target.value)}
                >
                  <option value="">Selecciona Subcategoría...</option>
                  {subCategoriasFiltradas.map(s => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
                </select>
              </div>

              <div className="mt-8 p-10 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 rounded-[2.5rem] flex flex-col items-center justify-center relative">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3">SKU Sugerido</span>
                <div className="flex items-center gap-6">
                  <span className="text-5xl font-black text-[#00338d] tracking-tighter drop-shadow-sm">
                    {form.sku || "---"}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => solicitarNuevoSku(form.subcategoria_id)}
                    disabled={!form.subcategoria_id || generatingSku}
                    className="p-3 bg-white hover:bg-blue-600 hover:text-white rounded-full shadow-lg transition-all active:scale-90 disabled:opacity-30"
                  >
                    <RefreshCcw size={22} className={generatingSku ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
            </section>

            {/* SECCIÓN 3: PRECIOS & PARÁMETROS */}
            <section className="space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-blue-600 rounded-full" />
                <h2 className="text-[11px] font-black text-blue-600 uppercase tracking-widest">3. Finanzas & Control</h2>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* Costo */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="number" 
                      placeholder="PRECIO COSTO" 
                      className="w-full pl-10 p-4 bg-white border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-slate-300 transition-all" 
                      value={form.precio_costo} 
                      onChange={e => setForm({...form, precio_costo: Number(e.target.value)})} 
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-4 py-4 rounded-2xl border border-slate-200 hover:bg-slate-200 transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-blue-700" 
                      checked={form.costo_incluye_iva} 
                      onChange={e => setForm({...form, costo_incluye_iva: e.target.checked})} 
                    />
                    <span className="text-[10px] font-black uppercase">IVA</span>
                  </label>
                </div>

                {/* Venta */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={18} />
                    <input 
                      type="number" 
                      placeholder="PRECIO VENTA" 
                      className="w-full pl-10 p-4 bg-white border-2 border-blue-100 rounded-2xl font-black text-blue-700 outline-none focus:border-blue-500 transition-all shadow-sm" 
                      value={form.precio_venta} 
                      onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} 
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-blue-600 px-4 py-4 rounded-2xl border border-blue-700 text-white shadow-md">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-white" 
                      checked={form.venta_incluye_iva} 
                      onChange={e => setForm({...form, venta_incluye_iva: e.target.checked})} 
                    />
                    <span className="text-[10px] font-black uppercase">IVA</span>
                  </label>
                </div>
              </div>

              {/* Switches Rápidos */}
              <div className="grid grid-cols-1 gap-2 pt-4">
                {[
                  { k: 'se_puede_vender', l: 'Habilitar para Venta' },
                  { k: 'se_puede_comprar', l: 'Permitir Compras/PO' },
                  { k: 'se_mantiene_stock', l: 'Controlar Inventario' }
                ].map(item => (
                  <label key={item.k} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-blue-200 hover:bg-white transition-all group">
                    <span className="text-[11px] font-bold uppercase italic text-slate-500 group-hover:text-blue-700 transition-colors">
                      {item.l}
                    </span>
                    <input 
                      type="checkbox" 
                      className="w-6 h-6 accent-blue-600" 
                      checked={(form as any)[item.k]} 
                      onChange={e => setForm({...form, [item.k]: e.target.checked})} 
                    />
                  </label>
                ))}
              </div>
            </section>
          </div>

          {/* MENSAJES DE ESTADO */}
          {status && (
            <div className={`p-5 rounded-[1.5rem] flex items-center gap-4 border-2 animate-in fade-in slide-in-from-bottom-2 ${
              status.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <div className={`p-2 rounded-full ${status.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'} text-white shadow-lg`}>
                {status.type === 'success' ? <Check size={20}/> : <AlertCircle size={20}/>}
              </div>
              <div className="flex flex-col">
                <span className="font-black uppercase text-xs tracking-widest">{status.type === 'success' ? 'Éxito' : 'Error'}</span>
                <span className="text-sm font-medium">{status.msg}</span>
              </div>
            </div>
          )}

          {/* BOTÓN FINAL */}
          <button 
            onClick={handleSubmit}
            disabled={loading || !form.sku || !form.nombre_completo || !form.categoria_id}
            className="w-full bg-[#00338d] hover:bg-[#002a75] disabled:bg-slate-300 text-white py-7 rounded-[2.5rem] font-black uppercase tracking-[0.3em] shadow-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.97] hover:shadow-blue-200"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={28} />
            ) : (
              <>
                <Save size={24} />
                <span>Registrar en Obuma ERP</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}