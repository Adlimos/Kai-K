import { useEffect, useState } from "react"
import type { DrillTopic } from "./questions"

export type DrillRoute = DrillTopic | "weak"

export type Route =
  | { page: "lobby" }
  | { page: "learn"; lesson?: string }
  | { page: "drill"; topic: DrillRoute }
  | { page: "hand"; code: string }
  | { page: "daily" | "timed" | "race" | "review" | "ranges" | "tools" | "stats" | "leaderboard" | "prefs" }

const SLUGS: Record<DrillRoute, string> = {
  potOdds: "pot-odds",
  ev: "ev",
  outs: "outs",
  preflop: "preflop",
  postflop: "postflop",
  equity: "equity",
  mixed: "mixed",
  weak: "weak-spots",
}
export const topicSlug = (t: DrillRoute) => SLUGS[t]
const SIMPLE = ["daily", "timed", "race", "review", "ranges", "tools", "stats", "leaderboard", "prefs"] as const

export function parseHash(h: string): Route {
  const s = h.replace(/^#/, "")
  if (s.startsWith("drill-")) {
    const slug = s.slice(6)
    const t = (Object.keys(SLUGS) as DrillRoute[]).find((k) => SLUGS[k] === slug)
    if (t) return { page: "drill", topic: t }
  }
  if (s === "learn") return { page: "learn" }
  if (s.startsWith("learn-")) return { page: "learn", lesson: s.slice(6) }
  if (s.startsWith("hand-")) return { page: "hand", code: s }
  if ((SIMPLE as readonly string[]).includes(s)) return { page: s as (typeof SIMPLE)[number] }
  return { page: "lobby" }
}

export function routeKey(r: Route) {
  if (r.page === "drill") return `drill-${SLUGS[r.topic]}`
  if (r.page === "learn") return r.lesson ? `learn-${r.lesson}` : "learn"
  if (r.page === "hand") return r.code
  return r.page
}

export function go(hash: string) {
  if (location.hash.replace(/^#/, "") === hash) return
  location.hash = hash
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(() => parseHash(location.hash))
  useEffect(() => {
    const on = () => {
      setR(parseHash(location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener("hashchange", on)
    return () => window.removeEventListener("hashchange", on)
  }, [])
  return r
}
