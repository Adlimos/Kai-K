import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, Copy, X } from "lucide-react"
import { PokerTable } from "@/components/PokerTable"
import { QuestionPanel } from "@/components/QuestionPanel"
import { hashString } from "@/lib/cards"
import { isCorrect, questionSet, TOPIC_META, type Question } from "@/lib/questions"
import { fmtMs, rankDaily, useStore, utcDayKey } from "@/lib/store"
import { useNames, displayName } from "@/lib/names"
import { cn } from "@/lib/utils"
import { sfx } from "@/lib/sound"

const COUNT = 20
const OPTS = { difficulty: "medium" as const, table: 6 as const, stack: 100 }

export function Daily() {
  const { data, recordAnswer, submitDaily, leaderboard, meId, settings } = useStore()
  const date = utcDayKey()
  const questions = useMemo(() => questionSet(hashString(`felt-lab-daily-${date}`), COUNT, OPTS), [date])
  const done = data.daily[date]
  const [phase, setPhase] = useState<"intro" | "play" | "done">(done ? "done" : "intro")
  const [i, setI] = useState(0)
  const [sel, setSel] = useState<number | null>(null)
  const [marks, setMarks] = useState<boolean[]>([])
  const [picks, setPicks] = useState<number[]>([])
  const startAt = useRef(0)
  const qStart = useRef(0)
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (phase !== "play") return
    const t = window.setInterval(() => setNow(performance.now()), 250)
    return () => window.clearInterval(t)
  }, [phase])

  const q = questions[i]
  const answer = (k: number) => {
    if (sel !== null) return
    setSel(k)
    const ok = isCorrect(q, k)
    recordAnswer(q, ok, performance.now() - qStart.current - 500)
    const m = [...marks, ok]
    setMarks(m)
    setPicks((p) => [...p, k])
    window.setTimeout(() => {
      if (i + 1 >= COUNT) {
        const ms = Math.round(performance.now() - startAt.current)
        submitDaily(date, { score: m.filter(Boolean).length, wrong: m.filter((x) => !x).length, ms, marks: m.map((x) => (x ? "1" : "0")).join("") })
        sfx.fanfare()
        setPhase("done")
      } else {
        setI(i + 1)
        setSel(null)
        qStart.current = performance.now()
      }
    }, 900)
  }

  if (phase === "intro") {
    return (
      <div className="mx-auto flex max-w-[760px] flex-col gap-6 py-4">
        <p className="text-brass">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="font-display text-[44px] leading-[1.02] sm:text-[60px]">Daily challenge</h1>
        <p className="max-w-[56ch] text-[18px] text-ivory/80">
          Twenty hands, the same for every player today. Your first attempt is the one that counts. Highest score wins; ties go to the faster time. A new set unlocks at midnight UTC.
        </p>
        <ul className="grid gap-2 text-ivory/85 sm:grid-cols-3">
          <li className="rounded-[14px] border border-line bg-panel px-4 py-3">20 mixed hands</li>
          <li className="rounded-[14px] border border-line bg-panel px-4 py-3">Medium difficulty</li>
          <li className="rounded-[14px] border border-line bg-panel px-4 py-3">Clock runs from the first deal</li>
        </ul>
        <button
          type="button"
          onClick={() => {
            startAt.current = performance.now()
            qStart.current = performance.now()
            setPhase("play")
            sfx.go()
          }}
          className="btn-brass min-h-[54px] w-fit cursor-pointer rounded-full px-8 text-[17px] font-semibold"
        >
          Start today's 20
        </button>
        <DailyBoard date={date} rows={rankDaily(leaderboard, date, meId, undefined, undefined)} />
      </div>
    )
  }

  if (phase === "done") {
    const r = data.daily[date] ?? { score: marks.filter(Boolean).length, wrong: marks.filter((x) => !x).length, ms: 0, marks: marks.map((x) => (x ? "1" : "0")).join("") }
    const ranked = rankDaily(leaderboard, date, meId, r)
    const me = ranked.find((x) => x.isMe)
    const clubRanked = settings.club ? rankDaily(leaderboard, date, meId, r, settings.club) : null
    return (
      <div className="mx-auto flex max-w-[860px] flex-col gap-6 py-4">
        <p className="text-brass">Daily challenge, {date}</p>
        <h1 className="font-display text-[56px] leading-none sm:text-[76px]">
          {r.score}/{COUNT}
        </h1>
        <div className="flex flex-wrap gap-1" aria-label="Hand by hand results">
          {(r.marks ?? "").split("").map((m, k) => (
            <span key={k} className={cn("h-5 w-5 rounded-[5px]", m === "1" ? "bg-verdigris" : "bg-oxblood-bright")} title={`Hand ${k + 1}: ${m === "1" ? "right" : "wrong"}`} />
          ))}
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Time" value={fmtMs(r.ms)} />
          <Stat label="Today's rank" value={me ? `#${me.rank} of ${ranked.length}` : "—"} />
          <Stat label={clubRanked ? "In your club" : "Dailies played"} value={clubRanked ? `#${clubRanked.find((x) => x.isMe)?.rank ?? "—"} of ${clubRanked.length}` : String(data.counters.dailyDone)} />
        </dl>
        <ShareResult text={`Felt Lab daily ${date}: ${r.score}/${COUNT} in ${fmtMs(r.ms)}\n${(r.marks ?? "").replace(/1/g, "🟩").replace(/0/g, "🟥")}`} />
        <DailyBoard date={date} rows={ranked} />
        <Recap questions={questions} picks={picks} />
      </div>
    )
  }

  const elapsed = Math.max(0, now - startAt.current)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[14px] text-ivory-dim">Daily challenge</div>
          <div className="font-display text-[28px] leading-none">
            Hand {i + 1} <span className="text-ivory-dim">of {COUNT}</span>
          </div>
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: COUNT }, (_, k) => (
            <span key={k} className={cn("hidden h-2 w-3 rounded-full sm:block", k < marks.length ? (marks[k] ? "bg-verdigris" : "bg-oxblood-bright") : k === i ? "bg-brass" : "bg-line")} />
          ))}
        </div>
        <div className="font-display text-[30px] tabular-nums">{fmtMs(elapsed)}</div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <PokerTable scenario={q.scenario} dealKey={q.id} verdict={sel === null ? null : isCorrect(q, sel) ? "right" : "wrong"} />
        <div className="panel p-5 sm:p-6">
          <QuestionPanel q={q} selected={sel} onSelect={answer} showExplain={false} help={false} share={false} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-panel px-4 py-3">
      <dt className="text-[13px] text-ivory-dim">{label}</dt>
      <dd className="font-display text-[24px] leading-tight">{value}</dd>
    </div>
  )
}

