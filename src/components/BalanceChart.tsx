import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MonthRow } from '../lib/calc';
import { money, moneyCompact } from '../lib/format';

interface BalanceChartProps {
  rows: MonthRow[];
}

const SERIES = [
  { key: 'closingLoan', name: 'Loan balance', color: 'var(--series-1)' },
  { key: 'offsetBalance', name: 'Offset balance', color: 'var(--series-2)' },
] as const;

const MARGIN = { top: 16, right: 16, bottom: 30, left: 56 };

/** Round a raw axis step up to the nearest 1 / 2 / 5 × 10^n. */
function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalised = raw / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

function yTicks(max: number, count: number): number[] {
  if (max <= 0) return [0];
  const step = niceStep(max / count);
  // Round the top of the scale *up* past the max, so the highest value always
  // sits inside the plot rather than above the last gridline.
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step * 0.001; value += step) ticks.push(value);
  return ticks;
}

/** Observe the container so the SVG is drawn at real pixel size — labels then
 *  keep their true type size instead of being scaled by preserveAspectRatio. */
function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    setWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

export function BalanceChart({ rows }: BalanceChartProps) {
  const [containerRef, width] = useMeasuredWidth<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const compact = width > 0 && width < 560;
  const height = compact ? 240 : 320;

  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 10);
  const plotHeight = height - MARGIN.top - MARGIN.bottom;

  const maxValue = rows.reduce(
    (max, row) => Math.max(max, row.closingLoan, row.offsetBalance, row.openingLoan),
    0,
  );
  const ticks = yTicks(maxValue, compact ? 4 : 5);
  const domainMax = ticks[ticks.length - 1] || 1;

  const xAt = useCallback(
    (index: number) =>
      MARGIN.left + (rows.length <= 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth),
    [rows.length, plotWidth],
  );
  const yAt = useCallback(
    (value: number) => MARGIN.top + plotHeight - (value / domainMax) * plotHeight,
    [plotHeight, domainMax],
  );

  // Clear a stale highlight when the schedule shrinks under it.
  useEffect(() => {
    setActiveIndex((current) =>
      current !== null && current >= rows.length ? null : current,
    );
  }, [rows.length]);

  const handlePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left - MARGIN.left;
    const ratio = plotWidth <= 0 ? 0 : x / plotWidth;
    const index = Math.round(ratio * Math.max(rows.length - 1, 0));
    setActiveIndex(Math.min(Math.max(index, 0), rows.length - 1));
  };

  if (rows.length === 0 || width === 0) {
    return <div className="chart" ref={containerRef} style={{ minHeight: height }} />;
  }

  const lastIndex = rows.length - 1;

  const line = (key: 'closingLoan' | 'offsetBalance') =>
    rows.map((row, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(2)},${yAt(row[key]).toFixed(2)}`).join(' ');

  const loanArea = `${line('closingLoan')} L${xAt(rows.length - 1).toFixed(2)},${yAt(0).toFixed(2)} L${xAt(0).toFixed(2)},${yAt(0).toFixed(2)} Z`;

  // Aim for ~6 x labels; snap to whole years once the term is long enough.
  const targetTicks = compact ? 4 : 6;
  const rawEvery = Math.max(1, Math.ceil(rows.length / targetTicks));
  const every = rawEvery >= 10 ? Math.ceil(rawEvery / 12) * 12 : rawEvery;
  const yearsOnly = every >= 12;

  // Pick x ticks by *pixel* spacing, not index spacing. The final tick is the
  // end of the term and always earns its place, so anchor on it and walk
  // backwards, dropping any earlier label that would not clear a full label
  // width — otherwise the last regular tick collides with the endpoint.
  const minLabelGap = yearsOnly ? 46 : 60;
  const xTickIndexes = (() => {
    const candidates: number[] = [];
    for (let i = 0; i < rows.length; i += every) candidates.push(i);
    if (candidates[candidates.length - 1] !== lastIndex) candidates.push(lastIndex);

    const kept: number[] = [];
    let previousX = Infinity;
    for (let k = candidates.length - 1; k >= 0; k--) {
      const x = xAt(candidates[k]);
      if (previousX - x >= minLabelGap) {
        kept.unshift(candidates[k]);
        previousX = x;
      }
    }
    return kept;
  })();

  const active = activeIndex !== null ? rows[activeIndex] : null;

  return (
    <div className="chart" ref={containerRef}>
      <svg
        className="chart__svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Loan balance and offset balance over ${rows.length} months, from ${rows[0].label} to ${rows[lastIndex].label}.`}
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id="loanWash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.13" />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Gridlines — solid hairlines, one step off the surface */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              y1={yAt(tick)}
              x2={MARGIN.left + plotWidth}
              y2={yAt(tick)}
              stroke="var(--gridline)"
              strokeWidth="1"
              shapeRendering="crispEdges"
            />
            <text
              x={MARGIN.left - 8}
              y={yAt(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="11"
              fill="var(--text-muted)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {moneyCompact(tick)}
            </text>
          </g>
        ))}

        {/* Baseline */}
        <line
          x1={MARGIN.left}
          y1={yAt(0)}
          x2={MARGIN.left + plotWidth}
          y2={yAt(0)}
          stroke="var(--axis)"
          strokeWidth="1"
          shapeRendering="crispEdges"
        />

        {/* X labels */}
        {xTickIndexes.map((i) => (
          <text
            key={i}
            x={xAt(i)}
            y={height - 10}
            textAnchor={i === 0 ? 'start' : i === lastIndex ? 'end' : 'middle'}
            fontSize="11"
            fill="var(--text-muted)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {yearsOnly ? rows[i].year : `${rows[i].monthName} '${String(rows[i].year).slice(2)}`}
          </text>
        ))}

        <path d={loanArea} fill="url(#loanWash)" />

        {SERIES.map((series) => (
          <path
            key={series.key}
            d={line(series.key)}
            fill="none"
            stroke={series.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* End markers — 2px surface ring keeps them legible where lines cross */}
        {SERIES.map((series) => (
          <circle
            key={series.key}
            cx={xAt(lastIndex)}
            cy={yAt(rows[lastIndex][series.key])}
            r="4"
            fill={series.color}
            stroke="var(--surface-1)"
            strokeWidth="2"
          />
        ))}

        {active && activeIndex !== null && (
          <g pointerEvents="none">
            <line
              x1={xAt(activeIndex)}
              y1={MARGIN.top}
              x2={xAt(activeIndex)}
              y2={MARGIN.top + plotHeight}
              stroke="var(--axis)"
              strokeWidth="1"
            />
            {SERIES.map((series) => (
              <circle
                key={series.key}
                cx={xAt(activeIndex)}
                cy={yAt(active[series.key])}
                r="4.5"
                fill={series.color}
                stroke="var(--surface-1)"
                strokeWidth="2"
              />
            ))}
          </g>
        )}
      </svg>

      {active && activeIndex !== null && (
        <div
          className="tooltip"
          style={{
            left: Math.min(Math.max(xAt(activeIndex), 84), width - 84),
            top: MARGIN.top - 6,
          }}
        >
          <div className="tooltip__title">
            {active.label} · Month {active.month}
          </div>
          {SERIES.map((series) => (
            <div className="tooltip__row" key={series.key}>
              <span className="tooltip__key" style={{ background: series.color }} />
              {series.name}
              <span className="tooltip__value">{money(active[series.key])}</span>
            </div>
          ))}
          <div className="tooltip__row">
            <span className="tooltip__key" style={{ background: 'var(--text-muted)' }} />
            Interest saved
            <span className="tooltip__value">{money(active.cumulativeInterestSaved)}</span>
          </div>
        </div>
      )}

      <div className="legend">
        {SERIES.map((series) => (
          <span className="legend__item" key={series.key}>
            <span className="legend__key" style={{ background: series.color }} />
            {series.name}
          </span>
        ))}
      </div>
    </div>
  );
}
