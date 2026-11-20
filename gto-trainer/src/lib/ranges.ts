import { ALL_HANDS, GRID_RANKS, combos } from "./cards"

export type RangeAction = "raise" | "call" | "fold"
export type RangeMap = Record<string, RangeAction>

export interface RangePreset {
  id: string
  name: string
  cells: RangeMap // hands not listed are folds
  updatedAt: number
  builtIn?: boolean
}

const R = GRID_RANKS // "AKQJT98765432", index 0 = ace
const idx = (ch: string) => R.indexOf(ch)

/** Parse a compact range string like "55+, A2s+, KTo+, A5s-A2s, 76s". */
export function parseRange(str: string): string[] {
  const out = new Set<string>()
  for (const raw of str.split(",")) {
    const t = raw.trim()
    if (!t) continue
    const plus = t.endsWith("+")
    const body = plus ? t.slice(0, -1) : t
    if (body.includes("-")) {
      const [a, b] = body.split("-")
      // same high card, kicker range e.g. A5s-A2s or pairs 99-66
      if (a.length === 2 && a[0] === a[1]) {
        const hi = idx(a[0])
        const lo = idx(b[0])
        for (let i = hi; i <= lo; i++) out.add(R[i] + R[i])
      } else {
        const suf = a[2]
        const k1 = idx(a[1])
        const k2 = idx(b[1])
        for (let i = Math.min(k1, k2); i <= Math.max(k1, k2); i++) out.add(a[0] + R[i] + suf)
      }
      continue
    }
    if (body.length === 2 && body[0] === body[1]) {
      const start = idx(body[0])
      if (plus) for (let i = start; i >= 0; i--) out.add(R[i] + R[i])
      else out.add(body)
      continue
    }
    const hi = idx(body[0])
    const lo = idx(body[1])
    const suf = body[2]
    if (plus) {
      for (let i = lo; i > hi; i--) out.add(body[0] + R[i] + suf)
    } else out.add(body)
  }
  return [...out]
}

export function rangeFrom(spec: Partial<Record<RangeAction, string>>): RangeMap {
  const m: RangeMap = {}
  // fold first, then call, then raise so stronger actions win on overlap
  for (const a of ["call", "raise"] as RangeAction[]) {
    const s = spec[a]
    if (s) for (const h of parseRange(s)) m[h] = a
  }
  return m
}

export function actionFor(range: RangeMap, hand: string): RangeAction {
  return range[hand] ?? "fold"
}

export function rangePercent(range: RangeMap, action?: RangeAction): number {
  let n = 0
  for (const h of ALL_HANDS) {
    const a = actionFor(range, h)
    if (action ? a === action : a !== "fold") n += combos(h)
  }
  return (n / 1326) * 100
}

// ---------- Built-in charts (6-max, 100bb, solver-approximated) ----------
export type Position = "UTG" | "UTG1" | "UTG2" | "LJ" | "HJ" | "CO" | "BTN" | "SB" | "BB"
export const POSITIONS: Position[] = ["UTG", "HJ", "CO", "BTN", "SB", "BB"]
export const POSITIONS9: Position[] = ["UTG", "UTG1", "UTG2", "LJ", "HJ", "CO", "BTN", "SB", "BB"]
export const POS_LABEL: Record<Position, string> = {
  UTG: "UTG",
  UTG1: "UTG+1",
  UTG2: "UTG+2",
  LJ: "LJ",
  HJ: "HJ",
  CO: "CO",
  BTN: "BTN",
  SB: "SB",
  BB: "BB",
}
export const seatsFor = (table: 6 | 9) => (table === 9 ? POSITIONS9 : POSITIONS)

export type Mix = Partial<Record<RangeAction, number>>

export interface Spot {
  key: string
  label: string
  hero: Position
  opener?: Position
  actions: RangeAction[]
  range: RangeMap
  /** Hands the solver splits between two actions. Values are frequencies (0-1). */
  mix: Record<string, Mix>
  table: 6 | 9 | "any"
}

