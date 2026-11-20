import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { PokerTable } from "@/components/PokerTable"
import { QuestionPanel } from "@/components/QuestionPanel"
import { DRILL_TOPICS, TOPIC_META, generateQuestion, type Question, type Topic } from "@/lib/questions"
import { DURATIONS, dayKey, recordKey, useStore } from "@/lib/store"
import { go, topicSlug } from "@/lib/nav"
import { Chip } from "@/components/Chips"
import poster from "data-url:../poster.jpg"

const TOPIC_CHIP: Record<string, string> = {
  potOdds: "var(--chip-blue)",
  ev: "var(--chip-red)",
  outs: "var(--chip-green)",
  preflop: "var(--chip-black)",
  mixed: "var(--chip-gold)",
}

export function Lobby() {
  const { data, recordAnswer } = useStore()
  const [q, setQ] = useState<Question>(() => generateQuestion("mixed"))
  const [sel, setSel] = useState<number | null>(null)

  const { today, byTopic, bestRun } = useMemo(() => {
    const tk = dayKey(new Date())
    let c = 0
    let w = 0
    const bt: Record<string, [number, number]> = {}
    for (const [k, b] of Object.entries(data.buckets)) {
      for (const [t, v] of Object.entries(b)) {
        if (!v) continue
        const cur = (bt[t] ??= [0, 0])
        cur[0] += v[0]
        cur[1] += v[1]
        if (k.startsWith(tk)) {
          c += v[0]
          w += v[1]
        }
      }
    }
    let best = 0
    for (const t of DRILL_TOPICS) for (const d of DURATIONS) best = Math.max(best, data.records[recordKey(t, d)]?.score ?? 0)
    return { today: { c, w }, byTopic: bt, bestRun: best }
  }, [data])

  const mixedAcc = (() => {
    let c = 0
    let n = 0
    for (const t of ["potOdds", "ev", "outs", "preflop"]) {
      const v = byTopic[t]
      if (v) {
        c += v[0]
        n += v[0] + v[1]
      }
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
            Drill pot odds, expected value, outs and pre-flop charts on a live table. Every answer is logged so you can watch your accuracy climb.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => go("drill-mixed")} className="btn-brass min-h-[52px] cursor-pointer rounded-full px-7 text-[17px] font-semibold">
              Start a mixed drill
            </button>
            <button type="button" onClick={() => go("timed")} className="btn-ghost min-h-[52px] cursor-pointer rounded-full px-6 text-[17px] font-semibold">
              Race the clock
            </button>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-5">
            <div>
              <dt className="text-[14px] text-ivory-dim">Answered today</dt>
              <dd className="font-display text-[30px] leading-tight">{today.c + today.w}</dd>
            </div>
            <div>
              <dt className="text-[14px] text-ivory-dim">Today's accuracy</dt>
              <dd className="font-display text-[30px] leading-tight">{today.c + today.w ? `${Math.round((today.c / (today.c + today.w)) * 100)}%` : "—"}</dd>
            </div>
            <div>
              <dt className="text-[14px] text-ivory-dim">Best timed run</dt>
              <dd className="font-display text-[30px] leading-tight text-brass">{bestRun || "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <PokerTable scenario={q.scenario} dealKey={q.id} verdict={sel === null ? null : sel === q.answer ? "right" : "wrong"} />
          <div className="panel p-5">
            <QuestionPanel
              compact
              q={q}
              selected={sel}
              onSelect={(i) => {
                if (sel !== null) return
                setSel(i)
                recordAnswer(q.topic, i === q.answer)
              }}
              onNext={() => {
                setQ(generateQuestion("mixed"))
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
                <button
                  type="button"
                  onClick={() => go(`drill-${topicSlug(t)}`)}
                  className="group flex w-full cursor-pointer items-center gap-4 py-4 text-left"
                >
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
              ["Drill one skill", "Work a single topic until the explanation after each hand feels obvious."],
              ["Race the clock", "Timed runs force the math to become reflex. Every miss costs three seconds."],
              ["Review and patch leaks", "Check accuracy by topic, then build a range preset for the spots you miss most."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brass/50 font-display text-[18px] text-brass">{i + 1}</span>
                <span>
                  <span className="block text-[17px] font-semibold">{t}</span>
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
