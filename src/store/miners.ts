import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Miner, MinerConfig } from "@/lib/types";

const STORAGE_KEY = "hashboard.state.v1";

const seed = (): Miner[] => [
  {
    id: "m1",
    ip: "192.168.1.42",
    model: "Antminer S19 Pro",
    status: "mining",
    config: {
      name: "Garage 01",
      powerMin: 500,
      powerMax: 1500,
      powerTarget: 1100,
      fanMode: "auto",
      fanManual: 60,
      fanAutoRange: [30, 70],
    },
    live: { th: 96, watts: 1100, chipTemp: 62, fanSpeed: 55 },
  },
  {
    id: "m2",
    ip: "192.168.1.43",
    model: "Antminer S19j Pro",
    status: "mining",
    config: {
      name: "Garage 02",
      powerMin: 600,
      powerMax: 1400,
      powerTarget: 1300,
      fanMode: "manual",
      fanManual: 75,
      fanAutoRange: [30, 70],
    },
    live: { th: 104, watts: 1300, chipTemp: 67, fanSpeed: 75 },
  },
];

interface State {
  miners: Miner[];
  selectedId: string | null;
  theme: "light" | "dark";
  scanning: boolean;
  select: (id: string) => void;
  setTheme: (t: "light" | "dark") => void;
  toggleTheme: () => void;
  setPower: (id: string, watts: number) => void;
  updateConfig: (id: string, patch: Partial<MinerConfig>) => void;
  togglePause: (id: string) => void;
  scan: () => Promise<void>;
  /** mock live ticker */
  _tick: () => void;
}

export const useMiners = create<State>()(
  persist(
    (set, get) => ({
      miners: seed(),
      selectedId: "m1",
      theme: "dark",
      scanning: false,

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
            // clamp target to bounds
            config.powerTarget = Math.min(
              config.powerMax,
              Math.max(config.powerMin, config.powerTarget)
            );
            return { ...m, config };
          }),
        })),

      togglePause: (id) =>
        set((s) => ({
          miners: s.miners.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: m.status === "paused" ? "mining" : "paused",
                }
              : m
          ),
        })),

      scan: async () => {
        set({ scanning: true });
        // Mocked LAN scan — in real build this iterates 192.168.x.1..254
        await new Promise((r) => setTimeout(r, 1400));
        set({ scanning: false });
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
            // efficiency: TH scales roughly linearly with power around a curve
            const targetTh = (target / 11.5) + jitter(1.2);
            const targetTemp = 45 + (target - 500) * 0.022 + jitter(0.6);
            const targetFan =
              m.config.fanMode === "manual"
                ? m.config.fanManual
                : clampFan(
                    m.config.fanAutoRange,
                    30 + (targetTemp - 45) * 1.6
                  );
            return {
              ...m,
              live: {
                watts: lerp(m.live.watts, target + jitter(6), 0.35),
                th: lerp(m.live.th, targetTh, 0.25),
                chipTemp: lerp(m.live.chipTemp, targetTemp, 0.12),
                fanSpeed: lerp(m.live.fanSpeed, targetFan, 0.2),
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
