import type { Metadata } from "next";

import ConfirmarFirma from "./ConfirmarFirma";

// verificacion-confirmacion-privacidad (D1 = A): el enlace del correo abre esta página y solo su botón confirma.
// El token va en la URL: sin indexar, sin enviarlo como Referer y sin que nadie lo cachee.
export const metadata: Metadata = {
  title: "Confirma tu firma",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function ConfirmarPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  return <ConfirmarFirma token={token} />;
}
