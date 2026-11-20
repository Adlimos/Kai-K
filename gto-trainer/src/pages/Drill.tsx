import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import { PokerTable } from "@/components/PokerTable"
import { QuestionPanel } from "@/components/QuestionPanel"
import { DRILL_TOPICS, TOPIC_META, generateQuestion, type DrillTopic, type Question } from "@/lib/questions"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { go, topicSlug } from "@/lib/nav"

export function Drill({ topic }: { topic: DrillTopic }) {
  const { recordAnswer } = useStore()
  const [q, setQ] = useState<Question>(() => generateQuestion(topic))
  const [sel, setSel] = useState<number | null>(null)
  const [session, setSession] = useState({ right: 0, wrong: 0, streak: 0 })

  const next = useCallback(() => {
    setQ(generateQuestion(topic))
    setSel(null)
  }, [topic])

  const answer = useCallback(
    (i: number) => {
      if (sel !== null) return
      setSel(i)
      const ok = i === q.answer
      recordAnswer(q.topic, ok)
      setSession((s) => ({ right: s.right + (ok ? 1 : 0), wrong: s.wrong + (ok ? 0 : 1), streak: ok ? s.streak + 1 : 0 }))
    },
    [q, recordAnswer, sel],
  )

  const total = session.right + session.wrong
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="font-display text-[34px] leading-none sm:text-[42px]">{TOPIC_META[topic].name}</h1>
          <p className="mt-2 max-w-[56ch] text-ivory-dim">{TOPIC_META[topic].blurb}</p>
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

      <nav aria-label="Drill topics" className="-mx-1 flex gap-1.5 overflow-x-auto whitespace-nowrap pb-1 sm:flex-wrap">
        {DRILL_TOPICS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => go(`drill-${topicSlug(t)}`)}
            className={cn(
              "relative min-h-[40px] cursor-pointer rounded-full px-4 text-[14px] font-semibold transition-colors",
              t === topic ? "text-[#1d140a]" : "text-ivory/80 hover:text-ivory",
            )}
          >
            {t === topic && <motion.span layoutId="drill-pill" className="btn-brass absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
            <span className="relative">{TOPIC_META[t].short}</span>
          </button>
        ))}
      </nav>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <PokerTable scenario={q.scenario} dealKey={q.id} verdict={sel === null ? null : sel === q.answer ? "right" : "wrong"} />
        <div className="panel p-5 sm:p-6">
          <QuestionPanel q={q} selected={sel} onSelect={answer} onNext={next} />
        </div>
      </div>
    </div>
  )
}
