import {
  type Card,
  ALL_HANDS,
  cardLabel,
  combos,
  dealHandClass,
  deckWithout,
  describeHand,
  evaluate,
  fullDeck,
  newSeed,
  pick,
  rand,
  random,
  RANKS,
  shuffle,
  withSeed,
  CATEGORY,
} from "./cards"
import {
  type Position,
  type RangeAction,
  type RangePreset,
  type Spot,
  ACTION_LABEL,
  POS_LABEL,
  actionFor,
  boundaryHands,
  freqs,
  rangePercent,
  seatsFor,
  spotByKey,
  spotsForTable,
  SPOTS,
} from "./ranges"
import { combosOf, equityHandVsHand, equityVsCombos, rangeCombos } from "./equity"

// ---------- Topics ----------
export type Topic = "potOdds" | "ev" | "outs" | "preflop" | "postflop" | "equity" | "ranges"
export type DrillTopic = Exclude<Topic, "ranges"> | "mixed"
export type Difficulty = "easy" | "medium" | "hard"
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"]

export const TOPIC_META: Record<Topic | "mixed", { name: string; short: string; blurb: string; lesson: string }> = {
  potOdds: { name: "Pot odds", short: "Pot odds", blurb: "Price a call: the equity you need, the ratio you're getting, and implied odds.", lesson: "pot-odds" },
  ev: { name: "Expected value", short: "EV", blurb: "Put a dollar figure on calls, bluffs and break-even folds.", lesson: "expected-value" },
  outs: { name: "Outs & the 4-2 rule", short: "Outs", blurb: "Count the cards that complete your draw, then turn them into equity.", lesson: "outs" },
  preflop: { name: "Pre-flop", short: "Pre-flop", blurb: "Open, 3-bet, call or fold from every seat, with mixed strategies.", lesson: "preflop" },
  postflop: { name: "Post-flop strategy", short: "Post-flop", blurb: "C-bet by board texture, defense frequency, bluff ratios and SPR.", lesson: "postflop" },
  equity: { name: "Range equity", short: "Equity", blurb: "Your hand against a whole range: value bet, check or bluff.", lesson: "range-equity" },
  mixed: { name: "Everything", short: "Mixed", blurb: "All six skills shuffled together, the way they come at the table.", lesson: "pot-odds" },
  ranges: { name: "My ranges", short: "Ranges", blurb: "Drill the ranges you've built until they're automatic.", lesson: "reading-ranges" },
}

export const DRILL_TOPICS: DrillTopic[] = ["potOdds", "ev", "outs", "preflop", "postflop", "equity", "mixed"]
export const CORE_TOPICS: Exclude<Topic, "ranges">[] = ["potOdds", "ev", "outs", "preflop", "postflop", "equity"]

export type Street = "preflop" | "flop" | "turn" | "river"

export interface Scenario {
  street: Street
  hero: Card[]
  board: Card[]
  heroPos: Position
  villainPos?: Position
  active: Position[]
  pot: number
  bets: Partial<Record<Position, number>>
  unit: "$" | "bb"
  table: 6 | 9
  stack?: number // bb, shown on seats in bb games
  caption?: string
  villainCards?: Card[] // shown face up (all-in equity spots)
}

export interface Question {
  id: string
  kind: string
  seed: number
  difficulty: Difficulty
  topic: Topic
  scenario: Scenario
  story: string
  prompt: string
  choices: string[]
  answer: number
  accept?: number[] // other answers that are also correct (mixed strategies)
  explain: string
  formula?: string
  freqs?: { label: string; pct: number }[]
}

export const isCorrect = (q: Question, i: number) => i === q.answer || (q.accept?.includes(i) ?? false)

export interface GenOpts {
  difficulty: Difficulty
  table: 6 | 9
  stack: number
}
export const DEFAULT_OPTS: GenOpts = { difficulty: "medium", table: 6, stack: 100 }

type Body = Omit<Question, "id" | "kind" | "seed" | "difficulty" | "topic">

let qid = 0
const nextId = () => `q${Date.now().toString(36)}${(qid++).toString(36)}`

