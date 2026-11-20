import type { UserData } from "./store"
import { CORE_TOPICS } from "./questions"

export interface Badge {
  id: string
  name: string
  desc: string
  earned: (d: UserData) => boolean
  progress?: (d: UserData) => [number, number]
}

function totals(d: UserData) {
  let c = 0
  let w = 0
  const by: Record<string, [number, number]> = {}
  for (const b of Object.values(d.buckets))
    for (const [t, v] of Object.entries(b)) {
      if (!v) continue
      c += v[0]
      w += v[1]
      const x = (by[t] ??= [0, 0])
      x[0] += v[0]
      x[1] += v[1]
    }
  return { n: c + w, by }
}

function dayStreak(d: UserData) {
  const days = new Set(Object.keys(d.buckets).map((k) => k.slice(0, 10)))
  const t = new Date()
  const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
  if (!days.has(key(t))) t.setDate(t.getDate() - 1)
  let n = 0
  while (days.has(key(t))) {
    n++
    t.setDate(t.getDate() - 1)
  }
  return n
}

export const BADGES: Badge[] = [
  { id: "first", name: "First hand", desc: "Answer your first question.", earned: (d) => totals(d).n >= 1, progress: (d) => [Math.min(1, totals(d).n), 1] },
  { id: "hundred", name: "Grinder", desc: "Answer 100 questions.", earned: (d) => totals(d).n >= 100, progress: (d) => [Math.min(100, totals(d).n), 100] },
  { id: "thousand", name: "Volume", desc: "Answer 1,000 questions.", earned: (d) => totals(d).n >= 1000, progress: (d) => [Math.min(1000, totals(d).n), 1000] },
  { id: "streak10", name: "On a heater", desc: "Get 10 right in a row.", earned: (d) => d.counters.bestStreak >= 10, progress: (d) => [Math.min(10, d.counters.bestStreak), 10] },
  { id: "streak25", name: "Unstoppable", desc: "Get 25 right in a row.", earned: (d) => d.counters.bestStreak >= 25, progress: (d) => [Math.min(25, d.counters.bestStreak), 25] },
  { id: "perfect", name: "Flawless", desc: "Finish a timed run with 10+ right and none wrong.", earned: (d) => d.counters.perfectRuns > 0 },
  { id: "fast", name: "Speed reader", desc: "Score 20+ in a 1-minute timed run.", earned: (d) => d.counters.fastRuns > 0 },
  { id: "daily", name: "Daily regular", desc: "Complete a daily challenge.", earned: (d) => d.counters.dailyDone > 0 },
  { id: "daily7", name: "Seven dailies", desc: "Complete seven daily challenges.", earned: (d) => d.counters.dailyDone >= 7, progress: (d) => [Math.min(7, d.counters.dailyDone), 7] },
  { id: "week", name: "Week streak", desc: "Practise seven days in a row.", earned: (d) => dayStreak(d) >= 7, progress: (d) => [Math.min(7, dayStreak(d)), 7] },
  {
    id: "allround",
    name: "All-rounder",
    desc: "90% or better in every topic, with 30+ answers each.",
    earned: (d) => {
      const { by } = totals(d)
      return CORE_TOPICS.every((t) => {
        const v = by[t]
        return v && v[0] + v[1] >= 30 && v[0] / (v[0] + v[1]) >= 0.9
      })
    },
  },
  { id: "architect", name: "Range architect", desc: "Save three range presets.", earned: (d) => d.presets.length >= 3, progress: (d) => [Math.min(3, d.presets.length), 3] },
  { id: "patched", name: "Leak plugger", desc: "Clear 10 hands from your mistake review.", earned: (d) => d.counters.reviewCleared >= 10, progress: (d) => [Math.min(10, d.counters.reviewCleared), 10] },
  { id: "racer", name: "Racer", desc: "Finish a head-to-head race.", earned: (d) => d.counters.racesDone > 0 },
  { id: "champ", name: "Champion", desc: "Win a head-to-head race.", earned: (d) => d.counters.racesWon > 0 },
]
