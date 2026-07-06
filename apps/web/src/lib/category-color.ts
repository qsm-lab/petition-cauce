const COLOR_MAP: Record<string, string> = {
  Agua:     "#2B4EEA",
  Bosques:  "#3F8F5C",
  Minería:  "#FF5A2B",
  Aire:     "#5B8FE8",
  Suelo:    "#8B6914",
  Páramo:   "#7B4EA6",
};

const DEFAULT_COLOR = "#2B4EEA";

export function getCategoryColor(
  category: string | null,
  meta: Record<string, unknown>
): string {
  if (typeof meta.category_color === "string" && meta.category_color) {
    return meta.category_color;
  }
  if (category && COLOR_MAP[category]) return COLOR_MAP[category];
  return DEFAULT_COLOR;
}
