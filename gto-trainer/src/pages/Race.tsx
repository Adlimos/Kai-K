import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Copy, Flag, Users } from "lucide-react"
import { PokerTable } from "@/components/PokerTable"
import { QuestionPanel } from "@/components/QuestionPanel"
import { Countdown, Penalty, PENALTY_MS } from "./Timed"
import { DRILL_TOPICS, TOPIC_META, isCorrect, questionSet, type DrillTopic } from "@/lib/questions"
import { fmtMs, useStore, type NamedRoom, type RoomPeer } from "@/lib/store"
import { useNames } from "@/lib/names"
import { newSeed } from "@/lib/cards"
import { cn } from "@/lib/utils"
import { sfx } from "@/lib/sound"

const N = 10
const OPTS = { difficulty: "medium" as const, table: 6 as const, stack: 100 }
const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"

interface Pres {
  nick: string
  uid: string | null
  host: boolean
  seed: number
  topic: DrillTopic
  state: "lobby" | "go" | "racing" | "done"
  go: number
  answered: number
  correct: number
  finishedMs: number | null
}

/** Presence is written by other viewers: read every field defensively. */
function readPres(p: Readonly<Record<string, unknown>>): Pres {
  const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d)
  const topic = DRILL_TOPICS.includes(p.topic as DrillTopic) ? (p.topic as DrillTopic) : "mixed"
  const state = ["lobby", "go", "racing", "done"].includes(p.state as string) ? (p.state as Pres["state"]) : "lobby"
  return {
    nick: typeof p.nick === "string" ? p.nick.slice(0, 24) : "",
    uid: typeof p.uid === "string" ? p.uid : null,
    host: p.host === true,
    seed: num(p.seed),
    topic,
    state,
    go: num(p.go),
    answered: Math.min(N, Math.max(0, num(p.answered))),
    correct: Math.min(N, Math.max(0, num(p.correct))),
    finishedMs: typeof p.finishedMs === "number" ? p.finishedMs : null,
  }
}