// ---------- helpers ----------
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(1)}`
const signedMoney = (n: number) => (n === 0 ? "$0" : `${n > 0 ? "+" : "−"}$${Math.abs(n)}`)
const pct = (n: number) => `${Math.round(n)}%`
const ratio = (r: number) => `${(Math.round(r * 10) / 10).toString()} : 1`
const cards = (cs: Card[]) => cs.map(cardLabel).join(" ")
const P = (p: Position) => POS_LABEL[p]
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const streetName = (s: Street) => (s === "preflop" ? "pre-flop" : `on the ${s}`)

function buildChoices<T>(correct: T, distractors: T[], fmt: (v: T) => string, count = 4) {
  const seen = new Set<string>([fmt(correct)])
  const opts: T[] = [correct]
  for (const d of distractors) {
    const k = fmt(d)
    if (seen.has(k)) continue
    seen.add(k)
    opts.push(d)
    if (opts.length >= count) break
  }
  const shuffled = shuffle(opts)
  return { choices: shuffled.map(fmt), answer: shuffled.findIndex((v) => fmt(v) === fmt(correct)) }
}

const POTS: Record<Difficulty, number[]> = {
  easy: [20, 40, 50, 100, 200],
  medium: [20, 30, 40, 50, 60, 75, 80, 100, 120, 150, 200, 240],
  hard: [35, 45, 55, 65, 85, 95, 130, 170, 210],
}
const FRACS: Record<Difficulty, number[]> = {
  easy: [0.5, 1],
  medium: [0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.25, 1.5, 2],
  hard: [0.4, 0.6, 0.7, 0.8, 1.1, 1.2, 1.75],
}
const SPREAD: Record<Difficulty, number[]> = { easy: [10, -10, 20], medium: [6, -5, 11], hard: [3, -3, 5] }

function niceBet(pot: number, frac: number, d: Difficulty) {
  const raw = pot * frac
  const step = d === "hard" ? 1 : pot >= 60 ? 5 : 1
  return Math.max(step, Math.round(raw / step) * step)
}

function seats(o: GenOpts): { hero: Position; villain: Position } {
  const list = seatsFor(o.table)
  const hero = pick(list)
  let villain = pick(list)
  while (villain === hero) villain = pick(list)
  return { hero, villain }
}

function randomBoard(street: Exclude<Street, "preflop">, exclude: Card[] = []) {
  const n = street === "flop" ? 3 : street === "turn" ? 4 : 5
  return shuffle(deckWithout(exclude)).slice(0, n)
}

function post(o: GenOpts, street: Exclude<Street, "preflop">, hero: Card[], board: Card[], pot: number): Scenario {
  const s = seats(o)
  return { street, hero, board, heroPos: s.hero, villainPos: s.villain, active: [s.hero, s.villain], pot, bets: {}, unit: "$", table: o.table }
}

// ---------- Draws (real cards, enumerated outs) ----------
export interface Draw {
  hero: Card[]
  board: Card[]
  outs: number
  flushOuts: number
  straightOuts: number
  straightRanks: number
  label: string
}

export function generateDraw(street: "flop" | "turn", minOuts = 4, maxOuts = 15): Draw {
  for (let attempt = 0; attempt < 20000; attempt++) {
    const d = shuffle(fullDeck())
    const hero = d.slice(0, 2)
    const board = d.slice(2, street === "flop" ? 5 : 6)
    if (evaluate([...hero, ...board]).cat !== 0) continue
    let outs = 0
    let flushOuts = 0
    let straightOuts = 0
    const straightRankSet = new Set<number>()
    for (const c of deckWithout([...hero, ...board])) {
      const v = evaluate([...hero, ...board, c])
      if (v.cat < 4) continue
      if (evaluate([...board, c]).cat >= 4) continue
      outs++
      if (v.cat === 5 || v.cat === 8) flushOuts++
      else {
        straightOuts++
        straightRankSet.add(c.r)
      }
    }
    if (outs < minOuts || outs > maxOuts) continue
    if (outs <= 4 && random() < 0.65) continue // gutshots are common; keep the mix varied
    const parts: string[] = []
    if (flushOuts) parts.push("a flush draw")
    if (straightOuts) parts.push(straightRankSet.size >= 2 ? "a two-way straight draw" : "a gutshot straight draw")
    return { hero, board, outs, flushOuts, straightOuts, straightRanks: straightRankSet.size, label: parts.join(" plus ") }
  }
  const hero = [{ r: 12, s: 1 }, { r: 8, s: 1 }]
  const board = [{ r: 7, s: 1 }, { r: 3, s: 1 }, { r: 0, s: 2 }]
  return { hero, board, outs: 9, flushOuts: 9, straightOuts: 0, straightRanks: 0, label: "a flush draw" }
}

const drawMin = (d: Difficulty) => (d === "easy" ? 8 : 4)

export function exactEquity(outs: number, street: "flop" | "turn") {
  if (street === "turn") return (outs / 46) * 100
  const miss = ((47 - outs) * (46 - outs)) / (47 * 46)
  return (1 - miss) * 100
}

function outsBreakdown(d: Draw) {
  if (d.flushOuts && d.straightOuts)
    return `${d.flushOuts} cards complete the flush and ${d.straightOuts} more complete the straight without a flush: ${d.outs} outs.`
  if (d.flushOuts) return `${d.flushOuts} cards of your suit are left, so ${d.outs} outs.`
  return `${d.straightRanks} rank${d.straightRanks > 1 ? "s" : ""} complete the straight, 4 of each left: ${d.outs} outs.`
}

// ---------- Pot odds ----------
function facing(o: GenOpts, street: Exclude<Street, "preflop">, hero: Card[], board: Card[], pot: number, bet: number, heroBets = false) {
  const sc = post(o, street, hero, board, pot)
  sc.bets = { [heroBets ? sc.heroPos : sc.villainPos!]: bet }
  return sc
}

function poEquity(o: GenOpts): Body {
  const d = o.difficulty
  const pot = pick(POTS[d])
  const bet = niceBet(pot, pick(FRACS[d]), d)
  const street = pick(["flop", "turn", "river"] as const)
  const hero = shuffle(fullDeck()).slice(0, 2)
  const sc = facing(o, street, hero, randomBoard(street, hero), pot, bet)
  const req = (bet / (pot + 2 * bet)) * 100
  const r = Math.round(req)
  const [a, b, c] = SPREAD[d]
  const { choices, answer } = buildChoices(r, [Math.round((bet / (pot + bet)) * 100), r + a, Math.round(Math.min(99, (bet / pot) * 100)), r + b, r + c], (v) => pct(v))
  return {
    scenario: sc,
    story: `You're in the ${P(sc.heroPos)} holding ${cards(hero)} ${streetName(street)}. The pot is ${money(pot)} and the ${P(sc.villainPos!)} bets ${money(bet)}.`,
    prompt: "What equity do you need to call?",
    choices,
    answer,
    explain: `Step 1: the call is ${money(bet)}. Step 2: the final pot if you call is ${money(pot)} + ${money(bet)} + ${money(bet)} = ${money(pot + 2 * bet)}. Step 3: ${money(bet)} ÷ ${money(pot + 2 * bet)} = ${req.toFixed(1)}%. You need at least that much equity.`,
    formula: "Required equity = call ÷ (pot + bet + call)",
  }
}

function poRatio(o: GenOpts): Body {
  const d = o.difficulty
  const pot = pick(POTS[d])
  const bet = niceBet(pot, pick(FRACS[d]), d)
  const street = pick(["flop", "turn", "river"] as const)
  const hero = shuffle(fullDeck()).slice(0, 2)
  const sc = facing(o, street, hero, randomBoard(street, hero), pot, bet)
  const r = (pot + bet) / bet
  const { choices, answer } = buildChoices(r, [pot / bet, (pot + 2 * bet) / bet, r + 1, Math.max(0.5, r - 1)], ratio)
  return {
    scenario: sc,
    story: `You're in the ${P(sc.heroPos)} holding ${cards(hero)} ${streetName(street)}. The pot is ${money(pot)} and the ${P(sc.villainPos!)} bets ${money(bet)}.`,
    prompt: "What pot odds are you being offered?",
    choices,
    answer,
    explain: `You call ${money(bet)} to win what's already out there: the ${money(pot)} pot plus the ${money(bet)} bet = ${money(pot + bet)}. ${money(pot + bet)} ÷ ${money(bet)} = ${ratio(r)}. As a percentage: 1 ÷ (${Math.round(r * 10) / 10} + 1) = ${((1 / (r + 1)) * 100).toFixed(1)}%.`,
    formula: "Pot odds = (pot + bet) : call",
  }
}

