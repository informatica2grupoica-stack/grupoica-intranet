'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bookmark, Search, Trash2, ExternalLink, Loader2,
  FileSpreadsheet, ChevronDown, Users, User,
  BarChart3, CheckCircle2, AlertCircle, RefreshCw,
  Calendar, SortAsc, SortDesc, Filter, X
} from 'lucide-react';

interface BusquedaGuardada {
  id: string;
  nombre: string;
  nombre_archivo: string;
  id_proyecto: string;
  total_productos: number;
  con_resultados: number;
  avg_match: number;
  created_at: string;
  user_id: string;
  user_email: string;
  user_nombre: string;
}

type SortKey = 'created_at' | 'nombre' | 'avg_match' | 'total_productos';
type SortDir = 'asc' | 'desc';

// ─── Badge de match ───────────────────────────────────────────────────────────
const MatchBadge = ({ pct }: { pct: number }) => {
  const color = pct >= 80 ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : pct >= 60 ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-red-100 text-red-700 border-red-200';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {pct >= 80 ? '●' : pct >= 60 ? '◑' : '○'} {pct}%
    </span>
  );
};

// ─── Tarjeta de búsqueda ──────────────────────────────────────────────────────
const BusquedaCard = ({
  b,
  showUser,
  onAbrir,
  onEliminar,
}: {
  b: BusquedaGuardada;
  showUser: boolean;
  onAbrir: (id: string) => void;
  onEliminar: (id: string) => void;
}) => {
  const [confirmar, setConfirmar] = useState(false);
  const fecha = new Date(b.created_at).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const tasaExito = b.total_productos > 0
    ? Math.round((b.con_resultados / b.total_productos) * 100)
    : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group overflow-hidden">
      {/* Barra de color superior según match */}
      <div className={`h-1 w-full ${b.avg_match >= 80 ? 'bg-emerald-400' : b.avg_match >= 60 ? 'bg-amber-400' : 'bg-red-300'}`} />

      <div className="p-5">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-50 transition-colors">
              <FileSpreadsheet size={18} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-800 text-sm leading-tight truncate" title={b.nombre}>
                {b.nombre}
              </h3>
              {b.nombre_archivo && (
                <p className="text-[10px] text-slate-400 truncate mt-0.5" title={b.nombre_archivo}>
                  📄 {b.nombre_archivo}
                </p>
              )}
            </div>
          </div>
          <MatchBadge pct={b.avg_match} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-slate-50 rounded-xl p-2.5 text-center">
            <p className="font-bold text-slate-800 text-base leading-none">{b.total_productos}</p>
            <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">Productos</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5 text-center">
            <p className="font-bold text-emerald-700 text-base leading-none">{b.con_resultados}</p>
            <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">Con resultados</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5 text-center">
            <p className="font-bold text-slate-800 text-base leading-none">{tasaExito}%</p>
            <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">Cobertura</p>
          </div>
        </div>

        {/* Usuario (solo admin) */}
        {showUser && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 bg-slate-50 rounded-lg">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-[8px] text-white font-bold shrink-0">
              {(b.user_nombre || b.user_email || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-700 truncate">{b.user_nombre || '—'}</p>
              <p className="text-[9px] text-slate-400 truncate">{b.user_email}</p>
            </div>
          </div>
        )}

        {/* Fecha */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-4">
          <Calendar size={11} />
          {fecha}
        </div>

        {/* Acciones */}
        {confirmar ? (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmar(false)}
              className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => onEliminar(b.id)}
              className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
            >
              Confirmar
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => onAbrir(b.id)}
              className="flex-1 py-2 text-xs font-semibold text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={12} /> Abrir en buscador
            </button>
            <button
              onClick={() => setConfirmar(true)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-slate-200"
              title="Eliminar búsqueda"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Grupo por usuario (vista admin) ─────────────────────────────────────────
const GrupoUsuario = ({
  userId,
  nombre,
  email,
  busquedas,
  onAbrir,
  onEliminar,
}: {
  userId: string;
  nombre: string;
  email: string;
  busquedas: BusquedaGuardada[];
  onAbrir: (id: string) => void;
  onEliminar: (id: string) => void;
}) => {
  const [expandido, setExpandido] = useState(true);

  return (
    <div className="mb-8">
      {/* Header del grupo */}
      <button
        onClick={() => setExpandido(v => !v)}
        className="w-full flex items-center gap-3 mb-4 text-left group"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#6366F1] flex items-center justify-center text-white font-bold text-sm shadow-sm">
          {(nombre || email || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="font-bold text-slate-800 text-sm group-hover:text-[#4F46E5] transition-colors">{nombre || '—'}</p>
          <p className="text-[10px] text-slate-400">{email}</p>
        </div>
        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {busquedas.length} búsqueda{busquedas.length !== 1 ? 's' : ''}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${expandido ? 'rotate-180' : ''}`}
        />
      </button>

      {expandido && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pl-12">
          {busquedas.map(b => (
            <BusquedaCard
              key={b.id}
              b={b}
              showUser={false}
              onAbrir={onAbrir}
              onEliminar={onEliminar}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────
export default function BusquedasGuardadasPage() {
  const router = useRouter();
  const [busquedas, setBusquedas]           = useState<BusquedaGuardada[]>([]);
  const [cargando, setCargando]             = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [esAdmin, setEsAdmin]               = useState(false);
  const [busqueda, setBusqueda]             = useState('');
  const [filtroUsuario, setFiltroUsuario]   = useState<string>('todos');
  const [sortKey, setSortKey]               = useState<SortKey>('created_at');
  const [sortDir, setSortDir]               = useState<SortDir>('desc');
  const [abriendo, setAbriendo]             = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch('/api/busquedas-guardadas');
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) throw new Error('Error al cargar búsquedas');
      const data = await res.json();
      setBusquedas(data.busquedas ?? []);
      setEsAdmin(data.esAdmin ?? false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const eliminar = async (id: string) => {
    const res = await fetch(`/api/busquedas-guardadas/${id}`, { method: 'DELETE' });
    if (res.ok) setBusquedas(prev => prev.filter(b => b.id !== id));
  };

  const abrir = async (id: string) => {
    setAbriendo(id);
    // Guarda el ID en sessionStorage y redirige al buscador para que lo restaure
    sessionStorage.setItem('restaurar_busqueda', id);
    router.push('/buscador-productos');
  };

  // Usuarios únicos (para el filtro de admin)
  const usuariosUnicos = useMemo(() => {
    const mapa = new Map<string, { nombre: string; email: string }>();
    busquedas.forEach(b => {
      if (b.user_id && !mapa.has(b.user_id)) {
        mapa.set(b.user_id, { nombre: b.user_nombre, email: b.user_email });
      }
    });
    return [...mapa.entries()].map(([id, info]) => ({ id, ...info }));
  }, [busquedas]);

  // Filtrado + ordenamiento
  const busquedasFiltradas = useMemo(() => {
    let lista = [...busquedas];

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(b =>
        b.nombre.toLowerCase().includes(q) ||
        b.nombre_archivo.toLowerCase().includes(q) ||
        b.user_nombre?.toLowerCase().includes(q) ||
        b.user_email?.toLowerCase().includes(q)
      );
    }

    if (esAdmin && filtroUsuario !== 'todos') {
      lista = lista.filter(b => b.user_id === filtroUsuario);
    }

    lista.sort((a, b) => {
      let va: any = a[sortKey];
      let vb: any = b[sortKey];
      if (sortKey === 'created_at') { va = new Date(va).getTime(); vb = new Date(vb).getTime(); }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return lista;
  }, [busquedas, busqueda, filtroUsuario, sortKey, sortDir, esAdmin]);

  // Agrupar por usuario (vista admin)
  const gruposPorUsuario = useMemo(() => {
    const mapa = new Map<string, { nombre: string; email: string; busquedas: BusquedaGuardada[] }>();
    busquedasFiltradas.forEach(b => {
      const uid = b.user_id || 'sin-usuario';
      if (!mapa.has(uid)) {
        mapa.set(uid, { nombre: b.user_nombre || '—', email: b.user_email || '', busquedas: [] });
      }
      mapa.get(uid)!.busquedas.push(b);
    });
    return [...mapa.entries()].map(([id, info]) => ({ id, ...info }));
  }, [busquedasFiltradas]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortButton = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
        sortKey === k
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
      }`}
    >
      {label}
      {sortKey === k && (sortDir === 'desc' ? <SortDesc size={12} /> : <SortAsc size={12} />)}
    </button>
  );

  // ─── Empty state ──────────────────────────────────────────────────────────────
  if (!cargando && !error && busquedas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
          <Bookmark size={36} className="text-slate-300" />
        </div>
        <h2 className="text-xl font-bold text-slate-700 mb-2">
          {esAdmin ? 'Sin búsquedas guardadas en el sistema' : 'No tienes búsquedas guardadas'}
        </h2>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          {esAdmin
            ? 'Ningún usuario ha guardado una búsqueda todavía.'
            : 'Realiza una búsqueda en el buscador de productos y usa el botón "Guardar" para que aparezca aquí.'}
        </p>
        <button
          onClick={() => router.push('/buscador-productos')}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <BarChart3 size={15} /> Ir al buscador
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ─── Barra de herramientas ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">

          {/* Buscador de texto */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px] border border-slate-200 rounded-xl px-3 focus-within:ring-2 focus-within:ring-[#4F46E5]/20 bg-slate-50">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nombre, archivo..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="py-2 text-sm bg-transparent outline-none flex-1 text-slate-700 placeholder:text-slate-400"
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filtro por usuario (solo admin) */}
          {esAdmin && usuariosUnicos.length > 1 && (
            <div className="flex items-center gap-2">
              <Users size={14} className="text-slate-400" />
              <select
                value={filtroUsuario}
                onChange={e => setFiltroUsuario(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-[#4F46E5]/20 text-slate-700"
              >
                <option value="todos">Todos los usuarios ({busquedas.length})</option>
                {usuariosUnicos.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nombre || u.email} ({busquedas.filter(b => b.user_id === u.id).length})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Ordenamiento */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Ordenar:</span>
            <SortButton label="Fecha" k="created_at" />
            <SortButton label="Nombre" k="nombre" />
            <SortButton label="Match" k="avg_match" />
            <SortButton label="Productos" k="total_productos" />
          </div>

          {/* Refrescar */}
          <button
            onClick={cargar}
            disabled={cargando}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Resumen */}
        <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Bookmark size={11} />
            {busquedasFiltradas.length} de {busquedas.length} búsquedas
          </span>
          {esAdmin && (
            <span className="flex items-center gap-1">
              <Users size={11} />
              {usuariosUnicos.length} usuario{usuariosUnicos.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ─── Error ───────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
          <AlertCircle size={18} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={cargar} className="ml-auto text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1">
            <RefreshCw size={12} /> Reintentar
          </button>
        </div>
      )}

      {/* ─── Loading ─────────────────────────────────────────────────────────── */}
      {cargando && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-[#4F46E5] animate-spin" />
            <p className="text-sm text-slate-500">Cargando búsquedas...</p>
          </div>
        </div>
      )}

      {/* ─── Sin resultados del filtro ───────────────────────────────────────── */}
      {!cargando && !error && busquedas.length > 0 && busquedasFiltradas.length === 0 && (
        <div className="text-center py-16">
          <Filter size={32} className="mx-auto mb-3 text-slate-200" />
          <p className="font-semibold text-slate-500">Sin resultados</p>
          <p className="text-xs text-slate-400 mt-1">Intenta con otro término de búsqueda o filtro</p>
          <button
            onClick={() => { setBusqueda(''); setFiltroUsuario('todos'); }}
            className="mt-3 text-xs text-[#4F46E5] hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* ─── VISTA ADMIN: agrupada por usuario ───────────────────────────────── */}
      {!cargando && !error && esAdmin && filtroUsuario === 'todos' && gruposPorUsuario.length > 0 && (
        <div>
          {/* Banner admin */}
          <div className="flex items-center gap-3 mb-6 p-4 bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl text-white">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <Users size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-sm">Vista de administrador</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Ves las búsquedas de todos los usuarios · {busquedas.length} en total · {usuariosUnicos.length} usuarios
              </p>
            </div>
          </div>

          {gruposPorUsuario.map(grupo => (
            <GrupoUsuario
              key={grupo.id}
              userId={grupo.id}
              nombre={grupo.nombre}
              email={grupo.email}
              busquedas={grupo.busquedas}
              onAbrir={abrir}
              onEliminar={eliminar}
            />
          ))}
        </div>
      )}

      {/* ─── VISTA USUARIO NORMAL o Admin con filtro activo: grid plano ────── */}
      {!cargando && !error && busquedasFiltradas.length > 0 && (!esAdmin || filtroUsuario !== 'todos') && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {busquedasFiltradas.map(b => (
            <BusquedaCard
              key={b.id}
              b={b}
              showUser={esAdmin}
              onAbrir={abrir}
              onEliminar={eliminar}
            />
          ))}
        </div>
      )}

      {/* Indicador de apertura */}
      {abriendo && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl">
          <Loader2 size={16} className="animate-spin text-emerald-400" />
          <span className="text-sm font-medium">Abriendo en el buscador...</span>
        </div>
      )}
    </div>
  );
}
