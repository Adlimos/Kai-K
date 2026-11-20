import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { DRILL_TOPICS, TOPIC_META, type DrillTopic } from "@/lib/questions"
import { DURATIONS, durationLabel, fmtMs, rankBoard, rankDaily, recordKey, useStore, utcDayKey, type Duration } from "@/lib/store"
import { displayName, useNames } from "@/lib/names"
import { cn } from "@/lib/utils"
import { go } from "@/lib/nav"

const MEDAL = ["var(--brass)", "#c9c3b4", "#b07a4a"]

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn("min-h-[40px] shrink-0 cursor-pointer rounded-full border px-4 text-[14px] font-semibold transition-colors", on ? "border-brass bg-[rgba(214,169,78,.14)] text-brass" : "border-line text-ivory/80 hover:text-ivory")}
    >
      {children}
    </button>
  )
}

export function Leaderboard() {
  const { leaderboard, meId, data, mode, settings } = useStore()
  const [board, setBoard] = useState<"timed" | "daily">("timed")
  const [scope, setScope] = useState<"all" | "club">("all")
  const [topic, setTopic] = useState<DrillTopic>("mixed")
  const [dur, setDur] = useState<Duration>(60)
  const club = scope === "club" && settings.club ? settings.club : undefined
  const key = recordKey(topic, dur)
  const date = utcDayKey()
  const rows =
    board === "timed"
      ? rankBoard(leaderboard, key, meId, data.records[key], club).map((r) => ({ id: r.id, rank: r.rank, isMe: r.isMe, main: r.rec.score, sub: `${r.rec.score + r.rec.wrong ? Math.round((r.rec.score / (r.rec.score + r.rec.wrong)) * 100) : 0}% accuracy, ${new Date(r.rec.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, unit: "correct" }))
      : rankDaily(leaderboard, date, meId, data.daily[date], club).map((r) => ({ id: r.id, rank: r.rank, isMe: r.isMe, main: r.r.score, sub: `${fmtMs(r.r.ms)}`, unit: "of 20" }))
  const names = useNames(rows.map((r) => r.id))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] leading-none sm:text-[42px]">Leaderboard</h1>
          <p className="mt-2 max-w-[60ch] text-ivory-dim">Personal bests in timed challenges, and today's daily challenge scores.</p>
        </div>
        <button type="button" onClick={() => go(board === "timed" ? "timed" : "daily")} className="btn-brass min-h-[46px] cursor-pointer rounded-full px-6 font-semibold">
          {board === "timed" ? "Play a timed run" : "Play today's daily"}
        </button>
      </header>

      {mode === "local" && (
        <p className="rounded-[14px] border border-line bg-panel px-4 py-3 text-[14px] text-ivory-dim">
          The shared leaderboard needs a signed-in claude.ai session. Right now you're seeing scores saved on this device only.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Pill on={board === "timed"} onClick={() => setBoard("timed")}>
            Timed records
          </Pill>
          <Pill on={board === "daily"} onClick={() => setBoard("daily")}>
            Today's daily
          </Pill>
          <span className="mx-1 hidden w-px bg-line sm:block" />
          <Pill on={scope === "all"} onClick={() => setScope("all")}>
            Everyone
          </Pill>
          <Pill on={scope === "club"} onClick={() => (settings.club ? setScope("club") : go("prefs"))}>
            {settings.club ? `Club ${settings.club}` : "Join a club"}
          </Pill>
        </div>
        {board === "timed" && (
          <>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Topic">
              {DRILL_TOPICS.map((t) => (
                <Pill key={t} on={topic === t} onClick={() => setTopic(t)}>
                  {TOPIC_META[t].short}
                </Pill>
              ))}
            </div>
            <div className="flex gap-1.5" role="group" aria-label="Clock">
              {DURATIONS.map((d) => (
                <Pill key={d} on={dur === d} onClick={() => setDur(d)}>
                  {durationLabel(d)}
                </Pill>
              ))}
            </div>
          </>
        )}
      </div>

      <section className="panel overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-6">
            <h2 className="font-display text-[24px]">No scores on this board yet</h2>
            <p className="text-ivory-dim">{board === "timed" ? `Be the first to post a ${durationLabel(dur)} score in ${TOPIC_META[topic].name.toLowerCase()}.` : "Nobody has finished today's daily challenge yet."}</p>
          </div>
        ) : (
          <ol>
            <AnimatePresence initial={false}>
              {rows.map((r, i) => {
                const p = names[r.id]
                return (
                  <motion.li
                    key={r.id + board + key}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i, 10) * 0.03 } }}
                    exit={{ opacity: 0 }}
                    className={cn("flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-0 sm:px-6", r.isMe && "bg-[rgba(214,169,78,.08)]")}
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-[18px]"
                      style={r.rank <= 3 ? { background: MEDAL[r.rank - 1], color: "#1d140a" } : { border: "1px solid var(--line)", color: "var(--ivory-dim)" }}
                    >
                      {r.rank}
                    </span>
                    {p?.avatarUrl && !r.isMe ? <img src={p.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full" /> : null}
                    <div className="min-w-0 flex-1">
                      <div className={cn("truncate font-semibold", r.isMe && "text-brass")}>{r.isMe ? `You${settings.nick ? ` (${settings.nick})` : ""}` : displayName(r.id, leaderboard, names)}</div>
                      <div className="text-[13px] text-ivory-dim">{r.sub}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-[28px] leading-none">{r.main}</div>
                      <div className="text-[12px] text-ivory-dim">{r.unit}</div>
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