function poDraw(o: GenOpts): Body {
  const d = o.difficulty
  const dr = generateDraw("turn", drawMin(d), 15)
  const eq = dr.outs / 46
  const margin = d === "easy" ? 0.08 : d === "medium" ? 0.04 : 0.015
  const wantCall = random() < 0.5
  let pot = 0
  let bet = 0
  let req = 0
  for (let i = 0; i < 300; i++) {
    pot = pick(POTS[d])
    bet = niceBet(pot, pick([...FRACS[d], 0.1, 0.15, 0.2, 0.25, 0.33, 1.5]), d)
    req = bet / (pot + 2 * bet)
    if (Math.abs(eq - req) >= margin && (eq > req) === wantCall) break
  }
  const call = eq > req
  const sc = facing(o, "turn", dr.hero, dr.board, pot, bet)
  return {
    scenario: sc,
    story: `The turn is out and you hold ${cards(dr.hero)} in the ${P(sc.heroPos)} with ${dr.label}. There's ${money(pot)} in the pot and the ${P(sc.villainPos!)} bets ${money(bet)}. Assume villain has you beat unless you hit, and there's no more betting.`,
    prompt: "One card to come. Call or fold?",
    choices: ["Call", "Fold"],
    answer: call ? 0 : 1,
    explain: `${outsBreakdown(dr)} With one card to come that's ${dr.outs}/46 = ${(eq * 100).toFixed(1)}% (the 2× rule says ≈ ${dr.outs * 2}%). You call ${money(bet)} into a final pot of ${money(pot + 2 * bet)}, so you need ${(req * 100).toFixed(1)}%. ${call ? "Your equity beats the price: call." : "The price is higher than your equity: fold."}`,
    formula: "Call when equity > call ÷ (pot + bet + call)",
  }
}

function poImplied(o: GenOpts): Body {
  const d = o.difficulty
  for (let tries = 0; tries < 200; tries++) {
    const dr = generateDraw("turn", drawMin(d), 9)
    const e = dr.outs / 46
    const pot = pick(POTS[d])
    const bet = niceBet(pot, pick([0.66, 0.75, 1, 1.25, 1.5]), d)
    const need = ((1 - e) * bet) / e - (pot + bet)
    if (need < 8) continue
    const w = Math.round(need)
    const sc = facing(o, "turn", dr.hero, dr.board, pot, bet)
    const { choices, answer } = buildChoices(
      w,
      [Math.round(((1 - e) * bet) / e), Math.round(w / 2), w + Math.round(pot / 2), Math.round(need + bet)],
      (v) => money(v),
    )
    return {
      scenario: sc,
      story: `Turn. You hold ${cards(dr.hero)} with ${dr.label} (${dr.outs} outs). The pot is ${money(pot)} and the ${P(sc.villainPos!)} bets ${money(bet)}. The price alone is too high, but you might win more on the river when you hit.`,
      prompt: "How much extra must you win on the river, when you hit, for this call to break even?",
      choices,
      answer,
      explain: `Your equity is ${dr.outs}/46 = ${(e * 100).toFixed(1)}%. Break-even means equity × (pot + bet + extra) = (1 − equity) × call. So extra = (1 − e) × call ÷ e − (pot + bet) = ${(1 - e).toFixed(3)} × ${bet} ÷ ${e.toFixed(3)} − ${pot + bet} ≈ ${money(w)}. If villain will reliably pay at least that much when you hit, the call is profitable.`,
      formula: "Extra needed = (1 − equity) × call ÷ equity − (pot + bet)",
    }
  }
  return poDraw(o)
}

// ---------- Expected value ----------
function evCall(o: GenOpts): Body {
  const d = o.difficulty
  const street = pick(["flop", "turn", "river"] as const)
  const hero = shuffle(fullDeck()).slice(0, 2)
  const pot = pick(POTS[d])
  const bet = niceBet(pot, pick(FRACS[d]), d)
  const eq = d === "easy" ? pick([25, 50, 75]) : d === "medium" ? pick([20, 25, 30, 35, 40, 45, 50, 55, 60]) : pick([18, 22, 28, 33, 38, 42, 47, 52, 57])
  const e = eq / 100
  const ev = Math.round(e * (pot + bet) - (1 - e) * bet)
  const sp = d === "hard" ? 0.2 : 0.4
  const { choices, answer } = buildChoices(
    ev,
    [Math.round(e * (pot + 2 * bet) - (1 - e) * bet), Math.round(e * pot - (1 - e) * bet), -ev, ev + Math.max(3, Math.round(bet * sp)), ev - Math.max(3, Math.round(bet * sp))],
    signedMoney,
  )
  const sc = facing(o, street, hero, randomBoard(street, hero), pot, bet)
  return {
    scenario: sc,
    story: `${cap(streetName(street))}, ${money(pot)} in the pot. The ${P(sc.villainPos!)} bets ${money(bet)}. Against villain's range your ${cards(hero)} has about ${eq}% equity. Ignore future betting.`,
    prompt: "What's the EV of calling?",
    choices,
    answer,
    explain: `When you win (${eq}%) you collect ${money(pot + bet)}: the pot plus the bet. When you lose (${100 - eq}%) you lose your ${money(bet)} call. EV = ${e.toFixed(2)} × ${pot + bet} − ${(1 - e).toFixed(2)} × ${bet} = ${signedMoney(ev)}. ${ev > 0 ? "Positive, so calling makes money over time." : ev < 0 ? "Negative, so folding (EV $0) is better." : "Break-even."}`,
    formula: "EV(call) = equity × (pot + bet) − (1 − equity) × call",
  }
}

