"use client";
import { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle2, AlertCircle, Hash, RefreshCcw } from "lucide-react";

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  const [categorias, setCategorias] = useState<any[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<any[]>([]);
  const [filteredSubcategorias, setFilteredSubcategorias] = useState<any[]>([]);

  // 1. CAMPOS PARA CONSTRUCCIÓN AUTOMÁTICA
  const [piezas, setPiezas] = useState({
    tipo: "",
    caracteristica: "",
    valorMedida: "",
    unidadMedida: "MT",
    marca: ""
  });

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

  // 2. LÓGICA DE GENERACIÓN AUTOMÁTICA DE NOMBRE
  useEffect(() => {
    const limpiar = (t: string) => 
      t.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    const nombreConstruido = [
      limpiar(piezas.tipo),
      limpiar(piezas.caracteristica),
      piezas.valorMedida ? `${limpiar(piezas.valorMedida)} ${piezas.unidadMedida}` : "",
      limpiar(piezas.marca)
    ].filter(Boolean).join(" ");

    setForm(prev => ({ ...prev, nombre: nombreConstruido }));
  }, [piezas]);

  // 3. CARGA INICIAL DE DATOS
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

  // 4. FILTRADO DE SUBCATEGORÍAS
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

  // FUNCIÓN CRÍTICA MEJORADA: Obtener correlativo real
  const sugerirSkuCorrelativo = async (subId: string) => {
    if (!subId) return;
    setGeneratingSku(true);
    try {
      // 1. Consultamos el último SKU de esta subcategoría en tu base de datos/API
      const res = await fetch(`/api/obuma/siguiente-sku?subcategoria_id=${subId}`);
      const data = await res.json();
      
      if (data.sku) {
        // Si la API devuelve un SKU (ej: 6026423201), lo asignamos directamente
        setForm(prev => ({ ...prev, sku: String(data.sku), subcategoria_id: subId }));
      } else {
        // Si no hay productos, iniciamos el correlativo limpio: SubID + 0001
        // Ej: Subcategoría 6026 -> SKU 60260001
        const nuevoSku = `${subId}0001`;
        setForm(prev => ({ ...prev, sku: nuevoSku, subcategoria_id: subId }));
      }
    } catch (err) {
      // Fallback de emergencia pero controlado para no romper el flujo
      const emergencySku = `${subId}${Math.floor(Math.random() * 9000) + 1000}`;
      setForm(prev => ({ ...prev, sku: emergencySku, subcategoria_id: subId }));
      console.error("Error al generar correlativo, usando fallback aleatorio.");
    } finally {
      setGeneratingSku(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku) {
        setStatus({ type: 'error', msg: "DEBES GENERAR UN SKU PRIMERO" });
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

      const result = await res.json();

      if (res.ok) {
        setStatus({ 
          type: 'success', 
          msg: `PRODUCTO CREADO EXITOSAMENTE: ${form.sku}` 
        });

        // Limpiamos los campos variables, pero mantenemos la configuración de IVA y Stock
        setForm(prev => ({ 
          ...prev, 
          nombre: "", 
          sku: "", 
          precio_costo: 0, 
          precio_venta: 0 
        }));
        setPiezas({ tipo: "", caracteristica: "", valorMedida: "", unidadMedida: "MT", marca: "" });
      } else {
        if (result.error?.includes("duplicado") || result.code === "sku_exists") {
            setStatus({ type: 'error', msg: "SKU DUPLICADO, REINTENTANDO CORRELATIVO..." });
            await sugerirSkuCorrelativo(form.subcategoria_id);
        } else {
            throw new Error(result.error || 'Error al crear producto');
        }
      }
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-slate-100 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800 font-black uppercase italic tracking-tighter">
          Sincronización Intranet - Obuma
        </h2>
        <div className="flex gap-2">
            <div className="bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Correlativo Automático</span>
            </div>
        </div>
      </div>

      {/* VISOR DE NOMBRE AUTOMÁTICO */}
      <div className="mb-8 p-6 bg-[#00338d] rounded-[1.5rem] text-white shadow-lg border-b-4 border-[#00266b]">
        <label className="text-[9px] font-black uppercase opacity-60 tracking-[0.2em]">Previsualización Nombre Obuma</label>
        <div className="text-xl font-black uppercase italic tracking-tight mt-1">
          {form.nombre || "ESPERANDO DATOS DE CONSTRUCCIÓN..."}
        </div>
      </div>
      
      {status && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
          {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-bold uppercase">{status.msg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* PIEZAS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400">1. Tipo Producto</label>
            <input required className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-[#00338d]" placeholder="EJ: ZINC" value={piezas.tipo} onChange={(e) => setPiezas({...piezas, tipo: e.target.value})} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400">2. Característica</label>
            <input required className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-[#00338d]" placeholder="EJ: ACANALADO" value={piezas.caracteristica} onChange={(e) => setPiezas({...piezas, caracteristica: e.target.value})} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400">3. Medida</label>
            <div className="flex gap-1">
              <input className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#00338d]" placeholder="3,66" value={piezas.valorMedida} onChange={(e) => setPiezas({...piezas, valorMedida: e.target.value})} />
              <select className="p-3 bg-white border border-slate-200 rounded-xl font-black text-[10px]" value={piezas.unidadMedida} onChange={(e) => setPiezas({...piezas, unidadMedida: e.target.value})}>
                <option value="MT">MT</option><option value="CM">CM</option><option value="MM">MM</option><option value='"'>"</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400">4. Marca / Modelo</label>
            <input className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-[#00338d]" placeholder="EJ: POLPAICO" value={piezas.marca} onChange={(e) => setPiezas({...piezas, marca: e.target.value})} />
          </div>
        </div>

        {/* SKU Y CATEGORIZACIÓN */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-[#00338d] italic flex justify-between items-center">
              SKU CORRELATIVO *
              <button 
                type="button" 
                onClick={() => sugerirSkuCorrelativo(form.subcategoria_id)}
                className="hover:rotate-180 transition-transform duration-500"
              >
                <RefreshCcw size={14} className={generatingSku ? "animate-spin text-slate-400" : "text-slate-400"} />
              </button>
            </label>
            <div className="relative">
                <input 
                  required
                  readOnly
                  className="w-full p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl text-base font-mono font-black text-amber-700 text-center outline-none"
                  placeholder="CÓDIGO AUTO"
                  value={form.sku}
                />
                <Hash className="absolute right-4 top-4 text-amber-300" size={18} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 italic">Categoría Obuma *</label>
            <select required className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" value={form.categoria_id} onChange={(e) => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}>
              <option value="">{loadingData ? "Cargando..." : "Selecciona..."}</option>
              {categorias.map((cat) => <option key={cat.producto_categoria_id} value={cat.producto_categoria_id}>{cat.producto_categoria_nombre}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 italic">Subcategoría *</label>
            <select 
              required 
              disabled={!form.categoria_id} 
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none disabled:opacity-50" 
              value={form.subcategoria_id} 
              onChange={(e) => sugerirSkuCorrelativo(e.target.value)} 
            >
              <option value="">{form.categoria_id ? "Selecciona..." : "Elige categoría"}</option>
              {filteredSubcategorias.map((sub) => <option key={sub.producto_subcategoria_id} value={sub.producto_subcategoria_id}>{sub.producto_subcategoria_nombre}</option>)}
            </select>
          </div>
        </div>

        {/* PRECIOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 italic text-center">Precio Costo Neto *</label>
            <div className="relative">
              <span className="absolute left-4 top-4 text-slate-400 font-bold">$</span>
              <input type="number" required className="w-full p-4 pl-8 bg-white border border-slate-200 rounded-2xl text-lg font-black text-center outline-none focus:border-[#00338d]" value={form.precio_costo} onChange={(e) => setForm({...form, precio_costo: Number(e.target.value)})} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-[#00338d] italic text-center">Precio Venta Neto *</label>
            <div className="relative">
              <span className="absolute left-4 top-4 text-[#00338d] font-bold">$</span>
              <input type="number" required className="w-full p-4 pl-8 bg-white border-2 border-[#00338d]/20 rounded-2xl text-lg font-black text-[#00338d] text-center outline-none focus:border-[#00338d]" value={form.precio_venta} onChange={(e) => setForm({...form, precio_venta: Number(e.target.value)})} />
            </div>
          </div>
        </div>

        {/* BOTÓN FINAL */}
        <div className="flex justify-end pt-4">
          <button 
            type="submit" 
            disabled={loading || loadingData || !form.sku} 
            className="w-full md:w-auto bg-[#00338d] hover:bg-[#00266b] text-white px-16 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            Sincronizar con Obuma
          </button>
        </div>
      </form>
    </div>
  );
}