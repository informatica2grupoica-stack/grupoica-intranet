'use client';
import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Search, MapPin, Loader2, AlertCircle, Phone, Globe, Clock, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import type { GeoLocal } from './MapaGeo';

const MapaGeo = dynamic(() => import('./MapaGeo'), { ssr: false });

const REGIONES = [
  'Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo',
  'Valparaíso','Metropolitana',"O'Higgins",'Maule','Ñuble','Biobío',
  'La Araucanía','Los Ríos','Los Lagos','Aysén','Magallanes',
];

const CATEGORIAS = [
  { key: 'todo',         label: 'Todo',         dot: '#64748b' },
  { key: 'grandes',      label: 'Grandes',      dot: '#2563eb' },
  { key: 'ferreterias',  label: 'Ferreterías',  dot: '#ea580c' },
  { key: 'materiales',   label: 'Materiales',   dot: '#0891b2' },
  { key: 'electrica',    label: 'Eléctrica',    dot: '#ca8a04' },
  { key: 'herramientas', label: 'Herramientas', dot: '#dc2626' },
  { key: 'pinturas',     label: 'Pinturas',     dot: '#9333ea' },
  { key: 'maderas',      label: 'Maderas',      dot: '#65a30d' },
  { key: 'mayoristas',   label: 'Mayoristas',   dot: '#0f766e' },
  { key: 'plomeria',     label: 'Plomería',     dot: '#0284c7' },
];

const TIPO_LABEL: Record<string, string> = {
  grande:      'Gran Tienda',
  ferreteria:  'Ferretería',
  materiales:  'Materiales',
  electrica:   'Eléctrica',
  herramientas:'Herramientas',
  pinturas:    'Pinturas',
  maderas:     'Maderas',
  mayorista:   'Mayorista',
  plomeria:    'Plomería',
  otro:        'Comercio',
};

const TIPO_DOT: Record<string, string> = {
  grande:      '#2563eb',
  ferreteria:  '#ea580c',
  materiales:  '#0891b2',
  electrica:   '#ca8a04',
  herramientas:'#dc2626',
  pinturas:    '#9333ea',
  maderas:     '#65a30d',
  mayorista:   '#0f766e',
  plomeria:    '#0284c7',
  otro:        '#64748b',
};

