// revision-datos-al-firmar R21/R22: servicios de correo web que reconocemos para ofrecer «Abrir <servicio>».
// Coincidencia por dominio EXACTO (nunca parcial: `gmail.com.ec` o `outlook.evil.com` no cuentan). La URL no lleva el correo de la persona.

export interface MailProvider {
  name: string;
  url: string;
}

const GMAIL: MailProvider = { name: "Gmail", url: "https://mail.google.com/" };
const OUTLOOK: MailProvider = { name: "Outlook", url: "https://outlook.live.com/mail/" };
const YAHOO: MailProvider = { name: "Yahoo", url: "https://mail.yahoo.com/" };
const ICLOUD: MailProvider = { name: "iCloud", url: "https://www.icloud.com/mail" };
const PROTON: MailProvider = { name: "Proton", url: "https://mail.proton.me/" };

const BY_DOMAIN: Record<string, MailProvider> = {
  "gmail.com": GMAIL,
  "googlemail.com": GMAIL,
  "outlook.com": OUTLOOK,
  "outlook.es": OUTLOOK,
  "hotmail.com": OUTLOOK,
  "hotmail.es": OUTLOOK,
  "live.com": OUTLOOK,
  "msn.com": OUTLOOK,
  "yahoo.com": YAHOO,
  "yahoo.es": YAHOO,
  "ymail.com": YAHOO,
  "icloud.com": ICLOUD,
  "me.com": ICLOUD,
  "mac.com": ICLOUD,
  "proton.me": PROTON,
  "protonmail.com": PROTON,
  "pm.me": PROTON,
};

/** Servicio de correo web del dominio del correo, o `null` si es un dominio propio o no reconocido. */
export function providerFor(email: string): MailProvider | null {
  const at = email.trim().lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.trim().slice(at + 1).toLowerCase();
  return Object.prototype.hasOwnProperty.call(BY_DOMAIN, domain) ? BY_DOMAIN[domain] : null;
}
