export type MinerStatus = "mining" | "paused" | "offline";
export type FanMode = "auto" | "manual";

export interface MinerConfig {
  /** user-defined display name */
  name: string;
  /** lower bound of allowed power range, watts */
  powerMin: number;
  /** upper bound of allowed power range, watts */
  powerMax: number;
  /** target watts (within [powerMin, powerMax]) */
  powerTarget: number;
  fanMode: FanMode;
  /** manual fan speed 0..100 */
  fanManual: number;
  /** auto fan range [low, high] in 0..100 */
  fanAutoRange: [number, number];
  /** BraiinsOS+ control-API password (username root); stored on device */
  apiPassword?: string;
}

export interface MinerLive {
  /** measured terahash/s */
  th: number;
  /** measured wall power, watts */
  watts: number;
  /** chip temperature °C */
  chipTemp: number;
  /** current fan speed percent */
  fanSpeed: number;
}

export interface Miner {
  id: string;
  ip: string;
  model: string;
  status: MinerStatus;
  /** active vs total hashboards, populated from the miner */
  boards?: { active: number; total: number };
  config: MinerConfig;
  live: MinerLive;
}
