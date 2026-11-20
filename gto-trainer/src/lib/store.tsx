import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { DrillTopic, Topic } from "./questions"
import type { RangePreset } from "./ranges"

// ---------- Types ----------
export type Tally = [number, number] // [correct, wrong]
export type Bucket = Partial<Record<Topic, Tally>>
export interface RunRecord {
  score: number
  wrong: number
  at: number
}
export type Duration = 60 | 150 | 300
export const DURATIONS: Duration[] = [60, 150, 300]
export const durationLabel = (d: Duration) => (d === 60 ? "1 min" : d === 150 ? "2.5 min" : "5 min")
export const recordKey = (t: DrillTopic, d: Duration) => `${t}_${d}`

export interface UserData {
  v: 1
  buckets: Record<string, Bucket> // "YYYY-MM-DDTHH" (recent) or "YYYY-MM-DD" (compacted)
  records: Record<string, RunRecord>
  presets: RangePreset[]
}

export interface LeaderRow {
  id: string
  records: Record<string, RunRecord>
}

export type SyncMode = "connecting" | "shared" | "local"

interface StoreValue {
  data: UserData
  mode: SyncMode
  meId: string | null
  leaderboard: LeaderRow[]
  recordAnswer: (topic: Topic, correct: boolean) => void
  submitRun: (topic: DrillTopic, d: Duration, score: number, wrong: number) => { best: boolean; previous?: RunRecord }
  savePreset: (p: RangePreset) => void
  deletePreset: (id: string) => void
  resolveNames: (ids: string[]) => Promise<Record<string, { name: string; avatarUrl?: string }>>
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
declare global {
  interface Window {
    claude?: { use?: (name: string) => Promise<unknown> }
  }
}

// ---------- Local persistence ----------
const LS_KEY = "gto-trainer:v1"
const empty = (): UserData => ({ v: 1, buckets: {}, records: {}, presets: [] })

function loadLocal(): UserData {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return empty()
    const d = JSON.parse(raw)
    return { ...empty(), ...d }
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
export function keyToDate(k: string): Date {
  const [y, m, rest] = k.split("-")
  const [d, h] = rest.split("T")
  return new Date(Number(y), Number(m) - 1, Number(d), h ? Number(h) : 0)
}

/** Fold hourly buckets older than 3 days into daily ones so the document stays small. */
function compact(buckets: Record<string, Bucket>): Record<string, Bucket> {
  const cutoff = Date.now() - 3 * 86400_000
  const out: Record<string, Bucket> = {}
  for (const [k, b] of Object.entries(buckets)) {
    const target = k.length > 10 && keyToDate(k).getTime() < cutoff ? k.slice(0, 10) : k
    const into = (out[target] ??= {})
    for (const [t, tally] of Object.entries(b) as [Topic, Tally][]) {
      const cur = into[t] ?? [0, 0]
      into[t] = [cur[0] + tally[0], cur[1] + tally[1]]
    }
  }
  return out
}

// ---------- Context ----------
const Ctx = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<UserData>(() => loadLocal())
  const [mode, setMode] = useState<SyncMode>("connecting")
  const [meId, setMeId] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([])
  const dbRef = useRef<DB | null>(null)
  const userRef = useRef<UserNS | null>(null)
  const writable = useRef(false)
  const writeChain = useRef<Promise<unknown>>(Promise.resolve())
  const saveTimer = useRef<number | undefined>(undefined)
  const latest = useRef(data)
  latest.current = data

  // Connect to the shared store once.
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
            snap.docs.filter((d) => d.exists).map((d) => ({ id: d.id, records: ((d.data() ?? {}).records as Record<string, RunRecord>) ?? {} })),
          )
        },
        () => setLeaderboard((rows) => rows),
      )
      const id = user ? await user.id() : null
      if (cancelled) return
      setMeId(id)
      if (!id) {
        setMode("local")
        return
      }
      try {
        const ref = db.doc(`data/users/${id}/profile`)
        const snap = await ref.get()
        if (snap.exists) {
          const remote = { ...empty(), ...(snap.data() as Partial<UserData>) } as UserData
          setData(remote)
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
      if (!writable.current || !dbRef.current || !meId) return
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        const db = dbRef.current
        if (!db) return
        enqueue(() => db.doc(`data/users/${meId}/profile`).set(latest.current as unknown as Record<string, unknown>))
      }, 1500)
    },
    [enqueue, meId],
  )

  const update = useCallback(
    (fn: (d: UserData) => UserData) => {
      setData((prev) => {
        const next = fn(prev)
        latest.current = next
        persist(next)
        return next
      })
    },
    [persist],
  )

  const recordAnswer = useCallback(
    (topic: Topic, correct: boolean) => {
      update((d) => {
        const k = hourKey(new Date())
        const b = { ...(d.buckets[k] ?? {}) }
        const cur = b[topic] ?? [0, 0]
        b[topic] = correct ? [cur[0] + 1, cur[1]] : [cur[0], cur[1] + 1]
        return { ...d, buckets: compact({ ...d.buckets, [k]: b }) }
      })
    },
    [update],
  )

  const submitRun = useCallback(
    (topic: DrillTopic, dur: Duration, score: number, wrong: number) => {
      const key = recordKey(topic, dur)
      const previous = latest.current.records[key]
      const best = !previous || score > previous.score || (score === previous.score && wrong < previous.wrong)
      if (best && score > 0) {
        const rec: RunRecord = { score, wrong, at: Date.now() }
        const records = { ...latest.current.records, [key]: rec }
        update((d) => ({ ...d, records }))
        const db = dbRef.current
        if (db && meId && writable.current) {
          enqueue(() => db.doc(`leaderboard/${meId}`).set({ records, updatedAt: Date.now() }))
        }
      }
      return { best: best && score > 0, previous }
    },
    [enqueue, meId, update],
  )

  const savePreset = useCallback(
    (p: RangePreset) =>
      update((d) => {
        const others = d.presets.filter((x) => x.id !== p.id)
        return { ...d, presets: [...others, { ...p, updatedAt: Date.now() }] }
      }),
    [update],
  )
  const deletePreset = useCallback((id: string) => update((d) => ({ ...d, presets: d.presets.filter((p) => p.id !== id) })), [update])

  const resolveNames = useCallback(async (ids: string[]) => {
    const u = userRef.current
    if (!u || !ids.length) return {}
    try {
      return await u.profiles(ids)
    } catch {
      return {}
    }
  }, [])

  const value = useMemo<StoreValue>(
    () => ({ data, mode, meId, leaderboard, recordAnswer, submitRun, savePreset, deletePreset, resolveNames }),
    [data, mode, meId, leaderboard, recordAnswer, submitRun, savePreset, deletePreset, resolveNames],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useStore outside provider")
  return v
}

// ---------- Leaderboard helpers ----------
export interface RankedEntry {
  id: string
  rec: RunRecord
  rank: number
  isMe: boolean
}

/** All entries for one board, merged with the viewer's own local record when offline. */
export function rankBoard(rows: LeaderRow[], key: string, meId: string | null, mine?: RunRecord): RankedEntry[] {
  const entries = rows.filter((r) => r.records[key]).map((r) => ({ id: r.id, rec: r.records[key] }))
  const meRow = entries.find((e) => e.id === (meId ?? "me"))
  if (mine && (!meRow || mine.score > meRow.rec.score)) {
    const id = meId ?? "me"
    const i = entries.findIndex((e) => e.id === id)
    if (i >= 0) entries[i] = { id, rec: mine }
    else entries.push({ id, rec: mine })
  }
  entries.sort((a, b) => b.rec.score - a.rec.score || a.rec.wrong - b.rec.wrong || a.rec.at - b.rec.at)
  let rank = 0
  let prev: RunRecord | null = null
  return entries.map((e, i) => {
    if (!prev || prev.score !== e.rec.score || prev.wrong !== e.rec.wrong) rank = i + 1
    prev = e.rec
    return { ...e, rank, isMe: e.id === (meId ?? "me") }
  })
}
