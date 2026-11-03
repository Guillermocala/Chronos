"use client";

import { useEffect, useState, type CSSProperties } from "react";

import type { Celebration } from "@/lib/action-result";

// Confeti propio (sin dependencias): `celebrate()` emite un evento y la capa,
// montada una vez en el layout raíz, lo dibuja. Con "reducir movimiento" no se muestra.

const EVENT = "chronos:celebrate";
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "#facc15"];

export function celebrate(level: Celebration) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Celebration>(EVENT, { detail: level }));
}

type Piece = { id: number; left: number; dx: number; rot: number; delay: number; duration: number; color: string; size: number };

function makePieces(count: number, seed: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: seed + i,
    left: Math.random() * 100,
    dx: (Math.random() - 0.5) * 240,
    rot: (Math.random() - 0.5) * 1080,
    delay: Math.random() * 250,
    duration: 1600 + Math.random() * 1200,
    color: COLORS[i % COLORS.length],
    size: 6 + Math.random() * 6,
  }));
}

export function CelebrationLayer() {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onCelebrate = (event: Event) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const level = (event as CustomEvent<Celebration>).detail;
      setPieces(makePieces(level === "big" ? 120 : 36, Date.now()));
      clearTimeout(timer);
      timer = setTimeout(() => setPieces([]), 3200);
    };
    window.addEventListener(EVENT, onCelebrate);
    return () => {
      window.removeEventListener(EVENT, onCelebrate);
      clearTimeout(timer);
    };
  }, []);

  if (pieces.length === 0) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute -top-4 block rounded-[2px]"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.45,
              background: p.color,
              animation: `confetti-fall ${p.duration}ms cubic-bezier(.2,.6,.4,1) ${p.delay}ms forwards`,
              "--confetti-dx": `${p.dx}px`,
              "--confetti-rot": `${p.rot}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
