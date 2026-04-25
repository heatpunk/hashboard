interface Props {
  label: string;
  value: string;
  unit?: string;
}

export function Readout({ label, value, unit }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 min-w-0">
      <span className="text-[10px] tracking-display text-muted-foreground">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="font-readout text-2xl sm:text-3xl font-light tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-[10px] tracking-display text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
