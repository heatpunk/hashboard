import { useEffect, useState } from "react";
import { useMiners } from "@/store/miners";
import { PowerSlider } from "@/components/PowerSlider";
import { Readout } from "@/components/Readout";
import { MinerSwitcher } from "@/components/MinerSwitcher";
import { SettingsDialog } from "@/components/SettingsDialog";
import { PasswordDialog } from "@/components/PasswordDialog";
import { axisLabels } from "@/lib/axis";
import { Settings, Pause, Play } from "lucide-react";

const Index = () => {
  const miners = useMiners((s) => s.miners);
  const selectedId = useMiners((s) => s.selectedId);
  const setPower = useMiners((s) => s.setPower);
  const togglePause = useMiners((s) => s.togglePause);
  const tick = useMiners((s) => s._tick);
  const pollLive = useMiners((s) => s.pollLive);
  const liveMode = useMiners((s) => s.liveMode);
  const intents = useMiners((s) => s.intents);
  const theme = useMiners((s) => s.theme);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const miner = miners.find((m) => m.id === selectedId) ?? miners[0];

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Animation tick — smooth lerp every 1 s
  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  // Real API poll every 5 s via local proxy
  useEffect(() => {
    pollLive();
    const id = setInterval(pollLive, 5000);
    return () => clearInterval(id);
  }, [pollLive]);

  if (!miner) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-6 px-8">
        <h1
          className="text-sm font-light uppercase text-muted-foreground/80"
          style={{ letterSpacing: "0.6em", paddingLeft: "0.6em" }}
        >
          Hashboard
        </h1>
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          No miners configured. Open the menu below and tap <strong>Scan LAN</strong> to find miners on your network, or add one manually in Settings.
        </p>
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-3 flex justify-center">
          <MinerSwitcher />
        </div>
      </div>
    );
  }

  const wth =
    miner.live.th > 0.5
      ? (miner.live.watts / miner.live.th).toFixed(1)
      : "—";
  const intent = intents[miner.id];
  const paused = intent ? intent.paused : liveMode ? miner.live.th <= 0.5 : miner.status === "paused";
  const axis = axisLabels(miner.config.powerMin, miner.config.powerMax);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Live readouts */}
      <header className="px-4 sm:px-8 pt-2 pb-0 shrink-0">
        <div className="flex items-center justify-center flex-wrap gap-x-5 gap-y-0 max-w-3xl mx-auto opacity-70">
          <Readout label="W" value={Math.round(miner.live.watts).toString()} />
          <Readout label="TH/s" value={miner.live.th.toFixed(1)} />
          <Readout label="W/TH" value={wth} />
          <Readout label="°C" value={Math.round(miner.live.chipTemp).toString()} />
        </div>
      </header>

      {/* Slider area */}
      <section className="flex-1 flex items-center justify-center px-4 sm:px-8 py-4 min-h-0">
        <div className="flex items-stretch gap-4 sm:gap-8 w-full max-w-2xl mx-auto h-[50vh]">
          <div className="w-14 sm:w-16 flex flex-col justify-between py-1 font-readout text-[10px] text-muted-foreground tabular-nums">
            {miner.config.powerMax > 0 ? (
              <>
                <span>{axis.top}</span>
                <span>{axis.mid}</span>
                <span>{axis.bottom}</span>
              </>
            ) : (
              <span className="self-center opacity-40">—</span>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-32 sm:w-40 h-full max-h-none">
              {miner.config.powerMax > 0 ? (
                <PowerSlider
                  min={miner.config.powerMin}
                  max={miner.config.powerMax}
                  value={miner.config.powerTarget}
                  onChange={(v) => setPower(miner.id, v)}
                  disabled={paused}
                />
              ) : (
                <div className="h-full flex items-center justify-center opacity-20 text-xs tracking-display">
                  connecting
                </div>
              )}
            </div>
          </div>
          <div className="w-14 sm:w-16 flex flex-col items-end justify-center">
            <span className="text-[9px] tracking-display text-muted-foreground/70">
              Target
            </span>
            <span className="font-readout text-xl sm:text-2xl font-light leading-none mt-1.5 tabular-nums">
              {miner.config.powerMax > 0 ? Math.round(miner.config.powerTarget) : "—"}
            </span>
            <span className="text-[9px] tracking-display text-muted-foreground/60 mt-1">
              watt
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="shrink-0 px-4 sm:px-8 pb-4 pt-3 flex flex-col items-center gap-3">
        <h1
          className="text-sm font-light uppercase text-muted-foreground/80"
          style={{ letterSpacing: "0.6em", paddingLeft: "0.6em" }}
        >
          Hashboard
        </h1>
        <div className="w-full grid grid-cols-3 items-center">
          <button
            onClick={() => { try { navigator.vibrate?.(15); } catch (e) {} togglePause(miner.id); }}
            aria-label={paused ? "Resume mining" : "Pause mining"}
            className="pointer-events-auto justify-self-start h-11 w-11 rounded-full border border-border backdrop-blur flex items-center justify-center hover:bg-secondary transition-all active:scale-90"
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
        </div>
      </footer>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        minerId={miner.id}
      />
      <PasswordDialog />
    </div>
  );
};

export default Index;
