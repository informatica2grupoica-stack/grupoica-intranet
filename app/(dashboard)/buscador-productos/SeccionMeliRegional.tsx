'use client';
import { useState } from 'react';
import { Search, ChevronDown, ChevronUp, ExternalLink, Loader2, AlertCircle, MapPin, ShoppingCart } from 'lucide-react';

const REGIONES = [
  'Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo',
  'Valparaíso','Metropolitana',"O'Higgins",'Maule','Ñuble','Biobío',
  'La Araucanía','Los Ríos','Los Lagos','Aysén','Magallanes',
];

const ALIASES_REGION: Record<string, string[]> = {
  'Metropolitana':      ['Región Metropolitana', 'Metropolitana', 'Metropolitan'],
  'Valparaíso':         ['Valparaíso', 'Valparaiso'],
  'Biobío':             ['Biobío', 'Bio-Bio', 'Bío-Bío', 'Biobio'],
  'La Araucanía':       ['Araucanía', 'La Araucanía', 'Araucania'],
  'Los Lagos':          ['Los Lagos'],
  'Maule':              ['Maule'],
  "O'Higgins":          ["O'Higgins", 'Libertador General'],
  'Coquimbo':           ['Coquimbo'],
  'Antofagasta':        ['Antofagasta'],
  'Tarapacá':           ['Tarapacá', 'Tarapaca'],
  'Atacama':            ['Atacama'],
  'Ñuble':              ['Ñuble', 'Nuble'],
  'Los Ríos':           ['Los Ríos', 'Los Rios'],
  'Aysén':              ['Aysén', 'Aysen'],
  'Magallanes':         ['Magallanes'],
  'Arica y Parinacota': ['Arica y Parinacota', 'Arica'],
};

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

export default function SeccionMeliRegional() {
  const [abierto, setAbierto] = useState(false);
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
      const url = `https://api.mercadolibre.com/sites/MLC/search?q=${encodeURIComponent(q)}&limit=50&sort=price_asc`;
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(`ML error ${r.status}: ${err.message || err.error || 'Sin respuesta'}`);
      }
      const data = await r.json();
      let results: any[] = data.results || [];

      if (region) {
        const aliases = ALIASES_REGION[region] || [region];
        results = results.filter((item: any) => {
          const estado = item.seller_address?.state?.name || '';
          return aliases.some(a => estado.toLowerCase().includes(a.toLowerCase()));
        });
      }

      const parsed: MeliItem[] = results.slice(0, 48).map((item: any) => ({
        id:              item.id || '',
        titulo:          item.title || '',
        precio:          item.price || 0,
        imagen:          item.thumbnail?.replace('I.jpg', 'O.jpg') || null,
        link:            item.permalink || '',
        condicion:       item.condition === 'new' ? 'Nuevo' : 'Usado',
        vendedor_estado: item.seller_address?.state?.name || '',
        vendedor_ciudad: item.seller_address?.city?.name || '',
      }));

      setItems(parsed);
      setBuscado(true);
    } catch (e: any) {
      setError(e.message || 'Error de conexión');
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="max-w-[1600px] mx-auto px-5 pb-4">
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FFE600] flex items-center justify-center flex-shrink-0">
            <ShoppingCart size={18} className="text-[#333]" />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-slate-800 text-sm">MercadoLibre — Búsqueda Regional</h2>
            <p className="text-[11px] text-slate-400">Filtra productos por región del vendedor · precios reales</p>
          </div>
        </div>
        {abierto ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {abierto && (
        <div className="mt-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex gap-3 flex-wrap">
            <div className="flex items-center border border-slate-200 rounded-lg px-3 gap-2 flex-1 min-w-48 focus-within:ring-2 focus-within:ring-yellow-300/40 bg-white">
              <Search size={14} className="text-slate-400 flex-shrink-0" />
              <input
                className="py-2.5 text-sm outline-none w-full bg-transparent placeholder:text-slate-400"
                placeholder="Ej: conduit EMT 25mm, cable 2.5mm..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscar()}
              />
            </div>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="border border-slate-200 rounded-lg text-sm px-3 py-2 bg-white outline-none text-slate-700 min-w-44"
            >
              <option value="">🌎 Todas las regiones</option>
              {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              onClick={buscar}
              disabled={cargando || !query.trim()}
              className="bg-[#FFE600] hover:bg-[#f5dc00] text-slate-900 px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {cargando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar
            </button>
          </div>

          {region && buscado && (
            <div className="px-5 py-2 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2">
              <MapPin size={13} className="text-yellow-600" />
              <span className="text-[11px] text-yellow-700 font-medium">
                Filtrando vendedores en <strong>{region}</strong> · Los vendedores de ML pueden despachar a todo Chile
              </span>
            </div>
          )}

          <div className="px-5 py-4">
            {cargando && (
              <div className="flex items-center gap-3 text-slate-500 py-8 justify-center">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Consultando MercadoLibre...</span>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-4">
                <AlertCircle size={16} />
                <span className="text-sm">{error}</span>
              </div>
            )}
            {buscado && !cargando && items.length === 0 && (
              <div className="text-center py-10 text-slate-400">
                <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Sin resultados{region ? ` de vendedores en ${region}` : ''}</p>
                {region && <p className="text-xs mt-1">Los vendedores de ML se concentran en la RM. Prueba sin filtro de región.</p>}
              </div>
            )}
            {items.length > 0 && !cargando && (
              <div>
                <p className="text-[11px] text-slate-400 mb-3 font-medium">{items.length} producto{items.length !== 1 ? 's' : ''}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {items.map(item => (
                    <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer"
                      className="group border border-slate-100 rounded-xl overflow-hidden hover:border-yellow-300 hover:shadow-md transition-all flex flex-col">
                      {item.imagen ? (
                        <div className="aspect-square bg-slate-50 overflow-hidden">
                          <img src={item.imagen} alt={item.titulo} className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform" />
                        </div>
                      ) : (
                        <div className="aspect-square bg-slate-100 flex items-center justify-center">
                          <ShoppingCart size={24} className="text-slate-300" />
                        </div>
                      )}
                      <div className="p-2 flex flex-col flex-1">
                        <p className="text-[11px] text-slate-700 font-medium line-clamp-2 leading-snug flex-1">{item.titulo}</p>
                        <p className="text-sm font-bold text-slate-900 mt-1.5">{fmt(item.precio)}</p>
                        {(item.vendedor_estado || item.vendedor_ciudad) && (
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
              <div className="text-center py-10 text-slate-300">
                <ShoppingCart size={36} className="mx-auto mb-2" />
                <p className="text-sm">Busca productos con precio real de vendedores en Chile</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
