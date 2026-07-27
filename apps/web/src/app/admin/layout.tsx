import { apiServer } from "@/lib/api-server";
import type { User } from "@/lib/types";
import { AdminSidebarClient, type NavItem } from "./AdminSidebarClient";

function getInitials(name?: string, email?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (email?.[0] ?? "U").toUpperCase();
}

const IconResumen = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true">
    <rect x="0.5" y="7.5" width="3" height="7" rx="0.6" />
    <rect x="6" y="4" width="3" height="10.5" rx="0.6" />
    <rect x="11.5" y="0.5" width="3" height="14" rx="0.6" />
  </svg>
);

const IconCampanas = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 11V4.5L11 2V13L2 11Z" />
    <path d="M2 7.5h9" />
    <path d="M2 11l-1 2.5" />
  </svg>
);

const IconFirmas = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2l3 3-7 7H3v-3l7-7Z" />
    <path d="M8 4l3 3" />
    <path d="M1 14h4" />
  </svg>
);

const IconOrganizaciones = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true">
    <path d="M1 14V6L7.5 2.5 14 6V14H1Z" opacity="0.9" />
    <rect x="4" y="8.5" width="2.5" height="5.5" rx="0.4" fill="var(--bink)" opacity="0.55" />
    <rect x="8.5" y="8.5" width="2.5" height="5.5" rx="0.4" fill="var(--bink)" opacity="0.55" />
    <rect x="5.5" y="5" width="4" height="2.5" rx="0.4" fill="var(--bink)" opacity="0.45" />
  </svg>
);

const IconUsuarios = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true">
    <circle cx="5.5" cy="4.5" r="2.5" opacity="0.85" />
    <path d="M0.5 13c0-2.76 2.24-5 5-5s5 2.24 5 5H0.5Z" opacity="0.85" />
    <circle cx="11" cy="4" r="2" opacity="0.55" />
    <path d="M11 9c1.93 0 3.5 1.57 3.5 3.5V13H10" opacity="0.55" />
  </svg>
);

const IconConfiguracion = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
    <circle cx="7.5" cy="7.5" r="2" />
    <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.93 2.93l1.06 1.06M11 11l1.07 1.07M2.93 12.07l1.06-1.06M11 4l1.07-1.07" />
  </svg>
);

const IconCategorias = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
    <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
  </svg>
);

const IconPrivacidad = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7.5 1L2 3.5V7c0 3.3 2.4 5.8 5.5 6.5C10.6 12.8 13 10.3 13 7V3.5L7.5 1Z" />
    <path d="M5 7.5l2 2 3.5-3.5" />
  </svg>
);

const ALL_NAV: (NavItem & { roles: string[] })[] = [
  { href: "/admin/resumen",              label: "Resumen",         icon: <IconResumen />,       roles: ["admin"] },
  { href: "/admin/campanas",             label: "Campañas",        icon: <IconCampanas />,      roles: ["admin", "gestor"] },
  { href: "/admin/firmas",               label: "Firmas",          icon: <IconFirmas />,        roles: ["admin", "gestor"] },
  { href: "/admin/organizaciones",       label: "Organizaciones",  icon: <IconOrganizaciones />,roles: ["admin"] },
  { href: "/admin/categorias",           label: "Categorías",      icon: <IconCategorias />,    roles: ["admin"] },
  { href: "/admin/politicas-privacidad", label: "Privacidad",      icon: <IconPrivacidad />,    roles: ["admin"] },
  { href: "/admin/usuarios",             label: "Usuarios",        icon: <IconUsuarios />,      roles: ["admin"] },
  { href: "/admin/configuracion",        label: "Configuración",   icon: <IconConfiguracion />, roles: ["admin"] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await apiServer<User>("/v1/auth/me");

  const role = user?.role ?? "gestor";
  const navItems: NavItem[] = ALL_NAV.filter((item) => item.roles.includes(role)).map(
    ({ href, label, icon }) => ({ href, label, icon })
  );

  const userName = user?.full_name ?? user?.email?.split("@")[0] ?? "Usuario";
  const userEmail = user?.email ?? "";
  const userInitials = getInitials(user?.full_name, user?.email);

  return (
    <div
      id="admin-shell"
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: "var(--bbg)" }}
      suppressHydrationWarning
    >
      {/* Aplica el estado de colapso guardado ANTES del primer paint, para evitar
          parpadeo (R4): se ejecuta de forma síncrona mientras el parser procesa
          el HTML, antes de que React hidrate. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{if(localStorage.getItem('admin.sidebar.collapsed')==='true'){document.getElementById('admin-shell').setAttribute('data-collapsed','true');}}catch(e){}})();",
        }}
      />
      <AdminSidebarClient
        navItems={navItems}
        userName={userName}
        userEmail={userEmail}
        userInitials={userInitials}
      />
      <main
        className="flex-1 min-w-0 overflow-y-auto"
        style={{ backgroundColor: "var(--bbg)" }}
      >
        {children}
      </main>
    </div>
  );
}
