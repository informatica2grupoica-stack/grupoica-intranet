"use client";
import React, { useState, useEffect } from "react";
import { BarChart3, Loader2 } from "lucide-react";

interface CategoriaData {
  nombre: string;
  cantidad: number;
}

interface CategoriaAPI {
  producto_categoria_id: string;
  producto_categoria_nombre: string;
}

interface ProductoAPI {
  categoria_nombre: string;
  stock_actual?: number;
  nombre?: string;
}

export default function ProductosChart() {
  const [data, setData] = useState<CategoriaData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarCategorias = async () => {
      try {
        const res = await fetch('/api/obuma/categorias');
        const categorias: CategoriaAPI[] = await res.json();
        
        const resProd = await fetch('/api/obuma/productos/list?limit=2000');
        const prodData = await resProd.json();
        const productos: ProductoAPI[] = prodData.data || [];
        
        const conteo: CategoriaData[] = categorias
          .map((cat: CategoriaAPI) => ({
            nombre: cat.producto_categoria_nombre,
            cantidad: productos.filter((p: ProductoAPI) => p.categoria_nombre === cat.producto_categoria_nombre).length
          }))
          .filter((item: CategoriaData) => item.cantidad > 0)
          .slice(0, 8);
        
        setData(conteo);
      } catch (error) {
        console.error("Error cargando categorías:", error);
      } finally {
        setLoading(false);
      }
    };
    
    cargarCategorias();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-[#2563EB]" size={32} />
        </div>
      </div>
    );
  }

  const maxCantidad = Math.max(...data.map((d: CategoriaData) => d.cantidad), 1);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center"><BarChart3 size={17} /></span>
        <h3 className="text-sm font-black uppercase text-slate-600">Productos por Categoría</h3>
      </div>
      
      {data.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          No hay datos de categorías disponibles
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((cat: CategoriaData, idx: number) => (
            <div key={idx}>
              <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                <span className="uppercase truncate">{cat.nombre}</span>
                <span className="flex-shrink-0 ml-2">{cat.cantidad} productos</span>
              </div>
              <div className="h-6 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#2563EB] to-[#3B82F6] rounded-full transition-all duration-500"
                  style={{ width: `${(cat.cantidad / maxCantidad) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}