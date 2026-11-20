import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { PokerTable } from "@/components/PokerTable"
import { QuestionPanel } from "@/components/QuestionPanel"
import { DRILL_TOPICS, TOPIC_META, generateQuestion, isCorrect, type Question, type Topic } from "@/lib/questions"
import { answeredOn, dayKey, practiceStreak, useGenOpts, useStore, utcDayKey } from "@/lib/store"
import { go, topicSlug } from "@/lib/nav"
import { Chip } from "@/components/Chips"
import { useAnswerClock } from "@/lib/useTimer"
import poster from "data-url:../poster.jpg"

const TOPIC_CHIP: Record<string, string> = {
  potOdds: "var(--chip-blue)",
  ev: "var(--chip-red)",
  outs: "var(--chip-green)",
  preflop: "var(--chip-black)",
  postflop: "#6b3f8f",
  equity: "#b5652b",
  mixed: "var(--chip-gold)",
}

function GoalRing({ done, goal }: { done: number; goal: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  const f = Math.min(1, done / goal)
  return (
    <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center">
      <svg width={76} height={76} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={38} cy={38} r={r} fill="none" stroke="var(--line)" strokeWidth={6} />
        <motion.circle cx={38} cy={38} r={r} fill="none" stroke="var(--brass)" strokeWidth={6} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - f) }} transition={{ duration: 0.8 }} />
      </svg>
      <span className="font-display text-[17px] leading-none">{Math.round(f * 100)}%</span>
    </div>
  )
}

