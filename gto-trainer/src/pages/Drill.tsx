import { useCallback, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { BookOpen } from "lucide-react"
import { PokerTable } from "@/components/PokerTable"
import { QuestionPanel } from "@/components/QuestionPanel"
import { DifficultyPicker } from "@/components/DifficultyPicker"
import { DRILL_TOPICS, TOPIC_META, generateQuestion, isCorrect, kindLabel, type Question } from "@/lib/questions"
import { useGenOpts, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { go, topicSlug, type DrillRoute } from "@/lib/nav"
import { useAnswerClock } from "@/lib/useTimer"

/** The question kinds you get wrong most often (at least 5 attempts each). */
export function weakKinds(sub: Record<string, [number, number]>, limit = 3) {
  return Object.entries(sub)
    .filter(([k, [c, w]]) => k !== "range" && c + w >= 5 && c / (c + w) < 0.9)
    .sort((a, b) => a[1][0] / (a[1][0] + a[1][1]) - b[1][0] / (b[1][0] + b[1][1]))
    .slice(0, limit)
    .map(([k, [c, w]]) => ({ kind: k, acc: c / (c + w), n: c + w }))
}

export function Drill({ topic }: { topic: DrillRoute }) {
  const { recordAnswer, data, settings, updateSettings } = useStore()
  const opts = useGenOpts()
  const weak = useMemo(() => (topic === "weak" ? weakKinds(data.sub) : []), [topic, data.sub])
  const weakKey = weak.map((w) => w.kind).join(",")
  const make = useCallback(
    () => (topic === "weak" ? generateQuestion("mixed", opts, weakKey ? weakKey.split(",") : undefined) : generateQuestion(topic, opts)),
    [topic, opts, weakKey],
  )
  const [q, setQ] = useState<Question>(make)
  const [sel, setSel] = useState<number | null>(null)
  const [session, setSession] = useState({ right: 0, wrong: 0, streak: 0 })
  const clock = useAnswerClock(q.id)

  const next = useCallback(() => {
    setQ(make())
    setSel(null)
  }, [make])

  const answer = useCallback(
    (i: number) => {
      if (sel !== null) return
      setSel(i)
      const ok = isCorrect(q, i)
      recordAnswer(q, ok, clock())
      setSession((s) => ({ right: s.right + (ok ? 1 : 0), wrong: s.wrong + (ok ? 0 : 1), streak: ok ? s.streak + 1 : 0 }))
    },
    [q, recordAnswer, sel, clock],
  )

  const meta = topic === "weak" ? { name: "Weak spots", blurb: "A drill built from the question types you miss most.", lesson: "" } : TOPIC_META[topic]
  const total = session.right + session.wrong
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="font-display text-[34px] leading-none sm:text-[42px]">{meta.name}</h1>
          <p className="mt-2 max-w-[56ch] text-ivory-dim">{meta.blurb}</p>
        </div>
        <dl className="flex gap-5 text-[14px]">
          <div>
            <dt className="text-ivory-dim">This session</dt>
            <dd className="font-display text-[22px] leading-tight">
              {session.right}/{total}
            </dd>
          </div>
          <div>
            <dt className="text-ivory-dim">Streak</dt>
            <dd className="font-display text-[22px] leading-tight text-brass">{session.streak}</dd>
          </div>
        </dl>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Drill topics" className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto whitespace-nowrap pb-1">
          {[...DRILL_TOPICS, "weak" as const].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => go(`drill-${topicSlug(t)}`)}
              className={cn("relative min-h-[40px] shrink-0 cursor-pointer rounded-full px-4 text-[14px] font-semibold transition-colors", t === topic ? "text-[#1d140a]" : "text-ivory/80 hover:text-ivory")}
            >
              {t === topic && <motion.span layoutId="drill-pill" className="btn-brass absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">{t === "weak" ? "Weak spots" : TOPIC_META[t].short}</span>
            </button>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <DifficultyPicker value={settings.difficulty} onChange={(d) => updateSettings({ difficulty: d })} />
          {meta.lesson && (
            <button type="button" onClick={() => go(`learn-${meta.lesson}`)} className="btn-ghost inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full px-4 text-[14px] font-semibold">
              <BookOpen className="h-4 w-4 text-brass" aria-hidden="true" />
              Lesson
            </button>
          )}
        </div>
      </div>

      {topic === "weak" && (
        <p className="rounded-[14px] border border-line bg-panel px-4 py-3 text-[14px] text-ivory/85">
          {weak.length ? (
            <>
              Working on:{" "}
              {weak.map((w, i) => (
                <span key={w.kind}>
                  {i > 0 && ", "}
                  <span className="font-semibold text-ivory">{kindLabel(w.kind)}</span> <span className="text-ivory-dim">({Math.round(w.acc * 100)}% of {w.n})</span>
                </span>
              ))}
              .
            </>
          ) : (
            "No weak spots yet. Once you've answered at least 5 of a question type and scored under 90%, it shows up here. Until then you'll get a mixed drill."
          )}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <PokerTable scenario={q.scenario} dealKey={q.id} verdict={sel === null ? null : isCorrect(q, sel) ? "right" : "wrong"} />
        <div className="panel p-5 sm:p-6">
          <QuestionPanel q={q} selected={sel} onSelect={answer} onNext={next} />
        </div>
      </div>
    </div>
  )
}
