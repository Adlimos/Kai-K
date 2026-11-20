import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { PokerTable } from "@/components/PokerTable"
import { QuestionPanel } from "@/components/QuestionPanel"
import { DifficultyPicker } from "@/components/DifficultyPicker"
import { DRILL_TOPICS, TOPIC_META, generateQuestion, isCorrect, type DrillTopic, type Question } from "@/lib/questions"
import { DURATIONS, durationLabel, rankBoard, recordKey, useGenOpts, useStore, type Duration, type RunRecord } from "@/lib/store"
import { displayName, useNames } from "@/lib/names"
import { cn } from "@/lib/utils"
import { go } from "@/lib/nav"
import { sfx } from "@/lib/sound"

type Phase = "setup" | "countdown" | "running" | "done"
export const PENALTY_MS = 3000

export function Timed() {
  const { data, recordAnswer, submitRun, leaderboard, meId, settings, updateSettings } = useStore()
  const opts = useGenOpts()
  const [topic, setTopic] = useState<DrillTopic>("mixed")
  const [dur, setDur] = useState<Duration>(60)
  const [phase, setPhase] = useState<Phase>("setup")
  const [count, setCount] = useState(3)
  const [q, setQ] = useState<Question>(() => generateQuestion("mixed", opts))
  const [sel, setSel] = useState<number | null>(null)
  const [score, setScore] = useState({ right: 0, wrong: 0, ms: 0 })
  const [now, setNow] = useState(0)
  const endAt = useRef(0)
  const qStart = useRef(0)
  const [penaltyUntil, setPenaltyUntil] = useState(0)
  const [result, setResult] = useState<{ best: boolean; previous?: RunRecord } | null>(null)
  const scoreRef = useRef(score)
  scoreRef.current = score

  const best = data.records[recordKey(topic, dur)]

  useEffect(() => {
    if (phase !== "countdown") return
    if (count === 0) {
      sfx.go()
      endAt.current = performance.now() + dur * 1000
      qStart.current = performance.now()
      setNow(performance.now())
      setPhase("running")
      return
    }
    sfx.tick()
    const t = window.setTimeout(() => setCount((c) => c - 1), 700)
    return () => window.clearTimeout(t)
  }, [phase, count, dur])

  const finish = useCallback(() => {
    setPhase("done")
    const s = scoreRef.current
    const r = submitRun(topic, dur, s.right, s.wrong)
    setResult(r)
    if (r.best) sfx.fanfare()
  }, [submitRun, topic, dur])

  useEffect(() => {
    if (phase !== "running") return
    let raf = 0
    const tick = () => {
      const t = performance.now()
      setNow(t)
      if (t >= endAt.current) {
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, finish])

  const nextQ = useCallback(() => {
    setQ(generateQuestion(topic, opts))
    setSel(null)
    qStart.current = performance.now()
  }, [topic, opts])

  useEffect(() => {
    if (phase !== "running" || !penaltyUntil) return
    if (now >= penaltyUntil) {
      setPenaltyUntil(0)
      nextQ()
    }
  }, [now, penaltyUntil, phase, nextQ])

  const answer = (i: number) => {
    if (sel !== null || phase !== "running") return
    setSel(i)
    const ok = isCorrect(q, i)
    const ms = Math.max(0, performance.now() - qStart.current - 500)
    recordAnswer(q, ok, ms)
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), wrong: s.wrong + (ok ? 0 : 1), ms: s.ms + ms }))
    if (ok) window.setTimeout(nextQ, 380)
    else setPenaltyUntil(performance.now() + PENALTY_MS)
  }

  const start = () => {
    setScore({ right: 0, wrong: 0, ms: 0 })
    setResult(null)
    setPenaltyUntil(0)
    setQ(generateQuestion(topic, opts))
    setSel(null)
    setCount(3)
    setPhase("countdown")
  }

  const remaining = Math.max(0, endAt.current - now)
  const frac = phase === "running" ? remaining / (dur * 1000) : 1
  const mm = Math.floor(remaining / 60000)
  const ss = Math.floor((remaining % 60000) / 1000)
  const penaltyLeft = penaltyUntil ? Math.max(0, penaltyUntil - now) : 0

  if (phase === "setup") {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <h1 className="font-display text-[34px] leading-none sm:text-[42px]">Timed challenge</h1>
          <p className="mt-2 max-w-[60ch] text-ivory-dim">Answer as many as you can before the clock runs out. A wrong answer sits you out for 3 seconds while the clock keeps running.</p>
        </header>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="panel flex flex-col gap-6 p-5 sm:p-7">
            <fieldset>
              <legend className="mb-3 text-[15px] font-semibold text-ivory">Topic</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DRILL_TOPICS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={topic === t}
                    onClick={() => setTopic(t)}
                    className={cn(
                      "min-h-[56px] cursor-pointer rounded-[14px] border px-4 py-2 text-left font-semibold transition-colors",
                      t === "mixed" && "col-span-2 sm:col-span-3",
                      topic === t ? "border-brass bg-[rgba(214,169,78,.12)]" : "border-line bg-panel-2 hover:border-brass/50",
                    )}
                  >
                    {TOPIC_META[t].name}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-8">
              <fieldset>
                <legend className="mb-3 text-[15px] font-semibold text-ivory">Clock</legend>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={dur === d}
                      onClick={() => setDur(d)}
                      className={cn(
                        "min-h-[48px] min-w-[96px] cursor-pointer rounded-full border px-5 font-display text-[20px] transition-colors",
                        dur === d ? "border-brass bg-[rgba(214,169,78,.12)] text-brass" : "border-line text-ivory hover:border-brass/50",
                      )}
                    >
                      {durationLabel(d)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-3 text-[15px] font-semibold text-ivory">Difficulty</legend>
                <DifficultyPicker id="timed-diff" value={settings.difficulty} onChange={(d) => updateSettings({ difficulty: d })} />
              </fieldset>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={start} className="btn-brass min-h-[52px] cursor-pointer rounded-full px-8 text-[17px] font-semibold">
                Start the clock
              </button>
              <span className="text-ivory-dim">
                {best ? (
                  <>
                    Your best: <span className="font-semibold text-ivory">{best.score} correct</span>
                  </>
                ) : (
                  "No record yet for this combination."
                )}
              </span>
            </div>
          </section>
          <TopFive rows={rankBoard(leaderboard, recordKey(topic, dur), meId, best)} />
        </div>
      </div>
    )
  }

  if (phase === "done") {
    const total = score.right + score.wrong
    const ranked = rankBoard(leaderboard, recordKey(topic, dur), meId, data.records[recordKey(topic, dur)])
    const me = ranked.find((r) => r.isMe)
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-[720px] flex-col items-start gap-6 py-6">
        <p className="text-brass">
          {TOPIC_META[topic].name}, {durationLabel(dur)}
        </p>
        <h1 className="font-display text-[56px] leading-none sm:text-[80px]">
          {score.right} <span className="text-ivory-dim">correct</span>
        </h1>
        <dl className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Wrong" value={String(score.wrong)} />
          <Stat label="Accuracy" value={total ? `${Math.round((score.right / total) * 100)}%` : "—"} />
          <Stat label="Avg per hand" value={total ? `${(score.ms / total / 1000).toFixed(1)}s` : "—"} />
          <Stat label="Board position" value={me ? `#${me.rank} of ${ranked.length}` : "—"} />
        </dl>
        {result?.best ? (
          <p className="rounded-[14px] border border-brass/50 bg-[rgba(214,169,78,.1)] px-4 py-3 text-ivory">
            New personal record{result.previous ? `, up from ${result.previous.score}` : ""}. It's on the leaderboard.
          </p>
        ) : best ? (
          <p className="text-ivory-dim">Your record for this run is {best.score}.</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={start} className="btn-brass min-h-[48px] cursor-pointer rounded-full px-6 font-semibold">
            Run it again
          </button>
          <button type="button" onClick={() => setPhase("setup")} className="btn-ghost min-h-[48px] cursor-pointer rounded-full px-6 font-semibold">
            Change topic or clock
          </button>
          {score.wrong > 0 && (
            <button type="button" onClick={() => go("review")} className="btn-ghost min-h-[48px] cursor-pointer rounded-full px-6 font-semibold">
              Review the {score.wrong} you missed
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-4 bg-ink/90 px-4 pb-3 pt-2 backdrop-blur sm:mx-0 sm:rounded-[14px] sm:px-0">
        <div className="flex items-center justify-between gap-4">
          <span className="font-display text-[34px] leading-none tabular-nums">
            {mm}:{String(ss).padStart(2, "0")}
          </span>
          <span className="hidden text-ivory-dim sm:inline">
            {TOPIC_META[topic].short}, {durationLabel(dur)}
          </span>
          <div className="flex items-center gap-4 text-[15px]">
            <span>
              <span className="font-display text-[26px] text-verdigris">{score.right}</span> <span className="text-ivory-dim">right</span>
            </span>
            <span>
              <span className="font-display text-[26px] text-oxblood-bright">{score.wrong}</span> <span className="text-ivory-dim">wrong</span>
            </span>
          </div>
        </div>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-line">
          <div className={cn("h-full rounded-full", frac < 0.15 ? "bg-oxblood-bright" : "bg-brass")} style={{ width: `${frac * 100}%` }} />
        </div>
      </div>

      <div className="relative grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <PokerTable scenario={q.scenario} dealKey={q.id} verdict={sel === null ? null : isCorrect(q, sel) ? "right" : "wrong"} />
        <div className="panel relative overflow-hidden p-5 sm:p-6">
          <QuestionPanel q={q} selected={sel} onSelect={answer} showExplain={false} locked={phase !== "running"} help={false} share={false} />
          <AnimatePresence>
            {penaltyUntil > 0 && <Penalty left={penaltyLeft} answer={q.choices[q.answer]} formula={q.formula} />}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>{phase === "countdown" && <Countdown count={count} />}</AnimatePresence>
    </div>
  )
}

export function Countdown({ count }: { count: number }) {
  return (
    <motion.div key="cd" className="fixed inset-0 z-50 grid place-items-center bg-ink/85 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={count}
          className="font-display text-[160px] leading-none text-brass"
          initial={{ scale: 1.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {count || "Go"}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  )
}

export function Penalty({ left, answer, formula }: { left: number; answer: string; formula?: string }) {
  const r = 34
  const c = 2 * Math.PI * r
  const f = left / PENALTY_MS
  return (
    <motion.div
      key="penalty"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[rgba(64,12,22,.94)] p-6 text-center"
      role="alert"
    >
      <div className="relative grid h-[88px] w-[88px] place-items-center">
        <svg width={88} height={88} className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx={44} cy={44} r={r} fill="none" stroke="rgba(239,230,210,.15)" strokeWidth={5} />
          <circle cx={44} cy={44} r={r} fill="none" stroke="var(--oxblood-bright)" strokeWidth={5} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - f)} />
        </svg>
        <span className="font-display text-[40px] leading-none">{Math.ceil(left / 1000)}</span>
      </div>
      <p className="font-display text-[22px]">Penalty</p>
      <p className="max-w-[34ch] text-ivory/85">
        The answer was <span className="font-semibold text-ivory">{answer}</span>.
      </p>
      {formula && <p className="max-w-[40ch] text-[13px] text-ivory-dim">{formula}</p>}
    </motion.div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-panel px-4 py-3">
      <dt className="text-[13px] text-ivory-dim">{label}</dt>
      <dd className="font-display text-[26px] leading-tight">{value}</dd>
    </div>
  )
}

function TopFive({ rows }: { rows: ReturnType<typeof rankBoard> }) {
  const { leaderboard } = useStore()
  const names = useNames(rows.slice(0, 5).map((r) => r.id))
  return (
    <aside className="panel flex flex-col gap-3 p-5 sm:p-6">
      <h2 className="font-display text-[22px]">Top of the board</h2>
      {rows.length === 0 ? (
        <p className="text-ivory-dim">Nobody has set a score here yet. Finish a run to claim first place.</p>
      ) : (
        <ol className="flex flex-col">
          {rows.slice(0, 5).map((r) => (
            <li key={r.id} className={cn("flex items-center gap-3 border-b border-line py-2.5 last:border-0", r.isMe && "text-brass")}>
              <span className="w-7 font-display text-[18px] text-ivory-dim">{r.rank}</span>
              <span className="min-w-0 flex-1 truncate">{r.isMe ? "You" : displayName(r.id, leaderboard, names)}</span>
              <span className="font-display text-[20px]">{r.rec.score}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
