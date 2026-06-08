'use client';
import { useState } from 'react';
import { Search, ChevronDown, ChevronUp, ExternalLink, FileText, Loader2, AlertCircle } from 'lucide-react';

const REGIONES = [
  'Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo',
  'Valparaíso','Metropolitana',"O'Higgins",'Maule','Ñuble','Biobío',
  'La Araucanía','Los Ríos','Los Lagos','Aysén','Magallanes',
];

interface LicitacionItem {
  titulo: string;
  snippet: string;
  link: string;
  fecha: string | null;
  codigo: string | null;
}

export default function SeccionMercadoPublico() {
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [cargando, setCargando] = useState(false);
  const [items, setItems] = useState<LicitacionItem[]>([]);
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
      const r = await fetch(`/api/mercado-publico?${params}`);
      const data = await r.json();
      if (data.error) { setError(data.error); return; }
      setItems(data.items || []);
      setBuscado(true);
    } catch {
      setError('Error de conexión');
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="max-w-[1600px] mx-auto px-5 pb-4">
      {/* Header colapsable */}
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#D62B2B] flex items-center justify-center flex-shrink-0">
            <FileText size={18} className="text-white" />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-slate-800 text-sm">Mercado Público — Licitaciones</h2>
            <p className="text-[11px] text-slate-400">Busca licitaciones activas en mercadopublico.cl por producto y región</p>
          </div>
        </div>
        {abierto ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {abierto && (
        <div className="mt-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Barra de búsqueda */}
          <div className="px-5 py-4 border-b border-slate-100 flex gap-3 flex-wrap">
            <div className="flex items-center border border-slate-200 rounded-lg px-3 gap-2 flex-1 min-w-48 focus-within:ring-2 focus-within:ring-[#D62B2B]/20 bg-white">
              <Search size={14} className="text-slate-400 flex-shrink-0" />
              <input
                className="py-2.5 text-sm outline-none w-full bg-transparent placeholder:text-slate-400"
                placeholder="Ej: cable eléctrico, pintura, madera..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscar()}
              />
            </div>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="border border-slate-200 rounded-lg text-sm px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-[#D62B2B]/20 text-slate-700 min-w-44"
            >
              <option value="">🌎 Todas las regiones</option>
              {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              onClick={buscar}
              disabled={cargando || !query.trim()}
              className="bg-[#D62B2B] hover:bg-[#b91c1c] text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {cargando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar
            </button>
          </div>

          {/* Resultados */}
          <div className="px-5 py-4">
            {cargando && (
              <div className="flex items-center gap-3 text-slate-500 py-8 justify-center">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Buscando en Mercado Público...</span>
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
                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Sin resultados para &ldquo;{query}&rdquo;{region ? ` en ${region}` : ''}</p>
                <p className="text-xs mt-1">Intenta con términos más generales</p>
              </div>
            )}
            {items.length > 0 && !cargando && (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-400 mb-3 font-medium">{items.length} resultado{items.length !== 1 ? 's' : ''} encontrado{items.length !== 1 ? 's' : ''}</p>
                {items.map((item, i) => (
                  <div key={i} className="border border-slate-100 rounded-xl p-4 hover:border-[#D62B2B]/30 hover:bg-red-50/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 leading-snug">{item.titulo}</p>
                        {item.codigo && (
                          <span className="inline-block mt-1 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">{item.codigo}</span>
                        )}
                        {item.snippet && (
                          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">{item.snippet}</p>
                        )}
                        {item.fecha && (
                          <p className="text-[10px] text-slate-400 mt-1">{item.fecha}</p>
                        )}
                      </div>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 flex items-center gap-1.5 text-[#D62B2B] text-xs font-semibold hover:text-[#b91c1c] bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Ver <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!buscado && !cargando && !error && (
              <div className="text-center py-10 text-slate-300">
                <FileText size={36} className="mx-auto mb-2" />
                <p className="text-sm">Ingresa un producto para buscar licitaciones activas</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
