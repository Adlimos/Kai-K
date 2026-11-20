import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { Difficulty, DrillTopic, Question, Topic } from "./questions"
import type { RangePreset } from "./ranges"
import { BADGES } from "./badges"

// ---------- Types ----------
export type Tally = [number, number, number?] // [correct, wrong, total answer ms]
export type Bucket = Partial<Record<Topic, Tally>>
export interface RunRecord {
  score: number
  wrong: number
  at: number
}
export interface DailyResult {
  score: number
  wrong: number
  ms: number
  marks?: string // "1101..." right/wrong per hand
}
export type Duration = 60 | 150 | 300
export const DURATIONS: Duration[] = [60, 150, 300]
export const durationLabel = (d: Duration) => (d === 60 ? "1 min" : d === 150 ? "2.5 min" : "5 min")
export const recordKey = (t: DrillTopic, d: Duration) => `${t}_${d}`

export interface Mistake {
  kind: string
  seed: number
  d: Difficulty
  table: 6 | 9
  due: number
  box: number // correct answers in a row since it was missed
  added: number
}

export interface Settings {
  difficulty: Difficulty
  table: 6 | 9
  stack: number
  deck: "four" | "two"
  cardScale: 1 | 1.2
  sound: boolean
  haptics: boolean
  goal: number
  nick: string
  club: string
}
export const DEFAULT_SETTINGS: Settings = {
  difficulty: "medium",
  table: 6,
  stack: 100,
  deck: "four",
  cardScale: 1,
  sound: true,
  haptics: true,
  goal: 30,
  nick: "",
  club: "",
}

export interface Counters {
  curStreak: number
  bestStreak: number
  perfectRuns: number
  fastRuns: number
  dailyDone: number
  reviewCleared: number
  racesDone: number
  racesWon: number
}
const DEFAULT_COUNTERS: Counters = { curStreak: 0, bestStreak: 0, perfectRuns: 0, fastRuns: 0, dailyDone: 0, reviewCleared: 0, racesDone: 0, racesWon: 0 }

export interface UserData {
  v: 2
  buckets: Record<string, Bucket>
  records: Record<string, RunRecord>
  presets: RangePreset[]
  sub: Record<string, [number, number]> // per question kind, all time
  mistakes: Mistake[]
  settings: Settings
  counters: Counters
  badges: Record<string, number>
  daily: Record<string, DailyResult>
}

export interface LeaderRow {
  id: string
  records: Record<string, RunRecord>
  daily: Record<string, DailyResult>
  nick: string
  club: string
}

export type SyncMode = "connecting" | "shared" | "local"

export interface Toast {
  id: number
  title: string
  body?: string
}

interface StoreValue {
  data: UserData
  settings: Settings
  mode: SyncMode
  meId: string | null
  leaderboard: LeaderRow[]
  toasts: Toast[]
  notify: (title: string, body?: string) => void
  dismiss: (id: number) => void
  recordAnswer: (q: Question, correct: boolean, ms: number, opts?: { noMistake?: boolean }) => void
  reviewResult: (m: Mistake, correct: boolean) => void
  submitRun: (topic: DrillTopic, d: Duration, score: number, wrong: number) => { best: boolean; previous?: RunRecord }
  submitDaily: (date: string, r: DailyResult) => void
  recordRace: (won: boolean) => void
  savePreset: (p: RangePreset) => void
  deletePreset: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  resolveNames: (ids: string[]) => Promise<Record<string, { name: string; avatarUrl?: string }>>
  room: () => Promise<RoomNS | null>
  userId: () => Promise<string | null>
}