/** Mixed hands: the chart's own action gets 60%, the alternative 40%. */
function mixFrom(range: RangeMap, spec: Partial<Record<"raise/fold" | "raise/call" | "call/fold", string>>): Record<string, Mix> {
  const out: Record<string, Mix> = {}
  for (const [pair, str] of Object.entries(spec)) {
    const [a, b] = pair.split("/") as [RangeAction, RangeAction]
    for (const h of parseRange(str!)) {
      const main = actionFor(range, h)
      const major = main === a || main === b ? main : a
      const minor = major === a ? b : a
      out[h] = { [major]: 0.6, [minor]: 0.4 }
    }
  }
  return out
}

interface SpotDef extends Omit<Spot, "range" | "mix"> {
  raise: string
  call?: string
  mixed?: Partial<Record<"raise/fold" | "raise/call" | "call/fold", string>>
}

const DEFS: SpotDef[] = [
  { key: "rfi-utg", label: "UTG open (6-max)", hero: "UTG", actions: ["raise", "fold"], table: 6,
    raise: "55+, A2s+, K9s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, AJo+, KQo",
    mixed: { "raise/fold": "44, ATo, KJo, Q9s, T8s, 65s" } },
  { key: "rfi-hj", label: "HJ open", hero: "HJ", actions: ["raise", "fold"], table: "any",
    raise: "44+, A2s+, K8s+, Q9s+, J9s+, T8s+, 97s+, 86s+, 76s, 65s, ATo+, KJo+, QJo",
    mixed: { "raise/fold": "33, A9o, KTo, QTo, J8s, 75s, 54s" } },
  { key: "rfi-co", label: "CO open", hero: "CO", actions: ["raise", "fold"], table: "any",
    raise: "22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A8o+, KTo+, QTo+, JTo",
    mixed: { "raise/fold": "A7o, K9o, Q9o, J9o, T9o, 64s, 53s, K4s" } },
  { key: "rfi-btn", label: "BTN open", hero: "BTN", actions: ["raise", "fold"], table: "any",
    raise: "22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o+, K8o+, Q9o+, J9o+, T8o+, 98o",
    mixed: { "raise/fold": "K7o, Q8o, J8o, T7o, 97o, 87o, Q3s, J5s, T5s, 95s, 84s, 73s, 63s, 52s, 42s" } },
  { key: "rfi-sb", label: "SB open", hero: "SB", actions: ["raise", "fold"], table: "any",
    raise: "22+, A2s+, K4s+, Q6s+, J7s+, T7s+, 97s+, 86s+, 75s+, 64s+, 54s, A4o+, K9o+, Q9o+, J9o+, T9o",
    mixed: { "raise/fold": "A3o, A2o, K8o, Q8o, J8o, T8o, 98o, K3s, Q5s, J6s, T6s, 96s, 85s, 74s, 53s, 43s" } },
  { key: "bb-vs-btn", label: "BB vs BTN open", hero: "BB", opener: "BTN", actions: ["raise", "call", "fold"], table: "any",
    raise: "99+, AJs+, AQo+, KQs, A5s-A2s, 76s, 65s",
    call: "22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o+, K7o+, Q8o+, J8o+, T8o+, 97o+, 87o, 76o",
    mixed: { "raise/call": "88, ATs, AJo, KJs, QJs, JTs, A9s, K9s, T9s, 87s, 54s", "call/fold": "K6o, Q7o, J7o, T7o, 96o, 86o, 75o, 65o, 52s, 42s" } },
  { key: "btn-vs-co", label: "BTN vs CO open", hero: "BTN", opener: "CO", actions: ["raise", "call", "fold"], table: "any",
    raise: "TT+, AQs+, AKo, A5s-A4s, KJs+, 76s",
    call: "22+, ATs+, KTs+, QTs+, JTs, T9s, 98s, 87s, 65s, AJo+, KQo",
    mixed: { "raise/call": "99, AJs, KTs, AQo, QJs", "call/fold": "A9s, K9s, Q9s, J9s, ATo, KJo, QJo" } },
  { key: "sb-vs-co", label: "SB vs CO open", hero: "SB", opener: "CO", actions: ["raise", "fold"], table: "any",
    raise: "77+, A9s+, A5s-A3s, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo",
    mixed: { "raise/fold": "66, A8s, A2s, K9s, Q9s, J9s, ATo, KJo" } },
  { key: "rfi9-utg", label: "UTG open (9-handed)", hero: "UTG", actions: ["raise", "fold"], table: 9,
    raise: "77+, ATs+, A5s, KTs+, QTs+, JTs, T9s, AQo+",
    mixed: { "raise/fold": "66, A9s, A4s, K9s, 98s, AJo, KQo" } },
  { key: "rfi9-utg1", label: "UTG+1 open", hero: "UTG1", actions: ["raise", "fold"], table: 9,
    raise: "66+, A9s+, A5s-A4s, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo",
    mixed: { "raise/fold": "55, A8s, K9s, Q9s, 87s, ATo, KJo" } },
  { key: "rfi9-utg2", label: "UTG+2 open", hero: "UTG2", actions: ["raise", "fold"], table: 9,
    raise: "55+, A8s+, A5s-A3s, K9s+, Q9s+, J9s+, T9s, 98s, 87s, AJo+, KQo",
    mixed: { "raise/fold": "44, A7s, A2s, K8s, T8s, 76s, ATo, KJo" } },
  { key: "rfi9-lj", label: "LJ open (9-handed)", hero: "LJ", actions: ["raise", "fold"], table: 9,
    raise: "55+, A2s+, K9s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, AJo+, KQo",
    mixed: { "raise/fold": "44, ATo, KJo, K8s, 65s" } },
]