function evBluff(o: GenOpts): Body {
  const d = o.difficulty
  const hero = shuffle(fullDeck()).slice(0, 2)
  const pot = pick(POTS[d])
  const bet = niceBet(pot, pick(FRACS[d]), d)
  const fold = d === "easy" ? pick([25, 50, 75]) : pick([25, 30, 35, 40, 45, 50, 55, 60, 65, 70])
  const f = fold / 100
  const ev = Math.round(f * pot - (1 - f) * bet)
  const { choices, answer } = buildChoices(
    ev,
    [Math.round(f * (pot + bet) - (1 - f) * bet), Math.round(f * pot), -ev, ev + Math.max(4, Math.round(bet * 0.5)), ev - Math.max(4, Math.round(bet * 0.5))],
    signedMoney,
  )
  const sc = facing(o, "river", hero, randomBoard("river", hero), pot, bet, true)
  return {
    scenario: sc,
    story: `River. You missed with ${cards(hero)} and you're considering a ${money(bet)} bluff into ${money(pot)}. You expect the ${P(sc.villainPos!)} to fold ${fold}% of the time, and you lose whenever called.`,
    prompt: "What's the EV of the bluff?",
    choices,
    answer,
    explain: `${fold}% of the time villain folds and you win the ${money(pot)} pot. ${100 - fold}% of the time you're called and lose your ${money(bet)}. EV = ${f.toFixed(2)} × ${pot} − ${(1 - f).toFixed(2)} × ${bet} = ${signedMoney(ev)}.`,
    formula: "EV(bluff) = fold% × pot − (1 − fold%) × bet",
  }
}

function evBreakeven(o: GenOpts): Body {
  const d = o.difficulty
  const hero = shuffle(fullDeck()).slice(0, 2)
  const pot = pick(POTS[d])
  const bet = niceBet(pot, pick(FRACS[d]), d)
  const be = (bet / (pot + bet)) * 100
  const r = Math.round(be)
  const [a, b] = SPREAD[d]
  const { choices, answer } = buildChoices(r, [Math.round((bet / (pot + 2 * bet)) * 100), Math.round(Math.min(95, (bet / pot) * 100)), r + a + 2, r + b - 2], pct)
  const sc = facing(o, "river", hero, randomBoard("river", hero), pot, bet, true)
  return {
    scenario: sc,
    story: `River, ${money(pot)} in the pot. You hold ${cards(hero)} with no showdown value and plan to bet ${money(bet)} as a pure bluff against the ${P(sc.villainPos!)}.`,
    prompt: "How often must villain fold for the bluff to break even?",
    choices,
    answer,
    explain: `You risk ${money(bet)} to win ${money(pot)}. Break-even fold frequency = risk ÷ (risk + reward) = ${bet} ÷ ${pot + bet} = ${be.toFixed(1)}%. If villain folds more often than that, the bluff makes money.`,
    formula: "Break-even fold% = bet ÷ (pot + bet)",
  }
}

// ---------- Outs & 4-2 ----------
function outsCount(o: GenOpts): Body {
  const street = random() < 0.6 ? "flop" : "turn"
  const dr = generateDraw(street, drawMin(o.difficulty))
  const sc = post(o, street, dr.hero, dr.board, pick([20, 30, 40, 60, 80, 100]))
  const near = o.difficulty === "hard" ? [dr.outs + 1, dr.outs - 1, dr.outs + 2, dr.outs - 2] : [dr.outs + 1, dr.outs - 1, dr.outs + 3, dr.outs - 3, 4, 8, 9, 12, 15]
  const { choices, answer } = buildChoices(dr.outs, shuffle(near).filter((n) => n > 0 && n <= 21), (n) => `${n} outs`)
  return {
    scenario: sc,
    story: `You hold ${cards(dr.hero)} in the ${P(sc.heroPos)}. The board ${street === "flop" ? "reads" : "runs out to the turn:"} ${cards(dr.board)}. Only straights and flushes count as improving.`,
    prompt: "How many outs do you have to a straight or a flush?",
    choices,
    answer,
    explain: `You have ${dr.label}. ${outsBreakdown(dr)} Count each card once: a card that makes both a flush and a straight is still one out.`,
  }
}

function outsRule(o: GenOpts): Body {
  const street = random() < 0.6 ? "flop" : "turn"
  const dr = generateDraw(street, drawMin(o.difficulty))
  const sc = post(o, street, dr.hero, dr.board, pick([20, 30, 40, 60, 80, 100]))
  const mult = street === "flop" ? 4 : 2
  const approx = dr.outs * mult
  const exact = exactEquity(dr.outs, street)
  const { choices, answer } = buildChoices(approx, [dr.outs * (street === "flop" ? 2 : 4), approx + 6, approx - 5, approx + 10, dr.outs], (n) => `≈ ${n}%`)
  return {
    scenario: sc,
    story: `You hold ${cards(dr.hero)} in the ${P(sc.heroPos)}. The board ${street === "flop" ? "reads" : "runs out to the turn:"} ${cards(dr.board)}. Only straights and flushes count as improving.${street === "flop" ? " You'll see both the turn and river." : ""}`,
    prompt: "Using the 4-2 rule, what's your equity to hit by the river?",
    choices,
    answer,
    explain: `${outsBreakdown(dr)} ${street === "flop" ? "Two cards to come, so multiply by 4" : "One card to come, so multiply by 2"}: ${dr.outs} × ${mult} ≈ ${approx}%. The exact figure is ${exact.toFixed(1)}%.`,
    formula: "Flop (2 cards to come): outs × 4. Turn (1 card): outs × 2",
  }
}

// ---------- Pre-flop ----------
function sampleHand(range: Record<string, RangeAction>, d: Difficulty, mix: Record<string, unknown> = {}): string {
  const edge = new Set([...boundaryHands(range), ...Object.keys(mix)])
  const pBoundary = d === "easy" ? 0 : d === "medium" ? 0.55 : 1
  if (random() < pBoundary && edge.size) return pick([...edge])
  for (let i = 0; i < 50; i++) {
    let x = rand(1326)
    let h = "AA"
    for (const hh of ALL_HANDS) {
      x -= combos(hh)
      if (x < 0) {
        h = hh
        break
      }
    }
    if (d !== "easy" || !edge.has(h)) return h
  }
  return "AA"
}

const spotChoiceLabel = (spot: Spot, a: RangeAction) => (!spot.opener ? (a === "raise" ? "Raise" : "Fold") : a === "raise" ? "3-bet" : a === "call" ? "Call" : "Fold")

