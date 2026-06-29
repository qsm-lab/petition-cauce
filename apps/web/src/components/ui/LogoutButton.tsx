"use client";

import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full text-left px-3 py-2 rounded text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
    >
      Cerrar sesión
    </button>
  );
}
