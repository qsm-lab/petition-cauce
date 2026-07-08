/** Mano firmando — aparece suave al hover del CTA (ancho 0 → visible).
    Requiere que el botón contenedor tenga la clase `group`. */
export default function SignHandIcon() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex w-0 opacity-0 -translate-x-1 overflow-hidden transition-all duration-300 ease-out group-hover:w-7 group-hover:opacity-100 group-hover:translate-x-0"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginRight: 8 }}
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </span>
  );
}