export default function GeoreferenciaPage() {
  const [region, setRegion]       = useState('');
  const [categoria, setCategoria] = useState('todo');
  const [busqueda, setBusqueda]   = useState('');
  const [cargando, setCargando]   = useState(false);
  const [locales, setLocales]     = useState<GeoLocal[]>([]);
  const [error, setError]         = useState('');
  const [buscado, setBuscado]     = useState(false);
  const [activo, setActivo]       = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Locales filtrados por texto de búsqueda local
  const localesFiltrados = busqueda.trim()
    ? locales.filter(l => l.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        l.direccion.toLowerCase().includes(busqueda.toLowerCase()))
    : locales;

  async function buscar() {
    if (!region) return;
    setCargando(true);
    setError('');
    setLocales([]);
    setBuscado(false);
    setActivo(null);
    try {
      const params = new URLSearchParams({ region, categoria });
      const r = await fetch(`/api/georeferencia?${params}`);
      const data = await r.json();
      if (data.error) { setError(data.error); return; }
      setLocales(data.locales || []);
      setBuscado(true);
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setCargando(false);
    }
  }

  // Scroll al card activo
  useEffect(() => {
    if (!activo || !cardRefs.current[activo]) return;
    cardRefs.current[activo]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activo]);

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 border-b border-slate-100 bg-white px-5 py-3">
        <div className="flex items-center gap-3 max-w-[1800px] mx-auto">

          {/* Icono + título */}
          <div className="flex items-center gap-2 mr-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <MapPin size={15} className="text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm hidden sm:block">Georeferencia</span>
          </div>

          {/* Región */}
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="border border-slate-200 rounded-lg text-sm px-3 py-2 bg-white outline-none focus:border-slate-400 text-slate-700 min-w-44"
          >
            <option value="">Región...</option>
            {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          {/* Categoría */}
          <select
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            className="border border-slate-200 rounded-lg text-sm px-3 py-2 bg-white outline-none focus:border-slate-400 text-slate-700 min-w-40"
          >
            {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>

          {/* Botón buscar */}
          <button
            onClick={buscar}
            disabled={cargando || !region}
            className="bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            {cargando
              ? <Loader2 size={14} className="animate-spin" />
              : <Search size={14} />}
            Buscar
          </button>

          {/* Buscador de texto (aparece cuando hay resultados) */}
          {locales.length > 0 && (
            <div className="relative ml-auto">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="border border-slate-200 rounded-lg text-sm pl-8 pr-3 py-2 w-52 outline-none focus:border-slate-400 bg-white"
                placeholder="Filtrar resultados..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {/* Contador */}
          {locales.length > 0 && (
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
              {localesFiltrados.length} local{localesFiltrados.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Chips de categoría ── */}
      {locales.length > 0 && (
        <div className="flex-shrink-0 border-b border-slate-100 bg-white px-5 py-2 overflow-x-auto">
          <div className="flex gap-2 max-w-[1800px] mx-auto">
            {CATEGORIAS.map(c => {
              const count = c.key === 'todo'
                ? localesFiltrados.length
                : localesFiltrados.filter(l => {
                    const map: Record<string, string> = {
                      grandes: 'grande', ferreterias: 'ferreteria', electrica: 'electrica',
                      herramientas: 'herramientas', pinturas: 'pinturas', maderas: 'maderas',
                      mayoristas: 'mayorista', plomeria: 'plomeria',
                    };
                    return l.tipo === (map[c.key] || c.key);
                  }).length;
              if (count === 0 && c.key !== 'todo') return null;
              return (
                <button
                  key={c.key}
                  onClick={() => setBusqueda('')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-slate-200 hover:border-slate-400 transition-colors whitespace-nowrap bg-white"
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.dot }} />
                  {c.label}
                  <span className="text-slate-400">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Contenido ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Panel lateral ── */}
        <div className="w-[340px] flex-shrink-0 overflow-y-auto border-r border-slate-100 bg-white">

          {/* Estado vacío / cargando / error */}
          {cargando && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
              <Loader2 size={28} className="animate-spin" />
              <p className="text-sm">Consultando OpenStreetMap...</p>
              <p className="text-xs text-slate-300">Puede tomar hasta 20 segundos</p>
            </div>
          )}
          {error && (
            <div className="m-4 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-4">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
          {!buscado && !cargando && !error && (
            <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <MapPin size={22} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700 mb-1">Busca locales comerciales</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ferreterías, grandes tiendas, mayoristas, materiales, eléctrica, pinturas y más — en cualquier región de Chile
              </p>
            </div>
          )}
          {buscado && !cargando && localesFiltrados.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <p className="text-sm font-medium text-slate-500">Sin resultados</p>
              <p className="text-xs text-slate-400 mt-1">Prueba otra categoría o región</p>
            </div>
          )}

          {/* Lista de locales */}
          {localesFiltrados.map(local => {
            const dot = TIPO_DOT[local.tipo] || TIPO_DOT.otro;
            const label = TIPO_LABEL[local.tipo] || 'Comercio';
            const isActivo = activo === local.id;
            return (
              <div
                key={local.id}
                ref={el => { cardRefs.current[local.id] = el; }}
                onClick={() => setActivo(local.id)}
                className={`px-4 py-3.5 cursor-pointer border-b border-slate-50 hover:bg-slate-50 transition-colors group ${
                  isActivo ? 'bg-slate-50 border-l-[3px] border-l-slate-900' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: dot }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-[13px] leading-snug truncate">{local.nombre}</p>
                    <p className="text-[10px] font-medium mt-0.5" style={{ color: dot }}>{label}</p>
                    {local.direccion && (
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{local.direccion}</p>
                    )}
                    {local.telefono && (
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Phone size={9} />
                        {local.telefono}
                      </p>
                    )}
                    {local.horario && (
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                        <Clock size={9} />
                        {local.horario}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={13} className="text-slate-300 group-hover:text-slate-500 flex-shrink-0 mt-1 transition-colors" />
                </div>
                {(local.web || local.maps_url) && (
                  <div className="flex gap-2 mt-2 pl-5">
                    {local.web && (
                      <a href={local.web} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">
                        <Globe size={9} /> Web
                      </a>
                    )}
                    <a href={local.maps_url} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1">
                      <MapPin size={9} /> Maps
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
            <MapaGeo
              locales={localesFiltrados}
              activo={activo}
              onSelect={setActivo}
            />
          )}
          {!buscado && !cargando && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <MapPin size={28} className="text-slate-300" />
                </div>
                <p className="text-slate-400 text-sm">El mapa aparecerá aquí</p>
              </div>
            </div>
          )}
          {cargando && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
              <Loader2 size={32} className="animate-spin text-slate-300" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