export function Lobby() {
  const { data, recordAnswer, settings } = useStore()
  const opts = useGenOpts()
  const [q, setQ] = useState<Question>(() => generateQuestion("mixed", opts))
  const [sel, setSel] = useState<number | null>(null)
  const clock = useAnswerClock(q.id)

  const { today, byTopic } = useMemo(() => {
    const bt: Record<string, [number, number]> = {}
    for (const b of Object.values(data.buckets))
      for (const [t, v] of Object.entries(b)) {
        if (!v) continue
        const cur = (bt[t] ??= [0, 0])
        cur[0] += v[0]
        cur[1] += v[1]
      }
    return { today: answeredOn(data.buckets, dayKey(new Date())), byTopic: bt }
  }, [data.buckets])

  const streak = practiceStreak(data.buckets)
  const dueReviews = data.mistakes.filter((m) => m.due <= Date.now()).length
  const dailyDone = data.daily[utcDayKey()]
  const answeredToday = today.c + today.w

  const mixedAcc = (() => {
    let c = 0
    let n = 0
    for (const v of Object.values(byTopic)) {
      c += v[0]
      n += v[0] + v[1]
    }
    return n ? [c, n] : null
  })()

  return (
    <div className="flex flex-col gap-12">
      <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-6">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
            className="font-display text-[44px] leading-[1.02] sm:text-[60px] xl:text-[68px]"
          >
            Do the math before the river does.
          </motion.h1>
          <p className="max-w-[46ch] text-[18px] leading-relaxed text-ivory/80">
            Learn the numbers behind every decision, then drill them on a live table: pot odds, EV, outs, pre-flop charts, post-flop strategy and range equity.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => go("drill-mixed")} className="btn-brass min-h-[52px] cursor-pointer rounded-full px-7 text-[17px] font-semibold">
              Start a mixed drill
            </button>
            <button type="button" onClick={() => go("learn")} className="btn-ghost min-h-[52px] cursor-pointer rounded-full px-6 text-[17px] font-semibold">
              Learn the math first
            </button>
          </div>

          <div className="grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
            <div className="flex items-center gap-4">
              <GoalRing done={answeredToday} goal={settings.goal} />
              <div>
                <div className="text-[14px] text-ivory-dim">Today's goal</div>
                <div className="font-display text-[24px] leading-tight">
                  {answeredToday} <span className="text-ivory-dim">/ {settings.goal}</span>
                </div>
                <div className="text-[13px] text-ivory-dim">
                  {streak ? `${streak}-day streak` : "Start a streak today"}
                  {answeredToday ? `, ${Math.round((today.c / answeredToday) * 100)}% right` : ""}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => go("daily")}
                className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-line bg-panel px-4 text-left hover:border-brass/50"
              >
                <span className="font-semibold">Daily challenge</span>
                <span className={dailyDone ? "text-[14px] text-verdigris" : "text-[14px] text-brass"}>{dailyDone ? `${dailyDone.score}/20 done` : "Not played"}</span>
              </button>
              <button
                type="button"
                onClick={() => go("review")}
                className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-line bg-panel px-4 text-left hover:border-brass/50"
              >
                <span className="font-semibold">Mistake review</span>
                <span className={dueReviews ? "text-[14px] text-brass" : "text-[14px] text-ivory-dim"}>{dueReviews ? `${dueReviews} due` : "All clear"}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <PokerTable scenario={q.scenario} dealKey={q.id} verdict={sel === null ? null : isCorrect(q, sel) ? "right" : "wrong"} />
          <div className="panel p-5">
            <QuestionPanel
              compact
              q={q}
              selected={sel}
              onSelect={(i) => {
                if (sel !== null) return
                setSel(i)
                recordAnswer(q, isCorrect(q, i), clock())
              }}
              onNext={() => {
                setQ(generateQuestion("mixed", opts))
                setSel(null)
              }}
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[30px]">Pick a drill</h2>
        <ul className="grid gap-x-8 sm:grid-cols-2">
          {DRILL_TOPICS.map((t) => {
            const v = t === "mixed" ? mixedAcc : byTopic[t as Topic] ? [byTopic[t][0], byTopic[t][0] + byTopic[t][1]] : null
            return (
              <li key={t} className="border-b border-line">
                <button type="button" onClick={() => go(`drill-${topicSlug(t)}`)} className="group flex w-full cursor-pointer items-center gap-4 py-4 text-left">
                  <span className="shrink-0 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[-8deg]">
                    <Chip color={TOPIC_CHIP[t]} edge="#f1e9d6" size={44} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[22px] leading-tight group-hover:text-brass">{TOPIC_META[t].name}</span>
                    <span className="block text-[15px] text-ivory-dim">{TOPIC_META[t].blurb}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-[22px] leading-tight">{v ? `${Math.round((v[0] / v[1]) * 100)}%` : "New"}</span>
                    <span className="block text-[12px] text-ivory-dim">{v ? `${v[1]} answered` : "not tried yet"}</span>
                  </span>
                </button>
              </li>
            )
          })}
          <li className="border-b border-line">
            <button type="button" onClick={() => go("ranges")} className="group flex w-full cursor-pointer items-center gap-4 py-4 text-left">
              <span className="shrink-0 transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[-8deg]">
                <Chip color="var(--chip-white)" edge="#2f5ea6" size={44} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[22px] leading-tight group-hover:text-brass">Build your own ranges</span>
                <span className="block text-[15px] text-ivory-dim">Paint a chart, save it as a preset, then practise it hand by hand.</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-display text-[22px] leading-tight">{data.presets.length}</span>
                <span className="block text-[12px] text-ivory-dim">saved</span>
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section className="grid items-center gap-8 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-14">
        <img
          src={poster}
          width={800}
          height={1000}
          alt="Poster: a 52-card grid on a felt oval with nine live hearts highlighted, above a 0 to 100 scale marking 36% by the rule of four and 35% exact."
          className="w-full max-w-[360px] rounded-[18px] border border-line shadow-[0_30px_60px_rgba(0,0,0,.45)]"
          loading="lazy"
        />
        <div className="flex flex-col gap-5">
          <h2 className="font-display text-[30px] leading-tight">A routine that sticks</h2>
          <ol className="flex max-w-[56ch] flex-col gap-4">
            {[
              ["Learn the idea", "Read the short lesson for a topic. Each has a worked example and a calculator to play with.", "learn"],
              ["Drill one skill", "Work a single topic until the explanation after each hand feels obvious. Tap “How to solve this” whenever you're stuck.", "drill-mixed"],
              ["Play the daily and race the clock", "The daily challenge and timed runs turn the math into reflex.", "daily"],
              ["Review and patch leaks", "Missed hands come back in Mistake review. Stats shows your weakest spots so you can drill them.", "review"],
            ].map(([t, d, h], i) => (
              <li key={t} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brass/50 font-display text-[18px] text-brass">{i + 1}</span>
                <span>
                  <button type="button" onClick={() => go(h)} className="block cursor-pointer text-left text-[17px] font-semibold hover:text-brass">
                    {t}
                  </button>
                  <span className="block text-ivory-dim">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  )
}