function ShareResult({ text }: { text: string }) {
  const [copied, setCopied] = useState<boolean | null>(null)
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
          } catch {
            setCopied(false)
          }
        }}
        className="btn-ghost inline-flex min-h-[46px] w-fit cursor-pointer items-center gap-2 rounded-full px-5 font-semibold"
      >
        <Copy className="h-4 w-4" aria-hidden="true" />
        {copied ? "Result copied" : "Copy result to share"}
      </button>
      {copied === false && <textarea readOnly value={text} rows={3} className="max-w-[420px] rounded-[10px] border border-line bg-ink p-2 text-[13px]" onFocus={(e) => e.currentTarget.select()} aria-label="Result text" />}
    </div>
  )
}

function DailyBoard({ date, rows }: { date: string; rows: ReturnType<typeof rankDaily> }) {
  const names = useNames(rows.slice(0, 10).map((r) => r.id))
  const { leaderboard } = useStore()
  return (
    <section className="panel p-5">
      <h2 className="font-display text-[22px]">Today's board</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-ivory-dim">No one has finished {date} yet.</p>
      ) : (
        <ol className="mt-2">
          {rows.slice(0, 10).map((r) => (
            <li key={r.id} className={cn("flex items-center gap-3 border-b border-line py-2.5 last:border-0", r.isMe && "text-brass")}>
              <span className="w-7 font-display text-[18px] text-ivory-dim">{r.rank}</span>
              <span className="min-w-0 flex-1 truncate">{r.isMe ? "You" : displayName(r.id, leaderboard, names)}</span>
              <span className="text-[14px] text-ivory-dim">{fmtMs(r.r.ms)}</span>
              <span className="w-12 text-right font-display text-[20px]">{r.r.score}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Recap({ questions, picks }: { questions: Question[]; picks: number[] }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!picks.length) return null
  return (
    <section className="panel p-5">
      <h2 className="font-display text-[22px]">Review your answers</h2>
      <ol className="mt-3 flex flex-col">
        {questions.map((q, k) => {
          const ok = isCorrect(q, picks[k])
          return (
            <li key={q.id} className="border-b border-line last:border-0">
              <button type="button" onClick={() => setOpen(open === k ? null : k)} aria-expanded={open === k} className="flex w-full cursor-pointer items-center gap-3 py-3 text-left">
                {ok ? <Check className="h-5 w-5 shrink-0 text-verdigris" aria-label="Right" /> : <X className="h-5 w-5 shrink-0 text-oxblood-bright" aria-label="Wrong" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-ivory-dim">{TOPIC_META[q.topic].name}</span>
                  <span className="block truncate">{q.prompt}</span>
                </span>
              </button>
              <AnimatePresence>
                {open === k && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="pb-4 pl-8 text-[15px] text-ivory/85">
                      <p>{q.story}</p>
                      <p className="mt-2">
                        You answered <span className="font-semibold">{q.choices[picks[k]]}</span>. Correct: <span className="font-semibold text-verdigris">{q.choices[q.answer]}</span>.
                      </p>
                      <p className="mt-2 text-ivory/75">{q.explain}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
