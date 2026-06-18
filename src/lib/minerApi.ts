export interface MinerStats {
  th: number;
  watts: number | null;
  chipTemp: number | null;
  fanSpeed: number | null;
}

export interface DiscoveredMiner {
  ip: string;
  model: string;
  live: MinerStats;
}

export interface MinerSnapshot {
  live: MinerStats;
  /** power target scaled to active boards (watts) — slider ceiling */
  machineTarget: number | null;
  /** Braiins floor scaled to active boards (watts) — slider min */
  machineMin: number | null;
  /** active vs total hashboards */
  boards: { active: number; total: number } | null;
}

export async function fetchMinerStats(ip: string): Promise<MinerSnapshot | null> {
  try {
    const res = await fetch(`/api/miners/${encodeURIComponent(ip)}/stats`, {
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok) return null;
    return {
      live: data.live as MinerStats,
      machineTarget: (data.config?.powerTarget ?? null) as number | null,
      machineMin: (data.config?.powerMin ?? null) as number | null,
      boards: (data.config?.boards ?? null) as { active: number; total: number } | null,
    };
  } catch {
    return null;
  }
}

export async function proxyHealthy(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function scanLAN(subnet: string): Promise<DiscoveredMiner[]> {
  try {
    const res = await fetch(`/api/scan?subnet=${encodeURIComponent(subnet)}`, {
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.ok ? (data.miners as DiscoveredMiner[]) : [];
  } catch {
    return [];
  }
}
