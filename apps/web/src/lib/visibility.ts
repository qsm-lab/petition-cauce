// Visibilidad de la firma: etiquetas y qué implica cada una. Única fuente: el formulario y la revisión (revision-datos-al-firmar)
// muestran EXACTAMENTE estos textos; un texto distinto en una pantalla de verificación de privacidad sería un error de contenido.

export type VisibilityValue = "pub" | "anon" | "sec";

export const VIS_LABELS: Record<VisibilityValue, string> = {
  pub: "Pública",
  anon: "Anónima",
  sec: "Secreta",
};

/** Qué implica cada visibilidad — se muestra bajo los botones del formulario y en la revisión. */
export const VIS_HINTS: Record<VisibilityValue, string> = {
  pub:  "Su nombre aparecerá en el listado público de apoyos y en el documento de entrega de la campaña.",
  anon: "Su firma se suma al conteo y al documento de entrega, pero su nombre no se muestra públicamente.",
  sec:  "Su firma solo se suma al conteo. No se muestra ni se incluirá en el documento de entrega oficial a autoridades.",
};
