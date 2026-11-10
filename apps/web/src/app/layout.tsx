import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/* Fuentes auto-hosteadas (woff2 en src/fonts, subset latin, licencia OFL): el build no depende de Google Fonts.
   Las rutas de `path` deben ser literales: next/font las resuelve en compilación. */

/* ── Cauce v2: fuentes del nuevo sistema de diseño (landing pública) ── */
const anton = localFont({
  src: [
    { path: "../fonts/anton-latin-400-normal.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-anton",
  display: "swap",
});

const workSans = localFont({
  src: [
    { path: "../fonts/work-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/work-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/work-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/work-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../fonts/work-sans-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-work-sans",
  display: "swap",
});

/* ── Petition-Cauce: fuentes del sistema de diseño público ── */
const poppins = localFont({
  src: [
    { path: "../fonts/poppins-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/poppins-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/poppins-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../fonts/poppins-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

const inter = localFont({
  src: [
    { path: "../fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

/* ── Legacy QSM: fuentes para páginas admin (heredadas del fork) ── */
const montserrat = localFont({
  src: [
    { path: "../fonts/montserrat-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/montserrat-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../fonts/montserrat-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-montserrat",
  display: "swap",
});

const nunito = localFont({
  src: [
    { path: "../fonts/nunito-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/nunito-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/nunito-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-nunito",
  display: "swap",
});

const fredoka = localFont({
  src: [
    { path: "../fonts/fredoka-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/fredoka-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/fredoka-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-fredoka",
  display: "swap",
});

const permanentMarker = localFont({
  src: [
    { path: "../fonts/permanent-marker-latin-400-normal.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-permanent-marker",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cauce — Plataforma de firmas ambientales",
  description: "Plataforma de recolección de firmas para campañas de activismo ambiental en Ecuador.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={[
        anton.variable,
        workSans.variable,
        poppins.variable,
        inter.variable,
        montserrat.variable,
        nunito.variable,
        fredoka.variable,
        permanentMarker.variable,
      ].join(" ")}
    >
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
