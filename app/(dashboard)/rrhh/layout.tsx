// app/(dashboard)/rrhh/layout.tsx
'use client';
import { useState } from 'react';
import { Users, LayoutDashboard, FileText, Calendar, Briefcase, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function RRHHLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/rrhh' },
  { name: 'Empleados', icon: Users, path: '/rrhh/empleados' },
  { name: 'Asistencias', icon: Calendar, path: '/rrhh/asistencias' },
  { name: 'Permisos', icon: FileText, path: '/rrhh/permisos' },
  { name: 'Contratos', icon: FileText, path: '/rrhh/contratos' },
  { name: 'Capacitaciones', icon: Briefcase, path: '/rrhh/capacitaciones' }, // ← NUEVO
  { name: 'Evaluaciones', icon: TrendingUp, path: '/rrhh/evaluaciones' },
];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="flex">
        {/* Sidebar RRHH */}
        <aside className="w-72 bg-white border-r border-slate-200 min-h-[calc(100vh-120px)] rounded-2xl shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2.5 rounded-xl text-white shadow-lg">
                <Users size={20} />
              </div>
              <div>
                <h2 className="font-black text-slate-800 text-lg uppercase italic">RRHH</h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Gestión de Talento</p>
              </div>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <item.icon size={18} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Contenido principal */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}