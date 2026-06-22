import { useMiners } from "@/store/miners";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Radar, Loader2, Check } from "lucide-react";
import { displayStatus, statusLabel, type DisplayStatus } from "@/lib/status";

// Status colours, used identically for the trigger dot and every list dot so
// two running miners never render differently. Green = mining, grey = paused,
// red = offline.
const DOT_BG: Record<DisplayStatus, string> = {
  mining: "hsl(140 70% 50%)",
  paused: "hsl(var(--muted-foreground))",
  offline: "hsl(var(--destructive))",
};
const LABEL_CLASS: Record<DisplayStatus, string> = {
  mining: "text-[hsl(140_70%_45%)]",
  paused: "text-muted-foreground",
  offline: "text-destructive",
};

function StatusDot({ status }: { status: DisplayStatus }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
      {status === "mining" && (
        <span
          className="absolute inset-0 rounded-full blur-[2px]"
          style={{ background: "hsl(140 80% 55% / 0.7)" }}
        />
      )}
      <span
        className="relative h-2 w-2 rounded-full"
        style={{
          background: DOT_BG[status],
          boxShadow: status === "mining" ? "0 0 6px hsl(140 80% 55% / 0.8)" : "none",
        }}
      />
    </span>
  );
}

export function MinerSwitcher() {
  const miners = useMiners((s) => s.miners);
  const selectedId = useMiners((s) => s.selectedId);
  const select = useMiners((s) => s.select);
  const scan = useMiners((s) => s.scan);
  const scanning = useMiners((s) => s.scanning);
  const liveMode = useMiners((s) => s.liveMode);

  const current = miners.find((m) => m.id === selectedId) ?? miners[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex items-center gap-2 px-3 py-2 rounded-sm hover:bg-secondary/60 transition-colors text-muted-foreground/70">
        {current && <StatusDot status={displayStatus(current, liveMode)} />}
        <span className="text-[11px] tracking-display uppercase">
          {current?.config.name ?? "—"}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[10px] tracking-display text-muted-foreground">
          Miners on LAN
        </DropdownMenuLabel>
        {miners.map((m) => {
          const status = displayStatus(m, liveMode);
          const selected = m.id === selectedId;
          return (
            <DropdownMenuItem
              key={m.id}
              onClick={() => select(m.id)}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <StatusDot status={status} />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm truncate flex items-center gap-1.5">
                    {m.config.name}
                    {selected && (
                      <Check className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-readout truncate">
                    {m.ip} · {m.model}
                  </span>
                </div>
              </div>
              {/* Live per-miner state — NOT "selected". Every running miner
                  reads ON regardless of which one is in view. */}
              <span
                className={`text-[10px] tracking-display ${LABEL_CLASS[status]}`}
              >
                {statusLabel(status)}
              </span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            scan();
          }}
          className="gap-2"
        >
          {scanning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Radar className="h-3.5 w-3.5" />
          )}
          <span className="text-sm">
            {scanning ? "Scanning LAN…" : "Scan LAN"}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
