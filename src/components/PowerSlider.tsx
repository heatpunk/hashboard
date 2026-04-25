import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

/** Vertical, frictionless power slider with gradient track. */
export function PowerSlider({ min, max, value, onChange, disabled }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const pct = ((value - min) / (max - min)) * 100;

  const update = useCallback(
    (clientY: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = 1 - (clientY - rect.top) / rect.height;
      const clamped = Math.min(1, Math.max(0, ratio));
      onChange(min + clamped * (max - min));
    },
    [min, max, onChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => update(e.clientY);
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, update]);

  return (
    <div className="flex h-full w-full items-center justify-center select-none">
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          if (disabled) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setDragging(true);
          update(e.clientY);
        }}
        className={`relative h-full w-16 rounded-full overflow-hidden cursor-pointer transition-opacity ${
          disabled ? "opacity-40 cursor-not-allowed" : ""
        }`}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        aria-orientation="vertical"
        tabIndex={0}
        onKeyDown={(e) => {
          if (disabled) return;
          const step = (max - min) / 100;
          if (e.key === "ArrowUp") onChange(Math.min(max, value + step));
          if (e.key === "ArrowDown") onChange(Math.max(min, value - step));
        }}
      >
        {/* faint track */}
        <div className="absolute inset-0 bg-secondary" />
        {/* filled gradient up to value */}
        <div
          className="absolute inset-x-0 bottom-0 power-gradient transition-[height] duration-150 ease-out"
          style={{ height: `${pct}%` }}
        />
        {/* hairline marks */}
        <div className="absolute inset-0 pointer-events-none">
          {[0.25, 0.5, 0.75].map((t) => (
            <div
              key={t}
              className="absolute left-0 right-0 h-px"
              style={{ bottom: `${t * 100}%`, background: "hsl(var(--hairline))" }}
            />
          ))}
        </div>
        {/* thumb indicator */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-foreground/90 shadow-[0_0_0_3px_hsl(var(--background))]"
          style={{ bottom: `calc(${pct}% - 2px)` }}
        />
      </div>
    </div>
  );
}
