import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { DRILL_TOPICS, TOPIC_META, type DrillTopic } from "@/lib/questions"
import { DURATIONS, durationLabel, rankBoard, recordKey, useStore, type Duration } from "@/lib/store"
import { cn } from "@/lib/utils"
import { go } from "@/lib/nav"

const MEDAL = ["var(--brass)", "#c9c3b4", "#b07a4a"]

export function Leaderboard() {
  const { leaderboard, meId, data, mode, resolveNames } = useStore()
  const [topic, setTopic] = useState<DrillTopic>("mixed")
  const [dur, setDur] = useState<Duration>(60)
  const key = recordKey(topic, dur)
  const rows = rankBoard(leaderboard, key, meId, data.records[key])
  const [names, setNames] = useState<Record<string, { name: string; avatarUrl?: string }>>({})
  const idsKey = rows.map((r) => r.id).join(",")
  useEffect(() => {
    let live = true
    resolveNames(idsKey ? idsKey.split(",").filter((i) => i !== "me") : []).then((n) => live && setNames(n))
    return () => {
      live = false
    }
  }, [idsKey, resolveNames])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] leading-none sm:text-[42px]">Leaderboard</h1>
          <p className="mt-2 max-w-[60ch] text-ivory-dim">Best timed-challenge scores. Each player's personal record counts once per topic and clock.</p>
        </div>
        <button type="button" onClick={() => go("timed")} className="btn-brass min-h-[46px] cursor-pointer rounded-full px-6 font-semibold">
          Play a timed run
        </button>
      </header>

      {mode === "local" && (
        <p className="rounded-[14px] border border-line bg-panel px-4 py-3 text-[14px] text-ivory-dim">
          The shared leaderboard needs a signed-in claude.ai session. Right now you're seeing scores saved on this device only.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Topic">
          {DRILL_TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={topic === t}
              onClick={() => setTopic(t)}
              className={cn(
                "min-h-[40px] cursor-pointer rounded-full border px-4 text-[14px] font-semibold transition-colors",
                topic === t ? "border-brass bg-[rgba(214,169,78,.14)] text-brass" : "border-line text-ivory/80 hover:text-ivory",
              )}
            >
              {TOPIC_META[t].name}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Clock">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dur === d}
              onClick={() => setDur(d)}
              className={cn(
                "min-h-[40px] cursor-pointer rounded-full border px-4 text-[14px] font-semibold transition-colors",
                dur === d ? "border-brass bg-[rgba(214,169,78,.14)] text-brass" : "border-line text-ivory/80 hover:text-ivory",
              )}
            >
              {durationLabel(d)}
            </button>
          ))}
        </div>
      </div>

      <section className="panel overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-6">
            <h2 className="font-display text-[24px]">No scores on this board yet</h2>
            <p className="text-ivory-dim">
              Be the first to post a {durationLabel(dur)} score in {TOPIC_META[topic].name.toLowerCase()}.
            </p>
          </div>
        ) : (
          <ol>
            <AnimatePresence initial={false}>
              {rows.map((r, i) => {
                const p = names[r.id]
                const name = r.isMe ? "You" : p?.name || "Player"
                const total = r.rec.score + r.rec.wrong
                return (
                  <motion.li
                    key={r.id + key}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i, 10) * 0.03 } }}
                    exit={{ opacity: 0 }}
                    className={cn("flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-0 sm:px-6", r.isMe && "bg-[rgba(214,169,78,.08)]")}
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-[18px]"
                      style={
                        r.rank <= 3
                          ? { background: MEDAL[r.rank - 1], color: "#1d140a" }
                          : { border: "1px solid var(--line)", color: "var(--ivory-dim)" }
                      }
                    >
                      {r.rank}
                    </span>
                    {p?.avatarUrl && !r.isMe ? (
                      <img src={p.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className={cn("truncate font-semibold", r.isMe && "text-brass")}>{name}</div>
                      <div className="text-[13px] text-ivory-dim">
                        {total ? Math.round((r.rec.score / total) * 100) : 0}% accuracy, {new Date(r.rec.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-[28px] leading-none">{r.rec.score}</div>
                      <div className="text-[12px] text-ivory-dim">correct</div>
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ol>
        )}
      </section>
    </div>
  )
}
