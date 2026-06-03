// app/(dashboard)/proveedores/page.tsx
'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Building2, Search, Loader2, MapPin, X, Phone, Star, 
  Trash2, Edit3, Plus, CheckCircle2, AlertCircle,
  Landmark, Mail, Globe, ChevronDown, ChevronUp,
  Briefcase, DollarSign, Calendar, Users,
  Database, Package, ExternalLink, Smartphone,
  ChevronLeft, ChevronRight, Shield, ShieldAlert
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
  obuma_id?: string;
}

type OrdenType = 'nombre' | 'calificacion' | 'reciente' | 'categoria';
type VistaType = 'grid' | 'lista';
type FuentType = 'todos' | 'manuales' | 'obuma';

const ITEMS_PER_PAGE = 25;

// Tipos de usuario para permisos
type UserRole = 'superuser' | 'admin' | 'user' | 'rrhh' | 'jefe' | 'vendedor';

export default function ProveedoresPage() {
  const router = useRouter();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [filteredProveedores, setFilteredProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [orden, setOrden] = useState<OrdenType>('nombre');
  const [vista, setVista] = useState<VistaType>('lista');
  const [fuente, setFuente] = useState<FuentType>('todos');
  const [seleccionado, setSeleccionado] = useState<Proveedor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [alert, setAlert] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  
  // Estado del usuario actual y sus permisos
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  
  const [estadisticas, setEstadisticas] = useState({
    total: 0,
    manuales: 0,
    obuma: 0,
    categorias: 0,
    activos: 0,
    avgCalificacion: 0
  });
  
  const [errorRut, setErrorRut] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [showBuscadorProductos, setShowBuscadorProductos] = useState(false);
  const [productoBuscado, setProductoBuscado] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState<any[]>([]);
  const [buscandoProducto, setBuscandoProducto] = useState(false);

  const initialFormState = {
    nombre_empresa: '', rut_empresa: '', categoria: '', tipo_servicio: '',
    nombre_contacto: '', email_contacto: '', telefono: '', sitio_web: '',
    direccion: '', comuna: '', ciudad: '', condiciones_pago: 'Contado',
    banco_nombre: '', cuenta_tipo: 'Corriente', cuenta_numero: '', 
    observaciones: '', calificacion: 5, activo: true
  };

  const [nuevo, setNuevo] = useState(initialFormState);

  // Cargar perfil del usuario actual
  useEffect(() => {
    cargarPerfilUsuario();
  }, []);

  useEffect(() => {
    if (userRole) {
      cargarProveedores();
    }
  }, [userRole]);

  useEffect(() => {
    filtrarYOrdenar();
  }, [proveedores, busqueda, categoriaFiltro, orden, fuente]);

  useEffect(() => {
    setCurrentPage(1);
  }, [busqueda, categoriaFiltro, orden, fuente]);

  const cargarPerfilUsuario = async () => {
    setLoadingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log("No hay sesión activa");
        router.push('/login');
        return;
      }

      const { data: perfil, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        console.error("Error cargando perfil:", error);
      } else {
        setUserProfile(perfil);
        setUserRole(perfil?.rol as UserRole || 'user');
        console.log("👤 Usuario autenticado:", perfil?.nombre, "Rol:", perfil?.rol);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoadingUser(false);
    }
  };

  // Verificar si el usuario tiene permisos de administrador
  const isAdmin = () => {
    return userRole === 'admin' || userRole === 'superuser';
  };

  // Verificar si puede eliminar (solo superuser)
  const canDelete = () => {
    return userRole === 'superuser';
  };

  // Verificar si puede editar (admin o superuser)
  const canEdit = () => {
    return userRole === 'admin' || userRole === 'superuser';
  };

  const showAlert = (msg: string, type: 'success' | 'error') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 3000);
  };

  // 🔥 FUNCIÓN PARA VERIFICAR RUT DUPLICADO ANTES DE GUARDAR
  const verificarRutDuplicado = async (rut: string, idExcluir?: string): Promise<{duplicado: boolean, proveedorExistente?: Proveedor}> => {
    if (!rut || rut.trim() === '') {
      return { duplicado: false };
    }

    let query = supabase
      .from('proveedores')
      .select('id, nombre_empresa, rut_empresa')
      .eq('rut_empresa', rut.trim());

    // Si es edición, excluir el registro actual
    if (idExcluir) {
      query = query.neq('id', idExcluir);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error verificando RUT:", error);
      return { duplicado: false };
    }

    if (data && data.length > 0) {
      return { duplicado: true, proveedorExistente: data[0] as Proveedor };
    }

    return { duplicado: false };
  };

  const cargarProveedores = async () => {
    setLoading(true);
    console.log("🔄 Cargando proveedores desde Supabase...");
    
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre_empresa', { ascending: true });
    
    if (!error && data) {
      console.log(`✅ Proveedores cargados: ${data.length} registros`);
      setProveedores(data);
      calcularEstadisticas(data);
    } else if (error) {
      console.error("❌ Error cargando proveedores:", error);
      showAlert("Error al cargar proveedores: " + error.message, "error");
    }
    setLoading(false);
  };

  const calcularEstadisticas = (data: Proveedor[]) => {
    const categoriasUnicas = new Set(
      data.map(p => p.categoria).filter(cat => cat && cat.trim() !== '')
    );
    
    const activos = data.filter(p => p.activo !== false).length;
    
    const proveedoresConRating = data.filter(p => p.calificacion && p.calificacion > 0);
    const avgCalificacion = proveedoresConRating.length > 0
      ? proveedoresConRating.reduce((acc, p) => acc + (p.calificacion || 0), 0) / proveedoresConRating.length
      : 0;
    
    const manuales = data.filter(p => !p.obuma_id).length;
    const obuma = data.filter(p => p.obuma_id).length;
    
    console.log('📊 Estadísticas calculadas:', {
      total: data.length,
      manuales,
      obuma,
      categorias: categoriasUnicas.size,
      activos,
      avgCalificacion: Math.round(avgCalificacion * 10) / 10
    });
    
    setEstadisticas({
      total: data.length,
      manuales,
      obuma,
      categorias: categoriasUnicas.size,
      activos,
      avgCalificacion: Math.round(avgCalificacion * 10) / 10
    });
  };

  const filtrarYOrdenar = () => {
    let filtrados = [...proveedores];
    
    // Filtrar por fuente
    if (fuente === 'manuales') {
      filtrados = filtrados.filter(p => !p.obuma_id);
    } else if (fuente === 'obuma') {
      filtrados = filtrados.filter(p => p.obuma_id);
    }
    
    // Filtrar por búsqueda
    if (busqueda) {
      const busquedaLower = busqueda.toLowerCase();
      filtrados = filtrados.filter(p => 
        p.nombre_empresa?.toLowerCase().includes(busquedaLower) ||
        p.rut_empresa?.includes(busqueda) ||
        p.categoria?.toLowerCase().includes(busquedaLower) ||
        p.tipo_servicio?.toLowerCase().includes(busquedaLower)
      );
    }
    
    // Filtrar por categoría
    if (categoriaFiltro !== "Todas") {
      filtrados = filtrados.filter(p => p.categoria === categoriaFiltro);
    }
    
    // Ordenar
    switch (orden) {
      case 'nombre':
        filtrados.sort((a, b) => (a.nombre_empresa || '').localeCompare(b.nombre_empresa || ''));
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

  const totalPages = Math.ceil(filteredProveedores.length / ITEMS_PER_PAGE);
  const paginatedProveedores = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProveedores.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProveedores, currentPage]);

  const validarRut = (rut: string): boolean => {
    if (!rut) return true;
    const rutLimpio = rut.replace(/\./g, '').replace(/-/g, '');
    if (rutLimpio.length < 2) return false;
    
    const cuerpo = rutLimpio.slice(0, -1);
    const dvEsperado = rutLimpio.slice(-1).toUpperCase();
    
    let suma = 0;
    let multiplo = 2;
    
    for (let i = cuerpo.length - 1; i >= 0; i--) {
      suma += parseInt(cuerpo[i]) * multiplo;
      multiplo = multiplo === 7 ? 2 : multiplo + 1;
    }
    
    const dvCalculado = 11 - (suma % 11);
    const dvCaracter = dvCalculado === 11 ? '0' : dvCalculado === 10 ? 'K' : dvCalculado.toString();
    
    return dvCaracter === dvEsperado;
  };

  // 🔥 GUARDAR PROVEEDOR CON VALIDACIÓN DE DUPLICADOS
  const guardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar permisos
    if (!isAdmin()) {
      showAlert("No tienes permisos para crear proveedores. Solo administradores.", "error");
      return;
    }
    
    if (!nuevo.nombre_empresa.trim()) {
      showAlert("El nombre de la empresa es obligatorio", "error");
      return;
    }
    
    if (!nuevo.rut_empresa.trim()) {
      showAlert("El RUT es obligatorio", "error");
      return;
    }
    
    if (!validarRut(nuevo.rut_empresa)) {
      showAlert("RUT inválido. Formato: 12345678-9", "error");
      return;
    }
    
    if (!nuevo.categoria.trim()) {
      showAlert("La categoría es obligatoria", "error");
      return;
    }
    
    setLoading(true);
    setErrorRut("");
    
    // 🔥 VERIFICAR DUPLICADO ANTES DE INSERTAR
    const { duplicado, proveedorExistente } = await verificarRutDuplicado(nuevo.rut_empresa);
    
    if (duplicado) {
      setErrorRut(`El RUT ${nuevo.rut_empresa} ya está registrado por el proveedor: ${proveedorExistente?.nombre_empresa}`);
      showAlert(`❌ RUT duplicado: Ya existe el proveedor "${proveedorExistente?.nombre_empresa}" con este RUT`, "error");
      setLoading(false);
      return;
    }
    
    const { error } = await supabase.from('proveedores').insert([nuevo]);
    
    if (error) {
      if (error.code === '23505') {
        setErrorRut("Este RUT ya está registrado");
        showAlert("Ya existe un proveedor con este RUT", "error");
      } else {
        showAlert(error.message, "error");
      }
    } else {
      showAlert("Proveedor registrado con éxito", "success");
      setNuevo(initialFormState);
      cargarProveedores();
      setShowForm(false);
    }
    setLoading(false);
  };

  // 🔥 ACTUALIZAR PROVEEDOR CON VALIDACIÓN DE DUPLICADOS
  const actualizarProveedor = async () => {
    if (!seleccionado) return;
    
    // Verificar permisos
    if (!canEdit()) {
      showAlert("No tienes permisos para editar proveedores. Solo administradores.", "error");
      return;
    }
    
    if (seleccionado.rut_empresa && !validarRut(seleccionado.rut_empresa)) {
      showAlert("RUT inválido. Formato: 12345678-9", "error");
      return;
    }
    
    setLoading(true);
    
    // 🔥 VERIFICAR DUPLICADO EN EDICIÓN (excluyendo el propio ID)
    const { duplicado, proveedorExistente } = await verificarRutDuplicado(seleccionado.rut_empresa, seleccionado.id);
    
    if (duplicado) {
      showAlert(`❌ RUT duplicado: El RUT ${seleccionado.rut_empresa} ya pertenece al proveedor "${proveedorExistente?.nombre_empresa}"`, "error");
      setLoading(false);
      return;
    }
    
    const { error } = await supabase
      .from('proveedores')
      .update(seleccionado)
      .eq('id', seleccionado.id);
    
    if (error) {
      if (error.code === '23505') {
        showAlert("Ya existe otro proveedor con este RUT", "error");
      } else {
        showAlert(error.message, "error");
      }
    } else {
      showAlert("Proveedor actualizado con éxito", "success");
      cargarProveedores();
      setSeleccionado(null);
    }
    setLoading(false);
  };

  // 🔥 ELIMINAR PROVEEDOR (solo superuser)
  const eliminarProveedor = async (id: string) => {
    if (!canDelete()) {
      showAlert("No tienes permisos para eliminar proveedores. Solo Super Usuario.", "error");
      return;
    }
    
    if (!window.confirm("⚠️ ¿Eliminar este proveedor permanentemente? Esta acción no se puede deshacer.")) return;
    
    setLoading(true);
    const { error } = await supabase.from('proveedores').delete().eq('id', id);
    if (error) {
      showAlert("Error al eliminar", "error");
    } else {
      showAlert("Eliminado correctamente", "success");
      setSeleccionado(null);
      cargarProveedores();
    }
    setLoading(false);
  };

  const toggleActivo = async (prov: Proveedor) => {
    if (!canEdit()) {
      showAlert("No tienes permisos para cambiar el estado de proveedores", "error");
      return;
    }
    
    const nuevoEstado = !prov.activo;
    const { error } = await supabase
      .from('proveedores')
      .update({ activo: nuevoEstado })
      .eq('id', prov.id);
    
    if (error) {
      showAlert("Error al cambiar estado", "error");
    } else {
      showAlert(`Proveedor ${nuevoEstado ? 'activado' : 'desactivado'}`, "success");
      cargarProveedores();
    }
  };

  const sincronizarProductos = async () => {
    if (!isAdmin()) {
      showAlert("No tienes permisos para sincronizar productos", "error");
      return;
    }
    
    setSincronizando(true);
    try {
      const res = await fetch('/api/sincronizar-productos-obuma', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showAlert(`✅ Sincronización completada! ${data.estadisticas?.productos_sincronizados || 0} productos sincronizados`, "success");
        cargarProveedores();
      } else {
        showAlert(`❌ Error: ${data.error || data.message}`, "error");
      }
    } catch (error) {
      showAlert("Error al sincronizar con Obuma", "error");
    }
    setSincronizando(false);
  };

  const buscarProductosProveedor = async () => {
    if (!productoBuscado.trim()) return;
    setBuscandoProducto(true);
    try {
      const res = await fetch(`/api/buscar-proveedores-por-producto?producto=${encodeURIComponent(productoBuscado)}&incluirObuma=true`);
      const data = await res.json();
      setResultadosBusqueda(data.proveedores || []);
    } catch (error) {
      console.error(error);
      setResultadosBusqueda([]);
    }
    setBuscandoProducto(false);
  };

  const getInitials = (nombre: string) => nombre?.charAt(0).toUpperCase() || 'P';

  const categoriasUnicas = ["Todas", ...new Set(proveedores.map(p => p.categoria).filter(cat => cat && cat.trim() !== ''))];

  const DetallesExpandidos = ({ prov }: { prov: Proveedor }) => (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 animate-in slide-in-from-top duration-200">
      {prov.direccion && (
        <div className="flex items-start gap-2 text-xs text-slate-600">
          <MapPin size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <span>{prov.direccion}, {prov.comuna}, {prov.ciudad}</span>
        </div>
      )}
      {prov.email_contacto && (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Mail size={12} className="text-slate-400 flex-shrink-0" />
          <span className="truncate">{prov.email_contacto}</span>
        </div>
      )}
      {prov.sitio_web && (
        <div className="flex items-center gap-2 text-xs text-[#059669]">
          <Globe size={12} className="flex-shrink-0" />
          <a href={prov.sitio_web} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
            {prov.sitio_web}
          </a>
        </div>
      )}
      {prov.condiciones_pago && (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <DollarSign size={12} className="text-slate-400" />
          <span>Pago: {prov.condiciones_pago}</span>
        </div>
      )}
      {prov.banco_nombre && (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Landmark size={12} className="text-slate-400" />
          <span>{prov.banco_nombre} - {prov.cuenta_tipo}: {prov.cuenta_numero}</span>
        </div>
      )}
      {prov.observaciones && (
        <p className="text-[10px] text-slate-500 italic bg-slate-50 p-2 rounded-lg mt-2">
          <strong>Observaciones:</strong> {prov.observaciones}
        </p>
      )}
      {prov.obuma_id && (
        <p className="text-[9px] text-[#059669] bg-[#ECFDF5] p-1.5 rounded-lg inline-block">
          🏢 ID Obuma: {prov.obuma_id}
        </p>
      )}
      <div className="flex items-center justify-between pt-2 text-[9px] text-slate-400">
        <span>Registrado: {new Date(prov.created_at).toLocaleDateString('es-CL')}</span>
        <span className={`px-2 py-0.5 rounded-full ${prov.activo !== false ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
          {prov.activo !== false ? 'Activo' : 'Inactivo'}
        </span>
      </div>
    </div>
  );

  // Pantalla de carga de usuario
  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#059669]" size={48} />
      </div>
    );
  }

  // Verificar autenticación
  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShieldAlert size={48} className="mx-auto text-red-500 mb-4" />
          <p className="text-slate-600">No tienes acceso a esta página</p>
          <button onClick={() => router.push('/login')} className="mt-4 px-4 py-2 bg-[#059669] text-white rounded-xl">
            Ir al Login
          </button>
        </div>
      </div>
    );
  }

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
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-3 rounded-2xl text-white shadow-xl">
                <Building2 size={28} />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-800 uppercase italic">
                  Central de <span className="text-[#059669]">Proveedores</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                  Gestión Estratégica de Partners Comerciales
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Badge de rol del usuario */}
              <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase flex items-center gap-1 ${
                userRole === 'superuser' ? 'bg-purple-100 text-purple-700' : 
                userRole === 'admin' ? 'bg-[#D1FAE5] text-[#047857]' : 
                'bg-slate-100 text-slate-500'
              }`}>
                <Shield size={12} />
                {userRole === 'superuser' ? 'SUPER USUARIO' : userRole === 'admin' ? 'ADMINISTRADOR' : userRole?.toUpperCase()}
              </div>
              
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
                onClick={() => setShowBuscadorProductos(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-md flex items-center gap-2"
              >
                <Package size={14} />
                Buscar Producto
              </button>
              {isAdmin() && (
                <button
                  onClick={sincronizarProductos}
                  disabled={sincronizando}
                  className="px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all bg-[#111827] text-white hover:bg-[#1F2937] disabled:opacity-50 flex items-center gap-2"
                >
                  {sincronizando ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                  Sincronizar Obuma
                </button>
              )}
            </div>
          </div>
          
          {/* Tarjetas de métricas */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Total</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{estadisticas.total.toLocaleString()}</p>
                </div>
                <div className="bg-[#D1FAE5] p-2 rounded-xl">
                  <Building2 size={18} className="text-[#059669]" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">📋 Manuales</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">{estadisticas.manuales.toLocaleString()}</p>
                </div>
                <div className="bg-emerald-100 p-2 rounded-xl">
                  <Users size={18} className="text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">🏢 Obuma</p>
                  <p className="text-2xl font-black text-[#059669] mt-1">{estadisticas.obuma.toLocaleString()}</p>
                </div>
                <div className="bg-[#D1FAE5] p-2 rounded-xl">
                  <Database size={18} className="text-[#059669]" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Categorías</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{estadisticas.categorias}</p>
                </div>
                <div className="bg-purple-100 p-2 rounded-xl">
                  <Briefcase size={18} className="text-purple-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Activos</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{estadisticas.activos.toLocaleString()}</p>
                </div>
                <div className="bg-green-100 p-2 rounded-xl">
                  <CheckCircle2 size={18} className="text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400">Rating</p>
                  <p className="text-2xl font-black text-amber-600 mt-1">{estadisticas.avgCalificacion}</p>
                </div>
                <div className="bg-amber-100 p-2 rounded-xl">
                  <Star size={18} className="text-amber-500" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Filtros y búsqueda */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setFuente('todos')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${fuente === 'todos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Todos ({estadisticas.total})
              </button>
              <button
                onClick={() => setFuente('manuales')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${fuente === 'manuales' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                📋 Manuales ({estadisticas.manuales})
              </button>
              <button
                onClick={() => setFuente('obuma')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${fuente === 'obuma' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                🏢 Obuma ({estadisticas.obuma})
              </button>
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, RUT o servicio..." 
                className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]"
              />
            </div>
            
            <select 
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm font-medium text-slate-600 cursor-pointer"
            >
              {categoriasUnicas.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select 
              value={orden}
              onChange={(e) => setOrden(e.target.value as OrdenType)}
              className="bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm font-medium text-slate-600 cursor-pointer"
            >
              <option value="nombre">Ordenar por Nombre</option>
              <option value="calificacion">Ordenar por Calificación</option>
              <option value="reciente">Más Recientes</option>
              <option value="categoria">Ordenar por Categoría</option>
            </select>

            {isAdmin() && (
              <button 
                onClick={() => setShowForm(!showForm)}
                className="bg-[#059669] hover:bg-[#047857] text-white px-5 py-3 rounded-xl text-sm font-bold uppercase tracking-wide shadow-lg transition-all flex items-center gap-2"
              >
                {showForm ? <X size={18} /> : <Plus size={18} />}
                {showForm ? 'Cerrar' : 'Nuevo Proveedor'}
              </button>
            )}
          </div>
          
          {/* Info de resultados */}
          <div className="mt-4 text-[10px] text-slate-400">
            Mostrando {paginatedProveedores.length} de {filteredProveedores.length} proveedores
            {filteredProveedores.length !== proveedores.length && ` (filtrados de ${proveedores.length} totales)`}
          </div>
        </div>

        {/* Formulario de creación - SOLO visible para admin/superuser */}
        {showForm && isAdmin() && (
          <form onSubmit={guardarProveedor} className="mb-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-lg animate-in slide-in-from-top duration-300">
            <h2 className="text-lg font-black mb-6 text-slate-800 flex items-center gap-2">
              <Plus size={20} className="text-[#059669]" />
              REGISTRAR NUEVO PROVEEDOR
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Nombre Empresa *</label>
                <input required value={nuevo.nombre_empresa} onChange={e => setNuevo({...nuevo, nombre_empresa: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm border border-slate-200" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">RUT *</label>
                <input required value={nuevo.rut_empresa} onChange={e => setNuevo({...nuevo, rut_empresa: e.target.value})} className={`w-full bg-slate-50 rounded-xl p-3 text-sm border ${errorRut ? 'border-red-500' : 'border-slate-200'}`} />
                {errorRut && <p className="text-[9px] text-red-500">{errorRut}</p>}
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Categoría *</label>
                <input required value={nuevo.categoria} onChange={e => setNuevo({...nuevo, categoria: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Tipo Servicio</label>
                <input value={nuevo.tipo_servicio} onChange={e => setNuevo({...nuevo, tipo_servicio: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Contacto</label>
                <input value={nuevo.nombre_contacto} onChange={e => setNuevo({...nuevo, nombre_contacto: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Teléfono</label>
                <input value={nuevo.telefono} onChange={e => setNuevo({...nuevo, telefono: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Email</label>
                <input type="email" value={nuevo.email_contacto} onChange={e => setNuevo({...nuevo, email_contacto: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Sitio Web</label>
                <input value={nuevo.sitio_web} onChange={e => setNuevo({...nuevo, sitio_web: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Dirección</label>
                <input value={nuevo.direccion} onChange={e => setNuevo({...nuevo, direccion: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Comuna</label>
                <input value={nuevo.comuna} onChange={e => setNuevo({...nuevo, comuna: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Ciudad</label>
                <input value={nuevo.ciudad} onChange={e => setNuevo({...nuevo, ciudad: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Condiciones Pago</label>
                <select value={nuevo.condiciones_pago} onChange={e => setNuevo({...nuevo, condiciones_pago: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm">
                  <option value="Contado">Contado</option>
                  <option value="30 días">30 días</option>
                  <option value="60 días">60 días</option>
                  <option value="90 días">90 días</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Banco</label>
                <input value={nuevo.banco_nombre} onChange={e => setNuevo({...nuevo, banco_nombre: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Tipo Cuenta</label>
                <select value={nuevo.cuenta_tipo} onChange={e => setNuevo({...nuevo, cuenta_tipo: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm">
                  <option value="Corriente">Corriente</option>
                  <option value="Vista">Vista / RUT</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Número Cuenta</label>
                <input value={nuevo.cuenta_numero} onChange={e => setNuevo({...nuevo, cuenta_numero: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Calificación</label>
                <select value={nuevo.calificacion} onChange={e => setNuevo({...nuevo, calificacion: Number(e.target.value)})} className="w-full bg-slate-50 rounded-xl p-3 text-sm">
                  {[5,4,3,2,1].map(num => <option key={num} value={num}>{'★'.repeat(num)}{'☆'.repeat(5-num)}</option>)}
                </select>
              </div>
            </div>
            
            <div className="mt-5">
              <label className="text-[10px] font-bold uppercase text-slate-500">Observaciones</label>
              <textarea value={nuevo.observaciones} onChange={e => setNuevo({...nuevo, observaciones: e.target.value})} className="w-full bg-slate-50 rounded-xl p-3 text-sm resize-none" rows={3} />
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">Cancelar</button>
              <button type="submit" disabled={loading} className="px-6 py-2.5 bg-[#059669] text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 flex items-center gap-2">
                {loading && <Loader2 size={16} className="animate-spin" />}
                Guardar Proveedor
              </button>
            </div>
          </form>
        )}

        {/* Tabla de resultados */}
        {filteredProveedores.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 size={40} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-bold text-lg">No se encontraron proveedores</p>
            <p className="text-slate-400 text-sm mt-1">Intenta con otros filtros o agrega un nuevo proveedor</p>
          </div>
        )}

        {vista === 'lista' && !loading && paginatedProveedores.length > 0 && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Proveedor</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Categoría</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contacto</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fuente</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Calificación</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProveedores.map((prov) => (
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
                          {prov.tipo_servicio && <p className="text-[9px] text-slate-400 mt-1">{prov.tipo_servicio}</p>}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-700">{prov.nombre_contacto || '—'}</p>
                          <p className="text-[10px] text-slate-400">{prov.telefono}</p>
                          {prov.email_contacto && <p className="text-[9px] text-slate-400 truncate max-w-[180px]">{prov.email_contacto}</p>}
                        </td>
                        <td className="px-6 py-4">
                          {prov.obuma_id ? (
                            <span className="text-[9px] font-bold bg-[#D1FAE5] text-[#059669] px-2 py-1 rounded-full">🏢 Obuma</span>
                          ) : (
                            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full">📋 Manual</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} size={14} className={i < (prov.calificacion || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => toggleActivo(prov)} 
                            disabled={!canEdit()}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase transition-all ${prov.activo !== false ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-red-100 text-red-600 hover:bg-red-200'} ${!canEdit() ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {prov.activo !== false ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setExpandedCard(expandedCard === prov.id ? null : prov.id)} className="p-2 text-slate-400 hover:text-[#059669] transition-colors">
                              {expandedCard === prov.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            {canEdit() && (
                              <button onClick={() => setSeleccionado(prov)} className="p-2 text-slate-400 hover:text-amber-600 transition-colors">
                                <Edit3 size={16} />
                              </button>
                            )}
                            {canDelete() && !prov.obuma_id && (
                              <button onClick={() => eliminarProveedor(prov.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                          {expandedCard === prov.id && <DetallesExpandidos prov={prov} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                          currentPage === pageNum
                            ? 'bg-[#059669] text-white shadow-md'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}

        {/* Vista de grid con paginación */}
        {vista === 'grid' && !loading && paginatedProveedores.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedProveedores.map((prov) => (
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
                        {canEdit() && (
                          <button onClick={() => setSeleccionado(prov)} className="p-1.5 text-slate-400 hover:text-amber-600">
                            <Edit3 size={14} />
                          </button>
                        )}
                        {canDelete() && !prov.obuma_id && (
                          <button onClick={() => eliminarProveedor(prov.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Categoría</span>
                        <span className="text-xs font-bold text-slate-700">{prov.categoria}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Fuente</span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#D1FAE5] text-[#059669]">{prov.obuma_id ? '🏢 Obuma' : '📋 Manual'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Contacto</span>
                        <span className="text-xs text-slate-600">{prov.nombre_contacto || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</span>
                        <span className="text-xs text-slate-600">{prov.telefono || '—'}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={12} className={i < (prov.calificacion || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                        ))}
                      </div>
                      <button onClick={() => setExpandedCard(expandedCard === prov.id ? null : prov.id)} className="text-[10px] font-bold text-[#059669] hover:text-[#047857] flex items-center gap-1">
                        {expandedCard === prov.id ? 'Ver menos' : 'Ver detalles'}
                        {expandedCard === prov.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                    
                    {expandedCard === prov.id && <DetallesExpandidos prov={prov} />}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Paginación para grid */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                          currentPage === pageNum
                            ? 'bg-[#059669] text-white shadow-md'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-[#059669]" size={48} />
          </div>
        )}
      </div>

      {/* Modal de edición - solo visible para admin/superuser */}
      {seleccionado && canEdit() && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Editar Proveedor</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Modificar información del proveedor</p>
              </div>
              <button onClick={() => setSeleccionado(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Nombre Empresa *</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.nombre_empresa} onChange={e => setSeleccionado({...seleccionado, nombre_empresa: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">RUT *</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.rut_empresa} onChange={e => setSeleccionado({...seleccionado, rut_empresa: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Categoría *</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.categoria} onChange={e => setSeleccionado({...seleccionado, categoria: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Tipo Servicio</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.tipo_servicio} onChange={e => setSeleccionado({...seleccionado, tipo_servicio: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Contacto</label>
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
                  <select className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.condiciones_pago} onChange={e => setSeleccionado({...seleccionado, condiciones_pago: e.target.value})}>
                    <option value="Contado">Contado</option>
                    <option value="30 días">30 días</option>
                    <option value="60 días">60 días</option>
                    <option value="90 días">90 días</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Banco</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.banco_nombre} onChange={e => setSeleccionado({...seleccionado, banco_nombre: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Tipo Cuenta</label>
                  <select className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.cuenta_tipo} onChange={e => setSeleccionado({...seleccionado, cuenta_tipo: e.target.value})}>
                    <option value="Corriente">Corriente</option>
                    <option value="Vista">Vista / RUT</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Número Cuenta</label>
                  <input className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.cuenta_numero} onChange={e => setSeleccionado({...seleccionado, cuenta_numero: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Calificación</label>
                  <select className="w-full bg-slate-50 rounded-xl p-3 text-sm" value={seleccionado.calificacion} onChange={e => setSeleccionado({...seleccionado, calificacion: Number(e.target.value)})}>
                    {[5,4,3,2,1].map(num => <option key={num} value={num}>{'★'.repeat(num)}{'☆'.repeat(5-num)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Observaciones</label>
                <textarea className="w-full bg-slate-50 rounded-xl p-3 text-sm resize-none" rows={3} value={seleccionado.observaciones} onChange={e => setSeleccionado({...seleccionado, observaciones: e.target.value})} />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setSeleccionado(null)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold">Cancelar</button>
              <button onClick={actualizarProveedor} disabled={loading} className="px-6 py-2.5 bg-[#059669] text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 flex items-center gap-2">
                {loading && <Loader2 size={16} className="animate-spin" />}
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de búsqueda de productos */}
      {showBuscadorProductos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">🔍 Buscar Proveedores por Producto</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Encuentra qué proveedores venden un producto específico</p>
              </div>
              <button onClick={() => setShowBuscadorProductos(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="flex gap-3 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={productoBuscado}
                    onChange={(e) => setProductoBuscado(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && buscarProductosProveedor()}
                    placeholder="Ej: Martillo, Clavos, Anticorrosivo, Smartphone..."
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  onClick={buscarProductosProveedor}
                  disabled={buscandoProducto}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {buscandoProducto ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  Buscar
                </button>
              </div>

              {resultadosBusqueda.length > 0 && (
                <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                  <p className="text-sm text-slate-500">📦 {resultadosBusqueda.length} proveedores encontrados</p>
                  {resultadosBusqueda.map((prov, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-slate-800">{prov.nombre}</h3>
                          <p className="text-[10px] text-slate-400 font-mono">{prov.rut}</p>
                        </div>
                        {prov.telefono && (
                          <a href={`tel:${prov.telefono}`} className="text-xs text-[#059669] hover:underline">
                            <Phone size={14} className="inline mr-1" /> {prov.telefono}
                          </a>
                        )}
                      </div>
                      <div className="space-y-2">
                        {prov.productos.map((prod: any, pidx: number) => (
                          <div key={pidx} className="bg-white rounded-lg p-3 flex justify-between items-center">
                            <div>
                              <p className="font-medium text-sm">{prod.nombre}</p>
                              {prod.sku && <p className="text-[9px] text-slate-400">SKU: {prod.sku}</p>}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-emerald-600">
                                {prod.ultimo_precio ? `$${prod.ultimo_precio.toLocaleString('es-CL')}` : 'Consultar'}
                              </p>
                              {prod.fecha_compra && <p className="text-[9px] text-slate-400">{prod.fecha_compra}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                      {prov.sitio_web && (
                        <a href={prov.sitio_web} target="_blank" className="text-[10px] text-[#059669] hover:underline mt-3 inline-flex items-center gap-1">
                          <ExternalLink size={10} /> Ver sitio web
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {resultadosBusqueda.length === 0 && productoBuscado && !buscandoProducto && (
                <div className="text-center py-12">
                  <Package size={48} className="mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">No se encontraron proveedores que vendan "{productoBuscado}"</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button onClick={() => setShowBuscadorProductos(false)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}