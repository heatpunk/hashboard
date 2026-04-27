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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  minerId: string;
}

export function SettingsDialog({ open, onOpenChange, minerId }: Props) {
  const miner = useMiners((s) => s.miners.find((m) => m.id === minerId));
  const updateConfig = useMiners((s) => s.updateConfig);
  const theme = useMiners((s) => s.theme);
  const toggleTheme = useMiners((s) => s.toggleTheme);

  const [name, setName] = useState("");
  const [pMin, setPMin] = useState(500);
  const [pMax, setPMax] = useState(1500);

  useEffect(() => {
    if (!miner) return;
    setName(miner.config.name);
    setPMin(miner.config.powerMin);
    setPMax(miner.config.powerMax);
  }, [miner?.id, open]);

  if (!miner) return null;

  const fanAuto = miner.config.fanMode === "auto";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="tracking-display text-xs font-medium">
            Settings
          </DialogTitle>
          <DialogDescription className="text-xs">
            {miner.model} · {miner.ip}
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

          <Separator />

          {/* Power range */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] tracking-display text-muted-foreground">
                Power range
              </Label>
              <span className="font-readout text-xs text-muted-foreground">
                {pMin}–{pMax} W
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Min</Label>
                <Input
                  type="number"
                  value={pMin}
                  onChange={(e) => setPMin(Number(e.target.value))}
                  onBlur={() =>
                    updateConfig(miner.id, { powerMin: pMin })
                  }
                  className="font-readout"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Max</Label>
                <Input
                  type="number"
                  value={pMax}
                  onChange={(e) => setPMax(Number(e.target.value))}
                  onBlur={() =>
                    updateConfig(miner.id, { powerMax: pMax })
                  }
                  className="font-readout"
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
                    {miner.config.fanAutoRange[0]}–
                    {miner.config.fanAutoRange[1]}%
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