export function Race() {
  const { room, settings, userId, recordAnswer, recordRace } = useStore()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [r, setR] = useState<NamedRoom | null>(null)
  const [code, setCode] = useState("")
  const [input, setInput] = useState("")
  const [error, setError] = useState("")
  const [peers, setPeers] = useState<readonly RoomPeer[]>([])
  const [isHost, setIsHost] = useState(false)
  const [topic, setTopic] = useState<DrillTopic>("mixed")
  const mine = useRef<Partial<Pres>>({})

  useEffect(() => {
    let live = true
    room().then((ns) => live && setAvailable(!!ns))
    return () => {
      live = false
    }
  }, [room])

  const push = useCallback(
    (patch: Partial<Pres>) => {
      mine.current = { ...mine.current, ...patch }
      void r?.presence(patch as Record<string, unknown>)
    },
    [r],
  )

  const enter = async (c: string, host: boolean) => {
    setError("")
    const ns = await room()
    if (!ns) return setError("Races need the live version of Felt Lab on claude.ai.")
    try {
      const joined = await ns.join(`race-${c}`)
      const uid = await userId()
      const base: Pres = { nick: settings.nick, uid, host, seed: host ? newSeed() : 0, topic, state: "lobby", go: 0, answered: 0, correct: 0, finishedMs: null }
      mine.current = base
      await joined.presence(base as unknown as Record<string, unknown>)
      joined.onPeers((ch) => setPeers(ch.peers))
      setPeers(joined.peers())
      setR(joined)
      setCode(c)
      setIsHost(host)
    } catch (e) {
      const codeErr = (e as { code?: string })?.code
      setError(codeErr === "not_permitted" ? "Your access to this page doesn't include races." : "Couldn't open the race room. Check your connection and try again.")
    }
  }

  const leave = () => {
    void r?.leave()
    setR(null)
    setPeers([])
    setCode("")
  }
  useEffect(() => () => void r?.leave(), [r])

  if (available === false) {
    return (
      <div className="panel mx-auto max-w-[680px] p-6">
        <h1 className="font-display text-[32px]">Head-to-head races</h1>
        <p className="mt-2 text-ivory/80">Live races aren&apos;t switched on for this copy of Felt Lab. They need the live version on claude.ai with real-time connections enabled. Everything else works here, including the daily challenge, which gives every player the same hands.</p>
      </div>
    )
  }

  if (!r) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="font-display text-[34px] leading-none sm:text-[42px]">Head-to-head race</h1>
          <p className="mt-2 max-w-[60ch] text-ivory-dim">
            Everyone in the room gets the same {N} hands. A wrong answer costs 3 seconds. Most correct wins; ties go to the fastest finish.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          <section className="panel flex flex-col gap-4 p-5 sm:p-6">
            <h2 className="font-display text-[24px]">Start a race</h2>
            <div className="flex flex-wrap gap-1.5">
              {DRILL_TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={topic === t}
                  onClick={() => setTopic(t)}
                  className={cn("min-h-[40px] cursor-pointer rounded-full border px-3.5 text-[14px] font-semibold", topic === t ? "border-brass bg-[rgba(214,169,78,.14)] text-brass" : "border-line text-ivory/80")}
                >
                  {TOPIC_META[t].short}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={available === null}
              onClick={() => enter(Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(""), true)}
              className="btn-brass min-h-[50px] w-fit cursor-pointer rounded-full px-6 font-semibold disabled:opacity-50"
            >
              Create a race room
            </button>
          </section>
          <section className="panel flex flex-col gap-4 p-5 sm:p-6">
            <h2 className="font-display text-[24px]">Join a friend</h2>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const c = input.trim().toLowerCase()
                if (!/^[a-z0-9]{4,8}$/.test(c)) return setError("Room codes are 5 letters and numbers, like k7m2p.")
                void enter(c, false)
              }}
            >
              <label htmlFor="race-code" className="sr-only">
                Room code
              </label>
              <input
                id="race-code"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Room code"
                autoComplete="off"
                className="min-h-[50px] min-w-0 flex-1 rounded-[12px] border border-line bg-ink px-3 font-display text-[22px] tracking-[0.15em] text-ivory outline-none focus:border-brass"
              />
              <button type="submit" className="btn-ghost min-h-[50px] cursor-pointer rounded-full px-5 font-semibold">
                Join
              </button>
            </form>
            {!settings.nick && <p className="text-[14px] text-ivory-dim">Tip: set a nickname in Preferences so friends know which bar is yours.</p>}
          </section>
        </div>
        {error && (
          <p role="alert" className="text-oxblood-bright">
            {error}
          </p>
        )}
      </div>
    )
  }

  return <RaceRoom code={code} isHost={isHost} peers={peers} push={push} mine={mine} onLeave={leave} recordAnswer={recordAnswer} recordRace={recordRace} />
}