function genPreflop(spot: Spot, o: GenOpts): Body {
  const hand = sampleHand(spot.range, o.difficulty, spot.mix)
  const hero = dealHandClass(hand)
  const f = freqs(spot, hand)
  const ranked = (Object.entries(f) as [RangeAction, number][]).sort((a, b) => b[1] - a[1])
  const best = ranked[0][0]
  const positions = seatsFor(o.table)
  const heroIdx = positions.indexOf(spot.hero)
  const active: Position[] = [...(spot.opener ? [spot.opener] : []), ...positions.slice(heroIdx)]
  const bets: Partial<Record<Position, number>> = { SB: 0.5, BB: 1 }
  if (spot.opener) bets[spot.opener] = 2.5
  const tableName = o.table === 9 ? "9-handed" : "6-max"
  const story = spot.opener
    ? `${tableName}, ${o.stack}bb deep. The ${P(spot.opener)} opens to 2.5bb and it folds to you in the ${P(spot.hero)} with ${cards(hero)}.`
    : `${tableName}, ${o.stack}bb deep. It folds to you in the ${P(spot.hero)} with ${cards(hero)}.`
  const choices = spot.actions.map((a) => spotChoiceLabel(spot, a))
  const answer = spot.actions.indexOf(best)
  const accept = ranked.filter(([a, v]) => a !== best && v >= 0.25).map(([a]) => spot.actions.indexOf(a))
  const mixed = ranked.length > 1
  const pctOpen = rangePercent(spot.range)
  const depthNote = o.stack !== 100 ? ` These charts are built for 100bb; at ${o.stack}bb treat them as a starting point.` : ""
  return {
    scenario: { street: "preflop", hero, board: [], heroPos: spot.hero, villainPos: spot.opener, active, pot: 0, bets, unit: "bb", table: o.table, stack: o.stack },
    story,
    prompt: "What's the GTO play?",
    choices,
    answer,
    accept: accept.length ? accept : undefined,
    freqs: ranked.map(([a, v]) => ({ label: spotChoiceLabel(spot, a), pct: Math.round(v * 100) })),
    explain: mixed
      ? `${hand} (${describeHand(hand)}) is a mixed hand here: the strategy plays ${ranked.map(([a, v]) => `${spotChoiceLabel(spot, a).toLowerCase()} ${Math.round(v * 100)}%`).join(", ")}. Any action it takes at least a quarter of the time counts as correct.${depthNote}`
      : `${hand} (${describeHand(hand)}) is a pure ${spotChoiceLabel(spot, best).toLowerCase()} here. ${spot.opener ? `Against a ${P(spot.opener)} open this strategy continues with about ${pctOpen.toFixed(0)}% of hands, 3-betting ${rangePercent(spot.range, "raise").toFixed(0)}%.` : `The ${P(spot.hero)} opening range is about ${pctOpen.toFixed(0)}% of hands.`}${depthNote}`,
  }
}

// ---------- Post-flop strategy ----------
type Texture = "paired" | "monotone" | "lowConnected" | "highDynamic" | "highDry" | "lowDry"
export function texture(board: Card[]): Texture {
  const rs = board.map((c) => c.r).sort((a, b) => b - a)
  const suits = new Set(board.map((c) => c.s)).size
  if (new Set(rs).size < 3) return "paired"
  if (suits === 1) return "monotone"
  const span = rs[0] - rs[2]
  if (rs[0] <= 7 && span <= 4) return "lowConnected" // 9-high or lower and connected
  if (rs[0] >= 8 && span <= 4 && suits === 2) return "highDynamic"
  if (rs[0] >= 8) return "highDry"
  return "lowDry"
}
const CBET = ["Bet small (25–33%) with most of your range", "Bet big (66–75%) with a polarized range", "Check most of your range"]
const TEXTURE_ANSWER: Record<Texture, number> = { paired: 0, monotone: 0, highDry: 0, lowDry: 0, highDynamic: 1, lowConnected: 2 }
const TEXTURE_WHY: Record<Texture, string> = {
  paired: "Paired boards rarely help either range much, and the opener has more overpairs. A small bet with almost everything wins the pot often and is cheap when it fails.",
  monotone: "On monotone boards everyone's hand strength is capped by the flush. Solvers prefer small bets at a lower frequency; big bets get punished by flush draws and made flushes.",
  highDry: "High, disconnected boards favour the pre-flop raiser: more big pairs and strong aces, few two-pairs or sets for the caller. That range advantage lets you bet small with nearly your whole range.",
  lowDry: "Low, disconnected boards miss both ranges. The opener still has more overpairs, so a small bet at high frequency takes the pot from a lot of air.",
  highDynamic: "Connected high boards with a flush draw hit both ranges and create many draws. The opener keeps the nut advantage (sets, top two, nut draws), so solvers bet bigger with a polarized range and check medium hands.",
  lowConnected: "Low, connected boards smash the caller's suited connectors and small pairs; they have more two-pairs, sets and straights. The opener checks most hands and bets a narrow, strong range.",
}

function postCbet(o: GenOpts): Body {
  const allowed: Texture[] =
    o.difficulty === "easy"
      ? ["paired", "highDry", "lowConnected"]
      : o.difficulty === "medium"
        ? ["paired", "highDry", "lowDry", "lowConnected", "highDynamic"]
        : ["paired", "highDry", "lowDry", "lowConnected", "highDynamic", "monotone"]
  let board: Card[] = []
  let t: Texture = "paired"
  const hero = dealHandClass(pick(["AKo", "KQs", "QJs", "T9s", "77", "A5s", "KJo", "98s"]))
  const targets = [...new Set(allowed.map((x) => TEXTURE_ANSWER[x]))]
  const want = pick(targets)
  for (let i = 0; i < 3000; i++) {
    board = randomBoard("flop", hero)
    t = texture(board)
    if (allowed.includes(t) && TEXTURE_ANSWER[t] === want) break
  }
  return {
    scenario: { street: "flop", hero, board, heroPos: "BTN", villainPos: "BB", active: ["BTN", "BB"], pot: 5.5, bets: {}, unit: "bb", table: o.table, stack: o.stack - 2.5 },
    story: `Single-raised pot. You opened the BTN to 2.5bb and the BB called. The flop is ${cards(board)} and the BB checks to you. Think about your whole range, not just ${cards(hero)}.`,
    prompt: "What's your best overall betting strategy on this flop?",
    choices: CBET,
    answer: TEXTURE_ANSWER[t],
    explain: `${TEXTURE_WHY[t]} (Simplified solver heuristics for BTN vs BB, 100bb.)`,
  }
}

