import assert from "node:assert/strict";
import { test } from "node:test";
import { providerFor } from "./mail-providers.ts";

test("reconoce los servicios por dominio exacto, sin distinguir mayúsculas", () => {
  assert.equal(providerFor("a@gmail.com")?.name, "Gmail");
  assert.equal(providerFor("a@GoogleMail.com")?.name, "Gmail");
  assert.equal(providerFor("A@Hotmail.ES")?.name, "Outlook");
  assert.equal(providerFor("a@live.com")?.name, "Outlook");
  assert.equal(providerFor("a@ymail.com")?.name, "Yahoo");
  assert.equal(providerFor("a@mac.com")?.name, "iCloud");
  assert.equal(providerFor("a@pm.me")?.name, "Proton");
});

test("la URL de la bandeja no incluye el correo", () => {
  const p = providerFor("persona.privada@gmail.com");
  assert.ok(p && !p.url.includes("persona") && !p.url.includes("@"));
});

test("dominios parecidos, subdominios y dominios propios NO se reconocen", () => {
  for (const e of ["a@gmail.com.ec", "a@mail.gmail.com", "a@gmial.com", "a@outlook.evil.com", "a@yahoo.com.mx",
                   "a@molina-consultores.ec", "a@gmail.com.evil.org", "a@xgmail.com"]) {
    assert.equal(providerFor(e), null, e);
  }
});

test("entradas raras no rompen", () => {
  for (const e of ["", "sin-arroba", "@", "a@", "  a@gmail.com  "]) providerFor(e);
  assert.equal(providerFor("  a@gmail.com  ")?.name, "Gmail");
  assert.equal(providerFor("a@constructor"), null);
  assert.equal(providerFor("a@__proto__"), null);
});

test("con varias arrobas manda la última (el dominio real)", () => {
  assert.equal(providerFor("a@gmail.com@molina.ec"), null);
});
