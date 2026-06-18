import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Miner, MinerConfig } from "@/lib/types";
import { fetchMinerStats, scanLAN } from "@/lib/minerApi";

const STORAGE_KEY = "hashboard.state.v1";

const seed = (): Miner[] => [
  {
    id: "m1",
    ip: "192.168.1.106",
    model: "Antminer S19 Pro",
    status: "mining",
    config: {
      name: "Miner 01",
      powerMin: 500,
      powerMax: 1500,
      powerTarget: 1100,
      fanMode: "auto",
      fanManual: 60,
      fanAutoRange: [30, 70],
    },
    live: { th: 96, watts: 1100, chipTemp: 62, fanSpeed: 55 },
  },
];

interface State {
  miners: Miner[];
  selectedId: string | null;
  theme: "light" | "dark";
  scanning: boolean;
  /** true when at least one miner responded with real data on last poll */
  liveMode: boolean;

  select: (id: string) => void;
  setTheme: (t: "light" | "dark") => void;
  toggleTheme: () => void;
  setPower: (id: string, watts: number) => void;
  updateConfig: (id: string, patch: Partial<MinerConfig>) => void;
  updateIp: (id: string, ip: string) => void;
  togglePause: (id: string) => void;
  removeMiner: (id: string) => void;
  scan: () => Promise<void>;
  /** Poll live data from the real miner API via the local proxy */
  pollLive: () => Promise<void>;
  /** Smooth animation tick (1 s) — lerps toward current target/live values */
  _tick: () => void;
}

export const useMiners = create<State>()(
  persist(
    (set, get) => ({
      miners: seed(),
      selectedId: "m1",
      theme: "dark",
      scanning: false,
      liveMode: false,

      select: (id) => set({ selectedId: id }),
      setTheme: (t) => set({ theme: t }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      setPower: (id, watts) =>
        set((s) => ({
          miners: s.miners.map((m) =>
            m.id === id
              ? {
                  ...m,
                  config: {
                    ...m.config,
                    powerTarget: Math.round(
                      Math.min(m.config.powerMax, Math.max(m.config.powerMin, watts))
                    ),
                  },
                }
              : m
          ),
        })),

      updateConfig: (id, patch) =>
        set((s) => ({
          miners: s.miners.map((m) => {
            if (m.id !== id) return m;
            const config = { ...m.config, ...patch };
            config.powerTarget = Math.min(
              config.powerMax,
              Math.max(config.powerMin, config.powerTarget)
            );
            return { ...m, config };
          }),
        })),

      updateIp: (id, ip) =>
        set((s) => ({
          miners: s.miners.map((m) => (m.id === id ? { ...m, ip } : m)),
        })),

      togglePause: (id) =>
        set((s) => ({
          miners: s.miners.map((m) =>
            m.id === id
              ? { ...m, status: m.status === "paused" ? "mining" : "paused" }
              : m
          ),
        })),

      removeMiner: (id) =>
        set((s) => {
          const miners = s.miners.filter((m) => m.id !== id);
          const selectedId =
            s.selectedId === id ? (miners[0]?.id ?? null) : s.selectedId;
          return { miners, selectedId };
        }),

      pollLive: async () => {
        const { miners } = get();
        const fetched = await Promise.all(
          miners.map(async (m) => {
            const stats = await fetchMinerStats(m.ip);
            return { id: m.id, stats };
          })
        );

        const anyLive = fetched.some((f) => f.stats != null);

        set((s) => ({
          liveMode: anyLive,
          miners: s.miners.map((m) => {
            const entry = fetched.find((f) => f.id === m.id);
            const stats = entry?.stats;
            if (!stats) return m;
            return {
              ...m,
              live: {
                th: stats.th,
                watts: stats.watts ?? m.live.watts,
                chipTemp: stats.chipTemp ?? m.live.chipTemp,
                fanSpeed: stats.fanSpeed ?? m.live.fanSpeed,
              },
            };
          }),
        }));
      },

      scan: async () => {
        set({ scanning: true });
        const { miners } = get();
        const existingIp = miners[0]?.ip ?? "192.168.1.1";
        const subnet = existingIp.split(".").slice(0, 3).join(".");

        const discovered = await scanLAN(subnet);

        set((s) => {
          const existingIps = new Set(s.miners.map((m) => m.ip));
          const newMiners: Miner[] = discovered
            .filter((d) => !existingIps.has(d.ip))
            .map((d, i) => ({
              id: `disc-${Date.now()}-${i}`,
              ip: d.ip,
              model: d.model,
              status: "mining" as const,
              config: {
                name: d.ip,
                powerMin: 500,
                powerMax: 2000,
                powerTarget: 1200,
                fanMode: "auto" as const,
                fanManual: 60,
                fanAutoRange: [30, 70] as [number, number],
              },
              live: {
                th: d.live.th,
                watts: d.live.watts ?? 1200,
                chipTemp: d.live.chipTemp ?? 60,
                fanSpeed: d.live.fanSpeed ?? 60,
              },
            }));
          return { scanning: false, miners: [...s.miners, ...newMiners] };
        });
      },

      _tick: () => {
        set((s) => ({
          miners: s.miners.map((m) => {
            if (m.status !== "mining") {
              return {
                ...m,
                live: {
                  ...m.live,
                  th: lerp(m.live.th, 0, 0.2),
                  watts: lerp(m.live.watts, 0, 0.25),
                  chipTemp: lerp(m.live.chipTemp, 28, 0.04),
                  fanSpeed: lerp(m.live.fanSpeed, 0, 0.15),
                },
              };
            }
            const target = m.config.powerTarget;
            const targetTh = target / 11.5 + jitter(1.2);
            const targetTemp = 45 + (target - 500) * 0.022 + jitter(0.6);
            const targetFan =
              m.config.fanMode === "manual"
                ? m.config.fanManual
                : clampFan(m.config.fanAutoRange, 30 + (targetTemp - 45) * 1.6);
            return {
              ...m,
              live: {
                watts: lerp(m.live.watts, target + jitter(6), 0.08),
                th: lerp(m.live.th, targetTh, 0.08),
                chipTemp: lerp(m.live.chipTemp, targetTemp, 0.04),
                fanSpeed: lerp(m.live.fanSpeed, targetFan, 0.06),
              },
            };
          }),
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => ({
        miners: s.miners,
        selectedId: s.selectedId,
        theme: s.theme,
      }),
    }
  )
);

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function jitter(amp: number) {
  return (Math.random() - 0.5) * 2 * amp;
}
function clampFan([lo, hi]: [number, number], v: number) {
  return Math.min(hi, Math.max(lo, v));
}
