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
export type Position = "UTG" | "HJ" | "CO" | "BTN" | "SB" | "BB"
export const POSITIONS: Position[] = ["UTG", "HJ", "CO", "BTN", "SB", "BB"]

export interface Spot {
  key: string
  label: string
  hero: Position
  opener?: Position
  actions: RangeAction[]
  range: RangeMap
}

export const SPOTS: Spot[] = [
  {
    key: "rfi-utg",
    label: "UTG open",
    hero: "UTG",
    actions: ["raise", "fold"],
    range: rangeFrom({ raise: "55+, A2s+, K9s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, AJo+, KQo" }),
  },
  {
    key: "rfi-hj",
    label: "HJ open",
    hero: "HJ",
    actions: ["raise", "fold"],
    range: rangeFrom({ raise: "44+, A2s+, K8s+, Q9s+, J9s+, T8s+, 97s+, 86s+, 76s, 65s, ATo+, KJo+, QJo" }),
  },
  {
    key: "rfi-co",
    label: "CO open",
    hero: "CO",
    actions: ["raise", "fold"],
    range: rangeFrom({ raise: "22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A8o+, KTo+, QTo+, JTo" }),
  },
  {
    key: "rfi-btn",
    label: "BTN open",
    hero: "BTN",
    actions: ["raise", "fold"],
    range: rangeFrom({
      raise: "22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o+, K8o+, Q9o+, J9o+, T8o+, 98o",
    }),
  },
  {
    key: "rfi-sb",
    label: "SB open",
    hero: "SB",
    actions: ["raise", "fold"],
    range: rangeFrom({ raise: "22+, A2s+, K4s+, Q6s+, J7s+, T7s+, 97s+, 86s+, 75s+, 64s+, 54s, A4o+, K9o+, Q9o+, J9o+, T9o" }),
  },
  {
    key: "bb-vs-btn",
    label: "BB vs BTN open",
    hero: "BB",
    opener: "BTN",
    actions: ["raise", "call", "fold"],
    range: rangeFrom({
      raise: "99+, AJs+, AQo+, KQs, A5s-A2s, 76s, 65s",
      call: "22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o+, K7o+, Q8o+, J8o+, T8o+, 97o+, 87o, 76o",
    }),
  },
  {
    key: "btn-vs-co",
    label: "BTN vs CO open",
    hero: "BTN",
    opener: "CO",
    actions: ["raise", "call", "fold"],
    range: rangeFrom({
      raise: "TT+, AQs+, AKo, A5s-A4s, KJs+, 76s",
      call: "22+, ATs+, KTs+, QTs+, JTs, T9s, 98s, 87s, 65s, AJo+, KQo",
    }),
  },
  {
    key: "sb-vs-co",
    label: "SB vs CO open",
    hero: "SB",
    opener: "CO",
    actions: ["raise", "fold"],
    range: rangeFrom({ raise: "77+, A9s+, A5s-A3s, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo" }),
  },
]

export function builtInPresets(): RangePreset[] {
  return SPOTS.map((s) => ({
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
