interface Props {
  label: string;
  value: string;
  unit?: string;
}

export function Readout({ label, value, unit }: Props) {
  return (
    <div className="flex items-baseline justify-center gap-1.5 px-1 min-w-0">
      <span className="text-[9px] tracking-display text-muted-foreground/70">
        {label}
      </span>
      <span className="font-readout text-xs font-light tabular-nums text-foreground/80">
        {value}
      </span>
      {unit && (
        <span className="text-[9px] tracking-display text-muted-foreground/50">
          {unit}
        </span>
      )}
    </div>
  );
}
