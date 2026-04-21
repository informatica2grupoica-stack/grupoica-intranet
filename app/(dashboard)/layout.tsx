"use client";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  LogOut,
  ShoppingBag,
  Briefcase,
  Database,
  Box,
  FileText,
  Laptop,
  ChevronRight,
  ExternalLink,
  CheckSquare,
  Truck,
  TrendingUp,
  BarChart3  // Agregado para el Dashboard
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// --- IMPORTACIÓN DEL COMPONENTE IA ---
import ChatBot from "@/components/ChatBot";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("Cargando...");

  useEffect(() => {
    const getUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUserEmail(session.user.email || "");

        const { data: perfil } = await supabase
          .from('perfiles')
          .select('nombre')
          .eq('user_id', session.user.id)
          .single();

        if (perfil && perfil.nombre) {
          setUserName(perfil.nombre);
        } else {
          setUserName(session.user.email?.split('@')[0] || "Usuario");
        }
      }
    };

    getUserData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const sections = [
    {
      title: "Menu",
      items: [{ name: "Inicio", icon: LayoutDashboard, path: "/" }]
    },
    {
      title: "Comunicación y Flujo",
      items: [
        { name: "Chat Interno", icon: MessageSquare, path: "/chat" },
        { name: "Tareas", icon: CheckSquare, path: "/tareas" },
      ]
    },
    {
      title: "Analisis de productos",
      items: [
        { name: "Dashboard", icon: BarChart3, path: "/dashboard" },  // ← NUEVO DASHBOARD
        { name: "Buscador Productos", icon: Box, path: "/buscador-productos" },
        { name: "Historial de Precios", icon: TrendingUp, path: "/historial-precios" }
      ]
    },
    {
      title: "CRM",
      items: [
        { name: "Clientes Obuma", icon: Users, path: "/obuma-clientes" },
      ]
    },
    {
      title: "Logística",
      items: [{ name: "Proveedores", icon: Truck, path: "/proveedores" }]
    },
    {
      title: "Recursos Humanos",
      items: [
        {
          name: "Genera (RRHH)",
          icon: Briefcase,
          path: "https://portal360middleware.genera.cl/Account/Login?ReturnUrl=%2Fconnect%2Fauthorize%2Fcallback%3Fclient_id%3Dconsole%26scope%3Dopenid%2520email%2520console-api%26response_type%3Dcode%26acr_values%3Dtenant%253A93053F8F-8ACE-4ED3-881A-E348545F22B6%26redirect_uri%3Dhttps%253A%252F%252Fportal360comunicacion.genera.cl%252Fcallback%26state%3D6c3033c802788bfbb99af54c1e5b40d7154cf64e20201ca287043edc6589c297%26response_mode%3Dfragment",
          external: true
        }
      ]
    },
    {
      title: "OBUMA",
      items: [
        { name: "Documentos (DTE)", icon: FileText, path: "/dte", hasSub: true },
        { name: "Productos", icon: Database, path: "/obuma-productos" },
        { name: "Ordenes de Compras", icon: ShoppingBag, path: "/compras" },
      ]
    },
    {
      title: "Administración",
      items: [
        { name: "Usuarios", icon: Users, path: "/usuarios" },
        { name: "Dispositivos", icon: Laptop, path: "/dispositivos" },
      ]
    }
  ];

  return (
    <div className="flex min-h-screen bg-[#f8faff]">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-100 flex flex-col fixed h-full z-20">

        <div className="px-8 py-10 flex justify-center items-center">
          <div className="relative group cursor-pointer">
            <img
              src="https://i.postimg.cc/NMhmBtKx/logo.webp"
              alt="Grupo ICA"
              className="h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute -inset-2 bg-blue-500/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* NAVEGACIÓN */}
        <nav className="flex-1 overflow-y-auto px-4 custom-scrollbar">
          {sections.map((section, idx) => (
            <div key={idx} className="mb-6">
              <h3 className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.path;
                  const commonClasses = `flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                      ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100/50'
                      : 'text-slate-600 hover:bg-slate-50'
                    }`;

                  const content = (
                    <>
                      <div className="flex items-center gap-3">
                        <item.icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                        {item.name}
                      </div>
                      {(item as any).external && <ExternalLink className="w-3 h-3 text-slate-300" />}
                      {(item as any).hasSub && <ChevronRight className="w-3 h-3 text-slate-300" />}
                    </>
                  );

                  return (item as any).external ? (
                    <a
                      key={item.path}
                      href={item.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={commonClasses}
                    >
                      {content}
                    </a>
                  ) : (
                    <Link key={item.path} href={item.path} className={commonClasses}>
                      {content}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* PERFIL DE USUARIO */}
        <div className="p-4 border-t border-slate-50 bg-slate-50/30">
          <div className="flex items-center gap-3 p-2 rounded-2xl hover:bg-white hover:shadow-sm transition-all group relative border border-transparent hover:border-slate-100">
            <div className="w-10 h-10 bg-[#00338d] rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-blue-900/10">
              {userName.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden text-left">
              <p className="text-xs font-bold text-slate-800 truncate">
                {userName}
              </p>
              <p className="text-[9px] text-slate-400 truncate tracking-tight">{userEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          {/* BREADCRUMB */}
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-8 px-4 bg-white/50 w-fit py-2 rounded-full border border-slate-100 shadow-sm">
            <LayoutDashboard className="w-3 h-3 text-blue-500" />
            <span>Sistema Central</span>
            <ChevronRight className="w-2.5 h-2.5 opacity-50" />
            <span className="text-slate-600">
              {pathname === "/" ? "Inicio" : pathname.split('/').pop()?.replace("-", " ")}
            </span>
          </div>

          <div className="px-4">
            {children}
          </div>
        </div>
      </main>

      {/* --- BOT FLOTANTE --- */}
      <ChatBot />
    </div>
  );
}