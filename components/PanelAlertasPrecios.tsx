"use client";
import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus, Store } from 'lucide-react';

export default function PanelAlertasPrecios() {
  const [alertas, setAlertas] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/analizar-precios')
      .then(res => res.json())
      .then(data => setAlertas(data));
  }, []);

  return (
    <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
          Alertas de Mercado (Histórico)
        </h2>
      </div>

      <div className="space-y-3">
        {alertas.map((alerta, i) => (
          <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-orange-200 transition-all">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${
                alerta.tendencia === 'BAJA' ? 'bg-emerald-100 text-emerald-600' : 
                alerta.tendencia === 'SUBE' ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-500'
              }`}>
                {alerta.tendencia === 'BAJA' ? <TrendingDown size={20} /> : 
                 alerta.tendencia === 'SUBE' ? <TrendingUp size={20} /> : <Minus size={20} />}
              </div>
              <div>
                <p className="text-[13px] font-black text-slate-800 uppercase leading-none mb-1">
                  {alerta.producto}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase">
                  <Store size={10} /> {alerta.tienda}
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-black text-slate-900 italic">
                ${alerta.precio_actual.toLocaleString('es-CL')}
              </p>
              <p className={`text-[10px] font-black ${
                alerta.tendencia === 'BAJA' ? 'text-emerald-500' : 
                alerta.tendencia === 'SUBE' ? 'text-rose-500' : 'text-slate-400'
              }`}>
                {alerta.tendencia === 'BAJA' ? '-' : alerta.tendencia === 'SUBE' ? '+' : ''}
                ${Math.abs(alerta.diferencia).toLocaleString('es-CL')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}