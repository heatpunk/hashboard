import { useEffect, useState } from "react";
import { useMiners } from "@/store/miners";
import { PowerSlider } from "@/components/PowerSlider";
import { Readout } from "@/components/Readout";
import { MinerSwitcher } from "@/components/MinerSwitcher";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Settings, Pause, Play } from "lucide-react";

const Index = () => {
  const miners = useMiners((s) => s.miners);
  const selectedId = useMiners((s) => s.selectedId);
  const setPower = useMiners((s) => s.setPower);
  const togglePause = useMiners((s) => s.togglePause);
  const tick = useMiners((s) => s._tick);
  const theme = useMiners((s) => s.theme);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const miner =
    miners.find((m) => m.id === selectedId) ?? miners[0];

  // Apply theme class
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Live ticker — simulates real BraiinsOS+ polling
  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  if (!miner) return null;

  const wth =
    miner.live.th > 0.5
      ? (miner.live.watts / miner.live.th).toFixed(1)
      : "—";
  const paused = miner.status === "paused";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Live readouts — högst upp, diskret enradig */}
      <header className="px-4 sm:px-8 pt-2 pb-0 shrink-0">
        <div className="flex items-center justify-center flex-wrap gap-x-5 gap-y-0 max-w-3xl mx-auto opacity-70">
          <Readout label="W" value={Math.round(miner.live.watts).toString()} />
          <Readout label="TH/s" value={miner.live.th.toFixed(1)} />
          <Readout label="W/TH" value={wth} />
          <Readout label="°C" value={Math.round(miner.live.chipTemp).toString()} />
        </div>
      </header>

      {/* Slider area — vertikalt centrerad mellan header och footer */}
      <section className="flex-1 flex items-center justify-center px-4 sm:px-8 pb-20 min-h-0">
        <div className="flex items-stretch gap-4 sm:gap-8 w-full max-w-2xl mx-auto h-[70vh] max-h-full">
          {/* scale (vänster) */}
          <div className="w-14 sm:w-16 flex flex-col justify-between py-1 font-readout text-[10px] text-muted-foreground tabular-nums">
            <span>{miner.config.powerMax}</span>
            <span>
              {Math.round((miner.config.powerMax + miner.config.powerMin) / 2)}
            </span>
            <span>{miner.config.powerMin}</span>
          </div>

          {/* slider (mitten) */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-32 sm:w-40 h-full max-h-none">
              <PowerSlider
                min={miner.config.powerMin}
                max={miner.config.powerMax}
                value={miner.config.powerTarget}
                onChange={(v) => setPower(miner.id, v)}
                disabled={paused}
              />
            </div>
          </div>

          {/* target (höger) — samma bredd som scale för balans */}
          <div className="w-14 sm:w-16 flex flex-col items-end justify-center">
            <span className="text-[9px] tracking-display text-muted-foreground/70">
              Target
            </span>
            <span className="font-readout text-xl sm:text-2xl font-light leading-none mt-1.5 tabular-nums">
              {Math.round(miner.config.powerTarget)}
            </span>
            <span className="text-[9px] tracking-display text-muted-foreground/60 mt-1">
              watt
            </span>
          </div>
        </div>
      </section>

      {/* Footer controls */}
      <footer className="fixed bottom-0 inset-x-0 px-4 sm:px-8 pb-6 pt-3 grid grid-cols-[1fr_auto_1fr] items-center pointer-events-none">
        <button
          onClick={() => togglePause(miner.id)}
          aria-label={paused ? "Resume mining" : "Pause mining"}
          className="pointer-events-auto justify-self-start h-11 w-11 rounded-full border border-border bg-surface-elevated/80 backdrop-blur flex items-center justify-center hover:bg-secondary transition-colors"
          style={{ background: "hsl(var(--surface-elevated) / 0.85)" }}
        >
          {paused ? (
            <Play className="h-4 w-4" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
        </button>

        <div className="pointer-events-auto justify-self-center">
          <MinerSwitcher />
        </div>

        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="pointer-events-auto justify-self-end h-11 w-11 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors"
          style={{ background: "hsl(var(--surface-elevated) / 0.85)" }}
        >
          <Settings className="h-4 w-4" />
        </button>
      </footer>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        minerId={miner.id}
      />
    </div>
  );
};

export default Index;
