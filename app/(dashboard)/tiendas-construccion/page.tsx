'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Loader2, AlertCircle, Phone, Star, Clock, Globe, ExternalLink, List, Map } from 'lucide-react';

const MapaTiendas = dynamic(() => import('./MapaTiendas'), { ssr: false });

const REGIONES = [
  'Arica y Parinacota','Tarapacá','Antofagasta','Atacama','Coquimbo',
  'Valparaíso','Metropolitana',"O'Higgins",'Maule','Ñuble','Biobío',
  'La Araucanía','Los Ríos','Los Lagos','Aysén','Magallanes',
];

const CATEGORIAS = [
  { key: 'todo',         label: 'Todas',           color: 'bg-slate-700 text-white' },
  { key: 'grandes',      label: 'Grandes Tiendas', color: 'bg-blue-600 text-white' },
  { key: 'ferreteria',   label: 'Ferreterías',     color: 'bg-orange-500 text-white' },
  { key: 'materiales',   label: 'Materiales',      color: 'bg-amber-600 text-white' },
  { key: 'electrica',    label: 'Eléctrica',       color: 'bg-yellow-500 text-slate-900' },
  { key: 'herramientas', label: 'Herramientas',    color: 'bg-red-600 text-white' },
];

const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  grande:       { label: 'Gran Tienda',   cls: 'bg-blue-100 text-blue-700' },
  ferreteria:   { label: 'Ferretería',    cls: 'bg-orange-100 text-orange-700' },
  materiales:   { label: 'Materiales',    cls: 'bg-amber-100 text-amber-700' },
  electrica:    { label: 'Eléctrica',     cls: 'bg-yellow-100 text-yellow-700' },
  herramientas: { label: 'Herramientas',  cls: 'bg-red-100 text-red-700' },
  otro:         { label: 'Comercio',      cls: 'bg-slate-100 text-slate-600' },
};

interface TiendaItem {
  nombre: string;
  categoria: string;
  direccion: string;
  telefono: string | null;
  sitio_web: string | null;
  rating: number | null;
  reviews: number | null;
  horario: string | null;
  maps_url: string | null;
  tipo: string;
  lat: number | null;
  lng: number | null;
}

