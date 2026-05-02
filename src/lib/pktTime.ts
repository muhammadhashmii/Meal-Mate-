/**
 * Pakistan Standard Time (UTC+5, no DST). Aligns all pickup / cancellation rules with DB logic.
 * DB stores TIMESTAMPTZ (UTC); slot strings are interpreted as Karachi wall clock for "today".
 */

export const BUSINESS_TIMEZONE = "Asia/Karachi";
export const PKT_UTC_OFFSET_HOURS = 5;

/** Karachi calendar date for an instant. */
export function getKarachiYmd(nowMs: number = Date.now()): { y: number; m: number; d: number } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = dtf.formatToParts(new Date(nowMs));
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type === "year" || p.type === "month" || p.type === "day") {
      map[p.type] = Number(p.value);
    }
  }
  return { y: map.year, m: map.month, d: map.day };
}

/** Hour / minute in Karachi for an instant (24h clock). */
export function getKarachiTimeParts(nowMs: number = Date.now()): { y: number; m: number; d: number; h: number; min: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(new Date(nowMs));
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  return {
    y: map.year,
    m: map.month,
    d: map.day,
    h: map.hour,
    min: map.minute,
  };
}

/**
 * Absolute instant for a Karachi civil datetime (same interpretation as PostgreSQL
 * `timestamp AT TIME ZONE 'Asia/Karachi'` for fixed +5 offset).
 */
export function pktWallTimeToUtc(y: number, mo: number, d: number, h: number, mi: number): Date {
  return new Date(Date.UTC(y, mo - 1, d, h - PKT_UTC_OFFSET_HOURS, mi, 0, 0));
}

/**
 * Earliest pickup slot start instant to offer: current Karachi clock rounded up to the next
 * 30-minute boundary (minute resolution; matches prior Payment slot availability).
 */
export function nextKarachi30MinBoundaryMs(referenceMs: number = Date.now()): number {
  const { y, m, d, h, min } = getKarachiTimeParts(referenceMs);
  const totalMin = h * 60 + min;
  let boundaryMin = totalMin;
  if (totalMin % 30 !== 0) {
    boundaryMin = totalMin + (30 - (totalMin % 30));
  }
  const bh = Math.floor(boundaryMin / 60);
  const bm = boundaryMin % 60;
  return pktWallTimeToUtc(y, m, d, bh, bm).getTime();
}

/**
 * Parses END time from labels like "12:30 – 1:00" (must match SQL trailing HH:MM).
 * Hour &lt; 6 → +12 for ambiguous 12h-style labels without AM/PM.
 */
export function parsePickupSlotEndUtc(slotText: string, referenceMs: number = Date.now()): Date | null {
  const m = slotText.match(/(\d{1,2})\s*:\s*(\d{2})\s*$/);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour < 6) hour += 12;
  const { y, m: mo, d } = getKarachiYmd(referenceMs);
  return pktWallTimeToUtc(y, mo, d, hour, minute);
}

/** Rule: allow cancel iff now &lt;= slot_end - 2 hours (deadline is exclusive after that). */
export function canCancelWithinTwoHourWindowBeforeSlotEnd(slotText: string, referenceMs: number = Date.now()): boolean {
  const end = parsePickupSlotEndUtc(slotText, referenceMs);
  if (!end) return false;
  const cancelDeadlineMs = end.getTime() - 2 * 60 * 60 * 1000;
  return referenceMs <= cancelDeadlineMs;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 12-hour clock label for slot UI (matches prior Payment behavior). */
export function formatSlotLabel12h(hour24: number, minute: number): string {
  const h12 = ((hour24 + 11) % 12) + 1;
  return `${h12}:${pad2(minute)}`;
}

export interface PickupSlotOption {
  label: string;
  available: boolean;
}

/** 30-minute slots [12:00, 17:00) in PKT, availability vs rounded "now" in PKT. */
export function buildPickupSlots(referenceMs: number = Date.now()): PickupSlotOption[] {
  const { y, m: mo, d } = getKarachiYmd(referenceMs);
  const nextEligibleMs = nextKarachi30MinBoundaryMs(referenceMs);
  const slots: PickupSlotOption[] = [];

  for (let startMin = 12 * 60; startMin < 17 * 60; startMin += 30) {
    const endMin = startMin + 30;
    const sh = Math.floor(startMin / 60);
    const sm = startMin % 60;
    const eh = Math.floor(endMin / 60);
    const em = endMin % 60;
    const label = `${formatSlotLabel12h(sh, sm)} – ${formatSlotLabel12h(eh, em)}`;
    const slotStartUtc = pktWallTimeToUtc(y, mo, d, sh, sm);
    const available = slotStartUtc.getTime() >= nextEligibleMs;
    slots.push({ label, available });
  }

  return slots;
}