function postMdf(o: GenOpts): Body {
  const d = o.difficulty
  const pot = pick(POTS[d])
  const bet = niceBet(pot, pick(FRACS[d]), d)
  const mdf = (pot / (pot + bet)) * 100
  const r = Math.round(mdf)
  const [a, b] = SPREAD[d]
  const street = pick(["flop", "turn", "river"] as const)
  const hero = shuffle(fullDeck()).slice(0, 2)
  const sc = facing(o, street, hero, randomBoard(street, hero), pot, bet)
  const { choices, answer } = buildChoices(r, [Math.round((bet / (pot + bet)) * 100), Math.round(100 - (bet / (pot + 2 * bet)) * 100), r + a, r + b], pct)
  return {
    scenario: sc,
    story: `${cap(streetName(street))}. The pot is ${money(pot)} and the ${P(sc.villainPos!)} bets ${money(bet)} into you. You want to stop villain from profiting by betting any two cards.`,
    prompt: "What's your minimum defense frequency?",
    choices,
    answer,
    explain: `A pure bluff risks ${money(bet)} to win ${money(pot)}, so it profits if you fold more than ${((bet / (pot + bet)) * 100).toFixed(0)}% of the time. To prevent that you must continue with pot ÷ (pot + bet) = ${pot} ÷ ${pot + bet} = ${mdf.toFixed(1)}% of your range. MDF is a guide, not a law: against players who rarely bluff you can fold more.`,
    formula: "MDF = pot ÷ (pot + bet)",
  }
}

function postBluffRatio(o: GenOpts): Body {
  const d = o.difficulty
  const pot = pick(POTS[d])
  const bet = niceBet(pot, pick([0.33, 0.5, 0.66, 0.75, 1, 1.5, 2]), d)
  const share = (bet / (pot + 2 * bet)) * 100
  const r = Math.round(share)
  const [a, b] = SPREAD[d]
  const hero = shuffle(fullDeck()).slice(0, 2)
  const sc = facing(o, "river", hero, randomBoard("river", hero), pot, bet, true)
  const { choices, answer } = buildChoices(r, [Math.round((bet / (pot + bet)) * 100), Math.round(Math.min(90, (bet / pot) * 50)), r + a + 2, r + b - 2], pct)
  return {
    scenario: sc,
    story: `River, ${money(pot)} in the pot. You're building a ${money(bet)} betting range out of strong value hands and bluffs. You want villain to be indifferent between calling and folding.`,
    prompt: "What share of your betting range should be bluffs?",
    choices,
    answer,
    explain: `Villain calls ${money(bet)} to win ${money(pot + bet)}, so they need ${share.toFixed(1)}% equity. Make exactly that share of your bets bluffs and calling breaks even for them. Bigger bets allow more bluffs: a pot-size bet supports 33%, a half-pot bet 25%.`,
    formula: "Bluff share = bet ÷ (pot + 2 × bet)",
  }
}

function postSpr(o: GenOpts): Body {
  const type = pick(["srp", "3bet", "4bet"] as const)
  const stack = o.difficulty === "hard" ? pick([40, 60, 75, 125, 150, 200, 250]) : o.stack
  const put = type === "srp" ? 2.5 : type === "3bet" ? 11 : 24
  const pot = put * 2 + 0.5 // both players' chips plus the dead small blind
  const eff = stack - put
  const spr = eff / pot
  const r = Math.round(spr * 10) / 10
  const fmt = (v: number) => (Math.round(v * 10) / 10).toFixed(1)
  const { choices, answer } = buildChoices(r, [Math.round((stack / pot) * 10) / 10, Math.round((eff / (pot / 2)) * 10) / 10, Math.max(0.5, r + 2.5), Math.max(0.3, r - 1.5)], fmt)
  const hero = dealHandClass(pick(["AKs", "QQ", "JTs", "AQo", "99"]))
  const board = randomBoard("flop", hero)
  const villain: Position = type === "3bet" ? "CO" : "BB"
  const desc =
    type === "srp" ? "You open to 2.5bb on the BTN and the BB calls" : type === "3bet" ? "The CO opens, you 3-bet to 11bb from the BTN and the CO calls" : "You open the BTN, the BB 3-bets, you 4-bet to 24bb and get called"
  return {
    scenario: { street: "flop", hero, board, heroPos: "BTN", villainPos: villain, active: ["BTN", villain], pot, bets: {}, unit: "bb", table: o.table, stack: eff },
    story: `Effective stacks start at ${stack}bb. ${desc}; the small blind's 0.5bb is dead money. The pot on the flop is ${pot}bb.`,
    prompt: "What's the stack-to-pot ratio (SPR) on the flop?",
    choices,
    answer,
    explain: `Each player has ${stack} − ${put} = ${eff}bb behind. SPR = ${eff} ÷ ${pot} = ${spr.toFixed(1)}. ${spr < 4 ? "Low SPR: top pair and overpairs are usually happy to get all-in." : spr < 10 ? "Medium SPR: top pair is strong, but think twice about stacking off against heavy aggression." : "High SPR: one pair is rarely worth a whole stack; draws and sets gain value."}`,
    formula: "SPR = effective stack ÷ pot",
  }
}

// ---------- Range equity ----------
const btnOpen = () => Object.keys(spotByKey("rfi-btn")!.range)
const bbCall = () => {
  const r = spotByKey("bb-vs-btn")!.range
  return Object.keys(r).filter((h) => r[h] === "call")
}

