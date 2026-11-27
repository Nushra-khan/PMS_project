import { TrendPoint } from "@/lib/db/trends";

type TrendChartProps = {
  title: string;
  description: string;
  points: TrendPoint[];
  kind: "line" | "bar";
  /** Fixed y range, e.g. [1, 5] for scores. Defaults to 0..max. */
  yDomain?: [number, number];
  formatValue: (point: TrendPoint) => string;
};

// Single-series mark color, validated against the panel surface.
const SERIES = "#0d9488";
const WIDTH = 320;
const HEIGHT = 140;
const PAD = { top: 12, right: 8, bottom: 22, left: 28 };

function monthLabel(month: string) {
  return new Date(`${month}T00:00:00Z`).toLocaleString("en", { month: "short", timeZone: "UTC" });
}

export function TrendChart({ title, description, points, kind, yDomain, formatValue }: TrendChartProps) {
  const values = points.map((point) => point.value ?? 0);
  // Counts get an even maximum so the middle gridline is a whole number.
  const [yMin, yMax] = yDomain ?? [0, Math.max(2, Math.ceil(Math.max(...values) / 2) * 2)];
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const step = plotWidth / points.length;
  const x = (index: number) => PAD.left + step * index + step / 2;
  const y = (value: number) =>
    PAD.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight;
  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  const hasData = points.some((point) => point.value !== null && point.count > 0);

  // Line segments break where a month has no data.
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${current.length ? "L" : "M"}${x(index)},${y(point.value)}`);
  });
  if (current.length) segments.push(current.join(" "));

  return (
    <figure className="rounded-3xl border border-ink/10 bg-white/80 p-5">
      <figcaption>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-ink/60">{description}</p>
      </figcaption>

      {hasData ? (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`${title}: ${points.map((point) => `${monthLabel(point.month)} ${formatValue(point)}`).join(", ")}`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="#132a24"
                strokeOpacity={0.08}
              />
              <text x={PAD.left - 6} y={y(tick) + 3} textAnchor="end" fontSize={9} fill="#132a24" fillOpacity={0.55}>
                {Number.isInteger(tick) ? tick : tick.toFixed(1)}
              </text>
            </g>
          ))}

          {kind === "bar"
            ? points.map((point, index) => {
                const value = point.value ?? 0;
                const barWidth = Math.min(28, step - 8);
                const top = y(value);
                const height = Math.max(0, PAD.top + plotHeight - top);
                return (
                  <g key={point.month}>
                    {height > 0 ? (
                      <path
                        d={`M${x(index) - barWidth / 2},${top + height} V${top + Math.min(4, height)} Q${x(index) - barWidth / 2},${top} ${x(index) - barWidth / 2 + Math.min(4, height)},${top} H${x(index) + barWidth / 2 - Math.min(4, height)} Q${x(index) + barWidth / 2},${top} ${x(index) + barWidth / 2},${top + Math.min(4, height)} V${top + height} Z`}
                        fill={SERIES}
                      />
                    ) : null}
                    <rect x={x(index) - step / 2} y={PAD.top} width={step} height={plotHeight} fill="transparent">
                      <title>{`${monthLabel(point.month)}: ${formatValue(point)}`}</title>
                    </rect>
                  </g>
                );
              })
            : (
              <>
                {segments.map((d) => (
                  <path key={d} d={d} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" />
                ))}
                {points.map((point, index) =>
                  point.value === null ? null : (
                    <g key={point.month}>
                      <circle cx={x(index)} cy={y(point.value)} r={4} fill={SERIES} stroke="#fffbf3" strokeWidth={2} />
                      <circle cx={x(index)} cy={y(point.value)} r={14} fill="transparent">
                        <title>{`${monthLabel(point.month)}: ${formatValue(point)}`}</title>
                      </circle>
                    </g>
                  )
                )}
              </>
            )}

          {points.map((point, index) => (
            <text key={point.month} x={x(index)} y={HEIGHT - 6} textAnchor="middle" fontSize={9} fill="#132a24" fillOpacity={0.55}>
              {monthLabel(point.month)}
            </text>
          ))}
        </svg>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-ink/15 p-4 text-xs text-ink/60">
          No data in the last six months yet.
        </p>
      )}

      <details className="mt-2 text-xs text-ink/70">
        <summary className="cursor-pointer">Show as table</summary>
        <table className="mt-2 w-full">
          <tbody>
            {points.map((point) => (
              <tr key={point.month}>
                <td className="py-0.5">{monthLabel(point.month)}</td>
                <td className="py-0.5 text-right">{formatValue(point)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
