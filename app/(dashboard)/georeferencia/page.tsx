'use client';
import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Search, MapPin, Loader2, AlertCircle, Phone, Globe,
  Star, ChevronRight, X, Sparkles, Building2,
} from 'lucide-react';
import type { GeoLocal } from './MapaGeo';

const MapaGeo = dynamic(() => import('./MapaGeo'), { ssr: false });

const REGIONES = [
  'Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo',
  'Valparaíso','Metropolitana',"O'Higgins",'Maule','Ñuble','Biobío',
  'La Araucanía','Los Ríos','Los Lagos','Aysén','Magallanes',
];

const CATEGORIAS_RAPIDAS = [
  { label: 'Ferreterías',               q: 'ferretería' },
  { label: 'Materiales de Construcción',q: 'materiales de construcción' },
  { label: 'Eléctrica',                 q: 'tienda eléctrica electricidad' },
  { label: 'Pinturas',                  q: 'pinturas y revestimientos' },
  { label: 'Herramientas',              q: 'herramientas industriales' },
  { label: 'Maderas',                   q: 'maderas y tableros' },
  { label: 'Plomería',                  q: 'plomería sanitaria' },
  { label: 'Mayorista',                 q: 'mayorista construcción' },
  { label: 'Grandes Tiendas',           q: 'Sodimac Easy Construmart' },
];

type Alert = { id: number; type: 'error' | 'success' | 'info'; msg: string };

function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const counter = useRef(0);

  const push = (type: Alert['type'], msg: string) => {
    const id = ++counter.current;
    setAlerts(a => [...a, { id, type, msg }]);
    setTimeout(() => setAlerts(a => a.filter(x => x.id !== id)), 4500);
  };

  const dismiss = (id: number) => setAlerts(a => a.filter(x => x.id !== id));
  return { alerts, push, dismiss };
}