function eqRiver(o: GenOpts): Body {
  for (let tries = 0; tries < 400; tries++) {
    const hero = dealHandClass(pick(btnOpen()))
    const board = randomBoard("river", hero)
    const boardScore = evaluate(board).score
    const callers = rangeCombos(bbCall(), [...hero, ...board]).filter(([a, b]) => {
      const v = evaluate([a, b, ...board])
      return v.score > boardScore && v.cat >= 1
    })
    if (callers.length < 12) continue
    const eq = equityVsCombos(hero, board, callers).equity
    const hv = evaluate([...hero, ...board])
    const improved = hv.score > boardScore && hv.cat >= 1
    let ans = -1
    if (eq >= 0.6) ans = 0
    else if (!improved && eq < 0.12) ans = 2
    else if (improved && eq >= 0.2 && eq <= 0.45) ans = 1
    if (ans < 0) continue
    return {
      scenario: { street: "river", hero, board, heroPos: "BTN", villainPos: "BB", active: ["BTN", "BB"], pot: 20, bets: {}, unit: "bb", table: o.table, stack: o.stack - 12.5 },
      story: `You opened the BTN, the BB called, and the BB checks the river. Board ${cards(board)}, you hold ${cards(hero)} (${CATEGORY[hv.cat].toLowerCase()}). Assume the BB calls a pot-size bet with any pair or better that uses a hole card, and folds everything else.`,
      prompt: "Bet for value, check, or bluff?",
      choices: ["Bet for value", "Check", "Bluff"],
      answer: ans,
      explain: `The BB's calling range here is ${callers.length} combos. Against those you win ${(eq * 100).toFixed(0)}% of the time. ${
        ans === 0
          ? "You're ahead of most hands that call, so betting earns money: value bet."
          : ans === 2
            ? "You beat almost nothing that calls and can't win at showdown. Betting is the only way to win the pot: it's a bluff candidate."
            : "You lose to most hands that call but beat the hands that fold. Betting only gets called by better: check and take the showdown."
      }`,
      formula: "Value bet when you win more than half the time against the hands that call",
    }
  }
  return eqPreflop(o)
}

function eqFlop(o: GenOpts): Body {
  const callRange = bbCall()
  for (let tries = 0; tries < 60; tries++) {
    const hero = dealHandClass(pick(btnOpen()))
    const board = randomBoard("flop", hero)
    const villain = rangeCombos(callRange, [...hero, ...board])
    const eq = equityVsCombos(hero, board, villain, 3000).equity * 100
    let choices: string[]
    let answer: number
    if (o.difficulty === "hard") {
      const near = Math.round(eq / 5) * 5
      if (Math.abs(eq - near) > 1.4) continue
      ;({ choices, answer } = buildChoices(near, [near + 10, near - 10, near + 20, near - 20].filter((v) => v > 0 && v < 100), (v) => `≈ ${v}%`))
    } else {
      const edges = o.difficulty === "easy" ? [35, 65] : [30, 50, 70]
      choices = o.difficulty === "easy" ? ["Under 35%", "35–65%", "Over 65%"] : ["Under 30%", "30–50%", "50–70%", "Over 70%"]
      if (edges.some((e) => Math.abs(eq - e) < 3)) continue
      answer = edges.filter((e) => eq > e).length
    }
    const hv = evaluate([...hero, ...board])
    return {
      scenario: { street: "flop", hero, board, heroPos: "BTN", villainPos: "BB", active: ["BTN", "BB"], pot: 5.5, bets: {}, unit: "bb", table: o.table, stack: o.stack - 2.5 },
      story: `You opened the BTN with ${cards(hero)} and the BB called with their whole defending range (${villain.length} combos after card removal). The flop is ${cards(board)}; you have ${CATEGORY[hv.cat].toLowerCase()}.`,
      prompt: "What's your equity against the BB's range?",
      choices,
      answer,
      explain: `Simulated against every combo in the BB calling range, ${cards(hero)} wins about ${eq.toFixed(0)}% by the river. Ranges matter more than single hands: even a strong-looking holding loses ground when the board connects with the caller's suited connectors and small pairs.`,
    }
  }
  return eqPreflop(o)
}

const MATCHUPS = [
  ["AKo", "QQ"], ["AKs", "22"], ["AQo", "AJo"], ["KK", "AKo"], ["JTs", "AKo"], ["99", "AKs"], ["AA", "KK"], ["T9s", "AA"],
  ["AJo", "KQs"], ["76s", "AKo"], ["QQ", "A5s"], ["KQo", "AJo"], ["55", "KJo"], ["AKo", "AQo"], ["TT", "JJ"], ["A2s", "KQo"],
]

function eqPreflop(o: GenOpts): Body {
  for (let tries = 0; tries < 40; tries++) {
    const [a, b] = random() < 0.7 ? pick(MATCHUPS) : [pick(ALL_HANDS), pick(ALL_HANDS)]
    const h1 = dealHandClass(a)
    const opts = combosOf(b, new Set(h1.map((c) => c.r * 4 + c.s)))
    if (!opts.length) continue
    const h2 = pick(opts)
    const eq = equityHandVsHand(h1, h2, [], 9000).equity * 100
    const near = Math.round(eq / 5) * 5
    if (Math.abs(eq - near) > 1.6 || near <= 5 || near >= 95) continue
    const step = o.difficulty === "easy" ? 15 : o.difficulty === "medium" ? 10 : 5
    const { choices, answer } = buildChoices(near, [near + step, near - step, near + 2 * step, near - 2 * step].filter((v) => v > 0 && v < 100), (v) => `≈ ${v}%`)
    return {
      scenario: { street: "preflop", hero: h1, board: [], heroPos: "BTN", villainPos: "BB", active: ["BTN", "BB"], pot: 0, bets: { BTN: o.stack, BB: o.stack }, unit: "bb", table: o.table, villainCards: [h2[0], h2[1]] },
      story: `All-in pre-flop. Your ${cards(h1)} (${a}) against the BB's ${cards([h2[0], h2[1]])} (${b}). Five cards to come.`,
      prompt: "What's your equity?",
      choices,
      answer,
      explain: `Run out thousands of times, ${a} wins about ${eq.toFixed(1)}% against ${b}. Benchmarks: a pair against two overcards is roughly 55%, a pair against one overcard about 70%, a dominated hand (same high card, worse kicker) about 25–30%, and a bigger pair against a smaller one about 80%.`,
    }
  }
  return outsRule(o)
}

// ---------- Kind registry ----------
interface KindDef {
  topic: Exclude<Topic, "ranges">
  label: string
  gen: (o: GenOpts) => Body
  lesson: string
}

