"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full min-h-[48px] px-4 rounded-[16px] text-[15px] " +
  "bg-brand-bg text-brand-ink border-[1.5px] border-brand-border " +
  "placeholder:text-brand-muted " +
  "focus:outline-none focus:border-brand-primary " +
  "focus:ring-2 focus:ring-[color-mix(in_srgb,var(--bp)_30%,transparent)] " +
  "transition-colors duration-150";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        setError("Correo o contraseña incorrectos");
        return;
      }

      router.push("/admin/resumen");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <div className="w-full max-w-sm mx-4 bg-brand-surface rounded-petition border border-brand-border shadow-petition p-8">

        {/* Marca */}
        <div className="mb-8 text-center">
          <span className="inline-flex items-center justify-center gap-2">
            <span className="text-[22px]">🌿</span>
            <span
              className="font-display font-bold text-[22px] text-brand-ink tracking-tight"
              style={{ fontFamily: "var(--font-poppins, sans-serif)" }}
            >
              Cauce <span className="text-brand-primary">Petition</span>
            </span>
          </span>
          <p className="mt-1 text-[12.5px] text-brand-muted">Panel de administración</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-brand-ink">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@cauce.ec"
              className={inputClass}
            />
          </div>

          {/* Password con toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-brand-ink">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={inputClass + " pr-12"}
              />
              <button
                type="button"
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-brand-muted hover:text-brand-ink transition-colors"
              >
                {showPass ? (
                  /* ojo tachado */
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  /* ojo abierto */
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-[13px] text-[#d9483b] text-center -mt-1">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full min-h-[52px] rounded-pill font-display font-bold text-[16px]
              bg-brand-primary text-brand-on-primary
              shadow-[0_8px_22px_color-mix(in_srgb,var(--bp)_32%,transparent)]
              hover:brightness-110 active:scale-[0.98]
              disabled:opacity-60 disabled:cursor-not-allowed
              transition-all duration-150"
            style={{ fontFamily: "var(--font-poppins, sans-serif)" }}
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>

        </form>
      </div>
    </div>
  );
}
