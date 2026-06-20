import { describe, it, expect } from "vitest";
import { axisLabels } from "@/lib/axis";

describe("axisLabels", () => {
  it("brackets the live 2-of-3-board values (floor 629, target 1145)", () => {
    const { top, mid, bottom } = axisLabels(629, 1145);
    expect(top).toBe(1150); // rounded UP past the 1145 target
    expect(bottom).toBe(600); // rounded DOWN past the 629 floor
    expect(mid).toBeGreaterThan(bottom);
    expect(mid).toBeLessThan(top);
  });

  it("never crops the band inward, for any board count", () => {
    const cases: [number, number][] = [
      [629, 1145], // 2/3 boards active
      [572, 1718], // 3/3 boards (full machine)
      [314, 573], //  1/3 boards active
      [600, 600], //  degenerate min == max
    ];
    for (const [min, max] of cases) {
      const { top, bottom } = axisLabels(min, max);
      expect(top).toBeGreaterThanOrEqual(max); // top tick never below the target
      expect(bottom).toBeLessThanOrEqual(min); // bottom tick never above the floor
    }
  });
});
