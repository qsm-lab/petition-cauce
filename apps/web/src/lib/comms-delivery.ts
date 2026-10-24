// Estimación de entrega de un envío por la cola de comunicaciones.
//
// Con un tope diario (planes free: Brevo, Resend o la suma del pool) la cola
// envía en la hora programada lo que quede de cupo ese día y el resto en lotes
// diarios. El contador de cuota se renueva a las 00:00 UTC (19:00 en Guayaquil).
// Sin tope diario (algún proveedor del pool en plan Pro) todo sale en la hora
// programada.

const DAY_MS = 24 * 60 * 60 * 1000;
export const QUOTA_TZ = "America/Guayaquil";

export interface DeliveryEstimate {
  /** "complete": se entrega completo a la hora programada. "batches": en lotes diarios. */
  mode: "complete" | "batches";
  /** Destinatarios que salen en la hora programada. */
  firstBatch: number;
  /** Ciclos diarios que hacen falta en total (1 si es "complete"). */
  cycles: number;
  /** Momento en que arranca el último ciclo (= hora programada si es "complete"). */
  completeAt: Date;
}

function utcDayStart(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function estimateDelivery(opts: {
  count: number;
  dailyQuota: number | null;
  dailyUsed: number;
  scheduledAt: Date;
  now?: Date;
}): DeliveryEstimate {
  const { count, dailyQuota, dailyUsed, scheduledAt } = opts;
  const now = opts.now ?? new Date();

  if (dailyQuota == null) {
    return { mode: "complete", firstBatch: count, cycles: 1, completeAt: scheduledAt };
  }

  const quota = Math.max(dailyQuota, 1);
  const sameDay = utcDayStart(scheduledAt) === utcDayStart(now);
  const firstBatch = Math.min(count, sameDay ? Math.max(quota - dailyUsed, 0) : quota);

  if (count <= firstBatch) {
    return { mode: "complete", firstBatch: count, cycles: 1, completeAt: scheduledAt };
  }

  const extraDays = Math.ceil((count - firstBatch) / quota);
  return {
    mode: "batches",
    firstBatch,
    cycles: extraDays + (firstBatch > 0 ? 1 : 0),
    completeAt: new Date(utcDayStart(scheduledAt) + extraDays * DAY_MS),
  };
}

export function formatGuayaquil(d: Date): string {
  const fecha = d.toLocaleDateString("es-EC", {
    timeZone: QUOTA_TZ, weekday: "long", day: "numeric", month: "long",
  });
  const hora = d.toLocaleTimeString("es-EC", { timeZone: QUOTA_TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fecha}, ${hora} (hora de Guayaquil)`;
}
