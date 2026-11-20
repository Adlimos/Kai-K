import { useMemo, useState } from "react"
import { PokerTable } from "@/components/PokerTable"
import { QuestionPanel } from "@/components/QuestionPanel"
import { buildQuestion, isCorrect, KINDS, parseShare, TOPIC_META } from "@/lib/questions"
import { useStore } from "@/lib/store"
import { go, topicSlug } from "@/lib/nav"
import { useAnswerClock } from "@/lib/useTimer"

/** A single hand someone shared by link. */
export function Hand({ code }: { code: string }) {
  const { recordAnswer, settings } = useStore()
  const spec = parseShare(code)
  const q = useMemo(() => (spec ? buildQuestion(spec.kind, spec.seed, { difficulty: spec.difficulty, table: spec.table, stack: settings.stack }) : null), [code]) // eslint-disable-line react-hooks/exhaustive-deps
  const [sel, setSel] = useState<number | null>(null)
  const clock = useAnswerClock(q?.id ?? "")
  if (!q || !spec) {
    return (
      <div className="panel mx-auto max-w-[620px] p-6">
        <h1 className="font-display text-[30px]">This hand link doesn't work</h1>
        <p className="mt-2 text-ivory-dim">The link may have been cut off when it was copied. Ask for it again, or try a fresh hand.</p>
        <button type="button" onClick={() => go("drill-mixed")} className="btn-brass mt-4 min-h-[46px] cursor-pointer rounded-full px-5 font-semibold">
          Deal a new hand
        </button>
      </div>
    )
  }
  const topic = KINDS[spec.kind].topic
  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-brass">Shared hand</p>
        <h1 className="font-display text-[34px] leading-none sm:text-[42px]">How would you play this?</h1>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <PokerTable scenario={q.scenario} dealKey={q.id} verdict={sel === null ? null : isCorrect(q, sel) ? "right" : "wrong"} />
        <div className="panel p-5 sm:p-6">
          <QuestionPanel
            q={q}
            selected={sel}
            onSelect={(k) => {
              if (sel !== null) return
              setSel(k)
              recordAnswer(q, isCorrect(q, k), clock())
            }}
            onNext={() => go(`drill-${topicSlug(topic)}`)}
            nextLabel={`More ${TOPIC_META[topic].name.toLowerCase()} hands`}
          />
        </div>
      </div>
    </div>
  )
}
