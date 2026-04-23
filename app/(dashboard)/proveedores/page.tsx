'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, Search, Loader2, MapPin, X, Phone, Star, 
  Trash2, Edit3, Save, Plus, CheckCircle2, AlertCircle,
  Landmark, CreditCard, Mail, Globe, Info, ChevronDown, ChevronUp,
  Briefcase, DollarSign, Map, Filter, ArrowUpDown, TrendingUp,
  Clock, Award, ThumbsUp, MessageCircle, Calendar, Users
} from 'lucide-react';

interface Proveedor {
  id: string;
  nombre_empresa: string;
  rut_empresa: string;
  categoria: string;
  tipo_servicio: string;
  nombre_contacto: string;
  email_contacto: string;
  telefono: string;
  sitio_web: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  condiciones_pago: string;
  banco_nombre: string;
  cuenta_tipo: string;
  cuenta_numero: string;
  observaciones: string;
  calificacion: number;
  activo: boolean;
  created_at: string;
}

type OrdenType = 'nombre' | 'calificacion' | 'reciente' | 'categoria';
type VistaType = 'grid' | 'lista';

export default function SeccionProveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [filteredProveedores, setFilteredProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [orden, setOrden] = useState<OrdenType>('nombre');
  const [vista, setVista] = useState<VistaType>('lista');
  const [seleccionado, setSeleccionado] = useState<Proveedor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [alert, setAlert] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [estadisticas, setEstadisticas] = useState({
    total: 0,
    categorias: 0,
    activos: 0,
    avgCalificacion: 0
  });

  const initialFormState = {
    nombre_empresa: '', rut_empresa: '', categoria: '', tipo_servicio: '',
    nombre_contacto: '', email_contacto: '', telefono: '', sitio_web: '',
    direccion: '', comuna: '', ciudad: '', condiciones_pago: 'Contado',
    banco_nombre: '', cuenta_tipo: 'Corriente', cuenta_numero: '', 
    observaciones: '', calificacion: 5, activo: true
  };

  const [nuevo, setNuevo] = useState(initialFormState);

  useEffect(() => {
    cargarProveedores();
  }, []);

  useEffect(() => {
    filtrarYOrdenar();
  }, [proveedores, busqueda, categoriaFiltro, orden]);

  const showAlert = (msg: string, type: 'success' | 'error') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 3000);
  };

  const cargarProveedores = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre_empresa', { ascending: true });
    
    if (!error && data) {
      setProveedores(data);
      calcularEstadisticas(data);
    }
    setLoading(false);
  };

  const calcularEstadisticas = (data: Proveedor[]) => {
    const categoriasUnicas = new Set(data.map(p => p.categoria).filter(Boolean));
    const activos = data.filter(p => p.activo !== false).length;
    const avgCalificacion = data.reduce((acc, p) => acc + (p.calificacion || 0), 0) / (data.length || 1);
    
    setEstadisticas({
      total: data.length,
      categorias: categoriasUnicas.size,
      activos: activos,
      avgCalificacion: Math.round(avgCalificacion * 10) / 10
    });
  };

  const filtrarYOrdenar = () => {
    let filtrados = [...proveedores];
    
    // Filtro por búsqueda
    if (busqueda) {
      filtrados = filtrados.filter(p => 
        p.nombre_empresa?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.rut_empresa?.includes(busqueda) ||
        p.categoria?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.tipo_servicio?.toLowerCase().includes(busqueda.toLowerCase())
      );
    }
    
    // Filtro por categoría
    if (categoriaFiltro !== "Todas") {
      filtrados = filtrados.filter(p => p.categoria === categoriaFiltro);
    }
    
    // Ordenamiento
    switch (orden) {
      case 'nombre':
        filtrados.sort((a, b) => a.nombre_empresa?.localeCompare(b.nombre_empresa || ''));
        break;
      case 'calificacion':
        filtrados.sort((a, b) => (b.calificacion || 0) - (a.calificacion || 0));
        break;
      case 'reciente':
        filtrados.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'categoria':
        filtrados.sort((a, b) => (a.categoria || '').localeCompare(b.categoria || ''));
        break;
    }
    
    setFilteredProveedores(filtrados);
  };

  const guardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('proveedores').insert([nuevo]);
    if (error) showAlert(error.message, 'error');
    else {
      showAlert("Proveedor registrado con éxito", "success");
      setNuevo(initialFormState);
      cargarProveedores();
      setShowForm(false);
    }
    setLoading(false);
  };

  const actualizarProveedor = async () => {
    if (!seleccionado) return;
    setLoading(true);
    const { error } = await supabase
      .from('proveedores')
      .update(seleccionado)
      .eq('id', seleccionado.id);
    
    if (error) showAlert(error.message, 'error');
    else {
      showAlert("Proveedor actualizado con éxito", "success");
      cargarProveedores();
      setSeleccionado(null);
    }
    setLoading(false);
  };

  const eliminarProveedor = async (id: string) => {
    if (!window.confirm("¿Eliminar este proveedor permanentemente?")) return;
    const { error } = await supabase.from('proveedores').delete().eq('id', id);
    if (error) showAlert("Error al eliminar", "error");
    else {
      showAlert("Eliminado correctamente", "success");
      setSeleccionado(null);
      cargarProveedores();
    }
  };

  const categoriasUnicas = ["Todas", ...new Set(proveedores.map(p => p.categoria).filter(Boolean))];

  const getCalificacionColor = (calif: number) => {
    if (calif >= 4.5) return 'text-emerald-600 bg-emerald-50';
    if (calif >= 3.5) return 'text-blue-600 bg-blue-50';
    if (calif >= 2.5) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getInitials = (nombre: string) => {
    return nombre?.charAt(0).toUpperCase() || 'P';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 lg:p-8 font-sans">
      
      {/* Alertas */}
      {alert && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-md border animate-in slide-in-from-top duration-300 ${
          alert.type === 'success' ? 'bg-emerald-600/90 border-emerald-400 text-white' : 'bg-rose-600/90 border-rose-400 text-white'
        }`}>
          {alert.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-bold uppercase tracking-wide">{alert.msg}</span>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto">
        
        {/* Header con métricas */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-3 rounded-2xl text-white shadow-xl">
                <Building2 size={28} />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-800 uppercase italic">
                  Central de <span className="text-blue-600">Proveedores</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                  Gestión Estratégica de Partners Comerciales
                </p>
              </div>
            </div>
            
            {/* Botón vista */}
            <div className="flex gap-2">
              <button
                onClick={() => setVista('lista')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${vista === 'lista' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
              >
                📋 Lista
              </button>
              <button
                onClick={() => setVista('grid')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${vista === 'grid' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
              >
                🔲 Grid
              </button>
            </div>
          </div>
          
          {/* Tarjetas de métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Total Proveedores</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{estadisticas.total}</p>
                </div>
                <div className="bg-blue-100 p-2 rounded-xl">
                  <Building2 size={18} className="text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Categorías</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{estadisticas.categorias}</p>
                </div>
                <div className="bg-emerald-100 p-2 rounded-xl">
                  <Briefcase size={18} className="text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Activos</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{estadisticas.activos}</p>
                </div>
                <div className="bg-green-100 p-2 rounded-xl">
                  <CheckCircle2 size={18} className="text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Rating Promedio</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{estadisticas.avgCalificacion}</p>
                </div>
                <div className="bg-amber-100 p-2 rounded-xl">
                  <Star size={18} className="text-amber-500" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Filtros y búsqueda */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, RUT o servicio..." 
                className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select 
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {categoriasUnicas.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select 
              value={orden}
              onChange={(e) => setOrden(e.target.value as OrdenType)}
              className="bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="nombre">Ordenar por Nombre</option>
              <option value="calificacion">Ordenar por Calificación</option>
              <option value="reciente">Más Recientes</option>
              <option value="categoria">Ordenar por Categoría</option>
            </select>

            <button 
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl text-sm font-bold uppercase tracking-wide shadow-lg transition-all flex items-center gap-2"
            >
              {showForm ? <X size={18} /> : <Plus size={18} />}
              {showForm ? 'Cerrar' : 'Nuevo Proveedor'}
            </button>
          </div>
        </div>

        {/* Formulario de creación */}
        {showForm && (
          <form onSubmit={guardarProveedor} className="mb-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-lg animate-in slide-in-from-top duration-300">
            <h2 className="text-lg font-black mb-6 text-slate-800 flex items-center gap-2">
              <Plus size={20} className="text-blue-600" />
              REGISTRAR NUEVO PROVEEDOR
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Nombre Empresa *</label>
                <input required value={nuevo.nombre_empresa} onChange={e => setNuevo({...nuevo, nombre_empresa: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">RUT</label>
                <input value={nuevo.rut_empresa} onChange={e => setNuevo({...nuevo, rut_empresa: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Categoría *</label>
                <input required value={nuevo.categoria} onChange={e => setNuevo({...nuevo, categoria: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Tipo Servicio</label>
                <input value={nuevo.tipo_servicio} onChange={e => setNuevo({...nuevo, tipo_servicio: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Contacto</label>
                <input value={nuevo.nombre_contacto} onChange={e => setNuevo({...nuevo, nombre_contacto: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Teléfono</label>
                <input value={nuevo.telefono} onChange={e => setNuevo({...nuevo, telefono: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Email</label>
                <input type="email" value={nuevo.email_contacto} onChange={e => setNuevo({...nuevo, email_contacto: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Calificación</label>
                <select value={nuevo.calificacion} onChange={e => setNuevo({...nuevo, calificacion: Number(e.target.value)})} className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200">
                  {[5,4,3,2,1].map(num => <option key={num} value={num}>{'★'.repeat(num)}{'☆'.repeat(5-num)}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">Cancelar</button>
              <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg">Guardar Proveedor</button>
            </div>
          </form>
        )}

        {/* Resultados */}
        {filteredProveedores.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 size={40} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-bold text-lg">No se encontraron proveedores</p>
            <p className="text-slate-400 text-sm mt-1">Intenta con otros filtros o agrega un nuevo proveedor</p>
          </div>
        )}

        {/* Vista de lista - Estilo similar a tareas */}
        {vista === 'lista' && !loading && filteredProveedores.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Proveedor</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Categoría</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contacto</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Calificación</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ubicación</th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProveedores.map((prov) => (
                    <tr key={prov.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center text-white font-bold">
                            {getInitials(prov.nombre_empresa)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{prov.nombre_empresa}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{prov.rut_empresa}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{prov.categoria}</span>
                        {prov.tipo_servicio && (
                          <p className="text-[9px] text-slate-400 mt-1">{prov.tipo_servicio}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-700">{prov.nombre_contacto || '—'}</p>
                        <p className="text-[10px] text-slate-400">{prov.telefono}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={14} className={i < (prov.calificacion || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-600">{prov.ciudad || '—'}</p>
                        <p className="text-[9px] text-slate-400">{prov.comuna}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setExpandedCard(expandedCard === prov.id ? null : prov.id)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                            {expandedCard === prov.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <button onClick={() => setSeleccionado(prov)} className="p-2 text-slate-400 hover:text-amber-600 transition-colors">
                            <Edit3 size={16} />
                          </button>
                          <button onClick={() => eliminarProveedor(prov.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vista de grid - Tarjetas compactas */}
        {vista === 'grid' && !loading && filteredProveedores.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProveedores.map((prov) => (
              <div key={prov.id} className="bg-white rounded-2xl border border-slate-200 hover:shadow-lg transition-all overflow-hidden group">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                        {getInitials(prov.nombre_empresa)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 line-clamp-1">{prov.nombre_empresa}</h3>
                        <p className="text-[10px] text-slate-400">{prov.rut_empresa}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setSeleccionado(prov)} className="p-1.5 text-slate-400 hover:text-amber-600">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => eliminarProveedor(prov.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Categoría</span>
                      <span className="text-xs font-bold text-slate-700">{prov.categoria}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Contacto</span>
                      <span className="text-xs text-slate-600">{prov.nombre_contacto || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</span>
                      <span className="text-xs text-slate-600">{prov.telefono || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Ubicación</span>
                      <span className="text-xs text-slate-600">{prov.ciudad || '—'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={12} className={i < (prov.calificacion || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                      ))}
                    </div>
                    <button 
                      onClick={() => setExpandedCard(expandedCard === prov.id ? null : prov.id)}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      {expandedCard === prov.id ? 'Ver menos' : 'Ver detalles'}
                      {expandedCard === prov.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                  
                  {/* Detalles expandidos en grid */}
                  {expandedCard === prov.id && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 animate-in slide-in-from-top duration-200">
                      {prov.direccion && (
                        <div className="flex items-start gap-2 text-xs text-slate-600">
                          <MapPin size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
                          <span>{prov.direccion}, {prov.comuna}</span>
                        </div>
                      )}
                      {prov.email_contacto && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Mail size={12} className="text-slate-400" />
                          <span className="truncate">{prov.email_contacto}</span>
                        </div>
                      )}
                      {prov.banco_nombre && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Landmark size={12} className="text-slate-400" />
                          <span>{prov.banco_nombre} - {prov.cuenta_tipo}</span>
                        </div>
                      )}
                      {prov.observaciones && (
                        <p className="text-[10px] text-slate-500 italic bg-slate-50 p-2 rounded-lg">{prov.observaciones}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-blue-600" size={48} />
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Editar Proveedor</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Modificar información</p>
              </div>
              <button onClick={() => setSeleccionado(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Nombre Empresa</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200" value={seleccionado.nombre_empresa} onChange={e => setSeleccionado({...seleccionado, nombre_empresa: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">RUT</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200" value={seleccionado.rut_empresa} onChange={e => setSeleccionado({...seleccionado, rut_empresa: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Categoría</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200" value={seleccionado.categoria} onChange={e => setSeleccionado({...seleccionado, categoria: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Tipo Servicio</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200" value={seleccionado.tipo_servicio} onChange={e => setSeleccionado({...seleccionado, tipo_servicio: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Nombre Contacto</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.nombre_contacto} onChange={e => setSeleccionado({...seleccionado, nombre_contacto: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Teléfono</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.telefono} onChange={e => setSeleccionado({...seleccionado, telefono: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Email</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.email_contacto} onChange={e => setSeleccionado({...seleccionado, email_contacto: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Sitio Web</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.sitio_web} onChange={e => setSeleccionado({...seleccionado, sitio_web: e.target.value})} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Dirección</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.direccion} onChange={e => setSeleccionado({...seleccionado, direccion: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Comuna</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.comuna} onChange={e => setSeleccionado({...seleccionado, comuna: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Ciudad</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.ciudad} onChange={e => setSeleccionado({...seleccionado, ciudad: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Condiciones Pago</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.condiciones_pago} onChange={e => setSeleccionado({...seleccionado, condiciones_pago: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Calificación</label>
                  <select className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.calificacion} onChange={e => setSeleccionado({...seleccionado, calificacion: Number(e.target.value)})}>
                    {[5,4,3,2,1].map(num => <option key={num} value={num}>{'★'.repeat(num)}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setSeleccionado(null)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold">Cancelar</button>
              <button onClick={actualizarProveedor} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}