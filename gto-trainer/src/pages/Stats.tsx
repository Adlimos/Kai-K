import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AccuracyLine, TopicDots, type DotRow, type LinePoint } from "@/components/Charts"
import { TOPIC_META, type DrillTopic, type Topic } from "@/lib/questions"
import { DURATIONS, dayKey, durationLabel, keyToDate, rankBoard, recordKey, useStore, type Bucket } from "@/lib/store"
import { cn } from "@/lib/utils"
import { go } from "@/lib/nav"

type Period = "day" | "week" | "month" | "all"
const PERIODS: { id: Period; label: string }[] = [
  { id: "day", label: "1 day" },
  { id: "week", label: "1 week" },
  { id: "month", label: "1 month" },
  { id: "all", label: "Total" },
]
const TOPICS: Topic[] = ["potOdds", "ev", "outs", "preflop", "ranges"]
const RECORD_TOPICS: DrillTopic[] = ["potOdds", "ev", "outs", "preflop", "mixed"]

const sumBucket = (b: Bucket) => {
  let c = 0
  let w = 0
  for (const t of Object.values(b)) {
    if (!t) continue
    c += t[0]
    w += t[1]
  }
  return [c, w] as const
}

const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
const fmtHour = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric" })

export function Stats() {
  const { data, leaderboard, meId } = useStore()
  const [period, setPeriod] = useState<Period>("week")

  const view = useMemo(() => {
    const now = Date.now()
    const span = period === "day" ? 86400_000 : period === "week" ? 7 * 86400_000 : period === "month" ? 30 * 86400_000 : Infinity
    const entries = Object.entries(data.buckets)
      .map(([k, b]) => ({ k, b, t: keyToDate(k).getTime() }))
      .filter((e) => now - e.t < span + 3600_000)
    let correct = 0
    let wrong = 0
    const byTopic: Record<string, [number, number]> = {}
    for (const e of entries) {
      for (const [t, tally] of Object.entries(e.b)) {
        if (!tally) continue
        correct += tally[0]
        wrong += tally[1]
        const cur = (byTopic[t] ??= [0, 0])
        cur[0] += tally[0]
        cur[1] += tally[1]
      }
    }
    // Time series: hourly for a day, daily for week/month, daily or weekly for all-time.
    const groups = new Map<string, { t: number; c: number; w: number; label: string; title: string }>()
    const firstT = entries.length ? Math.min(...entries.map((e) => e.t)) : now
    const weekly = period === "all" && now - firstT > 60 * 86400_000
    for (const e of entries) {
      const d = new Date(e.t)
      let key: string
      let label: string
      let title: string
      let t: number
      if (period === "day") {
        key = e.k.slice(0, 13)
        t = e.t
        label = fmtHour(d)
        title = `${fmtDay(d)}, ${fmtHour(d)}`
      } else if (weekly) {
        const ws = new Date(d)
        ws.setDate(d.getDate() - d.getDay())
        key = dayKey(ws)
        t = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate()).getTime()
        label = fmtDay(ws)
        title = `Week of ${fmtDay(ws)}`
      } else {
        key = e.k.slice(0, 10)
        t = keyToDate(key).getTime()
        label = fmtDay(d)
        title = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
      }
      const [c, w] = sumBucket(e.b)
      const g = groups.get(key) ?? { t, c: 0, w: 0, label, title }
      g.c += c
      g.w += w
      groups.set(key, g)
    }
    const points: LinePoint[] = [...groups.entries()]
      .sort((a, b) => a[1].t - b[1].t)
      .filter(([, g]) => g.c + g.w > 0)
      .map(([k, g]) => ({ key: k, label: g.label, title: g.title, value: (g.c / (g.c + g.w)) * 100, n: g.c + g.w }))
    const rows: DotRow[] = TOPICS.map((t) => {
      const v = byTopic[t]
      const n = v ? v[0] + v[1] : 0
      return { key: t, label: TOPIC_META[t].name, value: n ? (v[0] / n) * 100 : null, n, correct: v?.[0] ?? 0 }
    }).filter((r) => r.key !== "ranges" || r.n > 0)
    return { correct, wrong, total: correct + wrong, points, rows }
  }, [data.buckets, period])

  const acc = view.total ? (view.correct / view.total) * 100 : null

  // Records + ranks
  const records = RECORD_TOPICS.map((t) => ({
    topic: t,
    cells: DURATIONS.map((d) => {
      const rec = data.records[recordKey(t, d)]
      const board = rankBoard(leaderboard, recordKey(t, d), meId, rec)
      const me = board.find((r) => r.isMe)
      return { d, rec, rank: rec ? me?.rank : undefined, of: board.length }
    }),
  }))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] leading-none sm:text-[42px]">My stats</h1>
          <p className="mt-2 text-ivory-dim">Every answer you give in drills and timed runs lands here.</p>
        </div>
        <div role="tablist" aria-label="Time period" className="flex rounded-full border border-line bg-panel p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={period === p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={cn(
                "relative min-h-[40px] cursor-pointer rounded-full px-3.5 text-[14px] font-semibold sm:px-4",
                period === p.id ? "text-[#1d140a]" : "text-ivory/80 hover:text-ivory",
              )}
            >
              {period === p.id && <motion.span layoutId="period-pill" className="btn-brass absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className="relative">{p.label}</span>
            </button>
          ))}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Answered" value={view.total.toLocaleString()} />
        <Tile label="Right" value={view.correct.toLocaleString()} tone="good" />
        <Tile label="Wrong" value={view.wrong.toLocaleString()} tone="bad" />
        <Tile label="Accuracy" value={acc === null ? "—" : `${acc.toFixed(1)}%`} big />
      </dl>

      {view.total === 0 ? (
        <section className="panel flex flex-col items-start gap-3 p-6">
          <h2 className="font-display text-[24px]">Nothing logged in this window</h2>
          <p className="max-w-[56ch] text-ivory-dim">Answer a few hands and your accuracy trend and topic breakdown will appear here.</p>
          <button type="button" onClick={() => go("drill-mixed")} className="btn-brass min-h-[46px] cursor-pointer rounded-full px-6 font-semibold">
            Start a mixed drill
          </button>
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section className="panel min-w-0 p-5 sm:p-6">
            <h2 className="font-display text-[22px]">Accuracy over time</h2>
            <p className="mb-4 text-[14px] text-ivory-dim">The scale fits your range so small gains are visible. Hover a point for details.</p>
            {view.points.length < 2 ? (
              <p className="py-10 text-ivory-dim">
                One {period === "day" ? "hour" : "day"} of data so far ({view.points[0]?.value.toFixed(0)}%). Come back {period === "day" ? "next hour" : "tomorrow"} to see a trend.
              </p>
            ) : (
              <AccuracyLine points={view.points} />
            )}
          </section>
          <section className="panel min-w-0 p-5 sm:p-6">
            <h2 className="font-display text-[22px]">Accuracy by topic</h2>
            <p className="mb-4 text-[14px] text-ivory-dim">Your weakest topic sits furthest left.</p>
            <TopicDots rows={view.rows} />
          </section>
        </div>
      )}

      <section className="panel min-w-0 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[22px]">Timed challenge records</h2>
          <button type="button" onClick={() => go("timed")} className="cursor-pointer text-[14px] font-semibold text-brass hover:underline">
            Set a new record
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left">
            <thead>
              <tr className="text-[13px] text-ivory-dim">
                <th className="py-2 pr-4 font-medium">Topic</th>
                {DURATIONS.map((d) => (
                  <th key={d} className="py-2 pr-4 font-medium">
                    {durationLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.topic} className="border-t border-line">
                  <td className="py-3 pr-4 font-semibold">{TOPIC_META[r.topic].name}</td>
                  {r.cells.map((c) => (
                    <td key={c.d} className="py-3 pr-4">
                      {c.rec ? (
                        <div className="flex items-baseline gap-2">
                          <span className="font-display text-[24px] leading-none">{c.rec.score}</span>
                          <span className={cn("text-[13px]", c.rank === 1 ? "font-semibold text-brass" : "text-ivory-dim")}>
                            #{c.rank} of {c.of}
                          </span>
                        </div>
                      ) : (
                        <span className="text-ivory-dim">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Tile({ label, value, tone, big }: { label: string; value: string; tone?: "good" | "bad"; big?: boolean }) {
  return (
    <div className={cn("rounded-[16px] border border-line px-4 py-4", big ? "bg-[rgba(214,169,78,.1)] border-brass/40" : "bg-panel")}>
      <dt className="flex items-center gap-2 text-[14px] text-ivory-dim">
        {tone && <span className={cn("h-2 w-2 rounded-full", tone === "good" ? "bg-verdigris" : "bg-oxblood-bright")} aria-hidden="true" />}
        {label}
      </dt>
      <dd className={cn("mt-1 font-display leading-none", big ? "text-[40px] text-brass" : "text-[34px]")}>{value}</dd>
    </div>
  )
}
