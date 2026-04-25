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
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-foreground" />
          <h1 className="text-xs tracking-display font-medium">Hashboard</h1>
        </div>
        <MinerSwitcher />
      </header>

      {/* Live readouts */}
      <section className="px-4 sm:px-8 pt-8 pb-4">
        <div className="grid grid-cols-4 gap-2 sm:gap-6 max-w-3xl mx-auto">
          <Readout
            label="W"
            value={Math.round(miner.live.watts).toString()}
            unit="watt"
          />
          <Readout
            label="TH"
            value={miner.live.th.toFixed(1)}
            unit="th/s"
          />
          <Readout label="W/TH" value={wth} unit="ratio" />
          <Readout
            label="CT"
            value={Math.round(miner.live.chipTemp).toString()}
            unit="°c"
          />
        </div>
      </section>

      {/* Slider area */}
      <section className="flex-1 flex items-stretch justify-center px-6 sm:px-8 pb-24 min-h-0">
        <div className="flex items-stretch gap-8 sm:gap-12 w-full max-w-md">
          {/* scale */}
          <div className="flex flex-col justify-between py-1 font-readout text-[10px] text-muted-foreground tabular-nums">
            <span>{miner.config.powerMax}</span>
            <span>
              {Math.round((miner.config.powerMax + miner.config.powerMin) / 2)}
            </span>
            <span>{miner.config.powerMin}</span>
          </div>

          <div className="flex-1 flex items-center">
            <PowerSlider
              min={miner.config.powerMin}
              max={miner.config.powerMax}
              value={miner.config.powerTarget}
              onChange={(v) => setPower(miner.id, v)}
              disabled={paused}
            />
          </div>

          {/* current target */}
          <div className="flex flex-col items-end justify-center min-w-[5rem]">
            <span className="text-[10px] tracking-display text-muted-foreground">
              Target
            </span>
            <span className="font-readout text-3xl sm:text-4xl font-light leading-none mt-1">
              {Math.round(miner.config.powerTarget)}
            </span>
            <span className="text-[10px] tracking-display text-muted-foreground mt-1">
              watt
            </span>
          </div>
        </div>
      </section>

      {/* Footer controls */}
      <footer className="fixed bottom-0 inset-x-0 px-4 sm:px-8 pb-6 pt-3 flex items-center justify-between pointer-events-none">
        <button
          onClick={() => togglePause(miner.id)}
          aria-label={paused ? "Resume mining" : "Pause mining"}
          className="pointer-events-auto h-11 w-11 rounded-full border border-border bg-surface-elevated/80 backdrop-blur flex items-center justify-center hover:bg-secondary transition-colors"
          style={{ background: "hsl(var(--surface-elevated) / 0.85)" }}
        >
          {paused ? (
            <Play className="h-4 w-4" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="pointer-events-auto h-11 w-11 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors"
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
