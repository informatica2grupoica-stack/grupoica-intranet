"use client";
import React from "react";
import { Package, TrendingUp, DollarSign, AlertTriangle, TrendingDown } from "lucide-react";

interface StatsCardsProps {
  stats: {
    total_productos: number;
    total_stock: number;
    total_valor_inventario: number;
    productos_con_stock_bajo: number;
    productos_sin_stock: number;
    categorias_count: number;
    precio_promedio: number;
  };
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const formatPrice = (price: number) => {
    return `$${price?.toLocaleString('es-CL') || 0}`;
  };

  const cards = [
    {
      titulo: "Total Productos",
      valor: stats.total_productos,
      icono: Package,
      color: "bg-blue-500",
      descripcion: `${stats.categorias_count} categorías`,
      trend: null
    },
    {
      titulo: "Stock Total",
      valor: stats.total_stock,
      icono: TrendingUp,
      color: "bg-emerald-500",
      descripcion: "unidades en inventario",
      trend: "up"
    },
    {
      titulo: "Valor Inventario",
      valor: formatPrice(stats.total_valor_inventario),
      icono: DollarSign,
      color: "bg-purple-500",
      descripcion: "valor total en CLP",
      trend: "up"
    },
    {
      titulo: "Alertas",
      valor: stats.productos_con_stock_bajo + stats.productos_sin_stock,
      icono: AlertTriangle,
      color: "bg-amber-500",
      descripcion: `${stats.productos_con_stock_bajo} stock bajo, ${stats.productos_sin_stock} sin stock`,
      trend: "down"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                {card.titulo}
              </p>
              <p className="text-2xl font-black text-slate-800 mt-1">{card.valor}</p>
              <p className="text-[9px] text-slate-400 mt-1">{card.descripcion}</p>
            </div>
            <div className={`${card.color} p-2 rounded-xl text-white`}>
              <card.icono size={18} />
            </div>
          </div>
          {card.trend === "up" && (
            <div className="flex items-center gap-1 mt-3 text-[9px] text-emerald-500">
              <TrendingUp size={10} /> Tendencia positiva
            </div>
          )}
          {card.trend === "down" && (
            <div className="flex items-center gap-1 mt-3 text-[9px] text-amber-500">
              <TrendingDown size={10} /> Requiere atención
            </div>
          )}
        </div>
      ))}
    </div>
  );
}