import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Fit the axis to the data so small changes fill the plot. Values are percentages (0-100). */
export function fitDomain(values: number[]): { lo: number; hi: number; ticks: number[] } {
  if (!values.length) return { lo: 0, hi: 100, ticks: [0, 25, 50, 75, 100] }
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max - min < 4) {
    const mid = (max + min) / 2
    min = mid - 3
    max = mid + 3
  }
  const pad = (max - min) * 0.15
  const span = max + pad - (min - pad)
  const raw = span / 4
  const step = [1, 2, 2.5, 5, 10, 20, 25].find((s) => s >= raw) ?? 25
  let lo = Math.floor((min - pad) / step) * step
  let hi = Math.ceil((max + pad) / step) * step
  lo = Math.max(0, lo)
  hi = Math.min(100, hi)
  if (hi - lo < step) hi = Math.min(100, lo + step * 2)
  const ticks: number[] = []
  for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 10) / 10)
  return { lo, hi, ticks }
}

export interface LinePoint {
  key: string
  label: string // x-axis label
  title: string // tooltip heading
  value: number // accuracy %
  n: number // questions answered
}

export function AccuracyLine({ points, height = 260 }: { points: LinePoint[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const m = { l: 44, r: 16, t: 16, b: 34 }
  const iw = w - m.l - m.r
  const ih = height - m.t - m.b
  const { lo, hi, ticks } = fitDomain(points.map((p) => p.value))
  const x = (i: number) => m.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw)
  const y = (v: number) => m.t + (1 - (v - lo) / (hi - lo || 1)) * ih
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 64))))

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect()
    const px = e.clientX - rect.left
    let best = 0
    let bd = Infinity
    points.forEach((_, i) => {
      const d = Math.abs(x(i) - m.l - px)
      if (d < bd) {
        bd = d
        best = i
      }
    })
    setHover(best)
  }

  const hp = hover !== null ? points[hover] : null
  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={height} role="img" aria-label="Accuracy over time" className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={12} fill="var(--ivory-dim)">
              {t}%
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.key} x={x(i)} y={height - 10} textAnchor="middle" fontSize={12} fill="var(--ivory-dim)">
              {p.label}
            </text>
          ) : null,
        )}
        {points.length > 1 && (
          <motion.path
            d={path}
            fill="none"
            stroke="var(--brass)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            key={path.length + "-" + points.length}
          />
        )}
        {points.map((p, i) => (
          <circle
            key={p.key}
            cx={x(i)}
            cy={y(p.value)}
            r={i === points.length - 1 || i === hover ? 5 : 3.5}
            fill={i === points.length - 1 ? "var(--brass)" : "var(--ink)"}
            stroke="var(--brass)"
            strokeWidth={2}
          />
        ))}
        {hp && hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} stroke="var(--ivory-dim)" strokeDasharray="3 3" strokeWidth={1} />
        )}
        <rect
          x={m.l}
          y={m.t}
          width={iw}
          height={ih}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 min-w-[132px] rounded-[10px] border border-line bg-[#0b1a15] px-3 py-2 text-[13px] shadow-xl"
          style={{
            left: Math.min(Math.max(x(hover) - 66, 0), w - 140),
            top: Math.max(0, y(hp.value) - 74),
          }}
        >
          <div className="text-ivory-dim">{hp.title}</div>
          <div className="font-display text-[20px] leading-tight text-ivory">{hp.value.toFixed(1)}%</div>
          <div className="text-ivory-dim">{hp.n} answered</div>
        </div>
      )}
    </div>
  )
}

export interface DotRow {
  key: string
  label: string
  value: number | null
  n: number
  correct: number
}

/** Dot plot: an adaptive axis is honest here because position, not length, carries the value. */
export function TopicDots({ rows }: { rows: DotRow[] }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<string | null>(null)
  const vals = rows.filter((r) => r.value !== null).map((r) => r.value as number)
  const { lo, hi, ticks } = fitDomain(vals)
  const narrow = w < 460
  const labelW = narrow ? 92 : 150
  const valueW = narrow ? 54 : 70
  const rowH = 46
  const top = 28
  const height = top + rows.length * rowH + 4
  const iw = w - labelW - valueW - 12
  const x = (v: number) => labelW + ((v - lo) / (hi - lo || 1)) * iw
  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={height} role="img" aria-label="Accuracy by topic" className="block">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top - 6} y2={height - 4} stroke="var(--line)" />
            <text x={x(t)} y={12} textAnchor="middle" fontSize={12} fill="var(--ivory-dim)">
              {t}%
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cy = top + i * rowH + rowH / 2
          return (
            <g key={r.key} onPointerEnter={() => setHover(r.key)} onPointerLeave={() => setHover(null)}>
              <rect x={0} y={cy - rowH / 2} width={w} height={rowH} fill={hover === r.key ? "rgba(239,230,210,.04)" : "transparent"} />
              <text x={0} y={cy} dy="0.32em" fontSize={narrow ? 13 : 15} fill="var(--ivory)">
                {r.label}
              </text>
              <line x1={labelW} x2={labelW + iw} y1={cy} y2={cy} stroke="var(--line)" strokeDasharray="2 4" />
              {r.value !== null ? (
                <>
                  <motion.circle
                    cy={cy}
                    r={hover === r.key ? 9 : 7}
                    fill="var(--brass)"
                    stroke="var(--panel)"
                    strokeWidth={2}
                    initial={{ cx: labelW }}
                    animate={{ cx: x(r.value) }}
                    transition={{ type: "spring", stiffness: 120, damping: 18, delay: i * 0.05 }}
                  />
                  <text x={w} y={cy} dy="0.32em" textAnchor="end" fontSize={15} fontWeight={600} fill="var(--ivory)">
                    {r.value.toFixed(0)}%
                  </text>
                </>
              ) : (
                <text x={w} y={cy} dy="0.32em" textAnchor="end" fontSize={13} fill="var(--ivory-dim)">
                  No data
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {hover &&
        (() => {
          const r = rows.find((x) => x.key === hover)
          if (!r || r.value === null) return null
          const i = rows.indexOf(r)
          return (
            <div
              className="pointer-events-none absolute z-10 rounded-[10px] border border-line bg-[#0b1a15] px-3 py-2 text-[13px] shadow-xl"
              style={{ left: Math.min(x(r.value) - 60, w - 150), top: top + i * rowH - 52 }}
            >
              <div className="text-ivory">{r.label}</div>
              <div className="text-ivory-dim">
                {r.correct} of {r.n} correct
              </div>
            </div>
          )
        })()}
    </div>
  )
}
