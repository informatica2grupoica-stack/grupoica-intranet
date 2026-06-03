// app/(dashboard)/obuma-proveedores/page.tsx
'use client';
import { useState, useMemo } from 'react';
import {
  Building2, Search, Loader2, MapPin, X, Phone,
  Edit3, Plus, CheckCircle2, AlertCircle,
  Mail, Globe, ChevronDown, ChevronUp, Briefcase,
  Smartphone, RefreshCw, Users, Download, Filter
} from 'lucide-react';
import { useObumaProveedores, ObumaProveedor } from '@/hooks/useObumaProveedores';
import Paginacion from '@/components/Paginacion';
import * as XLSX from 'xlsx';

type VistaType = 'grid' | 'lista';

export default function ObumaProveedoresPage() {
  const {
    proveedores: proveedoresPaginados,
    todosProveedores,
    loading,
    error,
    estadisticas,
    busqueda,
    setBusqueda,
    currentPage,
    totalPages,
    cambiarPagina,
    cargarProveedores,
    crearProveedor,
    actualizarProveedor
  } = useObumaProveedores();
  
  const [vista, setVista] = useState<VistaType>('lista');
  const [showForm, setShowForm] = useState(false);
  const [filtroRegion, setFiltroRegion] = useState('TODAS');
  const [filtroConEmail, setFiltroConEmail] = useState('todos');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<ObumaProveedor | null>(null);
  const [alert, setAlert] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  // Estado completo del formulario sin es_supermercado
  const initialFormState: Partial<ObumaProveedor> = {
    proveedor_rut: '',
    proveedor_razon_social: '',
    proveedor_contacto: '',
    proveedor_giro_comercial: '',
    proveedor_direccion: '',
    proveedor_comuna: '',
    proveedor_region: '',
    proveedor_pais: 'Chile',
    proveedor_telefono: '',
    proveedor_celular: '',
    proveedor_email: '',
    proveedor_website: '',
    proveedor_observacion: '',
  };

  const [nuevo, setNuevo] = useState(initialFormState);

  const showAlert = (msg: string, type: 'success' | 'error') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 3000);
  };

  // Función de sincronización
  const sincronizarProductos = async () => {
    setSincronizando(true);
    try {
      const res = await fetch('/api/sincronizar-productos-obuma', {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.success) {
        showAlert(
          `✅ Sincronización completada!\n${data.estadisticas.productos_sincronizados} productos sincronizados\n${data.estadisticas.proveedores_nuevos} proveedores nuevos`,
          "success"
        );
        cargarProveedores();
      } else {
        showAlert(`❌ Error: ${data.error || data.message || 'Error desconocido'}`, "error");
      }
    } catch (error) {
      console.error(error);
      showAlert("Error al sincronizar con Obuma", "error");
    }
    setSincronizando(false);
  };

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nuevo.proveedor_rut) {
      showAlert("El RUT es obligatorio", "error");
      return;
    }
    if (!nuevo.proveedor_razon_social) {
      showAlert("La razón social es obligatoria", "error");
      return;
    }

    setEnviando(true);
    const result = await crearProveedor(nuevo);
    
    if (result.success) {
      showAlert("Proveedor creado exitosamente en Obuma", "success");
      setNuevo(initialFormState);
      setShowForm(false);
    } else {
      showAlert(result.error || "Error al crear proveedor", "error");
    }
    setEnviando(false);
  };

  const handleActualizar = async () => {
    if (!seleccionado || !seleccionado.proveedor_id) return;
    
    setEnviando(true);
    const result = await actualizarProveedor(seleccionado.proveedor_id, seleccionado);
    
    if (result.success) {
      showAlert("Proveedor actualizado exitosamente", "success");
      setSeleccionado(null);
    } else {
      showAlert(result.error || "Error al actualizar proveedor", "error");
    }
    setEnviando(false);
  };

  // Proveedores filtrados con region/email (sobre todos, no solo paginados)
  const proveedoresFiltrados = useMemo(() => {
    const base = (filtroRegion !== 'TODAS' || filtroConEmail !== 'todos')
      ? todosProveedores
      : proveedoresPaginados;
    return base.filter((p) => {
      const matchRegion = filtroRegion === 'TODAS' || p.proveedor_region === filtroRegion;
      const matchEmail = filtroConEmail === 'todos' ||
        (filtroConEmail === 'si' ? !!p.proveedor_email : !p.proveedor_email);
      return matchRegion && matchEmail;
    });
  }, [proveedoresPaginados, todosProveedores, filtroRegion, filtroConEmail]);

  const proveedores = filtroRegion !== 'TODAS' || filtroConEmail !== 'todos'
    ? proveedoresFiltrados
    : proveedoresPaginados;

  const exportarExcel = () => {
    const rows = (todosProveedores.length ? todosProveedores : proveedores).map((p) => ({
      'RUT': p.proveedor_rut,
      'Razón Social': p.proveedor_razon_social,
      'Giro Comercial': p.proveedor_giro_comercial || '—',
      'Contacto': p.proveedor_contacto || '—',
      'Teléfono': p.proveedor_telefono || '—',
      'Celular': p.proveedor_celular || '—',
      'Email': p.proveedor_email || '—',
      'Sitio Web': p.proveedor_website || '—',
      'Dirección': p.proveedor_direccion || '—',
      'Comuna': p.proveedor_comuna || '—',
      'Región': getRegionNombre(p.proveedor_region || ''),
      'País': p.proveedor_pais || 'Chile',
      'Observaciones': p.proveedor_observacion || '—',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Proveedores Obuma');
    ws['!cols'] = [15, 40, 25, 20, 14, 14, 30, 30, 40, 20, 20, 12, 40].map((w) => ({ wch: w }));
    XLSX.writeFile(wb, `Proveedores_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getInitials = (nombre: string = '') => {
    return nombre.charAt(0).toUpperCase() || 'P';
  };

  const getRegionNombre = (regionCodigo: string = '') => {
    const regiones: Record<string, string> = {
      '01': 'Tarapacá', '02': 'Antofagasta', '03': 'Atacama', '04': 'Coquimbo',
      '05': 'Valparaíso', '06': "O'Higgins", '07': 'Maule', '08': 'Biobío',
      '09': 'Araucanía', '10': 'Los Lagos', '11': 'Aysén', '12': 'Magallanes',
      '13': 'Metropolitana', '14': 'Los Ríos', '15': 'Arica y Parinacota', '16': 'Ñuble'
    };
    return regiones[regionCodigo] || regionCodigo || 'No especificada';
  };

  // Componente de detalles expandidos
  const DetallesExpandidos = ({ prov }: { prov: ObumaProveedor }) => (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 animate-in slide-in-from-top duration-200">
      {prov.proveedor_giro_comercial && (
        <div className="flex items-start gap-2 text-sm text-slate-600">
          <Briefcase size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <span><strong>Giro:</strong> {prov.proveedor_giro_comercial}</span>
        </div>
      )}
      {prov.proveedor_direccion && (
        <div className="flex items-start gap-2 text-sm text-slate-600">
          <MapPin size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <span>
            {prov.proveedor_direccion}
            {prov.proveedor_comuna && `, ${prov.proveedor_comuna}`}
            {prov.proveedor_region && `, ${getRegionNombre(prov.proveedor_region)}`}
            {prov.proveedor_pais && `, ${prov.proveedor_pais}`}
          </span>
        </div>
      )}
      {(prov.proveedor_telefono || prov.proveedor_celular) && (
        <div className="flex flex-wrap gap-3">
          {prov.proveedor_telefono && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone size={14} className="text-slate-400" />
              <span>{prov.proveedor_telefono}</span>
            </div>
          )}
          {prov.proveedor_celular && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Smartphone size={14} className="text-slate-400" />
              <span>{prov.proveedor_celular}</span>
            </div>
          )}
        </div>
      )}
      {prov.proveedor_email && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Mail size={14} className="text-slate-400" />
          <span>{prov.proveedor_email}</span>
        </div>
      )}
      {prov.proveedor_website && (
        <div className="flex items-center gap-2 text-sm text-[#059669]">
          <Globe size={14} />
          <a href={prov.proveedor_website} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {prov.proveedor_website}
          </a>
        </div>
      )}
      {prov.proveedor_observacion && (
        <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg mt-2">
          <strong>Observaciones:</strong> {prov.proveedor_observacion}
        </p>
      )}
    </div>
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={40} className="text-red-500" />
          </div>
          <p className="text-red-600 font-bold text-lg">Error al cargar proveedores</p>
          <p className="text-slate-500 text-sm mt-2">{error}</p>
          <button 
            onClick={() => cargarProveedores()} 
            className="mt-4 px-6 py-2 bg-[#059669] text-white rounded-xl text-sm font-bold flex items-center gap-2 mx-auto"
          >
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 lg:p-8">
      
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
              <div className="bg-gradient-to-br from-[#059669] to-[#047857] p-3 rounded-2xl text-white shadow-xl">
                <Building2 size={28} />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-800 uppercase italic">
                  Proveedores <span className="text-[#059669]">Obuma</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                  Integración API - Gestión Centralizada de Proveedores
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setVista('lista')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${vista === 'lista' ? 'bg-[#059669] text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
              >
                📋 Lista
              </button>
              <button
                onClick={() => setVista('grid')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${vista === 'grid' ? 'bg-[#059669] text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
              >
                🔲 Grid
              </button>
              <button
                onClick={() => cargarProveedores()}
                className="p-2 text-slate-500 hover:text-[#059669] transition-colors"
                title="Actualizar lista"
              >
                <RefreshCw size={20} />
              </button>
              
              {/* Botón de sincronización */}
              <button
                onClick={sincronizarProductos}
                disabled={sincronizando}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                title="Sincronizar productos desde Obuma (histórico de compras)"
              >
                {sincronizando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Sincronizar Productos
              </button>
            </div>
          </div>
          
          {/* Tarjetas de estadísticas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Total Proveedores</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{estadisticas.total}</p>
                </div>
                <div className="bg-[#D1FAE5] p-2 rounded-xl">
                  <Building2 size={18} className="text-[#059669]" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Con Contacto</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{estadisticas.conContacto}</p>
                </div>
                <div className="bg-emerald-100 p-2 rounded-xl">
                  <Users size={18} className="text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Con Email</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{estadisticas.conEmail}</p>
                </div>
                <div className="bg-purple-100 p-2 rounded-xl">
                  <Mail size={18} className="text-purple-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Con Teléfono</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{estadisticas.conTelefono}</p>
                </div>
                <div className="bg-amber-100 p-2 rounded-xl">
                  <Phone size={18} className="text-amber-600" />
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
                placeholder="Buscar por nombre, RUT, contacto o email..."
                className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent"
              />
            </div>

            {/* Filtro región */}
            <select
              value={filtroRegion}
              onChange={(e) => setFiltroRegion(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl py-3 px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-[#059669]"
            >
              <option value="TODAS">Todas las regiones</option>
              {[['01','Tarapacá'],['02','Antofagasta'],['03','Atacama'],['04','Coquimbo'],['05','Valparaíso'],
                ['06',"O'Higgins"],['07','Maule'],['08','Biobío'],['09','Araucanía'],['10','Los Lagos'],
                ['11','Aysén'],['12','Magallanes'],['13','Metropolitana'],['14','Los Ríos'],
                ['15','Arica y Parinacota'],['16','Ñuble']
              ].map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>

            {/* Filtro email */}
            <select
              value={filtroConEmail}
              onChange={(e) => setFiltroConEmail(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl py-3 px-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-[#059669]"
            >
              <option value="todos">Con / Sin email</option>
              <option value="si">Con email</option>
              <option value="no">Sin email</option>
            </select>

            <button
              onClick={exportarExcel}
              className="bg-[#059669] hover:bg-[#047857] text-white px-5 py-3 rounded-xl text-sm font-bold uppercase tracking-wide shadow-lg transition-all flex items-center gap-2"
            >
              <Download size={16} /> Excel
            </button>

            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-slate-900 hover:bg-slate-700 text-white px-5 py-3 rounded-xl text-sm font-bold uppercase tracking-wide shadow-lg transition-all flex items-center gap-2"
            >
              {showForm ? <X size={18} /> : <Plus size={18} />}
              {showForm ? 'Cerrar' : 'Nuevo'}
            </button>
          </div>
        </div>

        {/* Formulario de creación - SIN es_supermercado */}
        {showForm && (
          <form onSubmit={handleCrear} className="mb-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-lg animate-in slide-in-from-top duration-300">
            <h2 className="text-lg font-black mb-6 text-slate-800 flex items-center gap-2">
              <Plus size={20} className="text-[#059669]" />
              REGISTRAR NUEVO PROVEEDOR EN OBUMA
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Datos básicos */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">RUT *</label>
                <input required value={nuevo.proveedor_rut} onChange={e => setNuevo({...nuevo, proveedor_rut: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200" placeholder="12.345.678-9" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Razón Social *</label>
                <input required value={nuevo.proveedor_razon_social} onChange={e => setNuevo({...nuevo, proveedor_razon_social: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200" placeholder="Nombre completo de la empresa" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Giro Comercial</label>
                <input value={nuevo.proveedor_giro_comercial} onChange={e => setNuevo({...nuevo, proveedor_giro_comercial: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" placeholder="Ej: Venta de productos, Servicios..." />
              </div>
              
              {/* Contacto */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Contacto</label>
                <input value={nuevo.proveedor_contacto} onChange={e => setNuevo({...nuevo, proveedor_contacto: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" placeholder="Persona de contacto" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Teléfono</label>
                <input value={nuevo.proveedor_telefono} onChange={e => setNuevo({...nuevo, proveedor_telefono: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" placeholder="Teléfono fijo" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Celular</label>
                <input value={nuevo.proveedor_celular} onChange={e => setNuevo({...nuevo, proveedor_celular: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" placeholder="Teléfono móvil" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Email</label>
                <input type="email" value={nuevo.proveedor_email} onChange={e => setNuevo({...nuevo, proveedor_email: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" placeholder="contacto@empresa.cl" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Sitio Web</label>
                <input value={nuevo.proveedor_website} onChange={e => setNuevo({...nuevo, proveedor_website: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" placeholder="https://www.empresa.cl" />
              </div>
              
              {/* Ubicación */}
              <div className="lg:col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Dirección</label>
                <input value={nuevo.proveedor_direccion} onChange={e => setNuevo({...nuevo, proveedor_direccion: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" placeholder="Calle, número, edificio" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Comuna</label>
                <input value={nuevo.proveedor_comuna} onChange={e => setNuevo({...nuevo, proveedor_comuna: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Región</label>
                <select value={nuevo.proveedor_region} onChange={e => setNuevo({...nuevo, proveedor_region: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200">
                  <option value="">Seleccionar región</option>
                  <option value="01">Tarapacá</option>
                  <option value="02">Antofagasta</option>
                  <option value="03">Atacama</option>
                  <option value="04">Coquimbo</option>
                  <option value="05">Valparaíso</option>
                  <option value="06">O'Higgins</option>
                  <option value="07">Maule</option>
                  <option value="08">Biobío</option>
                  <option value="09">Araucanía</option>
                  <option value="10">Los Lagos</option>
                  <option value="11">Aysén</option>
                  <option value="12">Magallanes</option>
                  <option value="13">Metropolitana</option>
                  <option value="14">Los Ríos</option>
                  <option value="15">Arica y Parinacota</option>
                  <option value="16">Ñuble</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">País</label>
                <input value={nuevo.proveedor_pais} onChange={e => setNuevo({...nuevo, proveedor_pais: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" placeholder="Chile" />
              </div>
            </div>
            
            {/* Observaciones */}
            <div className="mt-5 space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Observaciones</label>
              <textarea value={nuevo.proveedor_observacion} onChange={e => setNuevo({...nuevo, proveedor_observacion: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200 resize-none" rows={3} placeholder="Información adicional sobre el proveedor..." />
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">Cancelar</button>
              <button type="submit" disabled={enviando} className="px-6 py-2.5 bg-[#059669] text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 flex items-center gap-2">
                {enviando && <Loader2 size={16} className="animate-spin" />}
                Guardar en Obuma
              </button>
            </div>
          </form>
        )}

        {/* Resultados */}
        {proveedores.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 size={40} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-bold text-lg">No se encontraron proveedores</p>
            <p className="text-slate-400 text-sm mt-1">Intenta con otros filtros o agrega un nuevo proveedor</p>
          </div>
        )}

        {/* Vista de lista */}
        {vista === 'lista' && !loading && proveedores.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Proveedor</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contacto</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ubicación</th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proveedores.map((prov) => (
                    <tr key={prov.proveedor_id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-[#059669] to-[#047857] rounded-xl flex items-center justify-center text-white font-bold text-lg">
                            {getInitials(prov.proveedor_razon_social)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{prov.proveedor_razon_social}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{prov.proveedor_rut}</p>
                            {prov.proveedor_giro_comercial && (
                              <p className="text-[9px] text-slate-400">{prov.proveedor_giro_comercial}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {prov.proveedor_contacto && <p className="text-sm font-medium text-slate-700">{prov.proveedor_contacto}</p>}
                        {prov.proveedor_telefono && <p className="text-[10px] text-slate-400">{prov.proveedor_telefono}</p>}
                        {prov.proveedor_email && <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{prov.proveedor_email}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-600">{prov.proveedor_comuna || '—'}</p>
                        <p className="text-[9px] text-slate-400">{getRegionNombre(prov.proveedor_region || '')}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setExpandedCard(expandedCard === prov.proveedor_id ? null : prov.proveedor_id!)} className="p-2 text-slate-400 hover:text-[#059669] transition-colors" title="Ver detalles">
                            {expandedCard === prov.proveedor_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <button onClick={() => setSeleccionado(prov)} className="p-2 text-slate-400 hover:text-amber-600 transition-colors" title="Editar">
                            <Edit3 size={16} />
                          </button>
                        </div>
                        {expandedCard === prov.proveedor_id && <DetallesExpandidos prov={prov} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vista de grid */}
        {vista === 'grid' && !loading && proveedores.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {proveedores.map((prov) => (
              <div key={prov.proveedor_id} className="bg-white rounded-2xl border border-slate-200 hover:shadow-lg transition-all overflow-hidden group">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#059669] to-[#047857] rounded-xl flex items-center justify-center text-white font-bold text-lg">
                        {getInitials(prov.proveedor_razon_social)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 line-clamp-1">{prov.proveedor_razon_social}</h3>
                        <p className="text-[10px] text-slate-400 font-mono">{prov.proveedor_rut}</p>
                      </div>
                    </div>
                    <button onClick={() => setSeleccionado(prov)} className="p-1.5 text-slate-400 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit3 size={14} />
                    </button>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    {prov.proveedor_contacto && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Users size={14} className="text-slate-400" />
                        <span>{prov.proveedor_contacto}</span>
                      </div>
                    )}
                    {prov.proveedor_telefono && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone size={14} className="text-slate-400" />
                        <span>{prov.proveedor_telefono}</span>
                      </div>
                    )}
                    {prov.proveedor_email && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail size={14} className="text-slate-400" />
                        <span className="truncate">{prov.proveedor_email}</span>
                      </div>
                    )}
                    {prov.proveedor_direccion && (
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <MapPin size={14} className="text-slate-400 mt-0.5" />
                        <span className="line-clamp-1">{prov.proveedor_direccion}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex-1"></div>
                    <button onClick={() => setExpandedCard(expandedCard === prov.proveedor_id ? null : prov.proveedor_id!)} className="text-[10px] font-bold text-[#059669] hover:text-[#047857] flex items-center gap-1">
                      {expandedCard === prov.proveedor_id ? 'Ver menos' : 'Ver detalles'}
                      {expandedCard === prov.proveedor_id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                  
                  {expandedCard === prov.proveedor_id && <DetallesExpandidos prov={prov} />}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginación Frontend */}
        {!loading && totalPages > 1 && (
          <Paginacion
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={cambiarPagina}
          />
        )}

        {/* Info de paginación */}
        {!loading && proveedores.length > 0 && (
          <div className="text-center text-[10px] text-slate-400 mt-4">
            Mostrando {((currentPage - 1) * 10) + 1} - {Math.min(currentPage * 10, estadisticas.total)} de {estadisticas.total} proveedores
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-[#059669]" size={48} />
          </div>
        )}
      </div>

      {/* Modal de edición - SIN es_supermercado */}
      {seleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Editar Proveedor Obuma</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ID: {seleccionado.proveedor_id}</p>
              </div>
              <button onClick={() => setSeleccionado(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">RUT</label>
                  <input className="w-full bg-slate-100 rounded-xl p-3 text-sm" value={seleccionado.proveedor_rut} disabled />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Razón Social *</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200" value={seleccionado.proveedor_razon_social} onChange={e => setSeleccionado({...seleccionado, proveedor_razon_social: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Giro Comercial</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.proveedor_giro_comercial || ''} onChange={e => setSeleccionado({...seleccionado, proveedor_giro_comercial: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Contacto</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.proveedor_contacto || ''} onChange={e => setSeleccionado({...seleccionado, proveedor_contacto: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Teléfono</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.proveedor_telefono || ''} onChange={e => setSeleccionado({...seleccionado, proveedor_telefono: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Celular</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.proveedor_celular || ''} onChange={e => setSeleccionado({...seleccionado, proveedor_celular: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Email</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.proveedor_email || ''} onChange={e => setSeleccionado({...seleccionado, proveedor_email: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Sitio Web</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.proveedor_website || ''} onChange={e => setSeleccionado({...seleccionado, proveedor_website: e.target.value})} />
                </div>
                <div className="lg:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Dirección</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.proveedor_direccion || ''} onChange={e => setSeleccionado({...seleccionado, proveedor_direccion: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Comuna</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.proveedor_comuna || ''} onChange={e => setSeleccionado({...seleccionado, proveedor_comuna: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Región</label>
                  <select className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200" value={seleccionado.proveedor_region || ''} onChange={e => setSeleccionado({...seleccionado, proveedor_region: e.target.value})}>
                    <option value="">Seleccionar región</option>
                    <option value="01">Tarapacá</option>
                    <option value="02">Antofagasta</option>
                    <option value="03">Atacama</option>
                    <option value="04">Coquimbo</option>
                    <option value="05">Valparaíso</option>
                    <option value="06">O'Higgins</option>
                    <option value="07">Maule</option>
                    <option value="08">Biobío</option>
                    <option value="09">Araucanía</option>
                    <option value="10">Los Lagos</option>
                    <option value="11">Aysén</option>
                    <option value="12">Magallanes</option>
                    <option value="13">Metropolitana</option>
                    <option value="14">Los Ríos</option>
                    <option value="15">Arica y Parinacota</option>
                    <option value="16">Ñuble</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">País</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.proveedor_pais || 'Chile'} onChange={e => setSeleccionado({...seleccionado, proveedor_pais: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Observaciones</label>
                <textarea className="w-full bg-slate-50 rounded-xl p-3 text-sm resize-none" rows={3} value={seleccionado.proveedor_observacion || ''} onChange={e => setSeleccionado({...seleccionado, proveedor_observacion: e.target.value})} />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setSeleccionado(null)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold">Cancelar</button>
              <button onClick={handleActualizar} disabled={enviando} className="px-6 py-2.5 bg-[#059669] text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 flex items-center gap-2">
                {enviando && <Loader2 size={16} className="animate-spin" />}
                Actualizar en Obuma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}