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
  /** whole-machine power limit (watts) — the slider MAX / scale ceiling */
  machineMax: number | null;
  /** Braiins floor (watts) if known — slider min; null → dial floor is 0 */
  machineMin: number | null;
  /** active vs total hashboards — the Target is scaled by active/total */
  boards: { active: number; total: number } | null;
  /** reserved for control flows; reads no longer require a password */
  needPassword: boolean;
}

export async function fetchMinerStats(ip: string, password?: string): Promise<MinerSnapshot | null> {
  try {
    const res = await fetch(`/api/miners/${encodeURIComponent(ip)}/stats`, {
      // Reads use the open CGMiner API (port 4028) — no password needed. The
      // header is kept only so a future authenticated read could use it.
      headers: password ? { 'x-miner-password': password } : {},
      signal: AbortSignal.timeout(6500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok) return null;
    return {
      live: data.live as MinerStats,
      machineMax: (data.config?.fullTarget ?? null) as number | null,
      machineMin: (data.config?.powerMin ?? null) as number | null,
      boards: (data.config?.boards ?? null) as { active: number; total: number } | null,
      needPassword: !!data.needPassword,
    };
  } catch {
    return null;
  }
}

export interface ControlResult { ok: boolean; needPassword?: boolean }

export async function setMinerPaused(ip: string, paused: boolean, password?: string): Promise<ControlResult> {
  try {
    const res = await fetch(`/api/miners/${encodeURIComponent(ip)}/${paused ? 'pause' : 'resume'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password ?? '' }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: !!data.ok, needPassword: !!data.needPassword };
  } catch {
    return { ok: false };
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
