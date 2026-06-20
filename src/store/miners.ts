import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Miner, MinerConfig } from "@/lib/types";
import { fetchMinerStats, scanLAN, setMinerPaused } from "@/lib/minerApi";

const STORAGE_KEY = "hashboard.state.v2";

const seed = (): Miner[] => [];

interface State {
  miners: Miner[];
  selectedId: string | null;
  theme: "light" | "dark";
  scanning: boolean;
  /** true when at least one miner responded with real data on last poll */
  liveMode: boolean;
  /** miner awaiting an API password — for control (pause/resume) or just to
   *  read the power target. `paused` only applies to control prompts. */
  pwPrompt: { minerId: string; reason: "control" | "read"; paused?: boolean } | null;
  /** miners whose password prompt the user dismissed this session — don't nag */
  pwDismissed: Record<string, boolean>;
  /** optimistic pause/resume per miner for instant button feedback */
  intents: Record<string, { paused: boolean; until: number }>;

  select: (id: string) => void;
  setTheme: (t: "light" | "dark") => void;
  toggleTheme: () => void;
  setPower: (id: string, watts: number) => void;
  updateConfig: (id: string, patch: Partial<MinerConfig>) => void;
  updateIp: (id: string, ip: string) => void;
  togglePause: (id: string) => Promise<void>;
  submitMinerPassword: (pw: string) => Promise<void>;
  dismissPwPrompt: () => void;
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
      selectedId: null,
      theme: "dark",
      scanning: false,
      liveMode: false,
      pwPrompt: null,
      pwDismissed: {},
      intents: {},

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

      togglePause: async (id) => {
        const { miners, liveMode, intents } = get();
        const m = miners.find((x) => x.id === id);
        if (!m) return;
        const currentlyPaused = intents[id]?.paused ?? (liveMode ? m.live.th <= 0.5 : m.status === "paused");
        const desiredPaused = !currentlyPaused;
        // optimistic: flip the icon instantly, hold ~20s until polls confirm
        set((s) => ({
          intents: { ...s.intents, [id]: { paused: desiredPaused, until: Date.now() + 20000 } },
          miners: s.miners.map((x) =>
            x.id === id ? { ...x, status: desiredPaused ? "paused" : "mining" } : x
          ),
        }));
        const res = await setMinerPaused(m.ip, desiredPaused, m.config.apiPassword);
        if (res.needPassword) {
          set((s) => { const i = { ...s.intents }; delete i[id]; return { intents: i, pwPrompt: { minerId: id, reason: "control", paused: desiredPaused } }; });
        } else if (!res.ok) {
          set((s) => { const i = { ...s.intents }; delete i[id]; return { intents: i }; });
        }
      },

      submitMinerPassword: async (pw) => {
        const prompt = get().pwPrompt;
        if (!prompt) return;
        const { minerId, reason, paused } = prompt;
        // Store the password and clear any prior dismissal for this miner.
        set((s) => {
          const dismissed = { ...s.pwDismissed };
          delete dismissed[minerId];
          return {
            pwPrompt: null,
            pwDismissed: dismissed,
            miners: s.miners.map((x) =>
              x.id === minerId ? { ...x, config: { ...x.config, apiPassword: pw } } : x
            ),
          };
        });

        // "read": password only needed to read the power target — refresh now.
        if (reason === "read") {
          await get().pollLive();
          return;
        }

        // "control": also apply the intended pause/resume.
        set((s) => ({
          intents: { ...s.intents, [minerId]: { paused: !!paused, until: Date.now() + 20000 } },
          miners: s.miners.map((x) =>
            x.id === minerId ? { ...x, status: paused ? "paused" : "mining" } : x
          ),
        }));
        const m = get().miners.find((x) => x.id === minerId);
        if (m) {
          const res = await setMinerPaused(m.ip, !!paused, pw);
          if (res.ok) {
            set((s) => ({
              miners: s.miners.map((x) =>
                x.id === minerId ? { ...x, status: paused ? "paused" : "mining" } : x
              ),
            }));
          } else if (res.needPassword) {
            set({ pwPrompt: { minerId, reason: "control", paused } });
          }
        }
      },

      dismissPwPrompt: () =>
        set((s) =>
          s.pwPrompt
            ? { pwPrompt: null, pwDismissed: { ...s.pwDismissed, [s.pwPrompt.minerId]: true } }
            : { pwPrompt: null }
        ),

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
            const snap = await fetchMinerStats(m.ip, m.config.apiPassword);
            return { id: m.id, snap };
          })
        );

        const anyLive = fetched.some((f) => f.snap != null);

        set((s) => ({
          liveMode: anyLive,
          miners: s.miners.map((m) => {
            const entry = fetched.find((f) => f.id === m.id);
            const snap = entry?.snap;
            if (!snap) return m;
            const live = snap.live;
            // proxy scales machineTarget by (active boards / total boards); use directly.
            // fall back to stored powerMax when gRPC is unavailable (no password yet).
            const powerMax =
              snap.machineTarget != null && snap.machineTarget > 0
                ? snap.machineTarget
                : m.config.powerMax;
            const powerMin =
              snap.machineMin != null && snap.machineMin > 0
                ? Math.min(snap.machineMin, powerMax)
                : m.config.powerMin;
            const powerTarget = Math.min(
              powerMax,
              Math.max(powerMin, snap.machineTarget ?? m.config.powerTarget)
            );
            return {
              ...m,
              boards: snap.boards ?? m.boards,
              config: { ...m.config, powerMin, powerMax, powerTarget },
              live: {
                th: live.th,
                watts: live.watts ?? m.live.watts,
                chipTemp: live.chipTemp ?? m.live.chipTemp,
                fanSpeed: live.fanSpeed ?? m.live.fanSpeed,
              },
            };
          }),
        }));

        // If the visible miner is reachable but needs a password to read its
        // power target, raise the same dialog used for control — once, unless
        // the user dismissed it. (Wrong stored passwords re-prompt; dismissal
        // stops the nag.)
        const cur = get();
        const selId = cur.selectedId ?? cur.miners[0]?.id ?? null;
        if (selId && !cur.pwPrompt && !cur.pwDismissed[selId]) {
          const entry = fetched.find((f) => f.id === selId);
          if (entry?.snap?.needPassword) {
            set({ pwPrompt: { minerId: selId, reason: "read" } });
          }
        }

        const now = Date.now();
        set((s) => {
          let changed = false;
          const intents = { ...s.intents };
          for (const mm of s.miners) {
            const it = intents[mm.id];
            if (it && (now > it.until || ((mm.live.th ?? 0) <= 0.5) === it.paused)) {
              delete intents[mm.id];
              changed = true;
            }
          }
          return changed ? { intents } : {};
        });
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
        // In live mode the real values come from pollLive — don't let the
        // simulation overwrite them.
        if (get().liveMode) return;
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
            return {
              ...m,
              live: {
                watts: lerp(m.live.watts, target + jitter(6), 0.08),
                th: lerp(m.live.th, targetTh, 0.08),
                chipTemp: lerp(m.live.chipTemp, targetTemp, 0.04),
                fanSpeed: lerp(m.live.fanSpeed, 60, 0.06),
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

