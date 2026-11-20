// Card primitives, deck utilities and a 5–7 card hand evaluator.

export const RANKS = "23456789TJQKA" as const
export const SUITS = ["s", "h", "d", "c"] as const
export type Suit = (typeof SUITS)[number]

export interface Card {
  r: number // 0 (deuce) .. 12 (ace)
  s: number // index into SUITS
}

export const SUIT_GLYPH: Record<Suit, string> = { s: "♠", h: "♥", d: "♦", c: "♣" }
export const SUIT_NAME: Record<Suit, string> = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" }
export const RANK_NAME = ["deuce", "trey", "four", "five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king", "ace"]

export const cardId = (c: Card) => c.r * 4 + c.s
export const rankChar = (r: number) => RANKS[r]
export const cardLabel = (c: Card) => `${RANKS[c.r]}${SUIT_GLYPH[SUITS[c.s]]}`

export function fullDeck(): Card[] {
  const d: Card[] = []
  for (let r = 0; r < 13; r++) for (let s = 0; s < 4; s++) d.push({ r, s })
  return d
}

export function rand(n: number) {
  return Math.floor(Math.random() * n)
}
export function pick<T>(arr: readonly T[]): T {
  return arr[rand(arr.length)]
}
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function deckWithout(used: Card[]): Card[] {
  const ids = new Set(used.map(cardId))
  return fullDeck().filter((c) => !ids.has(cardId(c)))
}

// ---------- Evaluator ----------
export const CATEGORY = [
  "High card",
  "One pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
] as const

export interface HandValue {
  cat: number
  score: number
}

function straightHigh(mask: number): number {
  // mask bit r set when rank r present. Returns high rank of best straight or -1.
  for (let hi = 12; hi >= 4; hi--) {
    let ok = true
    for (let k = 0; k < 5; k++) if (!(mask & (1 << (hi - k)))) { ok = false; break }
    if (ok) return hi
  }
  // wheel A-2-3-4-5
  if ((mask & 0b1000000001111) === 0b1000000001111) return 3
  return -1
}

function pack(cat: number, kick: number[]): number {
  let v = cat
  for (let i = 0; i < 5; i++) v = v * 16 + (kick[i] ?? 0)
  return v
}

export function evaluate(cards: Card[]): HandValue {
  const counts = new Array(13).fill(0)
  const suitMasks = [0, 0, 0, 0]
  const suitCounts = [0, 0, 0, 0]
  let mask = 0
  for (const c of cards) {
    counts[c.r]++
    suitMasks[c.s] |= 1 << c.r
    suitCounts[c.s]++
    mask |= 1 << c.r
  }
  // straight flush / flush
  let flushSuit = -1
  for (let s = 0; s < 4; s++) if (suitCounts[s] >= 5) flushSuit = s
  if (flushSuit >= 0) {
    const sh = straightHigh(suitMasks[flushSuit])
    if (sh >= 0) return { cat: 8, score: pack(8, [sh]) }
  }
  const quads: number[] = []
  const trips: number[] = []
  const pairs: number[] = []
  const singles: number[] = []
  for (let r = 12; r >= 0; r--) {
    if (counts[r] === 4) quads.push(r)
    else if (counts[r] === 3) trips.push(r)
    else if (counts[r] === 2) pairs.push(r)
    else if (counts[r] === 1) singles.push(r)
  }
  if (quads.length) {
    const kicker = Math.max(...[...trips, ...pairs, ...singles], -1)
    return { cat: 7, score: pack(7, [quads[0], kicker]) }
  }
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const t = trips[0]
    const p = Math.max(trips[1] ?? -1, pairs[0] ?? -1)
    return { cat: 6, score: pack(6, [t, p]) }
  }
  if (flushSuit >= 0) {
    const ranks: number[] = []
    for (let r = 12; r >= 0 && ranks.length < 5; r--) if (suitMasks[flushSuit] & (1 << r)) ranks.push(r)
    return { cat: 5, score: pack(5, ranks) }
  }
  const sh = straightHigh(mask)
  if (sh >= 0) return { cat: 4, score: pack(4, [sh]) }
  if (trips.length) {
    const k = [...pairs, ...singles].sort((a, b) => b - a).slice(0, 2)
    return { cat: 3, score: pack(3, [trips[0], ...k]) }
  }
  if (pairs.length >= 2) {
    const k = Math.max(pairs[2] ?? -1, singles[0] ?? -1)
    return { cat: 2, score: pack(2, [pairs[0], pairs[1], k]) }
  }
  if (pairs.length === 1) {
    return { cat: 1, score: pack(1, [pairs[0], ...singles.slice(0, 3)]) }
  }
  return { cat: 0, score: pack(0, singles.slice(0, 5)) }
}

// ---------- Hand-class notation (169 starting hands) ----------
export const GRID_RANKS = "AKQJT98765432"

export function handClass(a: Card, b: Card): string {
  const hi = a.r >= b.r ? a : b
  const lo = a.r >= b.r ? b : a
  if (hi.r === lo.r) return RANKS[hi.r] + RANKS[lo.r]
  return RANKS[hi.r] + RANKS[lo.r] + (hi.s === lo.s ? "s" : "o")
}

export function gridHand(row: number, col: number): string {
  const a = GRID_RANKS[row]
  const b = GRID_RANKS[col]
  if (row === col) return a + b
  if (row < col) return a + b + "s"
  return b + a + "o"
}

export const ALL_HANDS: string[] = (() => {
  const out: string[] = []
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) out.push(gridHand(r, c))
  return out
})()

export function combos(hand: string): number {
  if (hand.length === 2) return 6
  return hand.endsWith("s") ? 4 : 12
}

/** Deal two concrete cards for a hand class like "AKs", "T9o" or "77". */
export function dealHandClass(hand: string): [Card, Card] {
  const r1 = RANKS.indexOf(hand[0] as never)
  const r2 = RANKS.indexOf(hand[1] as never)
  if (hand.length === 2) {
    const [s1, s2] = shuffle([0, 1, 2, 3])
    return [{ r: r1, s: s1 }, { r: r2, s: s2 }]
  }
  if (hand.endsWith("s")) {
    const s = rand(4)
    return [{ r: r1, s }, { r: r2, s }]
  }
  const [s1, s2] = shuffle([0, 1, 2, 3])
  return [{ r: r1, s: s1 }, { r: r2, s: s2 }]
}

export function describeHand(hand: string): string {
  const n = (ch: string) => RANK_NAME[RANKS.indexOf(ch as never)]
  if (hand.length === 2) return `pocket ${n(hand[0])}s`.replace("sixs", "sixes")
  return `${n(hand[0])}-${n(hand[1])} ${hand.endsWith("s") ? "suited" : "offsuit"}`
}
