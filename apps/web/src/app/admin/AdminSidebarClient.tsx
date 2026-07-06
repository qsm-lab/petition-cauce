"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

type Props = {
  navItems: NavItem[];
  userName: string;
  userEmail: string;
  userInitials: string;
};

export function AdminSidebarClient({ navItems, userName, userEmail, userInitials }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <aside
      className="flex flex-col h-screen overflow-y-auto flex-shrink-0"
      style={{ width: "220px", backgroundColor: "var(--bink)" }}
    >
      {/* Logo */}
      <div
        className="px-[18px] pt-5 pb-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="w-[30px] h-[30px] flex items-center justify-center rounded-[9px] flex-shrink-0"
            style={{ backgroundColor: "#D7F24C" }}
          >
            <span className="font-display text-[16px] leading-none" style={{ color: "#16261F" }}>C</span>
          </span>
          <span className="font-body font-bold text-[14px] text-white leading-tight">
            Cauce Petition
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav role="navigation" aria-label="Menú principal" className="flex-1 py-2.5">
        <ul className="flex flex-col" style={{ gap: "1px" }}>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href} className="mx-2">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-[10px] text-[13px] w-full transition-colors duration-100 ${
                    isActive ? "font-bold" : "font-medium text-white/55 hover:text-white/85"
                  }`}
                  style={{
                    padding: "10px 16px",
                    backgroundColor: isActive ? "#D7F24C" : "transparent",
                    color: isActive ? "#16261F" : undefined,
                  }}
                >
                  <span className="flex-shrink-0 w-[15px] h-[15px] flex items-center justify-center" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div
        className="px-4 py-3.5 flex items-center gap-2.5"
        style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "color-mix(in srgb, var(--bp) 45%, transparent)" }}
        >
          <span className="font-display font-bold text-[13px] text-white leading-none">
            {userInitials}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold text-white truncate">{userName}</p>
          <p className="truncate text-[10.5px] text-white/40">{userEmail}</p>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 transition-colors"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5.5 7.5h7M10 5l2.5 2.5L10 10" />
            <path d="M8 3H2.5A.5.5 0 002 3.5v8a.5.5 0 00.5.5H8" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
