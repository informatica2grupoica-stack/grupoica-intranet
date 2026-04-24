// components/rrhh/VistaJerarquica.tsx
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Mail, Phone, Building2 } from 'lucide-react';

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

interface VistaJerarquicaProps {
  data: NodoOrganigrama | null;
}

export default function VistaJerarquica({ data }: VistaJerarquicaProps) {
  const [expandido, setExpandido] = useState<Set<string>>(new Set(data ? [data.id] : []));

  if (!data) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
        <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">No hay datos para mostrar</p>
        <p className="text-slate-400 text-sm mt-1">
          Asegúrate de que los empleados tengan asignado un jefe directo
        </p>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    const newExpandido = new Set(expandido);
    if (expandido.has(id)) {
      newExpandido.delete(id);
    } else {
      newExpandido.add(id);
    }
    setExpandido(newExpandido);
  };

  const contarSubordinados = (node: NodoOrganigrama): number => {
    if (!node.children || node.children.length === 0) return 0;
    let count = node.children.length;
    node.children.forEach((child) => {
      count += contarSubordinados(child);
    });
    return count;
  };

  const renderNode = (node: NodoOrganigrama, level = 0) => {
    const isExpanded = expandido.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const subordinadosCount = contarSubordinados(node);

    return (
      <div key={node.id} className="relative">
        {/* Línea de conexión vertical */}
        {level > 0 && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-200"
            style={{ left: 20 }}
          />
        )}
        
        <div 
          className={`relative flex items-start gap-3 p-4 rounded-2xl transition-all ${
            level === 0 ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' : 'bg-white border border-slate-200 hover:shadow-md'
          }`}
          style={{ marginLeft: level * 40 }}
        >
          {/* Línea horizontal de conexión */}
          {level > 0 && (
            <div 
              className="absolute left-0 top-1/2 w-5 h-0.5 bg-slate-200"
              style={{ left: -20 }}
            />
          )}
          
          {/* Avatar */}
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-2xl shrink-0 ${
            level === 0 ? 'bg-white/20 text-white' : 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md'
          }`}>
            {node.name?.charAt(0).toUpperCase() || '?'}
          </div>
          
          {/* Información */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-bold text-lg ${level === 0 ? 'text-white' : 'text-slate-800'}`}>
                {node.name}
              </h3>
              {level > 0 && hasChildren && (
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  {subordinadosCount} subordinado{subordinadosCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className={`text-sm ${level === 0 ? 'text-blue-100' : 'text-slate-500'}`}>
              {node.title}
            </p>
            <p className={`text-xs ${level === 0 ? 'text-blue-200' : 'text-slate-400'} flex items-center gap-1 mt-0.5`}>
              <Building2 size={12} />
              {node.department}
            </p>
            <div className="flex gap-3 mt-2">
              {node.email && (
                <a 
                  href={`mailto:${node.email}`}
                  className={`text-[9px] flex items-center gap-1 transition-colors ${
                    level === 0 ? 'text-blue-200 hover:text-white' : 'text-slate-400 hover:text-blue-600'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Mail size={10} /> {node.email.split('@')[0]}
                </a>
              )}
              {node.phone && (
                <a 
                  href={`tel:${node.phone}`}
                  className={`text-[9px] flex items-center gap-1 transition-colors ${
                    level === 0 ? 'text-blue-200 hover:text-white' : 'text-slate-400 hover:text-blue-600'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone size={10} /> {node.phone}
                </a>
              )}
            </div>
          </div>
          
          {/* Botón expandir/contraer */}
          {hasChildren && (
            <button
              onClick={() => toggleExpand(node.id)}
              className={`p-2 rounded-xl transition-colors ${
                level === 0 
                  ? 'hover:bg-white/20 text-white' 
                  : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          )}
        </div>
        
        {/* Subordinados */}
        {hasChildren && isExpanded && (
          <div className="relative mt-2 ml-8">
            <div className="space-y-3">
              {node.children.map((child) => renderNode(child, level + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-x-auto">
      <div className="min-w-[600px]">
        {renderNode(data)}
      </div>
    </div>
  );
}