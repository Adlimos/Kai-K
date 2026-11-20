import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Award, Lock } from "lucide-react"
import { AccuracyLine, TopicDots, type DotRow, type LinePoint } from "@/components/Charts"
import { TOPIC_META, DRILL_TOPICS, kindLabel, type Topic } from "@/lib/questions"
import { DURATIONS, dayKey, durationLabel, keyToDate, practiceStreak, rankBoard, recordKey, useStore, type Bucket } from "@/lib/store"
import { BADGES } from "@/lib/badges"
import { weakKinds } from "./Drill"
import { cn } from "@/lib/utils"
import { go } from "@/lib/nav"

type Period = "day" | "week" | "month" | "all"
const PERIODS: { id: Period; label: string }[] = [
  { id: "day", label: "1 day" },
  { id: "week", label: "1 week" },
  { id: "month", label: "1 month" },
  { id: "all", label: "Total" },
]
const TOPICS: Topic[] = ["potOdds", "ev", "outs", "preflop", "postflop", "equity", "ranges"]

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
    let ms = 0
    let timed = 0
    const byTopic: Record<string, [number, number, number]> = {}
    for (const e of entries)
      for (const [t, tally] of Object.entries(e.b)) {
        if (!tally) continue
        correct += tally[0]
        wrong += tally[1]
        if (tally[2]) {
          ms += tally[2]
          timed += tally[0] + tally[1]
        }
        const cur = (byTopic[t] ??= [0, 0, 0])
        cur[0] += tally[0]
        cur[1] += tally[1]
        cur[2] += tally[2] ?? 0
      }
    const groups = new Map<string, { t: number; c: number; w: number; label: string; title: string }>()
    const firstT = entries.length ? Math.min(...entries.map((e) => e.t)) : now
    const weekly = period === "all" && now - firstT > 60 * 86400_000
    for (const e of entries) {
      const d = new Date(e.t)
      let key: string, label: string, title: string, t: number
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
      return { key: t, label: TOPIC_META[t].name, value: n ? (v[0] / n) * 100 : null, n, correct: v?.[0] ?? 0, avgMs: v && v[2] && n ? v[2] / n : undefined }
    }).filter((r) => r.key !== "ranges" || r.n > 0)
    return { correct, wrong, total: correct + wrong, points, rows, avgMs: timed ? ms / timed : null }
  }, [data.buckets, period])

  const acc = view.total ? (view.correct / view.total) * 100 : null
  const streak = practiceStreak(data.buckets)
  const weak = weakKinds(data.sub, 5)

  const records = DRILL_TOPICS.map((t) => ({
    topic: t,
    cells: DURATIONS.map((d) => {
      const rec = data.records[recordKey(t, d)]
      const board = rankBoard(leaderboard, recordKey(t, d), meId, rec)
      return { d, rec, rank: rec ? board.find((r) => r.isMe)?.rank : undefined, of: board.length }
    }),
  }))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] leading-none sm:text-[42px]">My stats</h1>
          <p className="mt-2 text-ivory-dim">Every answer you give in drills, reviews, dailies, races and timed runs lands here.</p>
        </div>
        <div role="tablist" aria-label="Time period" className="flex rounded-full border border-line bg-panel p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={period === p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={cn("relative min-h-[40px] cursor-pointer rounded-full px-3.5 text-[14px] font-semibold sm:px-4", period === p.id ? "text-[#1d140a]" : "text-ivory/80 hover:text-ivory")}
            >
              {period === p.id && <motion.span layoutId="period-pill" className="btn-brass absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className="relative">{p.label}</span>
            </button>
          ))}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="Answered" value={view.total.toLocaleString()} />
        <Tile label="Right" value={view.correct.toLocaleString()} tone="good" />
        <Tile label="Wrong" value={view.wrong.toLocaleString()} tone="bad" />
        <Tile label="Avg time per hand" value={view.avgMs ? `${(view.avgMs / 1000).toFixed(1)}s` : "—"} />
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
            <p className="mb-4 text-[14px] text-ivory-dim">Your weakest topic sits furthest left. Hover for speed.</p>
            <TopicDots rows={view.rows} />
          </section>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="panel min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[22px]">Practice calendar</h2>
            <span className="text-[15px]">
              <span className="font-display text-[24px] text-brass">{streak}</span> <span className="text-ivory-dim">day streak</span>
            </span>
          </div>
          <Heatmap buckets={data.buckets} goal={data.settings.goal} />
        </section>
        <section className="panel min-w-0 p-5 sm:p-6">
          <h2 className="font-display text-[22px]">Weakest spots</h2>
          {weak.length ? (
            <>
              <ul className="mt-3 flex flex-col">
                {weak.map((w) => (
                  <li key={w.kind} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
                    <span className="min-w-0 truncate">{kindLabel(w.kind)}</span>
                    <span className="shrink-0 text-ivory-dim">
                      <span className="font-semibold text-ivory">{Math.round(w.acc * 100)}%</span> of {w.n}
                    </span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => go("drill-weak-spots")} className="btn-brass mt-4 min-h-[44px] cursor-pointer rounded-full px-5 font-semibold">
                Drill these
              </button>
            </>
          ) : (
            <p className="mt-2 text-ivory-dim">Answer at least 5 of a question type to see where you leak. Anything under 90% shows up here.</p>
          )}
        </section>
      </div>

      <section className="panel min-w-0 p-5 sm:p-6">
        <h2 className="font-display text-[22px]">Badges</h2>
        <p className="mb-4 text-[14px] text-ivory-dim">
          {Object.keys(data.badges).length} of {BADGES.length} earned
        </p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BADGES.map((b) => {
            const got = !!data.badges[b.id]
            const prog = b.progress?.(data)
            return (
              <li key={b.id} className={cn("flex items-start gap-3 rounded-[14px] border p-3.5", got ? "border-brass/50 bg-[rgba(214,169,78,.08)]" : "border-line")}>
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", got ? "bg-brass text-[#1d140a]" : "bg-panel-2 text-ivory-dim")}>
                  {got ? <Award className="h-5 w-5" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block font-semibold", !got && "text-ivory/80")}>{b.name}</span>
                  <span className="block text-[13px] text-ivory-dim">{b.desc}</span>
                  {!got && prog && (
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                        <span className="block h-full rounded-full bg-brass" style={{ width: `${(prog[0] / prog[1]) * 100}%` }} />
                      </span>
                      <span className="text-[12px] text-ivory-dim">
                        {prog[0]}/{prog[1]}
                      </span>
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

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
    <div className={cn("rounded-[16px] border px-4 py-4", big ? "col-span-2 border-brass/40 bg-[rgba(214,169,78,.1)] md:col-span-1" : "border-line bg-panel")}>
      <dt className="flex items-center gap-2 text-[14px] text-ivory-dim">
        {tone && <span className={cn("h-2 w-2 rounded-full", tone === "good" ? "bg-verdigris" : "bg-oxblood-bright")} aria-hidden="true" />}
        {label}
      </dt>
      <dd className={cn("mt-1 font-display leading-none", big ? "text-[40px] text-brass" : "text-[32px]")}>{value}</dd>
    </div>
  )
}

/** Last 20 weeks, one square per day; colour steps relative to the daily goal. */
function Heatmap({ buckets, goal }: { buckets: Record<string, Bucket>; goal: number }) {
  const [hover, setHover] = useState<{ day: string; n: number } | null>(null)
  const weeks = 20
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const [k, b] of Object.entries(buckets)) {
      const [c, w] = sumBucket(b)
      m.set(k.slice(0, 10), (m.get(k.slice(0, 10)) ?? 0) + c + w)
    }
    return m
  }, [buckets])
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - today.getDay() - (weeks - 1) * 7)
  const cols: { day: string; n: number; future: boolean }[][] = []
  for (let w = 0; w < weeks; w++) {
    const col = []
    for (let d = 0; d < 7; d++) {
      const x = new Date(start)
      x.setDate(start.getDate() + w * 7 + d)
      const k = dayKey(x)
      col.push({ day: k, n: counts.get(k) ?? 0, future: x > today })
    }
    cols.push(col)
  }
  const level = (n: number) => (n === 0 ? 0 : n < goal * 0.34 ? 1 : n < goal * 0.67 ? 2 : n < goal ? 3 : 4)
  const fills = ["var(--panel-2)", "rgba(214,169,78,.28)", "rgba(214,169,78,.5)", "rgba(214,169,78,.75)", "var(--brass)"]
  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <div className="flex w-max gap-[3px]" role="img" aria-label="Questions answered per day over the last 20 weeks">
          {cols.map((col, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {col.map((c) => (
                <span
                  key={c.day}
                  className="h-[14px] w-[14px] rounded-[3px]"
                  style={{ background: c.future ? "transparent" : fills[level(c.n)] }}
                  onPointerEnter={() => !c.future && setHover({ day: c.day, n: c.n })}
                  onPointerLeave={() => setHover(null)}
                  title={c.future ? undefined : `${c.day}: ${c.n} answered`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[13px] text-ivory-dim">
        <span>{hover ? `${keyToDate(hover.day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}: ${hover.n} answered` : `Full colour means you hit your goal of ${goal}.`}</span>
        <span className="flex items-center gap-1">
          Less
          {fills.map((f, i) => (
            <span key={i} className="h-3 w-3 rounded-[3px]" style={{ background: f }} />
          ))}
          More
        </span>
      </div>
    </div>
  )
}