function Estrellas({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={11}
          className={i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200 fill-slate-200'} />
      ))}
      <span className="text-[11px] text-slate-500 ml-1 font-medium">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function TiendasConstruccionPage() {
  const [region, setRegion] = useState('');
  const [categoria, setCategoria] = useState('todo');
  const [cargando, setCargando] = useState(false);
  const [tiendas, setTiendas] = useState<TiendaItem[]>([]);
  const [error, setError] = useState('');
  const [buscado, setBuscado] = useState(false);
  const [vista, setVista] = useState<'mapa' | 'lista'>('mapa');
  const [tiendaActiva, setTiendaActiva] = useState<number | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Tiendas con coordenadas para el mapa
  const tiendasConCoords = tiendas.filter(t => t.lat !== null && t.lng !== null);

  async function buscar() {
    if (!region) return;
    setCargando(true);
    setError('');
    setTiendas([]);
    setBuscado(false);
    setTiendaActiva(null);
    try {
      const params = new URLSearchParams({ region, categoria });
      const r = await fetch(`/api/tiendas-construccion?${params}`);
      const data = await r.json();
      if (data.error) { setError(data.error); return; }
      setTiendas(data.tiendas || []);
      setBuscado(true);
    } catch {
      setError('Error de conexión');
    } finally {
      setCargando(false);
    }
  }

  // Scroll a la card cuando se selecciona en el mapa
  useEffect(() => {
    if (tiendaActiva === null) return;
    cardRefs.current[tiendaActiva]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [tiendaActiva]);

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
              <MapPin size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-base">Tiendas de Construcción</h1>
              <p className="text-xs text-slate-400">Ferreterías, materiales, eléctrica y herramientas por región</p>
            </div>
          </div>
          {/* Toggle vista */}
          {buscado && tiendas.length > 0 && (
            <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
              <button
                onClick={() => setVista('mapa')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${vista === 'mapa' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Map size={13} /> Mapa
              </button>
              <button
                onClick={() => setVista('lista')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${vista === 'lista' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <List size={13} /> Lista
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Controles */}
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto space-y-2">
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map(c => (
              <button
                key={c.key}
                onClick={() => setCategoria(c.key)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  categoria === c.key ? c.color + ' shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap">
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="border border-slate-200 rounded-lg text-sm px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-200 text-slate-700 flex-1 min-w-48"
            >
              <option value="">📍 Selecciona una región</option>
              {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              onClick={buscar}
              disabled={cargando || !region}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
            >
              {cargando ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              Buscar tiendas
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-hidden">
        {/* Estados vacíos */}
        {cargando && (
          <div className="flex items-center gap-3 text-slate-500 py-20 justify-center">
            <Loader2 size={22} className="animate-spin text-emerald-500" />
            <span>Buscando tiendas en {region}...</span>
          </div>
        )}
        {error && (
          <div className="m-6 flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {buscado && !cargando && tiendas.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <MapPin size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">Sin tiendas en {region}</p>
            <p className="text-sm mt-1 text-slate-300">Prueba con otra categoría</p>
          </div>
        )}
        {!buscado && !cargando && !error && (
          <div className="text-center py-20 text-slate-200">
            <MapPin size={48} className="mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Selecciona una región y categoría para ver tiendas en el mapa</p>
          </div>
        )}

        {/* Vista MAPA + lista lateral */}
        {tiendas.length > 0 && !cargando && vista === 'mapa' && (
          <div className="flex h-full gap-0">
            {/* Lista lateral */}
            <div className="w-80 flex-shrink-0 overflow-y-auto border-r border-slate-100 bg-white">
              <p className="text-[11px] text-slate-400 font-medium px-4 py-2 border-b border-slate-100">
                {tiendas.length} tienda{tiendas.length !== 1 ? 's' : ''} · {tiendasConCoords.length} en mapa
              </p>
              {tiendasConCoords.map((t, i) => {
                const badge = TIPO_BADGE[t.tipo] || TIPO_BADGE.otro;
                return (
                  <div
                    key={i}
                    ref={el => { cardRefs.current[i] = el; }}
                    onClick={() => setTiendaActiva(i)}
                    className={`px-4 py-3 cursor-pointer border-b border-slate-50 hover:bg-slate-50 transition-colors ${tiendaActiva === i ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''}`}
                  >
                    <p className="font-semibold text-slate-800 text-sm leading-tight">{t.nombre}</p>
                    <span className={`inline-block mt-1 text-[9px] px-2 py-0.5 rounded-full font-bold ${badge.cls}`}>{badge.label}</span>
                    {t.rating !== null && (
                      <div className="mt-1"><Estrellas rating={t.rating} /></div>
                    )}
                    {t.direccion && (
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{t.direccion}</p>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Mapa */}
            <div className="flex-1 p-4">
              <MapaTiendas
                tiendas={tiendasConCoords}
                tiendaActiva={tiendaActiva}
                onSelectTienda={setTiendaActiva}
              />
            </div>
          </div>
        )}

        {/* Vista LISTA */}
        {tiendas.length > 0 && !cargando && vista === 'lista' && (
          <div className="overflow-y-auto h-full px-6 py-4">
            <p className="text-xs text-slate-400 mb-4 font-medium">{tiendas.length} tienda{tiendas.length !== 1 ? 's' : ''} en {region}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tiendas.map((t, i) => {
                const badge = TIPO_BADGE[t.tipo] || TIPO_BADGE.otro;
                return (
                  <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-emerald-200 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 leading-snug">{t.nombre}</p>
                        <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.cls}`}>{badge.label}</span>
                      </div>
                      {t.maps_url && (
                        <a href={t.maps_url} target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 p-2 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors" title="Ver en Maps">
                          <MapPin size={15} className="text-emerald-600" />
                        </a>
                      )}
                    </div>
                    {t.rating !== null && (
                      <div className="mb-3">
                        <Estrellas rating={t.rating} />
                        {t.reviews && <p className="text-[10px] text-slate-400 mt-0.5">{t.reviews.toLocaleString()} reseñas</p>}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {t.direccion && (
                        <p className="text-xs text-slate-500 flex items-start gap-2">
                          <MapPin size={12} className="mt-0.5 flex-shrink-0 text-slate-400" />
                          <span className="line-clamp-2">{t.direccion}</span>
                        </p>
                      )}
                      {t.telefono && (
                        <p className="text-xs text-slate-500 flex items-center gap-2">
                          <Phone size={12} className="flex-shrink-0 text-slate-400" />
                          <a href={`tel:${t.telefono}`} className="hover:text-emerald-600 transition-colors">{t.telefono}</a>
                        </p>
                      )}
                      {t.horario && (
                        <p className="text-xs text-slate-500 flex items-center gap-2">
                          <Clock size={12} className="flex-shrink-0 text-slate-400" />
                          <span className="truncate">{t.horario}</span>
                        </p>
                      )}
                    </div>
                    {(t.sitio_web || t.maps_url) && (
                      <div className="flex gap-2 mt-4">
                        {t.sitio_web && (
                          <a href={t.sitio_web} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors font-medium">
                            <Globe size={11} /> Sitio web
                          </a>
                        )}
                        {t.maps_url && (
                          <a href={t.maps_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors font-medium">
                            <ExternalLink size={11} /> Google Maps
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
