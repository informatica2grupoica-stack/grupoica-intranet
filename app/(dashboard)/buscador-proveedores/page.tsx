// app/(dashboard)/buscador-proveedores/page.tsx
'use client';
import { useState } from 'react';
import { 
  Search, Building2, Package, ExternalLink, Loader2, 
  Phone, Mail, MapPin, Star, DollarSign, Calendar,
  X, ChevronDown, ChevronUp, Globe
} from 'lucide-react';

interface ProductoItem {
  nombre: string;
  sku?: string;
  ultimo_precio?: number;
  precio_unitario?: number;
  cantidad?: number;
  fecha_compra?: string;
  folio_oc?: string;
  fuente_dato: string;
}

interface ProveedorResultado {
  fuente: string;
  id: string;
  nombre: string;
  rut: string;
  telefono?: string;
  email?: string;
  sitio_web?: string;
  direccion?: string;
  comuna?: string;
  ciudad?: string;
  calificacion?: number;
  productos: ProductoItem[];
}

export default function BuscadorProveedores() {
  const [producto, setProducto] = useState('');
  const [resultados, setResultados] = useState<ProveedorResultado[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscado, setBuscado] = useState('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [incluirObuma, setIncluirObuma] = useState(true);

  const buscar = async () => {
    if (!producto.trim()) return;
    
    setLoading(true);
    setBuscado(producto);
    
    try {
      const res = await fetch(
        `/api/buscar-proveedores-por-producto?producto=${encodeURIComponent(producto)}&incluirObuma=${incluirObuma}`
      );
      const data = await res.json();
      
      if (data.success) {
        setResultados(data.proveedores || []);
      } else {
        console.error('Error:', data.error);
        setResultados([]);
      }
    } catch (error) {
      console.error('Error en búsqueda:', error);
      setResultados([]);
    }
    
    setLoading(false);
  };

  const formatearPrecio = (precio: number) => {
    if (!precio || precio === 0) return 'Consultar';
    return `$${precio.toLocaleString('es-CL')}`;
  };

  const getInitials = (nombre: string) => {
    return nombre?.charAt(0).toUpperCase() || 'P';
  };

  const getColorPorFuente = (fuente: string) => {
    if (fuente.includes('Supabase')) return 'bg-emerald-100 text-emerald-700';
    if (fuente.includes('Obuma')) return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
            <Search size={32} className="text-blue-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-800">
            Buscar <span className="text-blue-600">Proveedores</span> por Producto
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Encuentra proveedores que venden o han vendido el producto que buscas
          </p>
        </div>

        {/* Buscador */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={producto}
                onChange={(e) => setProducto(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscar()}
                placeholder='Ej: Martillo, Clavos 2", Anticorrosivo, Pernos, Cemento...'
                className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={buscar}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-w-[120px]"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              Buscar
            </button>
          </div>
          
          {/* Opciones de búsqueda */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={incluirObuma}
                onChange={(e) => setIncluirObuma(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Incluir histórico de compras de Obuma
            </label>
          </div>
        </div>

        {/* Resultados */}
        {buscado && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-500">
                Resultados para <strong className="text-blue-600">"{buscado}"</strong>: 
                {' '}{resultados.length} proveedores encontrados
              </p>
              {resultados.length > 0 && (
                <div className="flex gap-2 text-[10px] font-bold">
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                    📋 Supabase: {resultados.filter(r => r.fuente.includes('Supabase')).length}
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                    🏢 Obuma: {resultados.filter(r => r.fuente.includes('Obuma')).length}
                  </span>
                </div>
              )}
            </div>

            {resultados.length === 0 && !loading && (
              <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                <Package size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">No se encontraron proveedores que vendan "{buscado}"</p>
                <p className="text-xs text-slate-400 mt-2">
                  Sugerencias: Verifica la ortografía o intenta con términos más generales
                </p>
              </div>
            )}

            {resultados.map((prov, idx) => (
              <div key={`${prov.rut}-${idx}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Cabecera del proveedor */}
                <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
                        {getInitials(prov.nombre)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg text-slate-800">{prov.nombre}</h3>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${getColorPorFuente(prov.fuente)}`}>
                            {prov.fuente}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-1">{prov.rut}</p>
                        {prov.ciudad && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                            <MapPin size={10} /> {prov.ciudad}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Calificación */}
                    {prov.calificacion && (
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={14} className={i < (prov.calificacion || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Contacto rápido */}
                  <div className="flex flex-wrap gap-4 mt-4 pt-2">
                    {prov.telefono && (
                      <a href={`tel:${prov.telefono}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors">
                        <Phone size={12} /> {prov.telefono}
                      </a>
                    )}
                    {prov.email && (
                      <a href={`mailto:${prov.email}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors">
                        <Mail size={12} /> {prov.email}
                      </a>
                    )}
                    {prov.sitio_web && (
                      <a href={prov.sitio_web} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors">
                        <Globe size={12} /> Sitio Web
                      </a>
                    )}
                  </div>
                </div>
                
                {/* Productos */}
                <div className="p-6">
                  <button
                    onClick={() => setExpandedCard(expandedCard === prov.rut ? null : prov.rut)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-blue-600" />
                      <h4 className="font-bold text-sm text-slate-700">
                        Productos relacionados ({prov.productos.length})
                      </h4>
                    </div>
                    {expandedCard === prov.rut ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  
                  {expandedCard === prov.rut && (
                    <div className="mt-4 space-y-3 animate-in slide-in-from-top duration-200">
                      {prov.productos.map((prod, pidx) => (
                        <div key={pidx} className="bg-slate-50 rounded-xl p-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="flex-1">
                              <p className="font-medium text-slate-800">{prod.nombre}</p>
                              {prod.sku && (
                                <p className="text-[9px] text-slate-400 font-mono mt-0.5">SKU: {prod.sku}</p>
                              )}
                              <p className="text-[9px] text-slate-400 mt-1">
                                Fuente: {prod.fuente_dato}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                              {prod.cantidad && (
                                <div className="text-right">
                                  <p className="text-[8px] text-slate-400 uppercase">Cantidad</p>
                                  <p className="text-sm font-bold">{prod.cantidad}</p>
                                </div>
                              )}
                              {(prod.ultimo_precio || prod.precio_unitario) && (
                                <div className="text-right">
                                  <p className="text-[8px] text-slate-400 uppercase">Precio</p>
                                  <p className="text-sm font-black text-emerald-600">
                                    {formatearPrecio(prod.ultimo_precio || prod.precio_unitario || 0)}
                                  </p>
                                </div>
                              )}
                              {prod.fecha_compra && (
                                <div className="text-right">
                                  <p className="text-[8px] text-slate-400 uppercase flex items-center gap-1">
                                    <Calendar size={8} /> Fecha
                                  </p>
                                  <p className="text-xs font-medium">{prod.fecha_compra}</p>
                                </div>
                              )}
                              {prod.folio_oc && (
                                <div className="text-right">
                                  <p className="text-[8px] text-slate-400 uppercase">OC</p>
                                  <p className="text-xs font-mono">#{prod.folio_oc}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}