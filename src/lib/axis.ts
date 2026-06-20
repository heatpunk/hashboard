/**
 * Y-axis tick labels for the power slider.
 *
 * The three labels must always *bracket* the real [min, max] band so the
 * Target readout (which sits at max) never shows above the top tick, and the
 * floor never drops below the bottom tick. So: round the top UP and the bottom
 * DOWN. Rounding them the other way crops the band inward — the bug that made
 * Target read 1145 while the top tick said 1100.
 */
export interface AxisLabels {
  top: number;
  mid: number;
  bottom: number;
}

export function axisLabels(min: number, max: number): AxisLabels {
  return {
    top: Math.ceil(max / 50) * 50, // >= max, so Target always sits inside the scale
    mid: Math.round((max + min) / 100) * 50, // midpoint, snapped to 50 W
    bottom: Math.floor(min / 50) * 50, // <= min, so the floor always sits inside the scale
  };
}
