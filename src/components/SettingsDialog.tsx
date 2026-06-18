import { useEffect, useState } from "react";
import { useMiners } from "@/store/miners";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  minerId: string;
}

export function SettingsDialog({ open, onOpenChange, minerId }: Props) {
  const miner = useMiners((s) => s.miners.find((m) => m.id === minerId));
  const updateConfig = useMiners((s) => s.updateConfig);
  const updateIp = useMiners((s) => s.updateIp);
  const removeMiner = useMiners((s) => s.removeMiner);
  const theme = useMiners((s) => s.theme);
  const toggleTheme = useMiners((s) => s.toggleTheme);
  const liveMode = useMiners((s) => s.liveMode);

  const [name, setName] = useState("");
  const [ip, setIp] = useState("");

  useEffect(() => {
    if (!miner) return;
    setName(miner.config.name);
    setIp(miner.ip);
  }, [miner?.id, open]);

  if (!miner) return null;

  const fanAuto = miner.config.fanMode === "auto";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="tracking-display text-xs font-medium">
            Settings
          </DialogTitle>
          <DialogDescription className="text-xs flex items-center gap-2">
            {miner.model}
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] tracking-display"
              style={{
                background: liveMode
                  ? "hsl(140 60% 50% / 0.15)"
                  : "hsl(var(--muted) / 0.5)",
                color: liveMode
                  ? "hsl(140 70% 45%)"
                  : "hsl(var(--muted-foreground))",
              }}
            >
              {liveMode ? "LIVE" : "SIM"}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Name */}
          <div className="space-y-2">
            <Label className="text-[10px] tracking-display text-muted-foreground">
              Device name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => updateConfig(miner.id, { name })}
              className="font-readout"
            />
          </div>

          {/* IP address */}
          <div className="space-y-2">
            <Label className="text-[10px] tracking-display text-muted-foreground">
              IP address
            </Label>
            <Input
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              onBlur={() => {
                if (ip.trim()) updateIp(miner.id, ip.trim());
              }}
              className="font-readout"
              placeholder="192.168.1.106"
            />
          </div>

          <Separator />

          {/* Power range */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] tracking-display text-muted-foreground">
                Power range
              </Label>
              <span className="font-readout text-xs text-muted-foreground">
                {miner.config.powerMin}–{miner.config.powerMax} W
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/70 leading-snug">
              {miner.boards
                ? `${miner.boards.active} / ${miner.boards.total} hashboards aktiva — gränserna skalas efter detta`
                : "Skalas efter aktiva hashboards"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Min</Label>
                <Input
                  type="number"
                  value={miner.config.powerMin}
                  readOnly
                  title="Skalas efter aktiva hashboards - andras inte har"
                  className="font-readout opacity-60 cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Max (maskin)</Label>
                <Input
                  type="number"
                  value={miner.config.powerMax}
                  readOnly
                  title="Hämtas från maskinens inställda target — kan inte höjas här"
                  className="font-readout opacity-60 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Fan */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] tracking-display text-muted-foreground">
                Auto fan
              </Label>
              <Switch
                checked={fanAuto}
                onCheckedChange={(v) =>
                  updateConfig(miner.id, { fanMode: v ? "auto" : "manual" })
                }
              />
            </div>

            {fanAuto ? (
              <div className="space-y-2">
                <div className="flex justify-between font-readout text-xs text-muted-foreground">
                  <span>Range</span>
                  <span>
                    {miner.config.fanAutoRange[0]}–{miner.config.fanAutoRange[1]}%
                  </span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={miner.config.fanAutoRange}
                  onValueChange={(v) =>
                    updateConfig(miner.id, {
                      fanAutoRange: [v[0], v[1]] as [number, number],
                    })
                  }
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between font-readout text-xs text-muted-foreground">
                  <span>Manual</span>
                  <span>{miner.config.fanManual}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[miner.config.fanManual]}
                  onValueChange={(v) =>
                    updateConfig(miner.id, { fanManual: v[0] })
                  }
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Theme */}
          <div className="flex items-center justify-between">
            <Label className="text-[10px] tracking-display text-muted-foreground">
              Dark mode
            </Label>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={() => toggleTheme()}
            />
          </div>

          <Separator />

          {/* Remove miner */}
          <Button
            variant="destructive"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              removeMiner(miner.id);
              onOpenChange(false);
            }}
          >
            Remove this miner
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
