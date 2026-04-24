// components/rrhh/OrganigramaTree.tsx
'use client';
import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronRight, Mail, Phone, Search, Download, ZoomIn, ZoomOut, Building2 } from 'lucide-react';
import html2canvas from 'html2canvas';

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

interface OrganigramaTreeProps {
  data: NodoOrganigrama | null;
}

export default function OrganigramaTree({ data }: OrganigramaTreeProps) {
  const [expandido, setExpandido] = useState<Set<string>>(new Set(data ? [data.id] : []));
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState(100);
  const treeRef = useRef<HTMLDivElement>(null);

  if (!data) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
        <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">No hay datos para mostrar</p>
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

  const expandirTodo = () => {
    const todosIds = new Set<string>();
    const addIds = (node: NodoOrganigrama) => {
      todosIds.add(node.id);
      if (node.children) {
        node.children.forEach(addIds);
      }
    };
    addIds(data);
    setExpandido(todosIds);
  };

  const contraerTodo = () => {
    setExpandido(new Set([data.id]));
  };

  const exportarImagen = async () => {
    if (!treeRef.current) return;
    const canvas = await html2canvas(treeRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });
    const link = document.createElement('a');
    link.download = `organigrama_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const filtrarNodos = (node: NodoOrganigrama): NodoOrganigrama | null => {
    if (!searchTerm) return node;
    
    const matches = node.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    node.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    node.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!node.children || node.children.length === 0) {
      return matches ? node : null;
    }
    
    const filteredChildren = node.children.map(filtrarNodos).filter((child): child is NodoOrganigrama => child !== null);
    if (matches || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  };

  const renderNode = (node: NodoOrganigrama, level = 0) => {
    const isExpanded = expandido.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="relative">
        {/* Línea vertical de conexión */}
        {level > 0 && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-200 -translate-x-4" />
        )}
        
        {/* Nodo */}
        <div className="relative flex items-start py-2">
          {/* Línea horizontal de conexión */}
          {level > 0 && (
            <div className="absolute left-0 top-1/2 w-4 h-0.5 bg-slate-200 -translate-x-4" />
          )}
          
          {/* Icono de expandir/contraer */}
          {hasChildren && (
            <button
              onClick={() => toggleExpand(node.id)}
              className="absolute -left-6 top-1/2 -translate-y-1/2 z-10 p-1 bg-white rounded-full border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          
          {/* Tarjeta del empleado */}
          <div className="ml-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all w-72">
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                  {node.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{node.name}</h4>
                  <p className="text-[10px] text-slate-500 line-clamp-1">{node.title}</p>
                  <p className="text-[9px] text-slate-400 flex items-center gap-1">
                    <Building2 size={10} />
                    {node.department}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 mt-3 pt-2 border-t border-slate-100">
                {node.email && (
                  <a href={`mailto:${node.email}`} className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-blue-600 transition-colors">
                    <Mail size={10} /> Email
                  </a>
                )}
                {node.phone && (
                  <a href={`tel:${node.phone}`} className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-blue-600 transition-colors">
                    <Phone size={10} /> Teléfono
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Hijos */}
        {hasChildren && isExpanded && (
          <div className="ml-8 pl-4 border-l-2 border-slate-200">
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredData = searchTerm ? filtrarNodos(data) : data;

  if (!filteredData) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
        <p className="text-slate-500">No se encontraron resultados para "{searchTerm}"</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header con controles */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Buscar por nombre, cargo o área..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={expandirTodo}
            className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Expandir todo
          </button>
          <button
            onClick={contraerTodo}
            className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Contraer todo
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(50, zoom - 10))}
            className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
            title="Alejar"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs font-medium text-slate-600 w-12 text-center">{zoom}%</span>
          <button
            onClick={() => setZoom(Math.min(150, zoom + 10))}
            className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
            title="Acercar"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={exportarImagen}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            <Download size={14} />
            Exportar imagen
          </button>
        </div>
      </div>

      {/* Árbol */}
      <div 
        ref={treeRef}
        className="p-6 overflow-x-auto"
        style={{ zoom: `${zoom}%` }}
      >
        <div className="min-w-max">
          {renderNode(filteredData)}
        </div>
      </div>
    </div>
  );
}