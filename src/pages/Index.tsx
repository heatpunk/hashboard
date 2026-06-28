import { useEffect, useState } from "react";
import { useMiners } from "@/store/miners";
import { PowerSlider } from "@/components/PowerSlider";
import { Readout } from "@/components/Readout";
import { MinerSwitcher } from "@/components/MinerSwitcher";
import { SettingsDialog } from "@/components/SettingsDialog";
import { PasswordDialog } from "@/components/PasswordDialog";
import { axisLabels } from "@/lib/axis";
import { scaledTarget } from "@/lib/power";
import glassLeft from "@/assets/glass-button-left.png";
import glassRight from "@/assets/glass-button-right.png";

const frost = {
  filter:
    "blur(0.2px) drop-shadow(0 0.5px 0.5px rgba(0,0,0,0.5)) drop-shadow(0 0 1.5px rgba(255,255,255,0.25))",
  opacity: 0.92,
};

const Index = () => {
  const miners = useMiners((s) => s.miners);
  const selectedId = useMiners((s) => s.selectedId);
  const setPower = useMiners((s) => s.setPower);
  const commitPowerTarget = useMiners((s) => s.commitPowerTarget);
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
  const ba = miner.boards?.active ?? 1;
  const bt = miner.boards?.total ?? 1;
  const axis = axisLabels(
    scaledTarget(miner.config.powerMin, ba, bt),
    scaledTarget(miner.config.powerMax, ba, bt),
  );
  const displayTarget = miner.boards
    ? scaledTarget(miner.config.powerTarget, miner.boards.active, miner.boards.total)
    : miner.config.powerTarget;

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
          <div className="flex flex-col justify-between py-1 font-readout text-[10px] text-muted-foreground tabular-nums" style={{ width: 78 }}>
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
                  onCommit={() => commitPowerTarget(miner.id)}
                  disabled={paused}
                />
              ) : (
                <div className="h-full flex items-center justify-center opacity-20 text-xs tracking-display">
                  connecting
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end justify-center" style={{ width: 78 }}>
            <span className="text-[9px] tracking-display text-muted-foreground/70">
              Target
            </span>
            <span className="font-readout text-xl sm:text-2xl font-light leading-none mt-1.5 tabular-nums">
              {miner.config.powerMax > 0 ? Math.round(displayTarget) : "—"}
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
            className="pointer-events-auto justify-self-start h-11 w-11 rounded-full flex items-center justify-center hover:brightness-125 transition-all active:scale-90"
            style={{ backgroundImage: `url(${glassLeft})`, backgroundSize: "cover", backgroundPosition: "center" }}
          >
            {paused ? (
              <svg viewBox="0 0 44 44" className="h-11 w-11" style={frost} aria-hidden="true">
                <polygon points="17.8,15.6 28.4,22 17.8,28.4" fill="#eef2f8" />
              </svg>
            ) : (
              <svg viewBox="0 0 44 44" className="h-11 w-11" style={frost} aria-hidden="true">
                <rect x="18.5" y="15.6" width="2.4" height="12.8" rx="1.1" fill="#eef2f8" />
                <rect x="23.1" y="15.6" width="2.4" height="12.8" rx="1.1" fill="#eef2f8" />
              </svg>
            )}
          </button>
          <div className="pointer-events-auto justify-self-center">
            <MinerSwitcher />
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="pointer-events-auto justify-self-end h-11 w-11 rounded-full flex items-center justify-center hover:brightness-125 transition-all active:scale-90"
            style={{ backgroundImage: `url(${glassRight})`, backgroundSize: "cover", backgroundPosition: "center" }}
          >
            <svg viewBox="0 0 44 44" className="h-11 w-11" style={frost} aria-hidden="true">
              <g fill="#eef2f8">
                <circle cx="22" cy="22" r="4.4" />
                <rect x="21.01" y="15.18" width="1.98" height="2.2" rx="0.44" transform="rotate(0 22 22)" />
                <rect x="21.01" y="15.18" width="1.98" height="2.2" rx="0.44" transform="rotate(45 22 22)" />
                <rect x="21.01" y="15.18" width="1.98" height="2.2" rx="0.44" transform="rotate(90 22 22)" />
                <rect x="21.01" y="15.18" width="1.98" height="2.2" rx="0.44" transform="rotate(135 22 22)" />
                <rect x="21.01" y="15.18" width="1.98" height="2.2" rx="0.44" transform="rotate(180 22 22)" />
                <rect x="21.01" y="15.18" width="1.98" height="2.2" rx="0.44" transform="rotate(225 22 22)" />
                <rect x="21.01" y="15.18" width="1.98" height="2.2" rx="0.44" transform="rotate(270 22 22)" />
                <rect x="21.01" y="15.18" width="1.98" height="2.2" rx="0.44" transform="rotate(315 22 22)" />
              </g>
              <circle cx="22" cy="22" r="1.76" fill="#0c0d0f" />
            </svg>
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
