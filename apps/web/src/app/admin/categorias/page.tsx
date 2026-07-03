import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api-server";
import type { User } from "@/lib/types";
import type { Category } from "@/lib/admin-categories-api";
import CategoriasList from "./CategoriasList";

export default async function CategoriasPage() {
  const user = await apiServer<User>("/v1/auth/me");
  if (!user || user.role !== "admin") redirect("/admin/campanas");

  const categories = await apiServer<Category[]>("/v1/admin/categories") ?? [];

  return (
    <div>
      <header
        className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--bsurf)", borderBottom: "1px solid var(--bbord)" }}
      >
        <div>
          <h1 className="font-display font-bold text-[18px]" style={{ color: "var(--bink)" }}>
            Categorías
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--bmut)" }}>
            Etiquetas para clasificar campañas
          </p>
        </div>
      </header>

      <div className="p-6 animate-pc-rise">
        <CategoriasList initialCategories={categories} />
      </div>
    </div>
  );
}
