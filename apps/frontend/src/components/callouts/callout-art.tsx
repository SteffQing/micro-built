import { useMemo } from "react";
import { cn } from "@/lib/utils";

/*
 * A callout's artwork, made from the callout itself: a mosaic of tiles (squares, quarter and half circles, triangles,
 * dots, rings, bars) in MicroBuilt's colours. The kind picks the palette and which tiles are likely; the id and title
 * seed the layout, so a callout always gets the same picture and two callouts rarely share one. Nobody uploads or
 * picks an image.
 */

const C = {
  red: "oklch(0.40 0.16 29)",
  redLight: "oklch(0.55 0.17 27)",
  wine: "oklch(0.28 0.10 20)",
  rose: "oklch(0.84 0.07 25)",
  blush: "oklch(0.95 0.025 30)",
  gold: "oklch(0.81 0.16 75)",
  goldSoft: "oklch(0.92 0.08 85)",
  cream: "oklch(0.97 0.015 80)",
  stone: "oklch(0.86 0.01 60)",
  charcoal: "oklch(0.24 0.01 30)",
};

type Tile = "blank" | "square" | "quarter" | "half" | "triangle" | "dot" | "ring" | "bars";

const STYLES: Record<CalloutKind, { ground: string; inks: string[]; tiles: Partial<Record<Tile, number>> }> = {
  // Soft and rounded: learning should feel approachable.
  EDUCATION: {
    ground: C.cream,
    inks: [C.red, C.gold, C.rose, C.goldSoft],
    tiles: { blank: 3, quarter: 5, half: 4, dot: 2, square: 1 },
  },
  // Points of light: dots and rings on gold.
  INSIGHT: {
    ground: C.goldSoft,
    inks: [C.gold, C.red, C.cream, C.wine],
    tiles: { blank: 3, dot: 4, ring: 3, quarter: 3, square: 1 },
  },
  // Building blocks.
  PRODUCT: {
    ground: C.red,
    inks: [C.redLight, C.wine, C.rose, C.gold],
    tiles: { blank: 2, square: 4, triangle: 4, quarter: 2 },
  },
  // Signals: angles and stripes.
  ANNOUNCEMENT: {
    ground: C.wine,
    inks: [C.red, C.gold, C.redLight, C.rose],
    tiles: { blank: 2, triangle: 5, bars: 3, half: 2 },
  },
  // Like a chart: bars and blocks on a dark ground.
  STATISTIC: {
    ground: C.charcoal,
    inks: [C.red, C.gold, C.stone, C.redLight],
    tiles: { blank: 3, bars: 5, square: 3, dot: 1 },
  },
  // The crest's angles in red, wine and gold.
  BRAND: {
    ground: C.red,
    inks: [C.wine, C.gold, C.cream, C.redLight],
    tiles: { blank: 2, triangle: 4, quarter: 3, square: 2 },
  },
};

/** FNV-1a: a stable number from text. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded random generator, the same sequence for the same seed. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CELL = 16;

function tileShape(tile: Tile, x: number, y: number, turn: number, ink: string, key: string) {
  const s = CELL;
  const cx = x + s / 2;
  const cy = y + s / 2;
  // Corners in turn order: top-left, top-right, bottom-right, bottom-left.
  const corners = [
    [x, y],
    [x + s, y],
    [x + s, y + s],
    [x, y + s],
  ];
  switch (tile) {
    case "square":
      return <rect key={key} x={x + 2} y={y + 2} width={s - 4} height={s - 4} fill={ink} />;
    case "quarter": {
      const [ox, oy] = corners[turn];
      const [ax, ay] = corners[(turn + 1) % 4];
      const [bx, by] = corners[(turn + 3) % 4];
      return <path key={key} d={`M${ox} ${oy} L${ax} ${ay} A${s} ${s} 0 0 1 ${bx} ${by} Z`} fill={ink} />;
    }
    case "half": {
      const [ax, ay] = corners[turn];
      const [bx, by] = corners[(turn + 1) % 4];
      return <path key={key} d={`M${ax} ${ay} A${s / 2} ${s / 2} 0 0 0 ${bx} ${by} Z`} fill={ink} />;
    }
    case "triangle": {
      const [ax, ay] = corners[turn];
      const [bx, by] = corners[(turn + 1) % 4];
      const [dx, dy] = corners[(turn + 3) % 4];
      return <path key={key} d={`M${ax} ${ay} L${bx} ${by} L${dx} ${dy} Z`} fill={ink} />;
    }
    case "dot":
      return <circle key={key} cx={cx} cy={cy} r={s * 0.28} fill={ink} />;
    case "ring":
      return <circle key={key} cx={cx} cy={cy} r={s * 0.3} fill="none" stroke={ink} strokeWidth={2.5} />;
    case "bars": {
      // Two or three bars rising from the cell's floor, like a small chart.
      const heights = turn % 2 ? [0.45, 0.8, 0.6] : [0.7, 0.4, 0.9];
      return (
        <g key={key} fill={ink}>
          {heights.map((h, i) => (
            <rect key={i} x={x + 2 + i * 4.5} y={y + s - 2 - (s - 4) * h} width={3} height={(s - 4) * h} />
          ))}
        </g>
      );
    }
    default:
      return null;
  }
}

export function CalloutArt({
  kind,
  seed,
  cols = 16,
  rows = 4,
  className,
}: {
  kind: CalloutKind;
  /** What makes this callout's picture its own: its id and title. */
  seed: string;
  /** The mosaic's size in tiles; the callout strip is 16 by 4. */
  cols?: number;
  rows?: number;
  className?: string;
}) {
  const tiles = useMemo(() => {
    const style = STYLES[kind];
    const random = seeded(hash(`${kind}:${seed}`));
    const weighted = Object.entries(style.tiles) as [Tile, number][];
    const total = weighted.reduce((sum, [, w]) => sum + w, 0);
    const pick = (): Tile => {
      let r = random() * total;
      for (const [tile, weight] of weighted) {
        r -= weight;
        if (r < 0) return tile;
      }
      return "blank";
    };

    const shapes: React.ReactNode[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Calmer on the left, where the kind's label sits; fuller towards the right.
        const calm = col < 5 && random() < 0.55 - col * 0.1;
        const tile = calm ? "blank" : pick();
        if (tile === "blank") continue;
        const x = col * CELL;
        const y = row * CELL;
        const key = `${row}-${col}`;
        // Some tiles sit on a block of another colour, as in a mosaic.
        if (random() < 0.35) {
          shapes.push(
            <rect
              key={`${key}-g`}
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              fill={style.inks[Math.floor(random() * style.inks.length)]}
              opacity={0.55}
            />,
          );
        }
        const ink = style.inks[Math.floor(random() * style.inks.length)];
        shapes.push(tileShape(tile, x, y, Math.floor(random() * 4), ink, key));
      }
    }
    return shapes;
  }, [kind, seed, cols, rows]);

  return (
    <svg
      viewBox={`0 0 ${cols * CELL} ${rows * CELL}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={cn("block h-16 w-full", className)}
    >
      <rect width="100%" height="100%" fill={STYLES[kind].ground} />
      {tiles}
    </svg>
  );
}
