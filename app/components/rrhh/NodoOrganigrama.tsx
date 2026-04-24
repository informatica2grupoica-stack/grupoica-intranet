// components/rrhh/NodoOrganigrama.tsx
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Mail, Phone, Briefcase, Building2 } from 'lucide-react';

interface NodoOrganigramaProps {
  node: any;
  nivel?: number;
}

export default function NodoOrganigrama({ node, nivel = 0 }: NodoOrganigramaProps) {
  const [expandido, setExpandido] = useState(true);
  const tieneHijos = node.children && node.children.length > 0;

  const getColorByLevel = (level: number) => {
    const colores = [
      'bg-gradient-to-r from-blue-600 to-blue-700',
      'bg-gradient-to-r from-emerald-600 to-emerald-700',
      'bg-gradient-to-r from-purple-600 to-purple-700',
      'bg-gradient-to-r from-amber-600 to-amber-700',
      'bg-gradient-to-r from-rose-600 to-rose-700',
      'bg-gradient-to-r from-cyan-600 to-cyan-700',
    ];
    return colores[level % colores.length];
  };

  return (
    <div className="relative">
      {/* Nodo principal */}
      <div 
        className={`relative rounded-2xl shadow-lg overflow-hidden transition-all duration-300 ${
          expandido && tieneHijos ? 'mb-4' : ''
        }`}
        style={{ marginLeft: nivel * 30 }}
      >
        <div className={`${getColorByLevel(nivel)} text-white p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                {node.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <h3 className="font-bold text-lg">{node.name}</h3>
                <p className="text-sm text-white/80">{node.title}</p>
                <p className="text-xs text-white/60 flex items-center gap-1 mt-0.5">
                  <Building2 size={12} />
                  {node.department}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {node.email && (
                <a 
                  href={`mailto:${node.email}`}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Enviar email"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Mail size={16} />
                </a>
              )}
              {node.phone && (
                <a 
                  href={`tel:${node.phone}`}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Llamar"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone size={16} />
                </a>
              )}
              {tieneHijos && (
                <button
                  onClick={() => setExpandido(!expandido)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title={expandido ? 'Contraer' : 'Expandir'}
                >
                  {expandido ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hijos */}
      {tieneHijos && expandido && (
        <div className="relative">
          {/* Línea de conexión vertical */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-200" style={{ left: nivel * 30 + 32 }} />
          
          <div className="space-y-3 mt-2">
            {node.children.map((child: any, idx: number) => (
              <div key={child.id} className="relative">
                {/* Línea de conexión horizontal */}
                <div 
                  className="absolute top-1/2 w-8 h-0.5 bg-slate-200"
                  style={{ left: nivel * 30 + 24 }}
                />
                <NodoOrganigrama node={child} nivel={nivel + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}