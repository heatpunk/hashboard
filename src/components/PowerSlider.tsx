import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

/** Vertical, steglös power slider. Gradient-bakgrunden visas alltid;
 *  reglaget är en tunn, exklusiv linje som glider med pekaren. */
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
      // steglöst — ingen avrundning här
      onChange(min + clamped * (max - min));
    },
    [min, max, onChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      e.preventDefault();
      update(e.clientY);
    };
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
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
        className={`relative h-full w-14 rounded-full overflow-hidden touch-none transition-opacity ${
          disabled ? "opacity-40 cursor-not-allowed" : "cursor-ns-resize"
        }`}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        aria-orientation="vertical"
        tabIndex={0}
        onKeyDown={(e) => {
          if (disabled) return;
          const step = (max - min) / 200;
          if (e.key === "ArrowUp") onChange(Math.min(max, value + step));
          if (e.key === "ArrowDown") onChange(Math.max(min, value - step));
        }}
      >
        {/* Full gradient — alltid synlig, mjukt nedtonad */}
        <div className="absolute inset-0 power-gradient opacity-25" />

        {/* Aktiv del — gradient med full styrka upp till värdet */}
        <div
          className="absolute inset-x-0 bottom-0 power-gradient"
          style={{
            height: `${pct}%`,
            transition: dragging ? "none" : "height 120ms ease-out",
          }}
        />

        {/* Hairline-markeringar */}
        <div className="absolute inset-0 pointer-events-none">
          {[0.25, 0.5, 0.75].map((t) => (
            <div
              key={t}
              className="absolute left-3 right-3 h-px"
              style={{ bottom: `${t * 100}%`, background: "hsl(var(--hairline))" }}
            />
          ))}
        </div>

        {/* Tunn, exklusiv reglage-linje */}
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            bottom: `${pct}%`,
            transform: "translateY(50%)",
            transition: dragging ? "none" : "bottom 120ms ease-out",
          }}
        >
          <div
            className="h-px w-full"
            style={{ background: "hsl(var(--foreground))" }}
          />
        </div>
      </div>
    </div>
  );
}
