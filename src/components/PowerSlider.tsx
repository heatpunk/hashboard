import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  disabled?: boolean;
}

const LIQUID =
  "linear-gradient(to top,#F4B11A 0%,#F58E1E 18%,#F26A16 36%,#EE4F2A 52%,#C8447F 68%,#9A4FC4 84%,#7E45C8 100%)";
const GLASS_EMPTY = "linear-gradient(180deg,#161619 0%,#0e0e11 60%,#0a0a0c 100%)";

const STOPS: Array<[number, [number, number, number]]> = [
  [0.0, [244, 177, 26]], [0.18, [245, 142, 30]], [0.36, [242, 106, 22]],
  [0.52, [238, 79, 42]], [0.68, [200, 68, 127]], [0.84, [154, 79, 196]], [1.0, [126, 69, 200]],
];
function sampleColor(t: number): [number, number, number] {
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const a = STOPS[i - 1], b = STOPS[i];
      const f = (t - a[0]) / ((b[0] - a[0]) || 1);
      return [0, 1, 2].map((k) => Math.round(a[1][k] + (b[1][k] - a[1][k]) * f)) as [number, number, number];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

if (typeof document !== "undefined" && !document.getElementById("hb-capsule-kf")) {
  const s = document.createElement("style");
  s.id = "hb-capsule-kf";
  s.textContent = "@keyframes hbBreath{0%,100%{transform:scaleY(.9)}50%{transform:scaleY(1.14)}}";
  document.head.appendChild(s);
}

const overlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "inherit",
  pointerEvents: "none",
};

export function PowerSlider({ min, max, value, onChange, onCommit, disabled }: Props) {
  const capRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const fill = pct * 100;
  const bubbleShown = fill > 1.5 && fill < 99;
  const [r, g, b] = sampleColor(pct);
  const bubbleColor = `rgb(${r},${g},${b})`;

  const bubbleBase: React.CSSProperties = {
    position: "absolute",
    left: "6%",
    right: "6%",
    bottom: `calc(${fill}% - 8px)`,
    height: 16,
    transformOrigin: "center",
    borderRadius: "50%",
    opacity: bubbleShown ? 1 : 0,
    pointerEvents: "none",
    ...(disabled ? {} : { animation: "hbBreath 4.2s ease-in-out infinite" }),
  };

  const setFromY = useCallback(
    (clientY: number) => {
      const el = capRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height));
      onChange(min + ratio * (max - min));
    },
    [min, max, onChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => { e.preventDefault(); setFromY(e.clientY); };
    const up = () => { setDragging(false); onCommit?.(value); };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, setFromY, onCommit, value]);

  return (
    <div className="flex h-full w-full items-center justify-center select-none">
      <div
        ref={capRef}
        role="slider"
        tabIndex={0}
        aria-label="Power target"
        aria-orientation="vertical"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        onPointerDown={(e) => {
          if (disabled) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setDragging(true);
          setFromY(e.clientY);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          const step = (max - min) / (e.shiftKey ? 20 : 100);
          if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); const n = Math.min(max, value + step); onChange(n); onCommit?.(n); }
          else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); const n = Math.max(min, value - step); onChange(n); onCommit?.(n); }
          else if (e.key === "Home") { e.preventDefault(); onChange(max); onCommit?.(max); }
          else if (e.key === "End") { e.preventDefault(); onChange(min); onCommit?.(min); }
        }}
        style={{
          position: "relative",
          width: 66,
          height: "100%",
          borderRadius: 33,
          overflow: "hidden",
          isolation: "isolate",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          boxShadow: "0 22px 52px -38px rgba(0,0,0,.7)",
          cursor: disabled ? "not-allowed" : "ns-resize",
          opacity: disabled ? 0.42 : 1,
          outline: "none",
        }}
      >
        {/* liquid — full-capsule gradient, revealed from the bottom */}
        <div style={{ ...overlay, background: LIQUID }} />

        {/* empty glass — covers the top (100 - fill)% */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: `${100 - fill}%`, background: GLASS_EMPTY, pointerEvents: "none" }} />

        {/* colored bubble — solid liquid colour (back, beneath the glass) */}
        <div style={{ ...bubbleBase, background: bubbleColor }} />

        {/* shiny bubble — white highlight, screen-blended so colour shows through */}
        <div
          style={{
            ...bubbleBase,
            background: "radial-gradient(50% 65% at 50% 35%,rgba(255,255,255,.6),rgba(255,255,255,0) 72%)",
            borderTop: "1px solid rgba(255,255,255,.5)",
            mixBlendMode: "screen",
          }}
        />

        {/* etched measurement rings at 25/50/75% */}
        {[25, 50, 75].map((t) => (
          <div key={t} style={{ position: "absolute", left: "9%", right: "9%", bottom: `${t}%`, height: 13, transform: "translateY(50%)", borderRadius: "50%", borderTop: "1px solid rgba(255,255,255,.16)", boxShadow: "inset 0 1px 1px -1px rgba(0,0,0,.35)", pointerEvents: "none" }} />
        ))}

        {/* cylinder edge shading (wall thickness) */}
        <div style={{ ...overlay, mixBlendMode: "multiply", background: "linear-gradient(90deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.18) 15%,rgba(0,0,0,0) 36%,rgba(0,0,0,0) 62%,rgba(0,0,0,.16) 82%,rgba(0,0,0,.66) 100%)" }} />

        {/* specular streaks */}
        <div
          style={{
            ...overlay,
            mixBlendMode: "screen",
            background: "linear-gradient(90deg,rgba(255,255,255,0) 18%,rgba(255,255,255,.5) 27%,rgba(255,255,255,.06) 35%,rgba(255,255,255,0) 42%),linear-gradient(90deg,rgba(255,255,255,0) 9%,rgba(255,255,255,.6) 12.5%,rgba(255,255,255,0) 16%),linear-gradient(90deg,rgba(255,255,255,0) 82%,rgba(255,255,255,.22) 88%,rgba(255,255,255,0) 93%)",
            WebkitMaskImage: "linear-gradient(180deg,transparent 0,#000 9%,#000 90%,transparent 100%)",
            maskImage: "linear-gradient(180deg,transparent 0,#000 9%,#000 90%,transparent 100%)",
          }}
        />

        {/* dome + base gloss */}
        <div style={{ ...overlay, mixBlendMode: "screen", background: "radial-gradient(58% 20% at 50% 7%,rgba(255,255,255,.72),rgba(255,255,255,0) 72%),radial-gradient(52% 13% at 50% 94%,rgba(255,255,255,.3),rgba(255,255,255,0) 76%)" }} />

        {/* glass rim */}
        <div style={{ ...overlay, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1),inset 0 2px 1px -1px rgba(255,255,255,.22),inset 0 -3px 8px -2px rgba(255,255,255,.05)" }} />
      </div>
    </div>
  );
}