// ---------- Minimal typings for the artifact runtime ----------
interface DocSnap {
  exists: boolean
  id: string
  data(): Record<string, unknown> | undefined
}
interface DocRef {
  get(): Promise<DocSnap>
  set(d: Record<string, unknown>): Promise<void>
}
interface QuerySnap {
  docs: DocSnap[]
}
interface Coll {
  onSnapshot(next: (s: QuerySnap) => void, err?: (e: { code: string }) => void): () => void
}
interface DB {
  doc(p: string): DocRef
  collection(p: string): Coll
}
interface UserNS {
  id(): Promise<string | null>
  profiles(ids: string[]): Promise<Record<string, { name: string; avatarUrl: string }>>
}
export interface RoomPeer {
  peer: string
  by: string | null
  isMe: boolean
  presence: Readonly<Record<string, unknown>>
}
export interface NamedRoom {
  presence(p: Record<string, unknown>): Promise<void>
  peers(): readonly RoomPeer[]
  onPeers(h: (c: { peers: readonly RoomPeer[] }) => void, err?: (e: { code: string }) => void): () => void
  leave(): Promise<void>
}
export interface RoomNS {
  join(name: string): Promise<NamedRoom>
}
declare global {
  interface Window {
    claude?: { use?: (name: string) => Promise<unknown> }
  }
}

// ---------- Local persistence ----------
const LS_KEY = "gto-trainer:v1"
const empty = (): UserData => ({
  v: 2,
  buckets: {},
  records: {},
  presets: [],
  sub: {},
  mistakes: [],
  settings: { ...DEFAULT_SETTINGS },
  counters: { ...DEFAULT_COUNTERS },
  badges: {},
  daily: {},
})
function normalize(d: Partial<UserData> | null | undefined): UserData {
  const e = empty()
  if (!d) return e
  return {
    ...e,
    ...d,
    v: 2,
    settings: { ...e.settings, ...(d.settings ?? {}) },
    counters: { ...e.counters, ...(d.counters ?? {}) },
    sub: d.sub ?? {},
    mistakes: d.mistakes ?? [],
    badges: d.badges ?? {},
    daily: d.daily ?? {},
  }
}

function loadLocal(): UserData {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return normalize(raw ? JSON.parse(raw) : null)
  } catch {
    return empty()
  }
}
function saveLocal(d: UserData) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(d))
  } catch {
    /* storage unavailable: keep in memory */
  }
}

