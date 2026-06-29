/** Valores por defecto del tema Bosque claro */
export const BOSQUE_LIGHT = {
  "--bp":    "#18794A",
  "--bop":   "#ffffff",
  "--bsec":  "#2F855A",
  "--bink":  "#15241B",
  "--bmut":  "#5A6B60",
  "--bsurf": "#ffffff",
  "--bbg":   "#EEF4EC",
  "--bbord": "#DBE6D6",
  "--br":    "24px",
} as const;

export const OCEANO_LIGHT = {
  "--bp":    "#0C6FB0",
  "--bop":   "#ffffff",
  "--bsec":  "#0E8C86",
  "--bink":  "#0F2433",
  "--bmut":  "#4F6675",
  "--bsurf": "#ffffff",
  "--bbg":   "#EAF3F9",
  "--bbord": "#D2E2EE",
  "--br":    "24px",
} as const;

export const BOSQUE_DARK = {
  "--bp":    "#35C97B",
  "--bop":   "#08130C",
  "--bsec":  "#35C97B",
  "--bink":  "#E7F1E9",
  "--bmut":  "#9CB2A2",
  "--bsurf": "#17241B",
  "--bbg":   "#0E1712",
  "--bbord": "#2B3B30",
  "--br":    "24px",
} as const;

export type BrandingTokens = typeof BOSQUE_LIGHT;

/** Convierte un objeto de tokens a un string CSS inline para inyección SSR */
export function tokensToStyle(tokens: Partial<BrandingTokens>): string {
  return Object.entries(tokens)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

/**
 * Genera el <style> SSR para sobreescribir tokens de campaña.
 * Sanitiza valores de color (solo hex/rgb/hsl/named permitidos).
 */
export function campaignStyleTag(branding: {
  primary_color?: string;
  secondary_color?: string;
  bg_color?: string;
  surface_color?: string;
  border_color?: string;
  ink_color?: string;
  muted_color?: string;
  on_primary_color?: string;
  radius?: string;
}): string {
  const safe = (v: string | undefined) =>
    v && /^(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\)|hsl[a]?\([^)]+\)|[a-zA-Z]+)$/.test(v.trim())
      ? v.trim()
      : null;

  const vars: string[] = [];
  const push = (token: string, val: string | undefined) => {
    const s = safe(val);
    if (s) vars.push(`${token}:${s}`);
  };

  push("--bp",    branding.primary_color);
  push("--bop",   branding.on_primary_color);
  push("--bsec",  branding.secondary_color);
  push("--bink",  branding.ink_color);
  push("--bmut",  branding.muted_color);
  push("--bsurf", branding.surface_color);
  push("--bbg",   branding.bg_color);
  push("--bbord", branding.border_color);

  if (branding.radius && /^[0-9]+(px|rem|em|%)$/.test(branding.radius.trim())) {
    vars.push(`--br:${branding.radius.trim()}`);
  }

  return vars.length ? `:root{${vars.join(";")}}` : "";
}
