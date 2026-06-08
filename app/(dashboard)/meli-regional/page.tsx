'use client';
import { useState } from 'react';
import { Search, ExternalLink, Loader2, AlertCircle, MapPin, ShoppingCart } from 'lucide-react';

const REGIONES = [
  'Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo',
  'Valparaíso','Metropolitana',"O'Higgins",'Maule','Ñuble','Biobío',
  'La Araucanía','Los Ríos','Los Lagos','Aysén','Magallanes',
];

interface MeliItem {
  id: string;
  titulo: string;
  precio: number;
  imagen: string | null;
  link: string;
  condicion: string;
  vendedor_estado: string;
  vendedor_ciudad: string;
}

function fmt(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CL');
}

export default function MeliRegionalPage() {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [cargando, setCargando] = useState(false);
  const [items, setItems] = useState<MeliItem[]>([]);
  const [error, setError] = useState('');
  const [buscado, setBuscado] = useState(false);

  async function buscar() {
    const q = query.trim();
    if (!q) return;
    setCargando(true);
    setError('');
    setItems([]);
    setBuscado(false);
    try {
      const params = new URLSearchParams({ q });
      if (region) params.set('region', region);
      const r = await fetch(`/api/meli-regional?${params}`);
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setItems(data.items || []);
      setBuscado(true);
    } catch (e: any) {
      setError(e.message || 'Error de conexión');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-5">
        <div className="max-w-[1400px] mx-auto flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#FFE600] flex items-center justify-center flex-shrink-0">
            <ShoppingCart size={20} className="text-slate-900" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-lg">MercadoLibre Regional</h1>
            <p className="text-sm text-slate-400">Busca productos y filtra por región del vendedor</p>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Barra de búsqueda */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex gap-3 flex-wrap mb-6">
          <div className="flex items-center border border-slate-200 rounded-lg px-3 gap-2 flex-1 min-w-60 focus-within:ring-2 focus-within:ring-yellow-300/50">
            <Search size={15} className="text-slate-400 flex-shrink-0" />
            <input
              className="py-2.5 text-sm outline-none w-full bg-transparent placeholder:text-slate-400"
              placeholder="Ej: conduit EMT 25mm, cable 2.5mm, anticorrosivo..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscar()}
              autoFocus
            />
          </div>
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="border border-slate-200 rounded-lg text-sm px-3 py-2 bg-white outline-none text-slate-700 min-w-52"
          >
            <option value="">🌎 Todas las regiones</option>
            {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            onClick={buscar}
            disabled={cargando || !query.trim()}
            className="bg-[#FFE600] hover:bg-[#f5dc00] text-slate-900 px-6 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            {cargando ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Buscar en ML
          </button>
        </div>

        {/* Banner región */}
        {region && buscado && (
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-2.5 flex items-center gap-2 mb-4">
            <MapPin size={14} className="text-yellow-600 flex-shrink-0" />
            <p className="text-[12px] text-yellow-700 font-medium">
              Mostrando vendedores en <strong>{region}</strong>.
              La mayoría de vendedores en ML están en la RM — si no hay resultados, prueba sin filtro de región.
            </p>
          </div>
        )}

        {/* Resultados */}
        {cargando && (
          <div className="flex items-center gap-3 text-slate-500 py-20 justify-center">
            <Loader2 size={24} className="animate-spin text-yellow-400" />
            <span>Consultando MercadoLibre Chile...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
            <AlertCircle size={18} />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {buscado && !cargando && items.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <ShoppingCart size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">Sin resultados{region ? ` de vendedores en ${region}` : ''}</p>
            <p className="text-sm mt-1 text-slate-300">Intenta con términos más generales o sin filtro de región</p>
          </div>
        )}
        {items.length > 0 && !cargando && (
          <div>
            <p className="text-xs text-slate-400 mb-4 font-medium">
              {items.length} producto{items.length !== 1 ? 's' : ''}
              {region ? ` · vendedores en ${region}` : ' · Chile'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {items.map(item => (
                <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer"
                  className="group bg-white border border-slate-100 rounded-xl overflow-hidden hover:border-yellow-300 hover:shadow-md transition-all flex flex-col">
                  {item.imagen ? (
                    <div className="aspect-square bg-slate-50 overflow-hidden">
                      <img src={item.imagen} alt={item.titulo} className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform" />
                    </div>
                  ) : (
                    <div className="aspect-square bg-slate-100 flex items-center justify-center">
                      <ShoppingCart size={28} className="text-slate-200" />
                    </div>
                  )}
                  <div className="p-2.5 flex flex-col flex-1">
                    <p className="text-[11px] text-slate-700 font-medium line-clamp-2 leading-snug flex-1">{item.titulo}</p>
                    <p className="text-sm font-bold text-slate-900 mt-2">{fmt(item.precio)}</p>
                    {(item.vendedor_ciudad || item.vendedor_estado) && (
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin size={9} className="text-slate-400 flex-shrink-0" />
                        <p className="text-[9px] text-slate-400 truncate">{item.vendedor_ciudad || item.vendedor_estado}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[9px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium">{item.condicion}</span>
                      <ExternalLink size={9} className="text-slate-300 group-hover:text-yellow-500 transition-colors" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
        {!buscado && !cargando && !error && (
          <div className="text-center py-20 text-slate-200">
            <ShoppingCart size={48} className="mx-auto mb-3" />
            <p className="text-slate-400">Ingresa un producto para buscar en MercadoLibre Chile</p>
            <p className="text-sm text-slate-300 mt-1">Opcional: filtra por región del vendedor</p>
          </div>
        )}
      </div>
    </div>
  );
}
