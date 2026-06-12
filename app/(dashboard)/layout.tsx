// app/(dashboard)/layout.tsx
"use client";
import { supabase } from "@/lib/supabase";
import { SECTIONS_CONFIG, getSectionKeyForPath, puedeVerSeccion, ALL_SECTION_ITEMS } from "@/lib/sections";
import {
  Home, MessageSquare, CheckSquare, BarChart3, Box, TrendingUp,
  Users, Building2, Database, Package, ShoppingCart,
  Laptop, LogOut, ChevronRight, ShieldCheck, Sparkles, X,
  BookOpen, Bookmark, GraduationCap,
  MapPin, BadgeCheck, FileSearch, Menu, Gavel, ExternalLink
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChatBot from "@/components/ChatBot";
import { ToastContainer } from "@/components/Toast";
import { PageLoader } from "@/components/ui/Spinner";
import { ConfirmHost } from "@/components/ui/Confirm";

// ─── Metadatos de vista ───────────────────────────────────────────────────────
const VIEW_META: Record<string, { id: string; label: string }> = {
  "/":                    { id: "MP-00",  label: "Inicio" },
  "/chat":                { id: "MP-CHT", label: "Chat Interno" },
  "/tareas":              { id: "MP-TAR", label: "Tareas" },
  "/dashboard":           { id: "MP-DSH", label: "Dashboard de Análisis" },
  "/viabilidad":          { id: "MP-VIA", label: "Viabilidad de Licitaciones" },
  "/buscador-productos":   { id: "MP-BUS", label: "Buscador de Productos" },
  "/busquedas-guardadas":  { id: "MP-BGD", label: "Mis Búsquedas" },
  "/historial-precios":      { id: "MP-HIS", label: "Historial de Precios" },
  "/georeferencia":          { id: "MP-GEO", label: "Georeferencia" },
  "/obuma-clientes":      { id: "MP-CLI", label: "Clientes Obuma" },
  "/proveedores":         { id: "MP-PRV", label: "Mis Proveedores" },
  "/obuma-proveedores":   { id: "MP-OPV", label: "Proveedores Obuma" },
  "/obuma-productos":     { id: "MP-PRD", label: "Productos Obuma" },
  "/compras":             { id: "MP-OC",  label: "Compras & Órdenes" },
  "/ventas":              { id: "MP-VTA", label: "Ventas" },
  "/contabilidad":        { id: "MP-CTB", label: "Contabilidad" },
  "/capacitaciones":      { id: "MP-CAP", label: "Capacitaciones" },
  "/usuarios":            { id: "MP-USR", label: "Usuarios" },
  "/dispositivos":        { id: "MP-DEV", label: "Dispositivos" },
  "/credenciales":        { id: "MP-CRD", label: "Credenciales PVC" },
};

// ─── Icono por sección (key → componente) ────────────────────────────────────
const SECTION_ICONS: Record<string, React.ElementType> = {
  "inicio":             Home,
  "chat":               MessageSquare,
  "tareas":             CheckSquare,
  "dashboard":          BarChart3,
  "viabilidad":         FileSearch,
  "buscador-productos":  Box,
  "busquedas-guardadas": Bookmark,
  "historial-precios":      TrendingUp,
  "georeferencia":          MapPin,
  "obuma-clientes":     Users,
  "ventas":             TrendingUp,
  "obuma-productos":    Package,
  "compras":            ShoppingCart,
  "proveedores":        Building2,
  "obuma-proveedores":  Database,
  "contabilidad":       BookOpen,
  "capacitaciones":     GraduationCap,
  "usuarios":           Users,
  "dispositivos":       Laptop,
  "credenciales":       BadgeCheck,
};

const PERM_LABELS: Record<string, string> = {
  can_assign_tasks:        "Asignar tareas",
  can_create_tasks:        "Crear tareas",
  can_view_billing:        "Ver facturación",
  can_manage_devices:      "Gestionar dispositivos",
  can_create_products:     "Crear productos",
  can_search_products_only:"Solo búsqueda de productos",
};

const ROL_LABEL: Record<string, string> = {
  superuser: "Super Usuario", admin: "Administrador", user: "Usuario",
  rrhh: "Recursos Humanos",   jefe: "Jefatura",       vendedor: "Vendedor",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail]   = useState("");
  const [userName, setUserName]     = useState("Cargando…");
  const [userRol, setUserRol]       = useState<string | null>(null);
  const [permisos, setPermisos]     = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [showPerms, setShowPerms]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // drawer móvil

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

  // Cerrar drawer móvil al navegar
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };

  const esAdminOSuper = userRol === 'admin' || userRol === 'superuser';
  const secciones: Record<string, boolean> | null | undefined = permisos?.secciones;

  // Determina si el usuario puede ver una sección
  const puedeVerSeccionFn = (key: string): boolean => {
    if (esAdminOSuper) return true;
    // Retrocompatibilidad: can_search_products_only restringe a productos
    if (permisos?.can_search_products_only === true) {
      return ["buscador-productos", "obuma-productos"].includes(key);
    }
    return puedeVerSeccion(secciones, key);
  };

  // ─── Redirect si accede directamente a una URL bloqueada ─────────────────
  useEffect(() => {
    if (isLoading || !permisos || esAdminOSuper) return;
    const currentKey = getSectionKeyForPath(pathname);
    if (!currentKey) return;
    if (!puedeVerSeccionFn(currentKey)) {
      const primerPermitido = ALL_SECTION_ITEMS.find(i => puedeVerSeccionFn(i.key));
      router.replace(primerPermitido?.path ?? "/");
    }
  }, [isLoading, pathname, permisos, userRol]);

  // ─── Sidebar filtrado por permisos de sección ─────────────────────────────
  const visibleSections = SECTIONS_CONFIG.map(group => ({
    title: group.group,
    items: group.items
      .filter(item => puedeVerSeccionFn(item.key))
      .map(item => ({
        name:  item.label,
        icon:  SECTION_ICONS[item.key] ?? Box,
        path:  item.path,
      })),
  })).filter(group => group.items.length > 0);

  const meta = VIEW_META[pathname] || {
    id: "MP-··",
    label: (pathname.split("/").filter(Boolean).pop() || "inicio").replace(/-/g, " "),
  };

  const permActivos = permisos
    ? Object.entries(permisos)
        .filter(([k, v]) => k !== "secciones" && v === true)
    : [];

  const fechaHoy = new Date().toLocaleDateString("es-CL", {
    weekday: "long", day: "numeric", month: "long",
  });

  // ─── Marca ────────────────────────────────────────────────────────────────
  // NOTA: estos bloques son constantes JSX (no componentes función) a propósito:
  // un componente definido dentro del render cambia de identidad en cada render
  // y React lo desmonta/remonta — eso reseteaba el scroll del sidebar al navegar.
  const brand = (
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-blue-900/40">
        <Sparkles className="w-5 h-5 text-white" />
        <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
      </div>
      <div className="leading-tight">
        <p className="font-black text-[15px] tracking-tight text-white">
          Comercial <span className="text-[#60A5FA]">MP</span>
        </p>
        <p className="text-[9px] font-bold tracking-[0.35em] text-slate-500">WORKSPACE</p>
      </div>
    </div>
  );

  // ─── Tarjeta usuario ──────────────────────────────────────────────────────
  const userCard = (
    <div className="relative">
      <AnimatePresence>
        {showPerms && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 480, damping: 32 }}
            className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 p-3 z-50 origin-bottom"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" /> Privilegios
              </span>
              <button onClick={() => setShowPerms(false)} className="p-1 -m-1 rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="mb-2">
              <span className="text-[9px] text-slate-400">Rol</span>
              <p className="text-xs font-bold text-[#2563EB]">{userRol ? (ROL_LABEL[userRol] || userRol) : "—"}</p>
            </div>
            {/* Secciones permitidas */}
            {!esAdminOSuper && secciones && (
              <div className="mb-2">
                <span className="text-[9px] text-slate-400">Secciones habilitadas</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ALL_SECTION_ITEMS
                    .filter(i => puedeVerSeccionFn(i.key))
                    .map(i => (
                      <span key={i.key} className="text-[8px] bg-emerald-50 text-emerald-600 border border-emerald-100 rounded px-1.5 py-0.5 font-bold">
                        {i.label}
                      </span>
                    ))}
                </div>
              </div>
            )}
            <div className="space-y-1">
              {permActivos.length
                ? permActivos.map(([k]) => (
                    <div key={k} className="flex items-center gap-2 text-[11px] text-slate-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" /> {PERM_LABELS[k] || k}
                    </div>
                  ))
                : <p className="text-[11px] text-slate-400">Privilegios estándar de su rol.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors ring-1 ring-inset ring-white/[0.06]">
        <div className="relative w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#2563EB] to-[#3B82F6] flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-blue-900/40">
          {userName.substring(0, 2).toUpperCase()}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#161F30]" title="En línea" />
        </div>
        <button onClick={() => setShowPerms(s => !s)} className="flex-1 overflow-hidden text-left">
          <p className="text-xs font-bold text-white truncate">{userName}</p>
          <p className="text-[9px] text-slate-400 truncate">{userEmail}</p>
          {userRol && (
            <span className="inline-flex items-center gap-1 mt-0.5 text-[8px] font-bold uppercase text-[#60A5FA]">
              <ShieldCheck className="w-2.5 h-2.5" /> {ROL_LABEL[userRol] || userRol}
            </span>
          )}
        </button>
        <button onClick={handleLogout} className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors" title="Cerrar sesión">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // ─── Navegación (compartida entre sidebar fijo y drawer móvil) ────────────
  const sidebarNav = (
    <nav className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
      {visibleSections.map((section, idx) => (
        <div key={idx} className="mb-5">
          <h3 className="px-3 text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">{section.title}</h3>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = pathname === item.path || (item.path !== "/" && pathname?.startsWith(item.path + "/"));
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors ${
                    isActive ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#2563EB]/30 to-[#2563EB]/5 ring-1 ring-inset ring-[#3B82F6]/25"
                      transition={{ type: "spring", stiffness: 480, damping: 38 }}
                    />
                  )}
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-bar"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-[#3B82F6]"
                      transition={{ type: "spring", stiffness: 480, damping: 38 }}
                    />
                  )}
                  <item.icon className={`relative w-[18px] h-[18px] transition-all ${isActive ? "text-[#60A5FA]" : "text-slate-500 group-hover:text-[#60A5FA] group-hover:scale-110"}`} />
                  <span className="relative truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {/* Herramientas externas */}
      <div className="mb-5">
        <h3 className="px-3 text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">Herramientas</h3>
        <a
          href="https://licitapyme-clone-1erz.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          <Gavel className="w-[18px] h-[18px] text-slate-500 group-hover:text-[#60A5FA] group-hover:scale-110 transition-all" />
          <span className="truncate">LicitaICA</span>
          <ExternalLink className="w-3 h-3 ml-auto text-slate-600 group-hover:text-slate-400 transition-colors" />
        </a>
      </div>
    </nav>
  );

  const sidebarInner = (
    <>
      <div className="px-5 py-6 border-b border-white/[0.06]">{brand}</div>
      {sidebarNav}
      <div className="p-3 border-t border-white/[0.06]">{userCard}</div>
    </>
  );

  // ─── Layout (único para todos los roles) ──────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* SIDEBAR escritorio */}
      <aside className="hidden lg:flex w-64 fixed h-full z-30 flex-col bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#1E293B] border-r border-white/[0.06]">
        {sidebarInner}
      </aside>

      {/* SIDEBAR móvil (drawer) */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-slate-900/55 backdrop-blur-[2px] lg:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#1E293B] shadow-2xl lg:hidden"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
            >
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-4 right-3 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                aria-label="Cerrar menú"
              >
                <X className="w-4.5 h-4.5" />
              </button>
              {sidebarInner}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* CONTENIDO */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* TOPBAR sticky con glassmorphism */}
        <header className="sticky top-0 z-20 glass border-b border-slate-200/70">
          <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-3 flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-mono text-[10px] font-bold tracking-wider text-white bg-gradient-to-r from-[#2563EB] to-[#3B82F6] px-2.5 py-1 rounded-md shadow-sm shrink-0">
              {meta.id}
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-bold text-slate-800 leading-none truncate capitalize">{meta.label}</h1>
              <p className="text-[10px] text-slate-400 mt-0.5 hidden sm:flex items-center gap-1">
                Comercial MP Workspace <ChevronRight className="w-2.5 h-2.5" /> <span className="capitalize">{meta.label}</span>
              </p>
            </div>
            <p className="ml-auto hidden md:block text-[11px] font-medium text-slate-400 capitalize">{fechaHoy}</p>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-[1600px] mx-auto">
            {isLoading ? (
              <PageLoader label="Cargando tu espacio de trabajo…" />
            ) : (
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.21, 1.02, 0.73, 1] }}
              >
                {children}
              </motion.div>
            )}
          </div>
        </main>
      </div>

      <ChatBot />
      <ToastContainer />
      <ConfirmHost />
    </div>
  );
}
