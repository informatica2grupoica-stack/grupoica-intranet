// app/(dashboard)/layout.tsx
"use client";
import { supabase } from "@/lib/supabase";
import {
  Home, MessageSquare, CheckSquare, BarChart3, Box, TrendingUp,
  Users, Building2, Database, FileText, Package, ShoppingCart,
  Laptop, LogOut, ChevronRight, ShieldCheck, Sparkles, X,
  BookOpen, CreditCard, Receipt, Briefcase
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ChatBot from "@/components/ChatBot";
import { ToastContainer } from "@/components/Toast";

// ─── Identidad y metadatos de cada vista (identificador por vista) ────────────
const VIEW_META: Record<string, { id: string; label: string }> = {
  "/":                    { id: "MP-00",  label: "Inicio" },
  "/chat":                { id: "MP-CHT", label: "Chat Interno" },
  "/tareas":              { id: "MP-TAR", label: "Tareas" },
  "/dashboard":           { id: "MP-DSH", label: "Dashboard de Análisis" },
  "/buscador-productos":  { id: "MP-BUS", label: "Buscador de Productos" },
  "/historial-precios":   { id: "MP-HIS", label: "Historial de Precios" },
  "/obuma-clientes":      { id: "MP-CLI", label: "Clientes Obuma" },
  "/proveedores":         { id: "MP-PRV", label: "Mis Proveedores" },
  "/obuma-proveedores":   { id: "MP-OPV", label: "Proveedores Obuma" },
  "/obuma-productos":     { id: "MP-PRD", label: "Productos Obuma" },
  "/compras":             { id: "MP-OC",  label: "Compras & Órdenes" },
  "/ventas":              { id: "MP-VTA", label: "Ventas" },
  "/contabilidad":        { id: "MP-CTB", label: "Contabilidad" },
  "/usuarios":            { id: "MP-USR", label: "Usuarios" },
  "/dispositivos":        { id: "MP-DEV", label: "Dispositivos" },
};

// Etiquetas legibles de privilegios (campo perfiles.permisos)
const PERM_LABELS: Record<string, string> = {
  can_assign_tasks: "Asignar tareas",
  can_create_tasks: "Crear tareas",
  can_view_billing: "Ver facturación",
  can_manage_devices: "Gestionar dispositivos",
  can_create_products: "Crear productos",
  can_search_products_only: "Solo búsqueda de productos",
};

const ROL_LABEL: Record<string, string> = {
  superuser: "Super Usuario", admin: "Administrador", user: "Usuario",
  rrhh: "Recursos Humanos", jefe: "Jefatura", vendedor: "Vendedor",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("Cargando…");
  const [userRol, setUserRol] = useState<string | null>(null);
  const [permisos, setPermisos] = useState<Record<string, boolean> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPerms, setShowPerms] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || "");
        const { data: perfil } = await supabase
          .from("perfiles").select("nombre, rol, id, permisos")
          .eq("user_id", session.user.id).single();
        if (perfil) {
          setUserName(perfil.nombre);
          setUserRol(perfil.rol);
          setPermisos(perfil.permisos || {});
        } else {
          setUserName(session.user.email?.split("@")[0] || "Usuario");
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };

  const isOnlyProductsUser = permisos?.can_search_products_only === true;
  useEffect(() => {
    if (!isLoading && isOnlyProductsUser) {
      const allowed = ["/buscador-productos", "/obuma-productos"];
      if (!allowed.includes(pathname)) router.push("/buscador-productos");
    }
  }, [isLoading, isOnlyProductsUser, pathname, router]);

  const sections = [
    {
      title: "PRINCIPAL",
      items: [{ name: "Inicio", icon: Home, path: "/" }],
    },
    {
      title: "COMUNICACIÓN",
      items: [
        { name: "Chat Interno", icon: MessageSquare, path: "/chat" },
        { name: "Tareas", icon: CheckSquare, path: "/tareas" },
      ],
    },
    {
      title: "ANÁLISIS & PRECIOS",
      items: [
        { name: "Dashboard", icon: BarChart3, path: "/dashboard" },
        { name: "Buscador de Productos", icon: Box, path: "/buscador-productos" },
        { name: "Historial de Precios", icon: TrendingUp, path: "/historial-precios" },
      ],
    },
    {
      title: "CRM & CLIENTES",
      items: [
        { name: "Clientes Obuma", icon: Users, path: "/obuma-clientes" },
      ],
    },
    {
      title: "VENTAS",
      items: [
        { name: "Ventas / Cotizaciones", icon: TrendingUp, path: "/ventas" },
      ],
    },
    {
      title: "INVENTARIO & COMPRAS",
      items: [
        { name: "Productos Obuma", icon: Package, path: "/obuma-productos" },
        { name: "Compras & Órdenes (OC)", icon: ShoppingCart, path: "/compras" },
        { name: "Mis Proveedores", icon: Building2, path: "/proveedores" },
        { name: "Proveedores Obuma", icon: Database, path: "/obuma-proveedores" },
      ],
    },
    {
      title: "FINANZAS",
      items: [
        { name: "Contabilidad", icon: BookOpen, path: "/contabilidad" },
      ],
    },
    {
      title: "ADMINISTRACIÓN",
      items: [
        { name: "Usuarios", icon: Users, path: "/usuarios" },
        { name: "Dispositivos TI", icon: Laptop, path: "/dispositivos" },
      ],
    },
  ];

  const meta = VIEW_META[pathname] || { id: "MP-··", label: (pathname.split("/").filter(Boolean).pop() || "inicio").replace(/-/g, " ") };
  const permActivos = permisos ? Object.entries(permisos).filter(([, v]) => v === true) : [];

  // ─── Marca ─────────────────────────────────────────────────────────────────
  const Brand = ({ dark = true }: { dark?: boolean }) => (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center shadow-lg shadow-blue-900/30">
        <Sparkles className="w-5 h-5 text-white" />
      </div>
      <div className="leading-tight">
        <p className={`font-black text-[15px] tracking-tight ${dark ? "text-white" : "text-slate-800"}`}>
          Comercial <span className="text-[#10B981]">MP</span>
        </p>
        <p className={`text-[9px] font-bold tracking-[0.35em] ${dark ? "text-slate-400" : "text-slate-400"}`}>WORKSPACE</p>
      </div>
    </div>
  );

  // ─── Tarjeta de usuario + privilegios ────────────────────────────────────────
  const UserCard = () => (
    <div className="relative">
      {showPerms && (
        <div className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" /> Privilegios
            </span>
            <button onClick={() => setShowPerms(false)} className="text-slate-300 hover:text-slate-500"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="mb-2">
            <span className="text-[9px] text-slate-400">Rol</span>
            <p className="text-xs font-bold text-[#059669]">{userRol ? (ROL_LABEL[userRol] || userRol) : "—"}</p>
          </div>
          <div className="space-y-1">
            {permActivos.length ? permActivos.map(([k]) => (
              <div key={k} className="flex items-center gap-2 text-[11px] text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" /> {PERM_LABELS[k] || k}
              </div>
            )) : <p className="text-[11px] text-slate-400">Privilegios estándar de su rol.</p>}
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-white/5">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-blue-900/40">
          {userName.substring(0, 2).toUpperCase()}
        </div>
        <button onClick={() => setShowPerms(s => !s)} className="flex-1 overflow-hidden text-left">
          <p className="text-xs font-bold text-white truncate">{userName}</p>
          <p className="text-[9px] text-slate-400 truncate">{userEmail}</p>
          {userRol && (
            <span className="inline-flex items-center gap-1 mt-0.5 text-[8px] font-bold uppercase text-[#10B981]">
              <ShieldCheck className="w-2.5 h-2.5" /> {ROL_LABEL[userRol] || userRol}
            </span>
          )}
        </button>
        <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-400 transition-colors" title="Cerrar sesión">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // ─── Vista restringida (solo productos) ──────────────────────────────────────
  if (isOnlyProductsUser) {
    return (
      <div className="flex min-h-screen bg-[#F3F4F6]">
        <main className="flex-1 p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <Brand dark={false} />
              <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                <LogOut className="w-4 h-4" /> Cerrar Sesión
              </button>
            </div>
            {children}
          </div>
        </main>
        <ChatBot />
        <ToastContainer />
      </div>
    );
  }

  // ─── Layout completo ─────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#F3F4F6]">
      {/* SIDEBAR */}
      <aside className="w-64 fixed h-full z-20 flex flex-col bg-gradient-to-b from-[#111827] to-[#1F2937] border-r border-white/5">
        <div className="px-5 py-6 border-b border-white/5"><Brand /></div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
          {sections.map((section, idx) => (
            <div key={idx} className="mb-5">
              <h3 className="px-3 text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">{section.title}</h3>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.path || pathname?.startsWith(item.path + "/");
                  const cls = `group flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all relative ${
                    isActive ? "bg-gradient-to-r from-[#059669]/25 to-transparent text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`;
                  const content = (
                    <>
                      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-[#10B981]" />}
                      <span className="flex items-center gap-3">
                        <item.icon className={`w-[18px] h-[18px] transition-colors ${isActive ? "text-[#10B981]" : "text-slate-500 group-hover:text-[#10B981]"}`} />
                        {item.name}
                      </span>
                      {(item as any).hasSub && <ChevronRight className="w-3 h-3 text-slate-600" />}
                    </>
                  );
                  return (item as any).external
                    ? <a key={item.path} href={item.path} target="_blank" rel="noopener noreferrer" className={cls}>{content}</a>
                    : <Link key={item.path} href={item.path} className={cls}>{content}</Link>;
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5"><UserCard /></div>
      </aside>

      {/* CONTENIDO */}
      <main className="flex-1 ml-64 p-6 md:p-8">
        <div className="max-w-[1600px] mx-auto">
          {/* HEADER con identificador de vista */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-7">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] font-bold tracking-wider text-white bg-gradient-to-r from-[#059669] to-[#10B981] px-2.5 py-1 rounded-md shadow-sm">
                {meta.id}
              </span>
              <div>
                <h1 className="text-lg font-black text-slate-800 leading-none">{meta.label}</h1>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  Comercial MP Workspace <ChevronRight className="w-2.5 h-2.5" /> {meta.label}
                </p>
              </div>
            </div>
          </div>
          {children}
        </div>
      </main>

      <ChatBot />
      <ToastContainer />
    </div>
  );
}
