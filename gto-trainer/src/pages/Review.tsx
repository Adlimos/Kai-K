import { useMemo, useState } from "react"
import { PokerTable } from "@/components/PokerTable"
import { QuestionPanel } from "@/components/QuestionPanel"
import { buildQuestion, isCorrect, kindLabel, TOPIC_META, KINDS } from "@/lib/questions"
import { useStore, type Mistake } from "@/lib/store"
import { useAnswerClock } from "@/lib/useTimer"
import { go } from "@/lib/nav"

const when = (t: number) => {
  const d = t - Date.now()
  if (d <= 0) return "now"
  const h = Math.round(d / 3600_000)
  if (h < 1) return `in ${Math.max(1, Math.round(d / 60_000))} min`
  if (h < 36) return `in ${h} h`
  return `in ${Math.round(h / 24)} days`
}

export function Review() {
  const { data } = useStore()
  const [queue, setQueue] = useState<Mistake[] | null>(null)
  const due = useMemo(() => data.mistakes.filter((m) => m.due <= Date.now()).sort((a, b) => a.due - b.due), [data.mistakes])

  if (queue) return <Session queue={queue} onDone={() => setQueue(null)} />

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-[34px] leading-none sm:text-[42px]">Mistake review</h1>
        <p className="mt-2 max-w-[62ch] text-ivory-dim">
          Every hand you miss comes back here. Answer it right once and it returns in a day; right again three days later and it's cleared. Miss it and it starts over.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Due now" value={due.length} accent />
        <Tile label="Waiting" value={data.mistakes.length - due.length} />
        <Tile label="Cleared so far" value={data.counters.reviewCleared} />
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!due.length}
          onClick={() => setQueue(due)}
          className="btn-brass min-h-[52px] cursor-pointer rounded-full px-7 text-[17px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {due.length ? `Review ${due.length} due hand${due.length > 1 ? "s" : ""}` : "Nothing due right now"}
        </button>
        {data.mistakes.length > due.length && (
          <button type="button" onClick={() => setQueue([...data.mistakes].sort((a, b) => a.due - b.due))} className="btn-ghost min-h-[52px] cursor-pointer rounded-full px-6 font-semibold">
            Practise all {data.mistakes.length} early
          </button>
        )}
      </div>
      {data.mistakes.length === 0 ? (
        <section className="panel p-6">
          <h2 className="font-display text-[24px]">Your review pile is empty</h2>
          <p className="mt-2 max-w-[56ch] text-ivory-dim">Hands you get wrong in drills, timed runs and the daily challenge will collect here so you can come back to them.</p>
          <button type="button" onClick={() => go("drill-mixed")} className="btn-ghost mt-4 min-h-[46px] cursor-pointer rounded-full px-5 font-semibold">
            Start a mixed drill
          </button>
        </section>
      ) : (
        <section className="panel overflow-hidden">
          <table className="w-full border-collapse text-left text-[15px]">
            <thead>
              <tr className="text-[13px] text-ivory-dim">
                <th className="px-4 py-3 font-medium sm:px-6">Question type</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Next review</th>
              </tr>
            </thead>
            <tbody>
              {[...data.mistakes]
                .sort((a, b) => a.due - b.due)
                .slice(0, 30)
                .map((m) => (
                  <tr key={m.kind + m.seed} className="border-t border-line">
                    <td className="px-4 py-3 sm:px-6">
                      <div className="font-semibold">{kindLabel(m.kind)}</div>
                      <div className="text-[13px] text-ivory-dim">{KINDS[m.kind] ? TOPIC_META[KINDS[m.kind].topic].name : ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex gap-1" aria-label={`${m.box} of 2 correct reviews`}>
                        {[0, 1].map((k) => (
                          <span key={k} className={k < m.box ? "h-2.5 w-6 rounded-full bg-verdigris" : "h-2.5 w-6 rounded-full bg-line"} />
                        ))}
                      </span>
                    </td>
                    <td className={m.due <= Date.now() ? "px-4 py-3 font-semibold text-brass" : "px-4 py-3 text-ivory-dim"}>{when(m.due)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={accent ? "rounded-[16px] border border-brass/40 bg-[rgba(214,169,78,.1)] px-4 py-4" : "rounded-[16px] border border-line bg-panel px-4 py-4"}>
      <div className="text-[14px] text-ivory-dim">{label}</div>
      <div className={accent ? "font-display text-[38px] leading-none text-brass" : "font-display text-[38px] leading-none"}>{value}</div>
    </div>
  )
}

function Session({ queue, onDone }: { queue: Mistake[]; onDone: () => void }) {
  const { reviewResult, recordAnswer, settings } = useStore()
  const [i, setI] = useState(0)
  const [sel, setSel] = useState<number | null>(null)
  const [tally, setTally] = useState({ r: 0, w: 0 })
  const m = queue[i]
  const q = useMemo(() => (m ? buildQuestion(m.kind, m.seed, { difficulty: m.d, table: m.table, stack: settings.stack }) : null), [m, settings.stack])
  const clock = useAnswerClock(q?.id ?? "")
  if (!m || !q) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col gap-4 py-8">
        <h1 className="font-display text-[44px] leading-none">Review done</h1>
        <p className="text-[18px] text-ivory/80">
          {tally.r} right, {tally.w} still shaky. Hands you got right come back later to lock them in.
        </p>
        <button type="button" onClick={onDone} className="btn-brass min-h-[48px] w-fit cursor-pointer rounded-full px-6 font-semibold">
          Back to the review list
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-[30px] leading-none">
          Review {i + 1} <span className="text-ivory-dim">of {queue.length}</span>
        </h1>
        <button type="button" onClick={onDone} className="cursor-pointer text-[14px] font-semibold text-ivory-dim hover:text-ivory">
          Stop reviewing
        </button>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <PokerTable scenario={q.scenario} dealKey={q.id} verdict={sel === null ? null : isCorrect(q, sel) ? "right" : "wrong"} />
        <div className="panel p-5 sm:p-6">
          <QuestionPanel
            q={q}
            selected={sel}
            onSelect={(k) => {
              if (sel !== null) return
              setSel(k)
              const ok = isCorrect(q, k)
              reviewResult(m, ok)
              recordAnswer(q, ok, clock(), { noMistake: true })
              setTally((t) => ({ r: t.r + (ok ? 1 : 0), w: t.w + (ok ? 0 : 1) }))
            }}
            onNext={() => {
              setI(i + 1)
              setSel(null)
            }}
            nextLabel={i + 1 < queue.length ? "Next review" : "Finish"}
          />
        </div>
      </div>
    </div>
  )
}