export default function GeoreferenciaPage() {
  const [keyword,  setKeyword]  = useState('');
  const [region,   setRegion]   = useState('');
  const [comuna,   setComuna]   = useState('');
  const [cargando, setCargando] = useState(false);
  const [locales,  setLocales]  = useState<GeoLocal[]>([]);
  const [buscado,  setBuscado]  = useState(false);
  const [activo,   setActivo]   = useState<string | null>(null);
  const [filtroTexto, setFiltroTexto] = useState('');
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { alerts, push, dismiss } = useAlerts();

  const localesFiltrados = filtroTexto.trim()
    ? locales.filter(l =>
        l.nombre.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        l.direccion.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        l.categoria.toLowerCase().includes(filtroTexto.toLowerCase()))
    : locales;

  async function buscar(q?: string) {
    const kw = q ?? keyword;
    if (!kw.trim()) { push('error', 'Ingresa una búsqueda o selecciona una categoría'); return; }

    setCargando(true);
    setBuscado(false);
    setLocales([]);
    setActivo(null);
    setFiltroTexto('');

    const params = new URLSearchParams({ q: kw });
    if (region) params.set('region', region);
    if (comuna) params.set('comuna', comuna);

    try {
      const r = await fetch(`/api/georeferencia?${params}`);
      const data = await r.json();
      if (data.error) { push('error', data.error); return; }
      setLocales(data.places || []);
      setBuscado(true);
      if (!data.places?.length) push('info', 'Sin resultados. Prueba con otra búsqueda o zona.');
      else push('success', `${data.places.length} resultado${data.places.length !== 1 ? 's' : ''} encontrado${data.places.length !== 1 ? 's' : ''}`);
    } catch {
      push('error', 'Error de conexión con el servidor');
    } finally {
      setCargando(false);
    }
  }

  function aplicarCategoria(q: string) {
    setKeyword(q);
    buscar(q);
  }

  useEffect(() => {
    if (!activo || !cardRefs.current[activo]) return;
    cardRefs.current[activo]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activo]);

  const ALERT_COLORS = {
    error:   'bg-red-50 border-red-200 text-red-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    info:    'bg-blue-50 border-blue-200 text-blue-700',
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">

      {/* ── Toast alerts ── */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {alerts.map(a => (
          <div key={a.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium animate-in slide-in-from-right-4 duration-300 ${ALERT_COLORS[a.type]}`}
          >
            {a.type === 'error'   && <AlertCircle size={15} className="flex-shrink-0" />}
            {a.type === 'success' && <Sparkles    size={15} className="flex-shrink-0" />}
            {a.type === 'info'    && <MapPin      size={15} className="flex-shrink-0" />}
            <span>{a.msg}</span>
            <button onClick={() => dismiss(a.id)} className="ml-1 opacity-60 hover:opacity-100">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Barra de búsqueda ── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-100 px-5 py-4">
        <div className="max-w-[1800px] mx-auto">

          {/* Fila principal */}
          <div className="flex items-center gap-3 flex-wrap">

            {/* Ícono */}
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
              <MapPin size={16} className="text-white" />
            </div>

            {/* Keyword — input principal */}
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full border border-slate-200 rounded-xl text-sm pl-9 pr-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-white placeholder:text-slate-400 transition"
                placeholder="¿Qué buscas? ej: ferretería, materiales de construcción, eléctrica…"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscar()}
              />
              {keyword && (
                <button onClick={() => setKeyword('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Región */}
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="border border-slate-200 rounded-xl text-sm px-3 py-2.5 bg-white outline-none focus:border-slate-400 text-slate-700 min-w-[160px] transition"
            >
              <option value="">Todas las regiones</option>
              {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            {/* Comuna */}
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="border border-slate-200 rounded-xl text-sm pl-8 pr-3 py-2.5 w-44 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-white placeholder:text-slate-400 transition"
                placeholder="Comuna (opcional)"
                value={comuna}
                onChange={e => setComuna(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscar()}
              />
            </div>

            {/* Botón buscar */}
            <button
              onClick={() => buscar()}
              disabled={cargando}
              className="bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors flex items-center gap-2 flex-shrink-0"
            >
              {cargando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar
            </button>

            {/* Filtro de resultados */}
            {locales.length > 0 && (
              <div className="relative ml-auto">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="border border-slate-200 rounded-xl text-sm pl-8 pr-3 py-2.5 w-48 outline-none focus:border-slate-400 bg-white placeholder:text-slate-400"
                  placeholder="Filtrar resultados…"
                  value={filtroTexto}
                  onChange={e => setFiltroTexto(e.target.value)}
                />
                {filtroTexto && (
                  <button onClick={() => setFiltroTexto('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Chips de categorías rápidas */}
          <div className="flex flex-wrap gap-2 mt-3">
            {CATEGORIAS_RAPIDAS.map(c => (
              <button
                key={c.q}
                onClick={() => aplicarCategoria(c.q)}
                disabled={cargando}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all disabled:opacity-40 ${
                  keyword === c.q
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-900'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contenido principal ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Panel lateral ── */}
        <div className="w-[360px] flex-shrink-0 overflow-y-auto border-r border-slate-100 bg-white">

          {/* Header del panel */}
          {buscado && !cargando && (
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 py-2.5 z-10">
              <p className="text-xs text-slate-500 font-medium">
                {localesFiltrados.length} resultado{localesFiltrados.length !== 1 ? 's' : ''}
                {filtroTexto && <span className="text-slate-400"> para "{filtroTexto}"</span>}
              </p>
            </div>
          )}

          {/* Estado cargando */}
          {cargando && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
              <Loader2 size={26} className="animate-spin" />
              <p className="text-sm">Buscando locales…</p>
            </div>
          )}

          {/* Estado vacío inicial */}
          {!buscado && !cargando && (
            <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <MapPin size={24} className="text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Busca cualquier comercio</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Escribe lo que necesitas encontrar — ferreterías, materiales, eléctrica, pinturas, mayoristas y más — filtrando por región y comuna.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                {CATEGORIAS_RAPIDAS.slice(0,4).map(c => (
                  <button key={c.q} onClick={() => aplicarCategoria(c.q)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700 transition">
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sin resultados */}
          {buscado && !cargando && localesFiltrados.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <p className="text-sm font-semibold text-slate-500">Sin resultados</p>
              <p className="text-xs text-slate-400 mt-1">Prueba otra búsqueda, región o comuna</p>
            </div>
          )}

          {/* Lista */}
          {localesFiltrados.map(local => {
            const isActivo = activo === local.id;
            return (
              <div
                key={local.id}
                ref={el => { cardRefs.current[local.id] = el; }}
                onClick={() => setActivo(local.id)}
                className={`px-4 py-4 cursor-pointer border-b border-slate-50 hover:bg-slate-50 transition-colors group ${
                  isActivo ? 'bg-slate-50 border-l-[3px] border-l-slate-900' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${isActivo ? 'bg-slate-900' : 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0">

                    <p className="font-semibold text-slate-800 text-[13px] leading-snug">{local.nombre}</p>

                    {local.categoria && (
                      <span className="inline-block mt-0.5 text-[10px] font-semibold text-blue-600 uppercase tracking-wide">
                        {local.categoria}
                      </span>
                    )}

                    {/* Rating */}
                    {local.rating && (
                      <div className="flex items-center gap-1 mt-1">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={10}
                            className={s <= Math.round(local.rating!) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'} />
                        ))}
                        <span className="text-[11px] font-bold text-slate-700 ml-0.5">{local.rating.toFixed(1)}</span>
                        {local.ratingCount && (
                          <span className="text-[10px] text-slate-400">({local.ratingCount})</span>
                        )}
                      </div>
                    )}

                    {local.direccion && (
                      <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{local.direccion}</p>
                    )}

                    {local.telefono && (
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <Phone size={9} /> {local.telefono}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={13} className="text-slate-300 group-hover:text-slate-500 flex-shrink-0 mt-1 transition-colors" />
                </div>

                {(local.web || local.maps_url) && (
                  <div className="flex gap-3 mt-2.5 pl-5">
                    {local.web && (
                      <a href={local.web} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-medium">
                        <Globe size={9} /> Sitio web
                      </a>
                    )}
                    <a href={local.maps_url} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1 font-medium">
                      <MapPin size={9} /> Google Maps
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Mapa ── */}
        <div className="flex-1 relative">
          {localesFiltrados.length > 0 && (
            <MapaGeo locales={localesFiltrados} activo={activo} onSelect={setActivo} />
          )}
          {!buscado && !cargando && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <MapPin size={28} className="text-slate-300" />
                </div>
                <p className="text-slate-400 text-sm font-medium">El mapa aparecerá aquí</p>
                <p className="text-slate-300 text-xs mt-1">Realiza una búsqueda para comenzar</p>
              </div>
            </div>
          )}
          {cargando && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
              <Loader2 size={32} className="animate-spin text-slate-300" />
            </div>
          )}
          {buscado && !cargando && localesFiltrados.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
              <p className="text-slate-400 text-sm">Sin resultados para mostrar en el mapa</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
