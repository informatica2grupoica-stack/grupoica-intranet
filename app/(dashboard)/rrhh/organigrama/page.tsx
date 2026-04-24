// app/(dashboard)/rrhh/organigrama/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, Menu, GitBranch, Building2, ChevronDown, Mail, Phone } from 'lucide-react';
import VistaJerarquica from '@/app/components/rrhh/VistaJerarquica';
import OrganigramaTree from '@/app/components/rrhh/OrganigramaTree';

type TipoVista = 'jerarquica' | 'arbol';

interface NodoOrganigrama {
  id: string;
  name: string;
  title: string;
  department: string;
  email?: string;
  phone?: string;
  children: NodoOrganigrama[];
  parentId?: string | null;
}

export default function OrganigramaPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<NodoOrganigrama | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<TipoVista>('jerarquica');

  const cargarOrganigrama = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/rrhh/organigrama');
      const result = await response.json();
      if (response.ok) {
        setData(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarOrganigrama();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 size={40} className="text-red-500" />
        </div>
        <p className="text-red-600 font-bold text-lg">Error al cargar organigrama</p>
        <p className="text-slate-500 text-sm mt-2">{error}</p>
        <button 
          onClick={cargarOrganigrama} 
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 mx-auto"
        >
          <RefreshCw size={16} /> Reintentar
        </button>
      </div>
    );
  }

  if (!data || (data.children && data.children.length === 0)) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 size={40} className="text-slate-300" />
        </div>
        <p className="text-slate-500 font-bold text-lg">No hay datos para mostrar</p>
        <p className="text-slate-400 text-sm mt-1">
          Para ver el organigrama, primero debes asignar un jefe directo a los empleados.
        </p>
        <Link 
          href="/rrhh/empleados" 
          className="mt-4 inline-flex items-center gap-2 text-blue-600 text-sm font-bold hover:text-blue-700"
        >
          Ir a empleados →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase italic">
            Organigrama <span className="text-blue-600">Empresarial</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Estructura jerárquica de la empresa
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setVista('jerarquica')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                vista === 'jerarquica' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <Menu size={14} />
              Jerárquica
            </button>
            <button
              onClick={() => setVista('arbol')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                vista === 'arbol' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <GitBranch size={14} />
              Árbol
            </button>
          </div>

          <button
            onClick={cargarOrganigrama}
            className="p-2 text-slate-500 hover:text-blue-600 transition-colors rounded-xl hover:bg-slate-100"
            title="Actualizar"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Vista según selección */}
      {vista === 'jerarquica' ? (
        <VistaJerarquica data={data} />
      ) : (
        <OrganigramaTree data={data} />
      )}

      {/* Leyenda */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200">
        <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
          <GitBranch size={14} className="text-blue-500" />
          Leyenda
        </h3>
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded" />
            <span>Nivel principal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white border border-slate-200 rounded" />
            <span>Subordinados</span>
          </div>
          <div className="flex items-center gap-2">
            <ChevronDown size={14} className="text-slate-400" />
            <span>Expandir / Contraer</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-slate-400" />
            <span>Contacto por email</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-slate-400" />
            <span>Contacto telefónico</span>
          </div>
        </div>
      </div>
    </div>
  );
}