// components/rrhh/DashboardAvanzado.tsx
'use client';
import { useEffect, useState } from 'react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Users, TrendingUp, Calendar, Award, Loader2 } from 'lucide-react';

interface DashboardData {
  totalEmpleados: number;
  areas: { name: string; value: number }[];
  cargos: { name: string; value: number }[];
  antiguedad: { name: string; value: number }[];
  asistencia: {
    presente: number;
    ausente: number;
    tarde: number;
  };
}

export default function DashboardAvanzado() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const response = await fetch('/api/rrhh/dashboard-avanzado');
        const result = await response.json();
        if (response.ok) {
          setData(result.data);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, []);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec489a'];

  // Formateador personalizado para el label del PieChart
  const renderCustomLabel = ({ name, percent }: { name?: string; percent?: number }) => {
    if (!name || percent === undefined) return '';
    return `${name}: ${(percent * 100).toFixed(0)}%`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">No hay datos disponibles</p>
      </div>
    );
  }

  const asistenciaData = [
    { name: 'Presente', value: data.asistencia.presente },
    { name: 'Ausente', value: data.asistencia.ausente },
    { name: 'Tarde', value: data.asistencia.tarde },
  ];

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400">Total Empleados</p>
              <p className="text-3xl font-black text-slate-800 mt-1">{data.totalEmpleados}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-xl">
              <Users size={24} className="text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400">Asistencia</p>
              <p className="text-3xl font-black text-emerald-600 mt-1">{data.asistencia.presente}%</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-xl">
              <Calendar size={24} className="text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400">Ausentismo</p>
              <p className="text-3xl font-black text-amber-600 mt-1">{data.asistencia.ausente}%</p>
            </div>
            <div className="bg-amber-100 p-3 rounded-xl">
              <TrendingUp size={24} className="text-amber-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase text-slate-400">Tardanzas</p>
              <p className="text-3xl font-black text-red-500 mt-1">{data.asistencia.tarde}%</p>
            </div>
            <div className="bg-red-100 p-3 rounded-xl">
              <Award size={24} className="text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por Área */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 mb-4">Distribución por Área</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.areas}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución por Cargo (Top 5) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 mb-4">Principales Cargos</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.cargos.slice(0, 5)}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {data.cargos.slice(0, 5).map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Antigüedad */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 mb-4">Antigüedad en la Empresa</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.antiguedad} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={80} />
              <Tooltip />
              <Bar dataKey="value" fill="#10b981" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Asistencia */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <h3 className="text-sm font-black text-slate-800 mb-4">Resumen de Asistencia</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={asistenciaData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                <Cell fill="#10b981" />
                <Cell fill="#ef4444" />
                <Cell fill="#f59e0b" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}