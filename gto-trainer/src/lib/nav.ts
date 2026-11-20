import { useEffect, useState } from "react"
import type { DrillTopic } from "./questions"

export type Route =
  | { page: "lobby" }
  | { page: "drill"; topic: DrillTopic }
  | { page: "timed" }
  | { page: "ranges" }
  | { page: "stats" }
  | { page: "leaderboard" }

const SLUGS: Record<DrillTopic, string> = { potOdds: "pot-odds", ev: "ev", outs: "outs", preflop: "preflop", mixed: "mixed" }
export const topicSlug = (t: DrillTopic) => SLUGS[t]

export function parseHash(h: string): Route {
  const s = h.replace(/^#/, "")
  if (s.startsWith("drill-")) {
    const slug = s.slice(6)
    const t = (Object.keys(SLUGS) as DrillTopic[]).find((k) => SLUGS[k] === slug)
    if (t) return { page: "drill", topic: t }
  }
  if (s === "timed" || s === "ranges" || s === "stats" || s === "leaderboard") return { page: s }
  return { page: "lobby" }
}

export function routeKey(r: Route) {
  return r.page === "drill" ? `drill-${SLUGS[r.topic]}` : r.page
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
