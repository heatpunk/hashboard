import { describe, it, expect } from "vitest";
import { axisLabels } from "@/lib/axis";

describe("axisLabels", () => {
  // The scale runs 0 → whole-machine PowerLimit (MAX). The Target, scaled to
  // the active boards, sits INSIDE this scale. These are the exact tick labels
  // seen on the two live units.
  it("Cellarheater: 0 → 1718 W → ticks 0 / 850 / 1750", () => {
    const { top, mid, bottom } = axisLabels(0, 1718);
    expect(bottom).toBe(0);
    expect(mid).toBe(850);
    expect(top).toBe(1750);
  });

  it("Garageheater: 0 → 1798 W → ticks 0 / 900 / 1800", () => {
    const { top, mid, bottom } = axisLabels(0, 1798);
    expect(bottom).toBe(0);
    expect(mid).toBe(900);
    expect(top).toBe(1800);
  });

  it("top tick always brackets the max; bottom always brackets the min", () => {
    const cases: [number, number][] = [
      [0, 1718],
      [0, 1798],
      [0, 1150],
      [600, 600], // degenerate min == max
    ];
    for (const [min, max] of cases) {
      const { top, bottom } = axisLabels(min, max);
      expect(top).toBeGreaterThanOrEqual(max);
      expect(bottom).toBeLessThanOrEqual(min);
    }
  });
});
