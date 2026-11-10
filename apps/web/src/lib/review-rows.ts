// Filas del resumen «Verifica que tu información sea correcta» (revision-datos-al-firmar R4, R4b, R18).
// Cada fila declara qué claves del payload cubre (`covers`); el test recorre las claves de `toSignaturePayload` y exige que todas
// las que tienen valor estén cubiertas.
import type { FormValues } from "@/components/sign-flow/StepForm";
import type { FormConfig } from "@/lib/campaign-api";
import { VIS_HINTS, VIS_LABELS } from "./visibility.ts";

export const NOT_GIVEN = "No indicado";

export interface ReviewRow {
  id: "email" | "signer" | "org" | "first" | "last" | "document" | "celular" | "location" | "visibility";
  label: string;
  value: string;
  /** Texto pequeño bajo el valor (significado de la visibilidad). */
  note?: string;
  /** Campo opcional que la campaña pide y quedó vacío: se muestra «No indicado» en cursiva. */
  empty?: boolean;
  /** Claves del payload de firma que esta fila muestra. */
  covers: string[];
}

const clean = (s: string) => s.trim();

export function buildReviewRows(v: FormValues, cfg: FormConfig): ReviewRow[] {
  const intl = v.location_mode === "internacional";
  const rows: ReviewRow[] = [
    { id: "email", label: "Correo", value: clean(v.email), covers: ["email"] },
    { id: "signer", label: "Firma como", value: v.signer_type === "org" ? "Organización" : "Persona", covers: ["signer_type"] },
  ];
  if (v.signer_type === "org") rows.push({ id: "org", label: "Organización", value: clean(v.org_name), covers: ["org_name"] });
  rows.push(
    { id: "first", label: "Nombre(s)", value: clean(v.first_name), covers: ["first_name"] },
    { id: "last", label: "Apellido(s)", value: clean(v.last_name), covers: ["last_name"] },
  );
  const doc = clean(v.cedula);
  rows.push({
    id: "document",
    label: intl ? "Número de identificación" : "Cédula",
    value: doc || NOT_GIVEN,
    empty: !doc,
    covers: ["cedula"],
  });
  if (cfg.request_celular) {
    const cel = clean(v.celular);
    rows.push({ id: "celular", label: "Celular", value: cel || NOT_GIVEN, empty: !cel, covers: ["celular"] });
  }
  rows.push(
    {
      id: "location",
      label: "Ubicación",
      value: clean(intl ? v.country : v.provincia),
      covers: ["location_mode", intl ? "country" : "provincia"],
    },
    { id: "visibility", label: "Visibilidad", value: VIS_LABELS[v.visibility], note: VIS_HINTS[v.visibility], covers: ["visibility"] },
  );
  return rows;
}