function RaceRoom({
  code,
  isHost,
  peers,
  push,
  mine,
  onLeave,
  recordAnswer,
  recordRace,
}: {
  code: string
  isHost: boolean
  peers: readonly RoomPeer[]
  push: (p: Partial<Pres>) => void
  mine: React.MutableRefObject<Partial<Pres>>
  onLeave: () => void
  recordAnswer: ReturnType<typeof useStore>["recordAnswer"]
  recordRace: (won: boolean) => void
}) {
  const players = peers.map((p) => ({ peer: p, pres: readPres(p.presence) }))
  const host = players.find((p) => p.pres.host) ?? players.find((p) => p.peer.isMe)
  const seed = host?.pres.seed ?? 0
  const topic = host?.pres.topic ?? "mixed"
  const questions = useMemo(() => (seed ? questionSet(seed, N, OPTS, topic) : []), [seed, topic])
  const names = useNames(players.map((p) => p.peer.by ?? p.pres.uid ?? "").filter(Boolean))
  const nameOf = (p: (typeof players)[number]) => (p.peer.isMe ? "You" : p.pres.nick || names[p.peer.by ?? p.pres.uid ?? ""]?.name || "Player")

  const [phase, setPhase] = useState<"lobby" | "countdown" | "racing" | "done">("lobby")
  const [count, setCount] = useState(3)
  const [i, setI] = useState(0)
  const [sel, setSel] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [penaltyUntil, setPenaltyUntil] = useState(0)
  const [now, setNow] = useState(0)
  const startAt = useRef(0)
  const qStart = useRef(0)
  const seenGo = useRef(0)
  const recorded = useRef(false)

  // Follow the host's start signal and resets.
  useEffect(() => {
    if (!host) return
    if (host.pres.state === "go" || host.pres.state === "racing") {
      if (host.pres.go && host.pres.go !== seenGo.current && phase === "lobby") {
        seenGo.current = host.pres.go
        setCount(3)
        setPhase("countdown")
      }
    }
    if (host.pres.state === "lobby" && phase === "done" && !isHost) {
      setPhase("lobby")
      setI(0)
      setCorrect(0)
      setSel(null)
      recorded.current = false
      push({ state: "lobby", answered: 0, correct: 0, finishedMs: null })
    }
  }, [host, phase, isHost, push])

  useEffect(() => {
    if (phase !== "countdown") return
    if (count === 0) {
      sfx.go()
      startAt.current = performance.now()
      qStart.current = performance.now()
      setPhase("racing")
      push({ state: "racing", answered: 0, correct: 0, finishedMs: null })
      return
    }
    sfx.tick()
    const t = window.setTimeout(() => setCount((c) => c - 1), 700)
    return () => window.clearTimeout(t)
  }, [phase, count, push])

  useEffect(() => {
    if (phase !== "racing") return
    const t = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(t)
  }, [phase])

  const advance = useCallback(
    (answered: number, c: number) => {
      if (answered >= N) {
        const ms = Math.round(performance.now() - startAt.current)
        push({ state: "done", answered, correct: c, finishedMs: ms })
        setPhase("done")
        return
      }
      setI(answered)
      setSel(null)
      qStart.current = performance.now()
    },
    [push],
  )

  useEffect(() => {
    if (phase !== "racing" || !penaltyUntil || now < penaltyUntil) return
    setPenaltyUntil(0)
    advance(i + 1, correct)
  }, [now, penaltyUntil, phase, advance, i, correct])

  const q = questions[i]
  const answer = (k: number) => {
    if (sel !== null || phase !== "racing" || !q) return
    setSel(k)
    const ok = isCorrect(q, k)
    recordAnswer(q, ok, performance.now() - qStart.current - 500)
    const c = correct + (ok ? 1 : 0)
    setCorrect(c)
    push({ answered: i + 1, correct: c })
    if (ok) window.setTimeout(() => advance(i + 1, c), 380)
    else setPenaltyUntil(performance.now() + PENALTY_MS)
  }

  const standings = [...players].sort((a, b) => {
    const ad = a.pres.state === "done" ? 1 : 0
    const bd = b.pres.state === "done" ? 1 : 0
    return b.pres.correct - a.pres.correct || bd - ad || (a.pres.finishedMs ?? 9e9) - (b.pres.finishedMs ?? 9e9)
  })
  const racers = players.filter((p) => p.pres.state === "racing" || p.pres.state === "done")
  const allDone = racers.length > 1 && racers.every((p) => p.pres.state === "done")
  useEffect(() => {
    if (!allDone || recorded.current || phase !== "done") return
    recorded.current = true
    const winner = standings.find((p) => p.pres.state === "done")
    const won = !!winner?.peer.isMe
    recordRace(won)
    if (won) sfx.fanfare()
  }, [allDone, phase, standings, recordRace])

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      /* code is on screen to read out */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[14px] text-ivory-dim">Race room, {TOPIC_META[topic].name.toLowerCase()}</div>
          <button type="button" onClick={copyCode} className="flex cursor-pointer items-center gap-2 font-display text-[36px] leading-none tracking-[0.12em]" aria-label={`Room code ${code}. Copy`}>
            {code}
            <Copy className="h-5 w-5 text-ivory-dim" aria-hidden="true" />
          </button>
        </div>
        <button type="button" onClick={onLeave} className="btn-ghost min-h-[44px] cursor-pointer rounded-full px-5 font-semibold">
          Leave room
        </button>
      </div>

      <section className="panel p-4 sm:p-5" aria-label="Players">
        <div className="mb-3 flex items-center gap-2 text-[14px] text-ivory-dim">
          <Users className="h-4 w-4" aria-hidden="true" />
          {players.length} in the room
        </div>
        <ul className="flex flex-col gap-2.5">
          {standings.map((p) => (
            <li key={p.peer.peer} className="flex items-center gap-3">
              <span className={cn("w-28 shrink-0 truncate text-[15px] font-semibold sm:w-40", p.peer.isMe && "text-brass")}>{nameOf(p)}</span>
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-line">
                <motion.div className={cn("absolute inset-y-0 left-0 rounded-full", p.peer.isMe ? "bg-brass" : "bg-ivory/70")} animate={{ width: `${(p.pres.answered / N) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />
              </div>
              <span className="w-20 shrink-0 text-right text-[14px]">
                {p.pres.state === "done" ? (
                  <span className="flex items-center justify-end gap-1">
                    <Flag className="h-3.5 w-3.5 text-verdigris" aria-hidden="true" />
                    {p.pres.correct}/{N}
                  </span>
                ) : p.pres.state === "racing" ? (
                  `${p.pres.correct}/${p.pres.answered}`
                ) : (
                  <span className="text-ivory-dim">ready</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {phase === "lobby" && (
        <div className="flex flex-wrap items-center gap-4">
          {isHost ? (
            <>
              <button
                type="button"
                disabled={players.length < 2}
                onClick={() => {
                  const go = Date.now()
                  push({ state: "go", go })
                }}
                className="btn-brass min-h-[52px] cursor-pointer rounded-full px-7 text-[17px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start the race
              </button>
              <span className="text-ivory-dim">{players.length < 2 ? "Share the room code. You need at least one opponent." : "Everyone's in? Start when ready."}</span>
            </>
          ) : (
            <span className="text-ivory/80">Waiting for the host to start. Share the code to bring more players.</span>
          )}
        </div>
      )}

      {phase === "racing" && q && (
        <>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[26px]">
              Hand {i + 1} <span className="text-ivory-dim">of {N}</span>
            </span>
            <span className="font-display text-[26px] tabular-nums">{fmtMs(Math.max(0, now - startAt.current))}</span>
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <PokerTable scenario={q.scenario} dealKey={q.id} verdict={sel === null ? null : isCorrect(q, sel) ? "right" : "wrong"} />
            <div className="panel relative overflow-hidden p-5 sm:p-6">
              <QuestionPanel q={q} selected={sel} onSelect={answer} showExplain={false} help={false} share={false} />
              <AnimatePresence>{penaltyUntil > 0 && <Penalty left={Math.max(0, penaltyUntil - now)} answer={q.choices[q.answer]} formula={q.formula} />}</AnimatePresence>
            </div>
          </div>
        </>
      )}

      {phase === "done" && (
        <section className="panel flex flex-col gap-3 p-5 sm:p-6">
          <h2 className="font-display text-[28px]">{allDone ? (standings[0]?.peer.isMe ? "You won the race" : `${nameOf(standings[0])} wins`) : "You're done. Waiting for the others"}</h2>
          <ol className="flex flex-col">
            {standings
              .filter((p) => p.pres.state === "done")
              .map((p, k) => (
                <li key={p.peer.peer} className={cn("flex items-center gap-3 border-b border-line py-2.5 last:border-0", p.peer.isMe && "text-brass")}>
                  <span className="w-7 font-display text-[20px] text-ivory-dim">{k + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{nameOf(p)}</span>
                  <span className="text-ivory-dim">{p.pres.finishedMs !== null ? fmtMs(p.pres.finishedMs) : ""}</span>
                  <span className="w-14 text-right font-display text-[22px]">
                    {p.pres.correct}/{N}
                  </span>
                </li>
              ))}
          </ol>
          {isHost && allDone && (
            <button
              type="button"
              onClick={() => {
                recorded.current = false
                setI(0)
                setCorrect(0)
                setSel(null)
                setPhase("lobby")
                push({ seed: newSeed(), state: "lobby", answered: 0, correct: 0, finishedMs: null, go: 0 })
                mine.current.go = 0
              }}
              className="btn-brass mt-2 min-h-[48px] w-fit cursor-pointer rounded-full px-6 font-semibold"
            >
              Set up a rematch
            </button>
          )}
        </section>
      )}

      <AnimatePresence>{phase === "countdown" && <Countdown count={count} />}</AnimatePresence>
    </div>
  )
}
