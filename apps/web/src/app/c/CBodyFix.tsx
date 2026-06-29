"use client";

import { useEffect } from "react";

// Aplica background y overscroll en <body> para cubrir el bounce de iOS Safari.
// Las áreas de overscroll muestran el color de body, no del contenido.
export default function CBodyFix() {
  useEffect(() => {
    const dark = "#050a18";
    document.documentElement.style.backgroundColor = dark;
    document.body.style.backgroundColor = dark;
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
      document.body.style.overscrollBehavior = "";
    };
  }, []);
  return null;
}
