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

export async function fetchMinerStats(ip: string): Promise<MinerStats | null> {
  try {
    const res = await fetch(`/api/miners/${encodeURIComponent(ip)}/stats`, {
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok ? (data.live as MinerStats) : null;
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
