import { useMiners } from "@/store/miners";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Radar, Loader2, Circle } from "lucide-react";

export function MinerSwitcher() {
  const miners = useMiners((s) => s.miners);
  const selectedId = useMiners((s) => s.selectedId);
  const select = useMiners((s) => s.select);
  const scan = useMiners((s) => s.scan);
  const scanning = useMiners((s) => s.scanning);

  const current = miners.find((m) => m.id === selectedId) ?? miners[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex items-center gap-2 px-3 py-2 rounded-sm hover:bg-secondary/60 transition-colors">
        <Circle
          className={`h-2 w-2 ${
            current?.status === "mining"
              ? "fill-accent text-accent"
              : current?.status === "paused"
              ? "fill-muted-foreground text-muted-foreground"
              : "fill-destructive text-destructive"
          }`}
        />
        <span className="text-sm font-medium">
          {current?.config.name ?? "—"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[10px] tracking-display text-muted-foreground">
          Miners on LAN
        </DropdownMenuLabel>
        {miners.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => select(m.id)}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Circle
                className={`h-2 w-2 shrink-0 ${
                  m.status === "mining"
                    ? "fill-accent text-accent"
                    : m.status === "paused"
                    ? "fill-muted-foreground text-muted-foreground"
                    : "fill-destructive text-destructive"
                }`}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm truncate">{m.config.name}</span>
                <span className="text-[10px] text-muted-foreground font-readout truncate">
                  {m.ip} · {m.model}
                </span>
              </div>
            </div>
            {m.id === selectedId && (
              <span className="text-[10px] tracking-display text-muted-foreground">
                ON
              </span>
            )}
          </DropdownMenuItem>
        ))}
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
