"use client";
import { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle2, AlertCircle, PackagePlus, RefreshCcw } from "lucide-react";

export default function NuevoProductoForm() {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [generatingSku, setGeneratingSku] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  
  const [categorias, setCategorias] = useState<any[]>([]);
  const [allSubcategorias, setAllSubcategorias] = useState<any[]>([]);
  const [filteredSubcategorias, setFilteredSubcategorias] = useState<any[]>([]);

  const [piezas, setPiezas] = useState({
    tipo: "",
    caracteristica: "",
    valorMedida: "",
    unidadMedida: "MT",
    marca: ""
  });

  const [form, setForm] = useState({
    nombre: "",
    tipo: "0", 
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

  // Generación de nombre compacto
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

  useEffect(() => {
    async function loadObumaData() {
      try {
        const [resCat, resSub] = await Promise.all([
          fetch('/api/obuma/categorias'),
          fetch('/api/obuma/subcategorias')
        ]);
        setCategorias(await resCat.json());
        setAllSubcategorias(await resSub.json());
      } catch (err) {
        console.error("Error Obuma Data");
      } finally {
        setLoadingData(false);
      }
    }
    loadObumaData();
  }, []);

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

  const sugerirSkuCorrelativo = async (subId: string, inicioForce?: number) => {
    if (!subId || !form.categoria_id) return;
    setGeneratingSku(true);
    try {
      const cat = categorias.find(c => String(c.producto_categoria_id) === String(form.categoria_id));
      const nombreCat = cat?.producto_categoria_nombre?.toUpperCase() || "";
      let prefijo = nombreCat.includes("MERCADO PUBLICO") ? "60" : nombreCat.includes("MAYORISTA") ? "50" : "99";

      const prefijoSub = `${prefijo}${subId}`;
      const url = `/api/obuma/siguiente-sku?prefijoSub=${prefijoSub}${inicioForce ? `&inicio=${inicioForce}` : ''}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.sku) {
        // CORRECCIÓN: Guardamos el SKU en el estado form para habilitar el botón
        setForm(prev => ({ ...prev, sku: String(data.sku), subcategoria_id: subId }));
      }
    } catch (err) {
      console.error("Error SKU");
    } finally {
      setGeneratingSku(false);
    }
  };

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
      const dataReal = Array.isArray(result) ? result[0] : result;

      if (!res.ok || !dataReal?.producto_id) {
        setStatus({ type: 'error', msg: `SKU EN USO. REINTENTANDO...` });
        await sugerirSkuCorrelativo(form.subcategoria_id, 204);
        setLoading(false);
        return;
      }

      setStatus({ type: 'success', msg: `CREADO EXITOSAMENTE` });
      setPiezas({ tipo: "", caracteristica: "", valorMedida: "", unidadMedida: "MT", marca: "" });
      setForm(prev => ({ ...prev, sku: "", precio_costo: 0, precio_venta: 0 }));
    } catch (error) {
      setStatus({ type: 'error', msg: "ERROR DE CONEXIÓN" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-2 font-sans text-slate-900">
      <div className="bg-white rounded-[1.5rem] shadow-xl border border-slate-100 overflow-hidden">
        
        {/* HEADER MÁS COMPACTO */}
        <div className="p-5 bg-[#00338d] text-white flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black italic uppercase tracking-tighter">Sincronización Obuma</h1>
            <p className="text-[9px] text-blue-200 font-bold uppercase tracking-widest">
              {form.nombre || "NUEVO PRODUCTO"}
            </p>
          </div>
          <PackagePlus size={30} className="opacity-30" />
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* 1. COMPONENTES (Achicado) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 relative">
            <span className="absolute -top-2.5 left-4 bg-white px-2 py-0.5 rounded-full text-[8px] font-black text-slate-400 border border-slate-100 uppercase">1. Componentes del Nombre</span>
            <input required placeholder="TIPO" className="p-2 bg-white border rounded-lg font-bold text-[11px] uppercase outline-none focus:border-blue-500" value={piezas.tipo} onChange={e => setPiezas({...piezas, tipo: e.target.value})} />
            <input required placeholder="CARACTERÍSTICA" className="p-2 bg-white border rounded-lg font-bold text-[11px] uppercase outline-none focus:border-blue-500" value={piezas.caracteristica} onChange={e => setPiezas({...piezas, caracteristica: e.target.value})} />
            <div className="flex gap-1">
              <input placeholder="MEDIDA" className="w-full p-2 bg-white border rounded-lg font-bold text-[11px] outline-none" value={piezas.valorMedida} onChange={e => setPiezas({...piezas, valorMedida: e.target.value})} />
              <select className="bg-white border rounded-lg text-[9px] font-black px-1" value={piezas.unidadMedida} onChange={e => setPiezas({...piezas, unidadMedida: e.target.value})}>
                <option value="MT">MT</option><option value="UN">UN</option><option value="KG">KG</option><option value='"'>"</option>
              </select>
            </div>
            <input placeholder="MARCA" className="p-2 bg-white border rounded-lg font-bold text-[11px] uppercase outline-none" value={piezas.marca} onChange={e => setPiezas({...piezas, marca: e.target.value})} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 2. CLASIFICACIÓN */}
            <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-400 uppercase italic">2. Clasificación</label>
              <select required className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-[11px] outline-none" value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}>
                <option value="">{loadingData ? "CARGANDO..." : "CATEGORÍA"}</option>
                {categorias.map(c => <option key={c.producto_categoria_id} value={c.producto_categoria_id}>{c.producto_categoria_nombre}</option>)}
              </select>
              <select required disabled={!form.categoria_id} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-[11px] outline-none disabled:opacity-30" value={form.subcategoria_id} onChange={e => sugerirSkuCorrelativo(e.target.value)}>
                <option value="">SUBCATEGORÍA</option>
                {filteredSubcategorias.map(s => <option key={s.producto_subcategoria_id} value={s.producto_subcategoria_id}>{s.producto_subcategoria_nombre}</option>)}
              </select>
            </div>

            {/* SKU (Compacto) */}
            <div className="bg-blue-50 rounded-xl p-4 border-2 border-dashed border-blue-100 flex flex-col items-center justify-center">
              <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">SKU ASIGNADO</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-[#00338d] tracking-tighter">{form.sku || "---"}</span>
                <button type="button" onClick={() => sugerirSkuCorrelativo(form.subcategoria_id)} className="text-blue-300 hover:text-blue-600">
                  <RefreshCcw size={16} className={generatingSku ? "animate-spin" : ""} />
                </button>
              </div>
            </div>
          </div>

          {/* 3. PRECIOS Y OPCIONES (Compacto) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-400 uppercase italic">3. Precios</label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-300 text-xs">$</span><input type="number" className="w-full p-2.5 pl-7 bg-slate-50 border rounded-lg font-bold text-xs" value={form.precio_costo} onChange={e => setForm({...form, precio_costo: Number(e.target.value)})} /></div>
                <label className="flex items-center gap-1.5 text-[9px] font-black uppercase cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-[#00338d]" checked={form.incluye_iva_costo} onChange={e => setForm({...form, incluye_iva_costo: e.target.checked})} />IVA</label>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-300 text-xs">$</span><input type="number" className="w-full p-2.5 pl-7 bg-slate-50 border rounded-lg font-bold text-xs text-blue-700" value={form.precio_venta} onChange={e => setForm({...form, precio_venta: Number(e.target.value)})} /></div>
                <label className="flex items-center gap-1.5 text-[9px] font-black uppercase cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-[#00338d]" checked={form.incluye_iva_venta} onChange={e => setForm({...form, incluye_iva_venta: e.target.checked})} />IVA</label>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100">
              {[{ l: "¿SE PUEDE VENDER?", k: "se_puede_vender" }, { l: "¿SE PUEDE COMPRAR?", k: "se_puede_comprar" }, { l: "¿MANTIENE STOCK?", k: "se_mantiene_stock" }].map(i => (
                <label key={i.k} className="flex justify-between items-center text-[9px] font-black uppercase text-slate-600">
                  {i.l}
                  <input type="checkbox" className="w-4 h-4 accent-[#00338d]" checked={(form as any)[i.k]} onChange={e => setForm({...form, [i.k]: e.target.checked})} />
                </label>
              ))}
            </div>
          </div>

          {status && (
            <div className={`p-3 rounded-lg flex items-center gap-3 border ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
              <AlertCircle size={18}/>
              <span className="font-black uppercase text-[10px]">{status.msg}</span>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading || !form.sku || form.sku === "---"} 
            className="w-full bg-[#00338d] hover:bg-[#00266b] text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-30"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            FINALIZAR Y CREAR PRODUCTO
          </button>
        </form>
      </div>
    </div>
  );
}