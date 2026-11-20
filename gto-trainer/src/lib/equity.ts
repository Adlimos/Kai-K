import { type Card, cardId, evaluate, fullDeck, RANKS, random } from "./cards"
import type { RangeMap } from "./ranges"

const SUIT_N = 4

/** Every concrete two-card combo for a hand class, skipping dead cards. */
export function combosOf(hand: string, dead: Set<number>): [Card, Card][] {
  const r1 = RANKS.indexOf(hand[0] as never)
  const r2 = RANKS.indexOf(hand[1] as never)
  const out: [Card, Card][] = []
  for (let s1 = 0; s1 < SUIT_N; s1++)
    for (let s2 = 0; s2 < SUIT_N; s2++) {
      if (hand.length === 2) {
        if (s2 <= s1) continue
      } else if (hand.endsWith("s") ? s1 !== s2 : s1 === s2) continue
      const a = { r: r1, s: s1 }
      const b = { r: r2, s: s2 }
      if (dead.has(cardId(a)) || dead.has(cardId(b))) continue
      out.push([a, b])
    }
  return out
}

export function rangeCombos(range: RangeMap | string[], dead: Card[]): [Card, Card][] {
  const d = new Set(dead.map(cardId))
  const hands = Array.isArray(range) ? range : Object.keys(range).filter((h) => range[h] !== "fold")
  return hands.flatMap((h) => combosOf(h, d))
}

export interface EquityResult {
  win: number
  tie: number
  equity: number // win + tie/2, 0-1
  samples: number
  exact: boolean
}

/**
 * Hero equity against a list of villain combos on a (partial) board.
 * River boards are enumerated exactly; otherwise sampled (combo + runout).
 */
export function equityVsCombos(hero: Card[], board: Card[], villain: [Card, Card][], samples = 4000): EquityResult {
  const heroIds = new Set([...hero, ...board].map(cardId))
  const vs = villain.filter(([a, b]) => !heroIds.has(cardId(a)) && !heroIds.has(cardId(b)))
  if (!vs.length) return { win: 0, tie: 0, equity: 0, samples: 0, exact: true }
  let win = 0
  let tie = 0
  let n = 0
  if (board.length === 5) {
    const hv = evaluate([...hero, ...board]).score
    for (const [a, b] of vs) {
      const v = evaluate([a, b, ...board]).score
      if (hv > v) win++
      else if (hv === v) tie++
      n++
    }
    return { win: win / n, tie: tie / n, equity: (win + tie / 2) / n, samples: n, exact: true }
  }
  const deck = fullDeck()
  const need = 5 - board.length
  for (let i = 0; i < samples; i++) {
    const [a, b] = vs[Math.floor(random() * vs.length)]
    const used = new Set([...heroIds, cardId(a), cardId(b)])
    const run: Card[] = []
    while (run.length < need) {
      const c = deck[Math.floor(random() * 52)]
      const id = cardId(c)
      if (used.has(id)) continue
      used.add(id)
      run.push(c)
    }
    const full = [...board, ...run]
    const hv = evaluate([...hero, ...full]).score
    const v = evaluate([a, b, ...full]).score
    if (hv > v) win++
    else if (hv === v) tie++
    n++
  }
  return { win: win / n, tie: tie / n, equity: (win + tie / 2) / n, samples: n, exact: false }
}

export function equityHandVsHand(h1: Card[], h2: Card[], board: Card[], samples = 20000): EquityResult {
  // Exact enumeration once two or fewer cards remain to come.
  if (board.length >= 3) {
    const dead = new Set([...h1, ...h2, ...board].map(cardId))
    const rest = fullDeck().filter((c) => !dead.has(cardId(c)))
    let win = 0
    let tie = 0
    let n = 0
    const score = (full: Card[]) => {
      const a = evaluate([...h1, ...full]).score
      const b = evaluate([...h2, ...full]).score
      if (a > b) win++
      else if (a === b) tie++
      n++
    }
    if (board.length === 5) score(board)
    else if (board.length === 4) for (const c of rest) score([...board, c])
    else for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) score([...board, rest[i], rest[j]])
    return { win: win / n, tie: tie / n, equity: (win + tie / 2) / n, samples: n, exact: true }
  }
  return equityVsCombos(h1, board, [[h2[0], h2[1]]], samples)
}