export const SPOTS: Spot[] = DEFS.map((d) => {
  const range = rangeFrom({ raise: d.raise, call: d.call })
  return { key: d.key, label: d.label, hero: d.hero, opener: d.opener, actions: d.actions, table: d.table, range, mix: mixFrom(range, d.mixed ?? {}) }
})
export const spotByKey = (k: string) => SPOTS.find((s) => s.key === k)
export const spotsForTable = (t: 6 | 9) => SPOTS.filter((s) => s.table === "any" || s.table === t)

/** Action frequencies for a hand in a spot (pure hands return 100% of one action). */
export function freqs(spot: Spot, hand: string): Mix {
  return spot.mix[hand] ?? { [actionFor(spot.range, hand)]: 1 }
}

export function builtInPresets(): RangePreset[] {
  return SPOTS.filter((s) => s.table !== 9).map((s) => ({
    id: `builtin-${s.key}`,
    name: s.label,
    cells: { ...s.range },
    updatedAt: 0,
    builtIn: true,
  }))
}

/** Hands that sit on the edge of a range: some grid neighbour takes a different action. */
export function boundaryHands(range: RangeMap): string[] {
  const out: string[] = []
  for (let r = 0; r < 13; r++)
    for (let c = 0; c < 13; c++) {
      const h = gridAt(r, c)
      const a = actionFor(range, h)
      const ns = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ]
      if (ns.some(([nr, nc]) => nr >= 0 && nr < 13 && nc >= 0 && nc < 13 && actionFor(range, gridAt(nr, nc)) !== a)) out.push(h)
    }
  return out
}

function gridAt(r: number, c: number) {
  const a = R[r]
  const b = R[c]
  if (r === c) return a + b
  if (r < c) return a + b + "s"
  return b + a + "o"
}

export const ACTION_LABEL: Record<RangeAction, string> = { raise: "Raise", call: "Call", fold: "Fold" }