export const KINDS: Record<string, KindDef> = {
  "po-equity": { topic: "potOdds", label: "Required equity", gen: poEquity, lesson: "pot-odds" },
  "po-ratio": { topic: "potOdds", label: "Pot-odds ratio", gen: poRatio, lesson: "pot-odds" },
  "po-draw": { topic: "potOdds", label: "Draw: call or fold", gen: poDraw, lesson: "pot-odds" },
  "po-implied": { topic: "potOdds", label: "Implied odds", gen: poImplied, lesson: "implied-odds" },
  "ev-call": { topic: "ev", label: "EV of a call", gen: evCall, lesson: "expected-value" },
  "ev-bluff": { topic: "ev", label: "EV of a bluff", gen: evBluff, lesson: "expected-value" },
  "ev-breakeven": { topic: "ev", label: "Break-even fold %", gen: evBreakeven, lesson: "expected-value" },
  "outs-count": { topic: "outs", label: "Counting outs", gen: outsCount, lesson: "outs" },
  "outs-rule": { topic: "outs", label: "The 4-2 rule", gen: outsRule, lesson: "outs" },
  "post-cbet": { topic: "postflop", label: "C-bet by board texture", gen: postCbet, lesson: "postflop" },
  "post-mdf": { topic: "postflop", label: "Minimum defense frequency", gen: postMdf, lesson: "postflop" },
  "post-bluff": { topic: "postflop", label: "Bluff-to-value ratio", gen: postBluffRatio, lesson: "postflop" },
  "post-spr": { topic: "postflop", label: "Stack-to-pot ratio", gen: postSpr, lesson: "postflop" },
  "eq-river": { topic: "equity", label: "Value, check or bluff", gen: eqRiver, lesson: "range-equity" },
  "eq-flop": { topic: "equity", label: "Equity vs a range", gen: eqFlop, lesson: "range-equity" },
  "eq-preflop": { topic: "equity", label: "All-in matchups", gen: eqPreflop, lesson: "range-equity" },
}
for (const s of SPOTS) KINDS[`pre-${s.key}`] = { topic: "preflop", label: s.label, gen: (o) => genPreflop(s, o), lesson: "preflop" }

export const kindLabel = (k: string) => KINDS[k]?.label ?? (k === "range" ? "My ranges" : k)
export const lessonFor = (k: string) => KINDS[k]?.lesson ?? "reading-ranges"

export function kindsFor(topic: Exclude<Topic, "ranges">, table: 6 | 9): string[] {
  if (topic === "preflop") return spotsForTable(table).map((s) => `pre-${s.key}`)
  return Object.keys(KINDS).filter((k) => KINDS[k].topic === topic)
}

function pickKind(topic: DrillTopic, table: 6 | 9): string {
  const t = topic === "mixed" ? pick(CORE_TOPICS) : topic
  return pick(kindsFor(t, table))
}

export function buildQuestion(kind: string, seed: number, o: GenOpts): Question {
  const k = KINDS[kind] ? kind : "po-equity"
  const def = KINDS[k]
  const body = withSeed(seed, () => def.gen(o))
  return { ...body, id: nextId(), kind: k, seed, difficulty: o.difficulty, topic: def.topic }
}

export function generateQuestion(topic: DrillTopic, o: GenOpts = DEFAULT_OPTS, kinds?: string[]): Question {
  const kind = kinds?.length ? pick(kinds) : pickKind(topic, o.table)
  return buildQuestion(kind, newSeed(), o)
}

/** A fixed set of questions every player gets for the same seed (daily challenge, races). */
export function questionSet(seed: number, count: number, o: GenOpts, topic: DrillTopic = "mixed"): Question[] {
  const specs = withSeed(seed, () => {
    const out: [string, number][] = []
    for (let i = 0; i < count; i++) out.push([pickKind(topic, o.table), newSeed()])
    return out
  })
  return specs.map(([k, s]) => buildQuestion(k, s, o))
}

// ---------- User ranges ----------
export function genRangeQuestion(preset: RangePreset, o: GenOpts = DEFAULT_OPTS): Question {
  const seed = newSeed()
  const body = withSeed(seed, (): Body => {
    const hand = sampleHand(preset.cells, o.difficulty)
    const hero = dealHandClass(hand)
    const correct = actionFor(preset.cells, hand)
    const hasCall = Object.values(preset.cells).includes("call")
    const actions: RangeAction[] = hasCall ? ["raise", "call", "fold"] : ["raise", "fold"]
    return {
      scenario: { street: "preflop", hero, board: [], heroPos: "BTN", active: ["BTN", "SB", "BB"], pot: 0, bets: { SB: 0.5, BB: 1 }, unit: "bb", table: 6, caption: preset.name },
      story: `Range: ${preset.name}. You're dealt ${cards(hero)} (${hand}).`,
      prompt: "What does your range do with this hand?",
      choices: actions.map((a) => ACTION_LABEL[a]),
      answer: actions.indexOf(correct),
      explain: `In “${preset.name}”, ${hand} is a ${ACTION_LABEL[correct].toLowerCase()}. The range plays ${rangePercent(preset.cells).toFixed(0)}% of hands.`,
    }
  })
  return { ...body, id: nextId(), kind: "range", seed, difficulty: o.difficulty, topic: "ranges" }
}

// ---------- Share codes: #hand-<kind>-<seed36>-<e|m|h>-<6|9> ----------
export function shareCode(q: Question, table: 6 | 9) {
  return `hand-${q.kind}-${q.seed.toString(36)}-${q.difficulty[0]}-${table}`
}
export function parseShare(code: string): { kind: string; seed: number; difficulty: Difficulty; table: 6 | 9 } | null {
  const parts = code.split("-")
  if (parts[0] !== "hand" || parts.length < 5) return null
  const table = parts.pop() === "9" ? 9 : 6
  const dch = parts.pop()
  const seed = parseInt(parts.pop() ?? "", 36)
  const kind = parts.slice(1).join("-")
  if (!KINDS[kind] || !Number.isFinite(seed)) return null
  const difficulty: Difficulty = dch === "e" ? "easy" : dch === "h" ? "hard" : "medium"
  return { kind, seed, difficulty, table }
}

export { RANKS }
