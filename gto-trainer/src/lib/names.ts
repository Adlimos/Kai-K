import { useEffect, useState } from "react"
import { useStore, type LeaderRow } from "./store"

/** Resolve display names for player ids (account names, where the platform shares them). */
export function useNames(ids: string[]) {
  const { resolveNames } = useStore()
  const [names, setNames] = useState<Record<string, { name: string; avatarUrl?: string }>>({})
  const key = ids.filter((i) => i !== "me").join(",")
  useEffect(() => {
    let live = true
    resolveNames(key ? key.split(",") : []).then((n) => live && setNames(n))
    return () => {
      live = false
    }
  }, [key, resolveNames])
  return names
}

/** A player's chosen nickname wins, then their account name, then a neutral fallback. */
export function displayName(id: string, rows: LeaderRow[], names: Record<string, { name: string }>) {
  const row = rows.find((r) => r.id === id)
  return row?.nick?.trim() || names[id]?.name || "Player"
}
