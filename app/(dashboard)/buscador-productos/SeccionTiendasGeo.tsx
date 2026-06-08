'use client';
import { useState } from 'react';
import { MapPin, ChevronDown, ChevronUp, ExternalLink, Loader2, AlertCircle, Phone, Star, Clock, Globe } from 'lucide-react';

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
}

function Estrellas({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={10}
          className={i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200 fill-slate-200'} />
      ))}
      <span className="text-[10px] text-slate-500 ml-1 font-medium">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function SeccionTiendasGeo() {
  const [abierto, setAbierto] = useState(false);
  const [region, setRegion] = useState('');
  const [categoria, setCategoria] = useState('todo');
  const [cargando, setCargando] = useState(false);
  const [tiendas, setTiendas] = useState<TiendaItem[]>([]);
  const [error, setError] = useState('');
  const [buscado, setBuscado] = useState(false);

  async function buscar() {
    if (!region) return;
    setCargando(true);
    setError('');
    setTiendas([]);
    setBuscado(false);
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

  return (
    <section className="max-w-[1600px] mx-auto px-5 pb-8">
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <MapPin size={18} className="text-white" />
          </div>
          <div className="text-left">
            <h2 className="font-bold text-slate-800 text-sm">Tiendas de Construcción — Geolocalización</h2>
            <p className="text-[11px] text-slate-400">Ferreterías, materiales, eléctrica y herramientas grandes y medianas por región</p>
          </div>
        </div>
        {abierto ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {abierto && (
        <div className="mt-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Controles */}
          <div className="px-5 py-4 border-b border-slate-100 space-y-3">
            {/* Categoría */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.map(c => (
                <button
                  key={c.key}
                  onClick={() => setCategoria(c.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    categoria === c.key ? c.color : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {/* Región + botón */}
            <div className="flex gap-3 flex-wrap">
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="border border-slate-200 rounded-lg text-sm px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-emerald-200 text-slate-700 flex-1 min-w-44"
              >
                <option value="">📍 Selecciona una región</option>
                {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                onClick={buscar}
                disabled={cargando || !region}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {cargando ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                Buscar tiendas
              </button>
            </div>
          </div>

          {/* Resultados */}
          <div className="px-5 py-4">
            {cargando && (
              <div className="flex items-center gap-3 text-slate-500 py-10 justify-center">
                <Loader2 size={20} className="animate-spin text-emerald-600" />
                <span className="text-sm">Buscando tiendas en {region}...</span>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-4">
                <AlertCircle size={16} />
                <span className="text-sm">{error}</span>
              </div>
            )}
            {buscado && !cargando && tiendas.length === 0 && (
              <div className="text-center py-10 text-slate-400">
                <MapPin size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Sin tiendas encontradas en {region}</p>
                <p className="text-xs mt-1">Prueba con otra categoría o región</p>
              </div>
            )}
            {tiendas.length > 0 && !cargando && (
              <div>
                <p className="text-[11px] text-slate-400 mb-3 font-medium">
                  {tiendas.length} tienda{tiendas.length !== 1 ? 's' : ''} en {region}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {tiendas.map((t, i) => {
                    const badge = TIPO_BADGE[t.tipo] || TIPO_BADGE.otro;
                    return (
                      <div key={i} className="border border-slate-100 rounded-xl p-4 hover:border-emerald-200 hover:shadow-sm transition-all">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 leading-snug">{t.nombre}</p>
                            <span className={`inline-block mt-1 text-[9px] px-2 py-0.5 rounded-full font-bold ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                          {t.maps_url && (
                            <a href={t.maps_url} target="_blank" rel="noopener noreferrer"
                              className="flex-shrink-0 p-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                              title="Ver en Maps">
                              <MapPin size={13} className="text-emerald-600" />
                            </a>
                          )}
                        </div>

                        {t.rating !== null && <Estrellas rating={t.rating} />}

                        <div className="mt-2 space-y-1">
                          {t.direccion && (
                            <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
                              <MapPin size={10} className="mt-0.5 flex-shrink-0 text-slate-400" />
                              <span className="line-clamp-2">{t.direccion}</span>
                            </p>
                          )}
                          {t.telefono && (
                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                              <Phone size={10} className="flex-shrink-0 text-slate-400" />
                              <a href={`tel:${t.telefono}`} className="hover:text-emerald-600">{t.telefono}</a>
                            </p>
                          )}
                          {t.horario && (
                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                              <Clock size={10} className="flex-shrink-0 text-slate-400" />
                              <span className="truncate">{t.horario}</span>
                            </p>
                          )}
                        </div>

                        {(t.sitio_web || t.maps_url) && (
                          <div className="flex gap-2 mt-3">
                            {t.sitio_web && (
                              <a href={t.sitio_web} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors">
                                <Globe size={10} /> Web
                              </a>
                            )}
                            {t.maps_url && (
                              <a href={t.maps_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors">
                                <ExternalLink size={10} /> Maps
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
            {!buscado && !cargando && !error && (
              <div className="text-center py-10 text-slate-300">
                <MapPin size={36} className="mx-auto mb-2" />
                <p className="text-sm">Selecciona una región para ver tiendas cercanas</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
