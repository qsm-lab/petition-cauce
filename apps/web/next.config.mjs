// next.config.mjs — proy_petition-cauce
// Compatible con Next.js 14 — usa JSDoc para mantener el tipado en el editor

const isDev = process.env.NODE_ENV === "development";

// En dev la API corre en localhost:8011; en prod va por /api/ mismo dominio
const connectSrc = [
  "'self'",
  "https://challenges.cloudflare.com",
  ...(isDev ? ["http://localhost:8011"] : []),
].join(" ");

// Imágenes del centro de comunicaciones (GET /media/...) sirven desde la API
// — mismo origen dev-only que connect-src, por la misma razón (http en dev,
// https vía /api/ en prod).
const imgSrc = [
  "'self'",
  "data:",
  "https:",
  ...(isDev ? ["http://localhost:8011"] : []),
].join(" ");

const csp = [
  "default-src 'self'",
  // 'unsafe-eval' es necesario para Next.js dev (HMR) y algunos módulos de runtime.
  // En producción se puede eliminar si no hay eval en dependencias.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  `img-src ${imgSrc}`,
  `connect-src ${connectSrc}`,
  "frame-src https://challenges.cloudflare.com",
  // Turnstile ejecuta un Web Worker desde blob URL
  "worker-src blob: https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3002", "cauce.ecuadornotlc.org"],
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
