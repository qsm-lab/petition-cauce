// Nombre de pila para mostrar en títulos («Javier, por favor, confirme su correo»). Misma regla que `signer_name.simple_name` de la API:
// primera palabra, saltando títulos al inicio, con inicial en mayúscula. "" si no hay nombre.

const TITLES = new Set([
  "dr", "dra", "sr", "sra", "srta", "ing", "lic", "licda", "abg", "arq", "mgs", "msc", "mg", "prof", "econ", "psic", "med",
]);

const capitalize = (token: string) => token.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("-");

export function displayFirstName(raw: string | null | undefined): string {
  const tokens = (raw ?? "").split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  const token = tokens.find((t) => !TITLES.has(t.replace(/\.+$/, "").toLowerCase())) ?? tokens[0];
  return capitalize(token);
}