const pad = (n: number) => String(n).padStart(2, "0")
export const dayKey = (t: Date) => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
export const hourKey = (t: Date) => `${dayKey(t)}T${pad(t.getHours())}`
export const utcDayKey = (t = new Date()) => `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
export function keyToDate(k: string): Date {
  const [y, m, rest] = k.split("-")
  const [d, h] = rest.split("T")
  return new Date(Number(y), Number(m) - 1, Number(d), h ? Number(h) : 0)
}

function compact(buckets: Record<string, Bucket>): Record<string, Bucket> {
  const cutoff = Date.now() - 3 * 86400_000
  const out: Record<string, Bucket> = {}
  for (const [k, b] of Object.entries(buckets)) {
    const target = k.length > 10 && keyToDate(k).getTime() < cutoff ? k.slice(0, 10) : k
    const into = (out[target] ??= {})
    for (const [t, tally] of Object.entries(b) as [Topic, Tally][]) {
      const cur = into[t] ?? [0, 0, 0]
      into[t] = [cur[0] + tally[0], cur[1] + tally[1], (cur[2] ?? 0) + (tally[2] ?? 0)]
    }
  }
  return out
}

const REVIEW_STEPS = [86400_000, 3 * 86400_000]
const MAX_MISTAKES = 120

// ---------- Context ----------
const Ctx = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<UserData>(() => loadLocal())
  const [mode, setMode] = useState<SyncMode>("connecting")
  const [meId, setMeId] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const dbRef = useRef<DB | null>(null)
  const userRef = useRef<UserNS | null>(null)
  const writable = useRef(false)
  const writeChain = useRef<Promise<unknown>>(Promise.resolve())
  const saveTimer = useRef<number | undefined>(undefined)
  const lbTimer = useRef<number | undefined>(undefined)
  const latest = useRef(data)
  latest.current = data
  const meRef = useRef<string | null>(null)

  const notify = useCallback((title: string, body?: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, title, body }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false
    const giveUp = window.setTimeout(() => !cancelled && setMode((m) => (m === "connecting" ? "local" : m)), 10000)
    ;(async () => {
      const use = window.claude?.use
      if (!use) {
        setMode("local")
        return
      }
      const [db, user] = (await Promise.all([use("db"), use("user")])) as [DB | null, UserNS | null]
      if (cancelled) return
      userRef.current = user
      if (!db) {
        setMode("local")
        return
      }
      dbRef.current = db
      unsub = db.collection("leaderboard").onSnapshot(
        (snap) => {
          setLeaderboard(
            snap.docs
              .filter((d) => d.exists)
              .map((d) => {
                const v = (d.data() ?? {}) as Partial<LeaderRow>
                return { id: d.id, records: v.records ?? {}, daily: v.daily ?? {}, nick: typeof v.nick === "string" ? v.nick.slice(0, 24) : "", club: typeof v.club === "string" ? v.club : "" }
              }),
          )
        },
        () => undefined,
      )
      const id = user ? await user.id() : null
      if (cancelled) return
      setMeId(id)
      meRef.current = id
      if (!id) {
        setMode("local")
        return
      }
      try {
        const ref = db.doc(`data/users/${id}/profile`)
        const snap = await ref.get()
        if (snap.exists) {
          const remote = normalize(snap.data() as Partial<UserData>)
          setData(remote)
          latest.current = remote
          saveLocal(remote)
        } else if (Object.keys(latest.current.buckets).length || latest.current.presets.length) {
          await ref.set(latest.current as unknown as Record<string, unknown>)
        }
        writable.current = true
        setMode("shared")
      } catch {
        setMode("local")
      }
    })()
    return () => {
      cancelled = true
      window.clearTimeout(giveUp)
      unsub?.()
    }
  }, [])

  const enqueue = useCallback((fn: () => Promise<void>) => {
    writeChain.current = writeChain.current.then(fn).catch((e: { code?: string }) => {
      if (e?.code === "invalid_argument" || e?.code === "revoked") {
        writable.current = false
        setMode("local")
      }
    })
  }, [])

  const persist = useCallback(
    (next: UserData) => {
      saveLocal(next)
      if (!writable.current || !dbRef.current || !meRef.current) return
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        const db = dbRef.current
        const id = meRef.current
        if (!db || !id) return
        enqueue(() => db.doc(`data/users/${id}/profile`).set(latest.current as unknown as Record<string, unknown>))
      }, 1500)
    },
    [enqueue],
  )

  /** The public leaderboard row: records, the last two weeks of dailies, nickname and club. */
  const publishRow = useCallback(() => {
    if (!writable.current || !dbRef.current || !meRef.current) return
    window.clearTimeout(lbTimer.current)
    lbTimer.current = window.setTimeout(() => {
      const db = dbRef.current
      const id = meRef.current
      if (!db || !id) return
      const d = latest.current
      const keep = Object.keys(d.daily).sort().slice(-14)
      const daily = Object.fromEntries(keep.map((k) => [k, { score: d.daily[k].score, wrong: d.daily[k].wrong, ms: d.daily[k].ms }]))
      enqueue(() => db.doc(`leaderboard/${id}`).set({ records: d.records, daily, nick: d.settings.nick.slice(0, 24), club: d.settings.club, updatedAt: Date.now() }))
    }, 800)
  }, [enqueue])

  const update = useCallback(
    (fn: (d: UserData) => UserData) => {
      const next = fn(latest.current)
      latest.current = next
      setData(next)
      persist(next)
    },
    [persist],
  )

  // Award badges whenever the data changes.
  useEffect(() => {
    const fresh = BADGES.filter((b) => !data.badges[b.id] && b.earned(data))
    if (!fresh.length) return
    const now = Date.now()
    update((d) => ({ ...d, badges: { ...d.badges, ...Object.fromEntries(fresh.map((b) => [b.id, now])) } }))
    fresh.slice(0, 2).forEach((b) => notify(`Badge earned: ${b.name}`, b.desc))
  }, [data, notify, update])

  const recordAnswer = useCallback(
    (q: Question, correct: boolean, ms: number, opts?: { noMistake?: boolean }) => {
      const t = Math.min(Math.max(ms, 0), 120_000)
      update((d) => {
        const k = hourKey(new Date())
        const b = { ...(d.buckets[k] ?? {}) }
        const cur = b[q.topic] ?? [0, 0, 0]
        b[q.topic] = correct ? [cur[0] + 1, cur[1], (cur[2] ?? 0) + t] : [cur[0], cur[1] + 1, (cur[2] ?? 0) + t]
        const s = d.sub[q.kind] ?? [0, 0]
        const sub = { ...d.sub, [q.kind]: (correct ? [s[0] + 1, s[1]] : [s[0], s[1] + 1]) as [number, number] }
        let mistakes = d.mistakes
        if (!correct && !opts?.noMistake && q.kind !== "range" && !mistakes.some((m) => m.kind === q.kind && m.seed === q.seed)) {
          mistakes = [...mistakes, { kind: q.kind, seed: q.seed, d: q.difficulty, table: q.scenario.table, due: Date.now() + 10 * 60_000, box: 0, added: Date.now() }].slice(-MAX_MISTAKES)
        }
        const curStreak = correct ? d.counters.curStreak + 1 : 0
        return {
          ...d,
          buckets: compact({ ...d.buckets, [k]: b }),
          sub,
          mistakes,
          counters: { ...d.counters, curStreak, bestStreak: Math.max(d.counters.bestStreak, curStreak) },
        }
      })
    },
    [update],
  )

  const reviewResult = useCallback(
    (m: Mistake, correct: boolean) =>
      update((d) => {
        const i = d.mistakes.findIndex((x) => x.kind === m.kind && x.seed === m.seed)
        if (i < 0) return d
        const list = d.mistakes.slice()
        if (correct) {
          const box = list[i].box + 1
          if (box >= REVIEW_STEPS.length) {
            list.splice(i, 1)
            return { ...d, mistakes: list, counters: { ...d.counters, reviewCleared: d.counters.reviewCleared + 1 } }
          }
          list[i] = { ...list[i], box, due: Date.now() + REVIEW_STEPS[box - 1] }
        } else list[i] = { ...list[i], box: 0, due: Date.now() + 10 * 60_000 }
        return { ...d, mistakes: list }
      }),
    [update],
  )

  const submitRun = useCallback(
    (topic: DrillTopic, dur: Duration, score: number, wrong: number) => {
      const key = recordKey(topic, dur)
      const previous = latest.current.records[key]
      const best = score > 0 && (!previous || score > previous.score || (score === previous.score && wrong < previous.wrong))
      update((d) => ({
        ...d,
        records: best ? { ...d.records, [key]: { score, wrong, at: Date.now() } } : d.records,
        counters: {
          ...d.counters,
          perfectRuns: d.counters.perfectRuns + (wrong === 0 && score >= 10 ? 1 : 0),
          fastRuns: d.counters.fastRuns + (dur === 60 && score >= 20 ? 1 : 0),
        },
      }))
      if (best) publishRow()
      return { best, previous }
    },
    [publishRow, update],
  )

  const submitDaily = useCallback(
    (date: string, r: DailyResult) => {
      if (latest.current.daily[date]) return
      update((d) => ({ ...d, daily: { ...d.daily, [date]: r }, counters: { ...d.counters, dailyDone: d.counters.dailyDone + 1 } }))
      publishRow()
    },
    [publishRow, update],
  )

  const recordRace = useCallback(
    (won: boolean) => update((d) => ({ ...d, counters: { ...d.counters, racesDone: d.counters.racesDone + 1, racesWon: d.counters.racesWon + (won ? 1 : 0) } })),
    [update],
  )

  const savePreset = useCallback(
    (p: RangePreset) =>
      update((d) => ({ ...d, presets: [...d.presets.filter((x) => x.id !== p.id), { ...p, updatedAt: Date.now() }] })),
    [update],
  )
  const deletePreset = useCallback((id: string) => update((d) => ({ ...d, presets: d.presets.filter((p) => p.id !== id) })), [update])

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      update((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
      if ("nick" in patch || "club" in patch) publishRow()
    },
    [publishRow, update],
  )

  const resolveNames = useCallback(async (ids: string[]) => {
    const u = userRef.current
    if (!u || !ids.length) return {}
    try {
      return await u.profiles(ids)
    } catch {
      return {}
    }
  }, [])

  const roomPromise = useRef<Promise<RoomNS | null> | null>(null)
  const room = useCallback(() => {
    if (!roomPromise.current) {
      const use = window.claude?.use
      roomPromise.current = use ? (use("room") as Promise<RoomNS | null>).catch(() => null) : Promise.resolve(null)
    }
    return roomPromise.current
  }, [])
  const userId = useCallback(async () => {
    if (meRef.current) return meRef.current
    try {
      return (await userRef.current?.id()) ?? null
    } catch {
      return null
    }
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      data,
      settings: data.settings,
      mode,
      meId,
      leaderboard,
      toasts,
      notify,
      dismiss,
      recordAnswer,
      reviewResult,
      submitRun,
      submitDaily,
      recordRace,
      savePreset,
      deletePreset,
      updateSettings,
      resolveNames,
      room,
      userId,
    }),
    [data, mode, meId, leaderboard, toasts, notify, dismiss, recordAnswer, reviewResult, submitRun, submitDaily, recordRace, savePreset, deletePreset, updateSettings, resolveNames, room, userId],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useStore outside provider")
  return v
}

export function useGenOpts() {
  const { settings } = useStore()
  return useMemo(() => ({ difficulty: settings.difficulty, table: settings.table, stack: settings.stack }), [settings.difficulty, settings.table, settings.stack])
}

// ---------- Leaderboard helpers ----------
export interface RankedEntry {
  id: string
  rec: RunRecord
  rank: number
  isMe: boolean
}

export function rankBoard(rows: LeaderRow[], key: string, meId: string | null, mine?: RunRecord, club?: string): RankedEntry[] {
  const pool = club ? rows.filter((r) => r.club === club || r.id === meId) : rows
  const entries = pool.filter((r) => r.records[key]).map((r) => ({ id: r.id, rec: r.records[key] }))
  const myId = meId ?? "me"
  if (mine) {
    const i = entries.findIndex((e) => e.id === myId)
    if (i < 0) entries.push({ id: myId, rec: mine })
    else if (mine.score > entries[i].rec.score) entries[i] = { id: myId, rec: mine }
  }
  entries.sort((a, b) => b.rec.score - a.rec.score || a.rec.wrong - b.rec.wrong || a.rec.at - b.rec.at)
  let rank = 0
  let prev: RunRecord | null = null
  return entries.map((e, i) => {
    if (!prev || prev.score !== e.rec.score || prev.wrong !== e.rec.wrong) rank = i + 1
    prev = e.rec
    return { ...e, rank, isMe: e.id === myId }
  })
}

export interface DailyEntry {
  id: string
  r: DailyResult
  rank: number
  isMe: boolean
}
export function rankDaily(rows: LeaderRow[], date: string, meId: string | null, mine?: DailyResult, club?: string): DailyEntry[] {
  const pool = club ? rows.filter((r) => r.club === club || r.id === meId) : rows
  const myId = meId ?? "me"
  const entries = pool.filter((r) => r.daily[date]).map((r) => ({ id: r.id, r: r.daily[date] }))
  if (mine && !entries.some((e) => e.id === myId)) entries.push({ id: myId, r: mine })
  entries.sort((a, b) => b.r.score - a.r.score || a.r.ms - b.r.ms)
  let rank = 0
  let prev: DailyResult | null = null
  return entries.map((e, i) => {
    if (!prev || prev.score !== e.r.score || prev.ms !== e.r.ms) rank = i + 1
    prev = e.r
    return { ...e, rank, isMe: e.id === myId }
  })
}

/** Days in a row (ending today or yesterday) with at least one answer. */
export function practiceStreak(buckets: Record<string, Bucket>): number {
  const days = new Set(Object.keys(buckets).map((k) => k.slice(0, 10)))
  const d = new Date()
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(dayKey(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export function answeredOn(buckets: Record<string, Bucket>, day: string) {
  let c = 0
  let w = 0
  for (const [k, b] of Object.entries(buckets)) {
    if (!k.startsWith(day)) continue
    for (const t of Object.values(b)) {
      if (!t) continue
      c += t[0]
      w += t[1]
    }
  }
  return { c, w }
}

export const fmtMs = (ms: number) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}
