import { describe, it, expect } from "vitest";
import { roundTo50, scaledTarget } from "@/lib/power";

describe("roundTo50", () => {
  it("rounds to the nearest 50 W", () => {
    expect(roundTo50(1145.33)).toBe(1150);
    expect(roundTo50(599.33)).toBe(600);
    expect(roundTo50(1718)).toBe(1700);
    expect(roundTo50(1725)).toBe(1750);
    expect(roundTo50(0)).toBe(0);
  });
});

describe("scaledTarget — verified live against the two S19j Pro units", () => {
  it("1718 W over 2 of 3 boards → 1150 W (Cellarheater)", () => {
    expect(scaledTarget(1718, 2, 3)).toBe(1150);
  });
  it("1798 W over 1 of 3 boards → 600 W (Garageheater)", () => {
    expect(scaledTarget(1798, 1, 3)).toBe(600);
  });
  it("full machine (3 of 3) → the limit, rounded to 50", () => {
    expect(scaledTarget(1718, 3, 3)).toBe(1700);
  });
  it("the scaled target never exceeds the full machine target", () => {
    for (const active of [1, 2, 3]) {
      expect(scaledTarget(1718, active, 3)).toBeLessThanOrEqual(roundTo50(1718));
    }
  });
  it("returns 0 for missing/garbage inputs (shows 'connecting', not a wrong number)", () => {
    expect(scaledTarget(0, 2, 3)).toBe(0);
    expect(scaledTarget(1718, 0, 3)).toBe(0);
    expect(scaledTarget(1718, 2, 0)).toBe(0);
  });
});
