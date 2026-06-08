// Fuente de verdad única de todas las secciones de la intranet.
// Agregar una nueva sección aquí la muestra automáticamente en:
//   - El sidebar (layout.tsx)
//   - El editor de permisos de perfil (usuarios/page.tsx)

export interface SectionItem {
  key: string;
  path: string;
  label: string;
}

export interface SectionGroup {
  group: string;
  items: SectionItem[];
}

export const SECTIONS_CONFIG: SectionGroup[] = [
  {
    group: "PRINCIPAL",
    items: [
      { key: "inicio",             path: "/",                   label: "Inicio" },
    ],
  },
  {
    group: "COMUNICACIÓN",
    items: [
      { key: "chat",               path: "/chat",               label: "Chat Interno" },
      { key: "tareas",             path: "/tareas",             label: "Tareas" },
    ],
  },
  {
    group: "ANÁLISIS & PRECIOS",
    items: [
      { key: "dashboard",            path: "/dashboard",            label: "Dashboard" },
      { key: "buscador-productos",   path: "/buscador-productos",   label: "Buscador de Productos" },
      { key: "busquedas-guardadas",  path: "/busquedas-guardadas",  label: "Mis Búsquedas" },
      { key: "historial-precios",    path: "/historial-precios",    label: "Historial de Precios" },
    ],
  },
  {
    group: "CRM & CLIENTES",
    items: [
      { key: "obuma-clientes",     path: "/obuma-clientes",     label: "Clientes Obuma" },
    ],
  },
  {
    group: "VENTAS",
    items: [
      { key: "ventas",        path: "/ventas",        label: "Ventas & Facturas" },
    ],
  },
  {
    group: "INVENTARIO & COMPRAS",
    items: [
      { key: "obuma-productos",    path: "/obuma-productos",    label: "Productos Obuma" },
      { key: "compras",            path: "/compras",            label: "Compras & Órdenes (OC)" },
      { key: "proveedores",        path: "/proveedores",        label: "Mis Proveedores" },
      { key: "obuma-proveedores",  path: "/obuma-proveedores",  label: "Proveedores Obuma" },
    ],
  },
  {
    group: "FINANZAS",
    items: [
      { key: "contabilidad",       path: "/contabilidad",       label: "Contabilidad" },
    ],
  },
  {
    group: "FORMACIÓN",
    items: [
      { key: "capacitaciones",     path: "/capacitaciones",     label: "Capacitaciones" },
    ],
  },
  {
    group: "ADMINISTRACIÓN",
    items: [
      { key: "usuarios",           path: "/usuarios",           label: "Usuarios" },
      { key: "dispositivos",       path: "/dispositivos",       label: "Dispositivos TI" },
    ],
  },
];

// Todos los items aplanados
export const ALL_SECTION_ITEMS = SECTIONS_CONFIG.flatMap(g => g.items);

// Objeto con todas las secciones habilitadas (para nuevos usuarios)
export function getDefaultSecciones(): Record<string, boolean> {
  return Object.fromEntries(ALL_SECTION_ITEMS.map(i => [i.key, true]));
}

// Dado un pathname, devuelve la key de la sección correspondiente
export function getSectionKeyForPath(pathname: string): string | null {
  const match = ALL_SECTION_ITEMS
    .filter(item => {
      if (item.path === "/") return pathname === "/";
      return pathname === item.path || pathname.startsWith(item.path + "/");
    })
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.key ?? null;
}

// Dado un conjunto de permisos, determina si el usuario accede a una sección.
// Admin/superuser siempre pasan — la verificación de rol debe hacerse antes.
export function puedeVerSeccion(
  secciones: Record<string, boolean> | null | undefined,
  key: string
): boolean {
  if (!secciones) return true; // sin restricciones configuradas → acceso total
  // Si la clave no existe en el objeto, la sección se agregó después → acceso por defecto
  if (!(key in secciones)) return true;
  return secciones[key] !== false;
}
