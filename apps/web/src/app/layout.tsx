import type { Metadata } from "next";
import {
  Poppins,
  Inter,
  Montserrat,
  Nunito,
  Fredoka,
  Permanent_Marker,
} from "next/font/google";
import "./globals.css";

/* ── Petition-Cauce: fuentes del sistema de diseño público ── */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

/* ── Legacy QSM: fuentes para páginas admin (heredadas del fork) ── */
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-nunito",
  display: "swap",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fredoka",
  display: "swap",
});

const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: ["400"],
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
