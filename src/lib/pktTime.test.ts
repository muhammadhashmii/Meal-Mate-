import { describe, expect, it } from "vitest";
import {
  buildPickupSlots,
  canCancelWithinTwoHourWindowBeforeSlotEnd,
  formatSlotLabel12h,
  parsePickupSlotEndUtc,
  pktWallTimeToUtc,
} from "./pktTime";

describe("pktWallTimeToUtc", () => {
  it("maps Karachi noon to correct UTC instant (+5)", () => {
    const d = pktWallTimeToUtc(2026, 5, 2, 12, 0);
    expect(d.toISOString()).toBe("2026-05-02T07:00:00.000Z");
  });
});

describe("parsePickupSlotEndUtc", () => {
  it("parses trailing end time and applies sub-6 AM heuristic (+12)", () => {
    const ref = pktWallTimeToUtc(2026, 5, 2, 10, 0).getTime();
    const end = parsePickupSlotEndUtc("12:30 – 1:00", ref);
    expect(end).not.toBeNull();
    expect(end!.toISOString()).toBe("2026-05-02T08:00:00.000Z");
  });
});

describe("canCancelWithinTwoHourWindowBeforeSlotEnd", () => {
  it("allows cancel when more than 2h before slot end", () => {
    const end = parsePickupSlotEndUtc("12:30 – 2:00", Date.now());
    expect(end).not.toBeNull();
    const twoHoursBefore = end!.getTime() - 2 * 60 * 60 * 1000;
    expect(canCancelWithinTwoHourWindowBeforeSlotEnd("12:30 – 2:00", twoHoursBefore)).toBe(true);
  });

  it("denies cancel inside 2h window", () => {
    const end = parsePickupSlotEndUtc("12:30 – 2:00", Date.now());
    expect(end).not.toBeNull();
    const inside = end!.getTime() - 1 * 60 * 60 * 1000;
    expect(canCancelWithinTwoHourWindowBeforeSlotEnd("12:30 – 2:00", inside)).toBe(false);
  });
});

describe("buildPickupSlots", () => {
  it("uses 12h labels consistent with formatSlotLabel12h", () => {
    expect(formatSlotLabel12h(12, 0)).toMatch(/12:00/);
    expect(formatSlotLabel12h(17, 0)).toMatch(/5:00/);
    const slots = buildPickupSlots(pktWallTimeToUtc(2026, 5, 2, 11, 0).getTime());
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].label).toContain("–");
  });

  it("shows next-day availability after business hours", () => {
    const afterClose = pktWallTimeToUtc(2026, 5, 2, 22, 52).getTime();
    const slots = buildPickupSlots(afterClose);
    expect(slots.length).toBe(10);
    expect(slots.every((s) => s.available)).toBe(true);
  });
});
