// components/deepseek/AlertaDuplicado.tsx
'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ProductoSimilar {
  producto_nombre: string;
  producto_codigo_comercial: string;
  sku?: string;
  nombre?: string;
}

interface AlertaDuplicadoProps {
  nombreProducto: string;
  productosExistentes: any[];
  onClose?: () => void;
}

export default function AlertaDuplicado({
  nombreProducto,
  productosExistentes,
  onClose
}: AlertaDuplicadoProps) {
  const [duplicados, setDuplicados] = useState<ProductoSimilar[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!nombreProducto || nombreProducto.length < 3) {
      setDuplicados([]);
      return;
    }

    // Búsqueda local inmediata (sin llamar a la API)
    const buscarLocalmente = () => {
      const nombreLower = nombreProducto.toLowerCase();
      const similares = productosExistentes.filter(p => {
        const nombreExistente = (p.nombre || p.producto_nombre || '').toLowerCase();
        const skuExistente = (p.sku || p.producto_codigo_comercial || '').toLowerCase();
        
        // Buscar coincidencia parcial (al menos 3 caracteres coincidentes)
        if (nombreLower.length >= 3) {
          return nombreExistente.includes(nombreLower) || 
                 nombreLower.includes(nombreExistente) ||
                 skuExistente === nombreLower;
        }
        return false;
      }).slice(0, 5);
      
      if (similares.length > 0) {
        const duplicadosMap = similares.map(p => ({
          producto_nombre: p.nombre || p.producto_nombre || 'Sin nombre',
          producto_codigo_comercial: p.sku || p.producto_codigo_comercial || 'Sin SKU'
        }));
        setDuplicados(duplicadosMap);
        setVisible(true);
      } else {
        setDuplicados([]);
      }
    };

    const timeout = setTimeout(buscarLocalmente, 500);
    return () => clearTimeout(timeout);
  }, [nombreProducto, productosExistentes]);

  if (!visible || duplicados.length === 0 || !nombreProducto || nombreProducto.length < 3) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-3 mb-4 relative shadow-sm">
      <button
        onClick={() => setVisible(false)}
        className="absolute top-2 right-2 text-amber-400 hover:text-amber-600 transition-colors"
      >
        <X size={14} />
      </button>
      
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-bold text-amber-700 uppercase">⚠️ Posible producto duplicado</p>
          <p className="text-[10px] text-amber-600 mt-1">
            Ya existe un producto con nombre similar:
          </p>
          <ul className="mt-1 space-y-1">
            {duplicados.map((p, i) => (
              <li key={i} className="text-[10px] text-amber-700 font-mono">
                • <span className="font-bold">{p.producto_nombre}</span> 
                <span className="text-amber-500"> (SKU: {p.producto_codigo_comercial})</span>
              </li>
            ))}
          </ul>
          <p className="text-[9px] text-amber-500 mt-2">
            💡 Revisa si deseas continuar con la creación o editar el producto existente.
          </p>
        </div>
      </div>
    </div>
  );
}