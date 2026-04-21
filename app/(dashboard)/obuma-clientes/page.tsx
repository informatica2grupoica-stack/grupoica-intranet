'use client';
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Loader2, Edit3, ChevronLeft, ChevronRight, ListIcon, Plus, Mail, Phone, MapPin, Users, Building, CheckCircle, XCircle, RefreshCcw } from "lucide-react";
import Link from "next/link";

interface Cliente {
  id: string;
  rut: string;
  razon_social: string;
  email: string;
  telefono: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  estado: boolean;
  es_extranjero: boolean;
  total_contactos: number;
  total_direcciones: number;
  created_at?: string;
}

export default function ObumaClientesListado() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const [stats, setStats] = useState<any>(null);
  const [filtroEstado, setFiltroEstado] = useState<'activo' | 'inactivo' | 'todos'>('todos');
  const [error, setError] = useState<string | null>(null);

  const fetchClientes = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const res = await fetch(`/api/obuma/clientes/list?estado=${filtroEstado}&limit=500${refreshParam}`);
      const result = await res.json();
      
      if (result.success) {
        setClientes(result.data || []);
        setStats(result.stats);
      } else {
        setError(result.error || "Error al cargar clientes");
        setClientes([]);
      }
    } catch (err) {
      console.error("Error cargando clientes:", err);
      setError("Error de conexión con el servidor");
      setClientes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtroEstado]);

  const refreshClientes = async () => {
    setRefreshing(true);
    await fetchClientes(true);
  };

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const filteredClientes = useMemo(() => {
    const term = search.toLowerCase();
    return clientes.filter(c => 
      c.razon_social?.toLowerCase().includes(term) ||
      c.rut?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term)
    );
  }, [clientes, search]);

  const totalPages = Math.ceil(filteredClientes.length / itemsPerPage);
  const currentItems = useMemo(() => {
    const lastIndex = currentPage * itemsPerPage;
    const firstIndex = lastIndex - itemsPerPage;
    return filteredClientes.slice(firstIndex, lastIndex);
  }, [filteredClientes, currentPage, itemsPerPage]);

  useEffect(() => { setCurrentPage(1); }, [search, itemsPerPage]);

  const formatRut = (rut: string) => {
    if (!rut) return 'Sin RUT';
    if (rut.length <= 8) return rut;
    return rut.replace(/^(\d{1,2})(\d{3})(\d{3})(\w{1})$/, '$1.$2.$3-$4');
  };

  if (loading && !refreshing) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-[#00338d] mx-auto mb-4" size={48} />
          <p className="text-slate-500 text-sm">Cargando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 bg-[#f8fafc] min-h-screen">
      
      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle size={18} className="text-rose-500" />
            <span className="text-sm text-rose-600">{error}</span>
          </div>
          <button onClick={refreshClientes} className="text-rose-600 hover:text-rose-700 text-sm font-bold">
            Reintentar
          </button>
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Building size={14} />
            <span className="text-[8px] md:text-[9px] font-black uppercase">Total Clientes</span>
          </div>
          <div className="text-xl md:text-2xl font-black text-slate-800">{stats?.total_clientes || 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <CheckCircle size={14} />
            <span className="text-[8px] md:text-[9px] font-black uppercase">Activos</span>
          </div>
          <div className="text-xl md:text-2xl font-black text-emerald-600">{stats?.clientes_activos || 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 text-rose-500 mb-1">
            <XCircle size={14} />
            <span className="text-[8px] md:text-[9px] font-black uppercase">Inactivos</span>
          </div>
          <div className="text-xl md:text-2xl font-black text-rose-500">{stats?.clientes_inactivos || 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 text-blue-500 mb-1">
            <Users size={14} />
            <span className="text-[8px] md:text-[9px] font-black uppercase">Contactos</span>
          </div>
          <div className="text-xl md:text-2xl font-black text-blue-500">{stats?.total_contactos || 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 text-purple-500 mb-1">
            <MapPin size={14} />
            <span className="text-[8px] md:text-[9px] font-black uppercase">Direcciones</span>
          </div>
          <div className="text-xl md:text-2xl font-black text-purple-500">{stats?.total_direcciones || 0}</div>
        </div>
      </div>

      {/* Barra de control */}
      <div className="bg-white rounded-[2rem] p-4 md:p-6 shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4">
        
        <div className="flex items-center gap-2 flex-1 min-w-[250px]">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar por razón social, RUT o email..."
              className="w-full pl-12 pr-4 py-3 md:py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-[#00338d] transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-3 md:py-4 text-xs font-bold outline-none"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as any)}
          >
            <option value="todos">📋 Todos</option>
            <option value="activo">✅ Activos</option>
            <option value="inactivo">❌ Inactivos</option>
          </select>

          <button
            onClick={refreshClientes}
            disabled={refreshing}
            className="bg-slate-100 hover:bg-slate-200 p-3 md:p-4 rounded-2xl transition-all disabled:opacity-50"
            title="Actualizar lista"
          >
            {refreshing ? <Loader2 size={20} className="animate-spin" /> : <RefreshCcw size={20} />}
          </button>

          <Link 
            href="/obuma-clientes/nuevo" 
            className="bg-[#00338d] hover:bg-[#00266b] text-white p-3 md:p-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center"
          >
            <Plus size={20} />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ListIcon size={16} className="text-slate-400" />
            <select 
              className="bg-slate-50 border-none text-[11px] font-black uppercase text-slate-500 rounded-xl px-3 py-2 outline-none cursor-pointer"
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
            >
              <option value={30}>30 Filas</option>
              <option value={50}>50 Filas</option>
              <option value={100}>100 Filas</option>
            </select>
          </div>
          <div className="h-8 w-[1px] bg-slate-100" />
          <div className="flex items-center gap-2">
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(prev => prev - 1)} 
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-[#00338d] hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-4 py-2 bg-slate-50 rounded-xl">
              <span className="text-[11px] font-black text-slate-600 uppercase">
                Pág. {currentPage} / {totalPages || 1}
              </span>
            </div>
            <button 
              disabled={currentPage === totalPages || totalPages === 0} 
              onClick={() => setCurrentPage(prev => prev + 1)} 
              className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-[#00338d] hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <tr>
              <th className="px-4 md:px-6 py-4 md:py-5">Cliente / RUT</th>
              <th className="px-3 md:px-4 py-4 md:py-5">Contacto</th>
              <th className="px-3 md:px-4 py-4 md:py-5 text-center">Contactos</th>
              <th className="px-3 md:px-4 py-4 md:py-5 text-center">Direcciones</th>
              <th className="px-3 md:px-4 py-4 md:py-5 text-center">Estado</th>
              <th className="px-4 md:px-8 py-4 md:py-5 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {currentItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-20 text-center text-slate-400">
                  No se encontraron clientes {filtroEstado !== 'todos' && `con estado "${filtroEstado}"`}
                </td>
              </tr>
            ) : (
              currentItems.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-4 md:px-6 py-3 md:py-4">
                    <div className="font-black text-slate-800 text-sm">{cliente.razon_social || 'Sin nombre'}</div>
                    <div className="text-[9px] md:text-[10px] font-mono text-slate-400 mt-0.5">{formatRut(cliente.rut)}</div>
                    {cliente.es_extranjero && (
                      <span className="inline-block mt-1 text-[7px] md:text-[8px] font-black bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                        Extranjero
                      </span>
                    )}
                  </td>
                  <td className="px-3 md:px-4 py-3 md:py-4">
                    {cliente.email && (
                      <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-slate-600">
                        <Mail size={10} /> <span className="truncate max-w-[120px] md:max-w-none">{cliente.email}</span>
                      </div>
                    )}
                    {cliente.telefono && (
                      <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-slate-500 mt-0.5">
                        <Phone size={10} /> {cliente.telefono}
                      </div>
                    )}
                  </td>
                  <td className="px-3 md:px-4 py-3 md:py-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-600 rounded-full text-[8px] md:text-[9px] font-black">
                      <Users size={10} /> {cliente.total_contactos}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-3 md:py-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-600 rounded-full text-[8px] md:text-[9px] font-black">
                      <MapPin size={10} /> {cliente.total_direcciones}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-3 md:py-4 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[8px] md:text-[9px] font-black ${
                      cliente.estado ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                    }`}>
                      {cliente.estado ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 md:px-8 py-3 md:py-4 text-center">
                    <Link href={`/obuma-clientes/${cliente.id}`} className="p-2 bg-slate-100 rounded-xl text-slate-400 hover:bg-[#00338d] hover:text-white transition-all inline-block">
                      <Edit3 size={16} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Resumen de resultados */}
      {filteredClientes.length > 0 && (
        <div className="text-center text-[10px] text-slate-400">
          Mostrando {currentItems.length} de {filteredClientes.length} clientes
        </div>
      )}
    </div>
  );
}