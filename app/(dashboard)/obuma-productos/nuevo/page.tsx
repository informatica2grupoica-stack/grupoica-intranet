"use client";
import { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle2, AlertCircle, Hash, RefreshCcw, Copy } from "lucide-react";

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

  // 1. CONSTRUCCIÓN DE NOMBRE
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

  // 2. CARGA DE CATEGORÍAS
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
        console.error("Error cargando datos");
      } finally {
        setLoadingData(false);
      }
    }
    loadObumaData();
  }, []);

  // 3. FILTRADO DE SUBCATEGORÍAS
  useEffect(() => {
    if (form.categoria_id) {
      const filtradas = allSubcategorias.filter(
        sub => String(sub.rel_producto_categoria_id) === String(form.categoria_id)
      );
      setFilteredSubcategorias(filtradas);
    }
  }, [form.categoria_id, allSubcategorias]);

  // 4. GENERADOR DE SKU (ANTI-DUPLICADOS)
  const sugerirSkuCorrelativo = async (subId: string) => {
    if (!subId || !form.categoria_id) return;
    setGeneratingSku(true);
    try {
      let prefijo = "";
      const catSeleccionada = categorias.find(c => String(c.producto_categoria_id) === String(form.categoria_id));
      const nombreCat = catSeleccionada?.producto_categoria_nombre?.toUpperCase() || "";

      if (nombreCat.includes("MERCADO PUBLICO")) prefijo = "60";
      else if (nombreCat.includes("MAYORISTA")) prefijo = "50";
      else prefijo = "99";

      const prefijoSub = `${prefijo}${subId}`;
      const res = await fetch(`/api/obuma/siguiente-sku?prefijoSub=${prefijoSub}`, { cache: 'no-store' });
      const data = await res.json();
      
      if (data.sku) {
        setForm(prev => ({ ...prev, sku: String(data.sku), subcategoria_id: subId }));
      }
    } catch (err) {
      console.error("Error SKU");
    } finally {
      setGeneratingSku(false);
    }
  };

  // 5. ENVÍO CON VALIDACIÓN DE ID (Solución al problema que viste en la intranet antigua)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku || !form.nombre) return;
    
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/obuma/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const result = await res.json();

      // --- MEJORA CRÍTICA ---
      // Si Obuma devuelve un producto_id vacío (como en tu ejemplo), significa que NO SE CREÓ.
      // También validamos si result[0] existe porque Obuma a veces devuelve un Array.
      const dataReal = Array.isArray(result) ? result[0] : result;
      const idCreado = dataReal?.producto_id || dataReal?.id;

      if (!res.ok || !idCreado || dataReal?.status === false) {
        // Si no hay ID, es un error de duplicado casi seguro
        setStatus({ 
          type: 'error', 
          msg: `ERROR: EL SKU ${form.sku} YA EXISTE EN OBUMA. GENERANDO EL SIGUIENTE...` 
        });
        
        // Llamamos al correlativo inmediatamente para que el usuario no pierda tiempo
        await sugerirSkuCorrelativo(form.subcategoria_id);
        return; 
      }

      // --- ÉXITO REAL (ID DETECTADO) ---
      setStatus({ 
        type: 'success', 
        msg: `PRODUCTO CREADO CON ÉXITO (ID: ${idCreado})` 
      });

      // Limpiar y preparar siguiente
      const subIdActual = form.subcategoria_id;
      setPiezas({ tipo: "", caracteristica: "", valorMedida: "", unidadMedida: "MT", marca: "" });
      setForm(prev => ({ ...prev, nombre: "", sku: "", precio_costo: 0, precio_venta: 0 }));
      
      await sugerirSkuCorrelativo(subIdActual);
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error: any) {
      setStatus({ type: 'error', msg: "ERROR DE CONEXIÓN CON EL SERVIDOR" });
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
      </div>

      <div className="mb-8 p-6 bg-[#00338d] rounded-[1.5rem] text-white shadow-lg border-b-4 border-[#00266b]">
        <label className="text-[9px] font-black uppercase opacity-60 tracking-[0.2em]">Previsualización Nombre Obuma</label>
        <div className="text-xl font-black uppercase italic tracking-tight mt-1">
          {form.nombre || "ESPERANDO DATOS..."}
        </div>
      </div>
      
      {status && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
          {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-bold uppercase">{status.msg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400">1. Tipo</label>
            <input required className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-[#00338d]" value={piezas.tipo} onChange={(e) => setPiezas({...piezas, tipo: e.target.value})} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400">2. Característica</label>
            <input required className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-[#00338d]" value={piezas.caracteristica} onChange={(e) => setPiezas({...piezas, caracteristica: e.target.value})} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400">3. Medida</label>
            <div className="flex gap-1">
              <input className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none" value={piezas.valorMedida} onChange={(e) => setPiezas({...piezas, valorMedida: e.target.value})} />
              <select className="p-3 bg-white border border-slate-200 rounded-xl font-black text-[10px]" value={piezas.unidadMedida} onChange={(e) => setPiezas({...piezas, unidadMedida: e.target.value})}>
                <option value="MT">MT</option><option value="UN">UN</option><option value='"'>"</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400">4. Marca</label>
            <input className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none" value={piezas.marca} onChange={(e) => setPiezas({...piezas, marca: e.target.value})} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400">Categoría</label>
            <select required className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" value={form.categoria_id} onChange={(e) => setForm({...form, categoria_id: e.target.value, subcategoria_id: ""})}>
              <option value="">Selecciona...</option>
              {categorias.map((cat) => <option key={cat.producto_categoria_id} value={cat.producto_categoria_id}>{cat.producto_categoria_nombre}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400">Subcategoría</label>
            <select required disabled={!form.categoria_id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" value={form.subcategoria_id} onChange={(e) => sugerirSkuCorrelativo(e.target.value)}>
              <option value="">Selecciona...</option>
              {filteredSubcategorias.map((sub) => <option key={sub.producto_subcategoria_id} value={sub.producto_subcategoria_id}>{sub.producto_subcategoria_nombre}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-[#00338d] flex justify-between">
              SKU: {generatingSku && <Loader2 size={12} className="animate-spin" />}
              <button type="button" onClick={() => sugerirSkuCorrelativo(form.subcategoria_id)}><RefreshCcw size={12}/></button>
            </label>
            <input readOnly className="p-4 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-black text-slate-600" value={form.sku} />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading || !form.sku} 
          className="w-full bg-[#00338d] hover:bg-[#00266b] text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Save />}
          CREAR PRODUCTO EN OBUMA
        </button>
      </form>
    </div>
  );
}