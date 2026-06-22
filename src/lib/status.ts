import type { Miner } from "@/lib/types";

export type DisplayStatus = "mining" | "paused" | "offline";

/**
 * What a miner is doing RIGHT NOW, derived from live poll data — never the
 * stale stored `status` (which only changes on pause/resume/scan and is the
 * reason two running miners used to render with different dots).
 *
 * In live mode: unreachable on the last poll → offline; hashing → mining;
 * reachable but ~0 TH/s → paused. Before the first successful poll, fall back
 * to the stored status. This is per-miner and independent of which miner is
 * selected, so every running miner reads ON regardless of the current view.
 */
export function displayStatus(m: Miner, liveMode: boolean): DisplayStatus {
  if (!liveMode) return m.status;
  if (m.online === false) return "offline";
  return m.live.th > 0.5 ? "mining" : "paused";
}

/** Short status label shown next to each miner (ON / PAUSED / OFFLINE). */
export function statusLabel(s: DisplayStatus): string {
  return s === "mining" ? "ON" : s === "paused" ? "PAUSED" : "OFFLINE";
}
