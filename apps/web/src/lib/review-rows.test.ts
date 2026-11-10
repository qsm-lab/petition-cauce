import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReviewRows, NOT_GIVEN } from "./review-rows.ts";
import { toSignaturePayload } from "./sign-payload.ts";
import { VIS_HINTS } from "./visibility.ts";
import { displayFirstName } from "./names.ts";

const base = {
  signer_type: "natural", org_name: "", first_name: " Javier ", last_name: "Molina Andrade", email: "javier.molina@gmail.com",
  cedula: "1712345678", celular: "", location_mode: "nacional", provincia: "Pichincha", country: "", visibility: "pub",
  consent: true, cf_turnstile_token: "tok",
} as const;
const cfg = { signer_types: ["natural"], location_modes: ["nacional"], required_fields: [], visibility_options: ["publica"], request_celular: false } as const;

// Claves del payload que no se muestran como dato: token anti-bot, consentimiento (el aviso se muestra aparte) y la suscripción (siempre false).
const NO_SE_MUESTRAN = new Set(["cf_turnstile_token", "consent", "subscribe_newsletter"]);

function cubiertas(values: any, config: any) {
  const rows = buildReviewRows(values, config);
  const payload = toSignaturePayload(values) as Record<string, unknown>;
  const cubre = new Set(rows.flatMap((r) => r.covers));
  const faltan = Object.entries(payload)
    .filter(([k, v]) => !NO_SE_MUESTRAN.has(k) && v !== undefined && v !== "" && v !== false)
    .map(([k]) => k)
    .filter((k) => !cubre.has(k));
  return { rows, faltan };
}

const variantes: [string, any, any][] = [
  ["persona nacional", base, cfg],
  ["organización", { ...base, signer_type: "org", org_name: "Fundación Bosque Seco" }, { ...cfg, signer_types: ["natural", "org"] }],
  ["internacional", { ...base, location_mode: "internacional", provincia: "", country: "España", cedula: "X1234567L" }, { ...cfg, location_modes: ["nacional", "internacional"] }],
  ["con celular", { ...base, celular: "099 123 4567" }, { ...cfg, request_celular: true }],
  ["anónima", { ...base, visibility: "anon" }, cfg],
  ["secreta", { ...base, visibility: "sec" }, cfg],
];

for (const [nombre, values, config] of variantes) {
  test(`R4b: toda clave enviada con valor aparece en el resumen (${nombre})`, () => {
    assert.deepEqual(cubiertas(values, config).faltan, []);
  });
}

test("el valor de cada fila coincide con lo escrito (sin espacios sobrantes)", () => {
  const { rows } = cubiertas(base, cfg);
  const v = (id: string) => rows.find((r) => r.id === id)?.value;
  assert.equal(v("first"), "Javier");
  assert.equal(v("last"), "Molina Andrade");
  assert.equal(v("email"), "javier.molina@gmail.com");
  assert.equal(v("document"), "1712345678");
  assert.equal(v("location"), "Pichincha");
});

test("organización: aparece su fila; persona: no", () => {
  assert.ok(buildReviewRows({ ...base, signer_type: "org", org_name: "Colectivo Río" } as any, cfg as any).some((r) => r.id === "org" && r.value === "Colectivo Río"));
  assert.ok(!buildReviewRows(base as any, cfg as any).some((r) => r.id === "org"));
});

test("internacional: «Número de identificación» y país", () => {
  const rows = buildReviewRows({ ...base, location_mode: "internacional", provincia: "", country: "España", cedula: "X1" } as any, cfg as any);
  assert.equal(rows.find((r) => r.id === "document")?.label, "Número de identificación");
  assert.equal(rows.find((r) => r.id === "location")?.value, "España");
});

test("lo que la campaña pide y quedó vacío sale como «No indicado»; lo que no pide no aparece", () => {
  const sinCedula = buildReviewRows({ ...base, cedula: "" } as any, cfg as any);
  assert.deepEqual(sinCedula.find((r) => r.id === "document"), { id: "document", label: "Cédula", value: NOT_GIVEN, empty: true, covers: ["cedula"] });
  assert.ok(!sinCedula.some((r) => r.id === "celular"));
  const conCel = buildReviewRows({ ...base, celular: "" } as any, { ...cfg, request_celular: true } as any);
  assert.equal(conCel.find((r) => r.id === "celular")?.value, NOT_GIVEN);
});

test("la visibilidad muestra EXACTAMENTE el texto del formulario (Secreta no se entrega a autoridades)", () => {
  for (const vis of ["pub", "anon", "sec"] as const) {
    assert.equal(buildReviewRows({ ...base, visibility: vis } as any, cfg as any).find((r) => r.id === "visibility")?.note, VIS_HINTS[vis]);
  }
  assert.match(VIS_HINTS.sec, /ni se incluirá en el documento de entrega/i);
});

test("el payload manda nombre y apellido sin espacios sobrantes y no manda `name`", () => {
  const p = toSignaturePayload(base as any) as Record<string, unknown>;
  assert.equal(p.first_name, "Javier");
  assert.equal(p.last_name, "Molina Andrade");
  assert.ok(!("name" in p));
});

test("displayFirstName: mayúscula inicial, primera palabra, salta títulos", () => {
  assert.equal(displayFirstName("javier"), "Javier");
  assert.equal(displayFirstName("MARÍA josé"), "María");
  assert.equal(displayFirstName("Dr. Juan Pérez"), "Juan");
  assert.equal(displayFirstName("ana-lucía mora"), "Ana-Lucía");
  assert.equal(displayFirstName("  "), "");
  assert.equal(displayFirstName(undefined), "");
});
