import { useId } from "react";

/**
 * The trend line inside a stat tile. Deliberately tiny and mute: it says
 * "shape of the window" and nothing more, so it carries no axis, no labels and
 * no tooltip. Every value it draws is reachable from the revenue chart below
 * and from the table view, so it gates nothing.
 */

interface IProps {
  values: number[];
  /** the stat's own hue; the line is drawn in it, the wash beneath at 10% */
  color?: string;
}

const WIDTH = 120;
const HEIGHT = 28;
const STROKE = 2;

export default function Sparkline({ values, color = "var(--series-1)" }: IProps) {
  const gradientId = useId();

  // Two points is the minimum that can describe a direction. Below that there
  // is no shape to show and a flat stub would imply one.
  if (values.length < 2) return null;

  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  // A window where nothing moved still needs a denominator, and a flat line
  // through the middle is the honest picture of it.
  const span = max - min || 1;

  const inset = STROKE / 2;
  const plotHeight = HEIGHT - STROKE;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * WIDTH;
    const y = inset + plotHeight - ((value - min) / span) * plotHeight;
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");

  const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;

  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-7 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* the end dot, ringed in the surface so it stays legible over the line */}
      <circle
        cx={lastX}
        cy={lastY}
        r={2.5}
        fill={color}
        stroke="var(--surface-1)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
