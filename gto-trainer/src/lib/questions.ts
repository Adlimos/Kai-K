import {
  type Card,
  CATEGORY,
  cardLabel,
  dealHandClass,
  deckWithout,
  describeHand,
  evaluate,
  fullDeck,
  handClass,
  pick,
  rand,
  shuffle,
  ALL_HANDS,
  combos,
  RANKS,
} from "./cards"
import {
  type Position,
  type RangeAction,
  type RangePreset,
  type Spot,
  ACTION_LABEL,
  POSITIONS,
  SPOTS,
  actionFor,
  boundaryHands,
  rangePercent,
} from "./ranges"

export type Topic = "potOdds" | "ev" | "outs" | "preflop" | "ranges"
export type DrillTopic = Exclude<Topic, "ranges"> | "mixed"

export const TOPIC_META: Record<Topic | "mixed", { name: string; short: string; blurb: string }> = {
  potOdds: { name: "Pot odds", short: "Pot odds", blurb: "Price a call: the equity you need and the ratio you're getting." },
  ev: { name: "Expected value", short: "EV", blurb: "Put a dollar figure on calls, bluffs and break-even folds." },
  outs: { name: "Outs & the 4-2 rule", short: "Outs", blurb: "Count the cards that complete your draw, then turn them into equity." },
  preflop: { name: "Pre-flop", short: "Pre-flop", blurb: "Open, 3-bet, call or fold from every seat at a 6-max table." },
  mixed: { name: "Everything", short: "Mixed", blurb: "All four skills shuffled together, the way they come at the table." },
  ranges: { name: "My ranges", short: "Ranges", blurb: "Drill the ranges you've built until they're automatic." },
}

export const DRILL_TOPICS: DrillTopic[] = ["potOdds", "ev", "outs", "preflop", "mixed"]

export type Street = "preflop" | "flop" | "turn" | "river"

export interface Scenario {
  street: Street
  hero: Card[]
  board: Card[]
  heroPos: Position
  villainPos?: Position
  active: Position[] // seats still in the hand
  pot: number // chips in the middle
  bets: Partial<Record<Position, number>> // chips in front of seats this street
  unit: "$" | "bb"
  caption?: string
}

export interface Question {
  id: string
  topic: Topic
  scenario: Scenario
  story: string
  prompt: string
  choices: string[]
  answer: number
  explain: string
  formula?: string
}

let qid = 0
const nextId = () => `q${Date.now().toString(36)}${(qid++).toString(36)}`

// ---------- helpers ----------
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(1)}`
const signedMoney = (n: number) => (n === 0 ? "$0" : `${n > 0 ? "+" : "−"}$${Math.abs(n)}`)
const pct = (n: number) => `${Math.round(n)}%`
const ratio = (r: number) => `${(Math.round(r * 10) / 10).toString()} : 1`

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

function niceBet(pot: number, frac: number) {
  const raw = pot * frac
  const step = pot >= 60 ? 5 : 1
  return Math.max(step, Math.round(raw / step) * step)
}

function postflopSeats(): { hero: Position; villain: Position } {
  const hero = pick(POSITIONS)
  let villain = pick(POSITIONS)
  while (villain === hero) villain = pick(POSITIONS)
  return { hero, villain }
}

function randomBoard(street: Exclude<Street, "preflop">, exclude: Card[] = []) {
  const n = street === "flop" ? 3 : street === "turn" ? 4 : 5
  const d = shuffle(deckWithout(exclude))
  return d.slice(0, n)
}

const streetName = (s: Street) => (s === "preflop" ? "pre-flop" : `on the ${s}`)
const cards = (cs: Card[]) => cs.map(cardLabel).join(" ")

// ---------- Draw generator (real cards, enumerated outs) ----------
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
    const now = evaluate([...hero, ...board])
    if (now.cat !== 0) continue
    let outs = 0
    let flushOuts = 0
    let straightOuts = 0
    const straightRankSet = new Set<number>()
    for (const c of deckWithout([...hero, ...board])) {
      const v = evaluate([...hero, ...board, c])
      if (v.cat < 4) continue
      if (evaluate([...board, c]).cat >= 4) continue // the board alone would make it: not a real out
      outs++
      if (v.cat === 5 || v.cat === 8) flushOuts++
      else {
        straightOuts++
        straightRankSet.add(c.r)
      }
    }
    if (outs < minOuts || outs > maxOuts) continue
    if (outs <= 4 && Math.random() < 0.65) continue // gutshots are common; keep the mix varied
    const parts: string[] = []
    if (flushOuts) parts.push("a flush draw")
    if (straightOuts) parts.push(straightRankSet.size >= 2 ? "a two-way straight draw" : "a gutshot straight draw")
    return { hero, board, outs, flushOuts, straightOuts, straightRanks: straightRankSet.size, label: parts.join(" plus ") }
  }
  // Fallback: a textbook nut flush draw.
  const hero = [{ r: 12, s: 1 }, { r: 8, s: 1 }]
  const board = [{ r: 7, s: 1 }, { r: 3, s: 1 }, { r: 0, s: 2 }]
  return { hero, board, outs: 9, flushOuts: 9, straightOuts: 0, straightRanks: 0, label: "a flush draw" }
}

function exactEquity(outs: number, street: "flop" | "turn") {
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
function genPotOdds(): Question {
  const variant = rand(3)
  if (variant === 2) {
    // Draw decision on the turn with real cards.
    const d = generateDraw("turn", 4, 15)
    const { hero, villain } = postflopSeats()
    const eq = d.outs / 46
    let pot = 0
    let bet = 0
    let req = 0
    for (let i = 0; i < 60; i++) {
      pot = pick([20, 30, 40, 50, 60, 80, 100, 120, 150])
      bet = niceBet(pot, pick([0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.5]))
      req = bet / (pot + 2 * bet)
      if (Math.abs(eq - req) >= 0.04) break
    }
    const call = eq > req
    const choices = ["Call", "Fold"]
    return {
      id: nextId(),
      topic: "potOdds",
      scenario: {
        street: "turn",
        hero: d.hero,
        board: d.board,
        heroPos: hero,
        villainPos: villain,
        active: [hero, villain],
        pot,
        bets: { [villain]: bet },
        unit: "$",
      },
      story: `The turn is out and you hold ${cards(d.hero)} in the ${hero} with ${d.label}. There's ${money(pot)} in the pot and the ${villain} bets ${money(bet)}. Assume villain has you beat unless you hit.`,
      prompt: "One card to come. Call or fold?",
      choices,
      answer: call ? 0 : 1,
      explain: `${outsBreakdown(d)} With one card to come that's ${d.outs}/46 ≈ ${pct(eq * 100)} equity. You call ${money(bet)} to win a final pot of ${money(pot + 2 * bet)}, so you need ${pct(req * 100)}. ${call ? "You're getting the right price: call." : "The price is too high: fold."}`,
      formula: "Required equity = call ÷ (pot + bet + call)",
    }
  }
  const pot = pick([20, 30, 40, 50, 60, 75, 80, 100, 120, 150, 200, 240])
  const bet = niceBet(pot, pick([0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.25, 1.5, 2]))
  const street = pick(["flop", "turn", "river"] as const)
  const { hero, villain } = postflopSeats()
  const used = shuffle(fullDeck()).slice(0, 2)
  const board = randomBoard(street, used)
  const scenario: Scenario = {
    street,
    hero: used,
    board,
    heroPos: hero,
    villainPos: villain,
    active: [hero, villain],
    pot,
    bets: { [villain]: bet },
    unit: "$",
  }
  const story = `You're in the ${hero} holding ${cards(used)} ${streetName(street)}. The pot is ${money(pot)} and the ${villain} bets ${money(bet)}.`
  if (variant === 0) {
    const req = (bet / (pot + 2 * bet)) * 100
    const r = Math.round(req)
    const { choices, answer } = buildChoices(
      r,
      [Math.round((bet / (pot + bet)) * 100), Math.round(Math.min(99, (bet / pot) * 100)), r + 6, r - 5, r + 11],
      (v) => pct(v),
    )
    return {
      id: nextId(),
      topic: "potOdds",
      scenario,
      story,
      prompt: "What equity do you need to call?",
      choices,
      answer,
      explain: `You risk ${money(bet)} to win the ${money(pot)} pot plus villain's ${money(bet)} bet. The pot after you call is ${money(pot + 2 * bet)}, so you need ${money(bet)} ÷ ${money(pot + 2 * bet)} = ${pct(req)}.`,
      formula: "Required equity = call ÷ (pot + bet + call)",
    }
  }
  const r = (pot + bet) / bet
  const { choices, answer } = buildChoices(r, [pot / bet, (pot + 2 * bet) / bet, r + 1, Math.max(0.5, r - 1)], ratio)
  return {
    id: nextId(),
    topic: "potOdds",
    scenario,
    story,
    prompt: "What pot odds are you being offered?",
    choices,
    answer,
    explain: `You call ${money(bet)} to win ${money(pot + bet)} (the pot plus the bet). ${money(pot + bet)} ÷ ${money(bet)} = ${ratio(r)}.`,
    formula: "Pot odds = (pot + bet) : call",
  }
}

// ---------- Expected value ----------
function genEV(): Question {
  const variant = rand(3)
  const street = pick(["flop", "turn", "river"] as const)
  const { hero, villain } = postflopSeats()
  const heroCards = shuffle(fullDeck()).slice(0, 2)
  const board = randomBoard(street, heroCards)
  const pot = pick([20, 30, 40, 50, 60, 80, 100, 120, 150, 200])
  const bet = niceBet(pot, pick([0.33, 0.5, 0.66, 0.75, 1, 1.5]))
  if (variant === 0) {
    const eq = pick([20, 25, 30, 35, 40, 45, 50, 55, 60])
    const e = eq / 100
    const ev = Math.round(e * (pot + bet) - (1 - e) * bet)
    const { choices, answer } = buildChoices(
      ev,
      [
        Math.round(e * (pot + 2 * bet) - (1 - e) * bet),
        Math.round(e * pot - (1 - e) * bet),
        -ev,
        ev + Math.max(3, Math.round(bet * 0.4)),
        ev - Math.max(3, Math.round(bet * 0.4)),
      ],
      signedMoney,
    )
    return {
      id: nextId(),
      topic: "ev",
      scenario: { street, hero: heroCards, board, heroPos: hero, villainPos: villain, active: [hero, villain], pot, bets: { [villain]: bet }, unit: "$" },
      story: `${streetName(street)[0].toUpperCase() + streetName(street).slice(1)}, ${money(pot)} in the pot. The ${villain} bets ${money(bet)}. Against villain's range your ${cards(heroCards)} has about ${eq}% equity.`,
      prompt: "What's the EV of calling?",
      choices,
      answer,
      explain: `When you win (${eq}%) you collect ${money(pot + bet)}: the pot plus the bet. When you lose (${100 - eq}%) you lose your ${money(bet)} call. EV = ${e.toFixed(2)} × ${pot + bet} − ${(1 - e).toFixed(2)} × ${bet} = ${signedMoney(ev)}.`,
      formula: "EV(call) = equity × (pot + bet) − (1 − equity) × call",
    }
  }
  if (variant === 1) {
    const fold = pick([25, 30, 35, 40, 45, 50, 55, 60, 65, 70])
    const f = fold / 100
    const ev = Math.round(f * pot - (1 - f) * bet)
    const { choices, answer } = buildChoices(
      ev,
      [Math.round(f * (pot + bet) - (1 - f) * bet), Math.round(f * pot), -ev, ev + Math.max(4, Math.round(bet * 0.5)), ev - Math.max(4, Math.round(bet * 0.5))],
      signedMoney,
    )
    return {
      id: nextId(),
      topic: "ev",
      scenario: { street: "river", hero: heroCards, board: randomBoard("river", heroCards), heroPos: hero, villainPos: villain, active: [hero, villain], pot, bets: { [hero]: bet }, unit: "$" },
      story: `River. You missed with ${cards(heroCards)} and you're considering a ${money(bet)} bluff into ${money(pot)}. You expect the ${villain} to fold ${fold}% of the time, and you lose whenever called.`,
      prompt: "What's the EV of the bluff?",
      choices,
      answer,
      explain: `${fold}% of the time villain folds and you win the ${money(pot)} pot. ${100 - fold}% of the time you're called and lose your ${money(bet)}. EV = ${f.toFixed(2)} × ${pot} − ${(1 - f).toFixed(2)} × ${bet} = ${signedMoney(ev)}.`,
      formula: "EV(bluff) = fold% × pot − (1 − fold%) × bet",
    }
  }
  const be = (bet / (pot + bet)) * 100
  const r = Math.round(be)
  const { choices, answer } = buildChoices(r, [Math.round((bet / (pot + 2 * bet)) * 100), Math.round(Math.min(95, (bet / pot) * 100)), r + 8, r - 7], pct)
  return {
    id: nextId(),
    topic: "ev",
    scenario: { street: "river", hero: heroCards, board: randomBoard("river", heroCards), heroPos: hero, villainPos: villain, active: [hero, villain], pot, bets: { [hero]: bet }, unit: "$" },
    story: `River, ${money(pot)} in the pot. You hold ${cards(heroCards)} with no showdown value and plan to bet ${money(bet)} as a pure bluff against the ${villain}.`,
    prompt: "How often must villain fold for the bluff to break even?",
    choices,
    answer,
    explain: `You risk ${money(bet)} to win ${money(pot)}. Break-even fold frequency = risk ÷ (risk + reward) = ${bet} ÷ ${pot + bet} = ${pct(be)}. Any more folds than that and the bluff prints money.`,
    formula: "Break-even fold% = bet ÷ (pot + bet)",
  }
}

// ---------- Outs & 4-2 ----------
function genOuts(): Question {
  const street = Math.random() < 0.6 ? "flop" : "turn"
  const d = generateDraw(street)
  const { hero, villain } = postflopSeats()
  const scenario: Scenario = {
    street,
    hero: d.hero,
    board: d.board,
    heroPos: hero,
    villainPos: villain,
    active: [hero, villain],
    pot: pick([20, 30, 40, 60, 80, 100]),
    bets: {},
    unit: "$",
  }
  const story = `You hold ${cards(d.hero)} in the ${hero}. The board ${street === "flop" ? "reads" : "runs out to the turn:"} ${cards(d.board)}. Only straights and flushes count as improving.`
  if (Math.random() < 0.5) {
    const { choices, answer } = buildChoices(
      d.outs,
      shuffle([d.outs + 1, d.outs - 1, d.outs + 3, d.outs - 3, 4, 8, 9, 12, 15]).filter((n) => n > 0 && n <= 21),
      (n) => `${n} outs`,
    )
    return {
      id: nextId(),
      topic: "outs",
      scenario,
      story,
      prompt: "How many outs do you have to a straight or a flush?",
      choices,
      answer,
      explain: `You have ${d.label}. ${outsBreakdown(d)}`,
    }
  }
  const mult = street === "flop" ? 4 : 2
  const approx = d.outs * mult
  const exact = exactEquity(d.outs, street)
  const { choices, answer } = buildChoices(
    approx,
    [d.outs * (street === "flop" ? 2 : 4), approx + 6, approx - 5, approx + 10, d.outs],
    (n) => `≈ ${n}%`,
  )
  return {
    id: nextId(),
    topic: "outs",
    scenario,
    story: story + (street === "flop" ? " You'll see both the turn and river." : ""),
    prompt: `Using the 4-2 rule, what's your equity to hit by the river?`,
    choices,
    answer,
    explain: `${outsBreakdown(d)} ${street === "flop" ? "Two cards to come, so multiply by 4" : "One card to come, so multiply by 2"}: ${d.outs} × ${mult} ≈ ${approx}%. The exact figure is ${exact.toFixed(1)}%.`,
    formula: "Flop (2 cards): outs × 4 · Turn (1 card): outs × 2",
  }
}

// ---------- Pre-flop ----------
function sampleHand(range: Record<string, RangeAction>): string {
  if (Math.random() < 0.55) {
    const b = boundaryHands(range)
    if (b.length) return pick(b)
  }
  const total = 1326
  let x = rand(total)
  for (const h of ALL_HANDS) {
    x -= combos(h)
    if (x < 0) return h
  }
  return "AA"
}

const spotChoiceLabel = (spot: Spot, a: RangeAction) => {
  if (!spot.opener) return a === "raise" ? "Raise" : "Fold"
  return a === "raise" ? "3-bet" : a === "call" ? "Call" : "Fold"
}

function genPreflop(): Question {
  const spot = pick(SPOTS)
  const hand = sampleHand(spot.range)
  const hero = dealHandClass(hand)
  const correct = actionFor(spot.range, hand)
  const bets: Partial<Record<Position, number>> = { SB: 0.5, BB: 1 }
  const heroIdx = POSITIONS.indexOf(spot.hero)
  const active: Position[] = [...(spot.opener ? [spot.opener] : []), ...POSITIONS.slice(heroIdx)]
  if (spot.opener) bets[spot.opener] = 2.5
  const choicesA = spot.actions
  const story = spot.opener
    ? `6-max, 100bb deep. The ${spot.opener} opens to 2.5bb and it folds to you in the ${spot.hero} with ${cards(hero)}.`
    : `6-max, 100bb deep. It folds to you in the ${spot.hero} with ${cards(hero)}.`
  const pctOpen = rangePercent(spot.range)
  const verb = spotChoiceLabel(spot, correct).toLowerCase()
  return {
    id: nextId(),
    topic: "preflop",
    scenario: { street: "preflop", hero, board: [], heroPos: spot.hero, villainPos: spot.opener, active, pot: 0, bets, unit: "bb" },
    story,
    prompt: "What's the GTO play?",
    choices: choicesA.map((a) => spotChoiceLabel(spot, a)),
    answer: choicesA.indexOf(correct),
    explain: `${hand} (${describeHand(hand)}) is a ${verb} here. ${spot.opener ? `This ${spot.hero} strategy continues with about ${pctOpen.toFixed(0)}% of hands vs a ${spot.opener} open, 3-betting ${rangePercent(spot.range, "raise").toFixed(0)}%.` : `The ${spot.hero} opening range is about ${pctOpen.toFixed(0)}% of hands.`}`,
  }
}

// ---------- User ranges ----------
export function genRangeQuestion(preset: RangePreset): Question {
  const hand = sampleHand(preset.cells)
  const hero = dealHandClass(hand)
  const correct = actionFor(preset.cells, hand)
  const hasCall = Object.values(preset.cells).includes("call")
  const actions: RangeAction[] = hasCall ? ["raise", "call", "fold"] : ["raise", "fold"]
  return {
    id: nextId(),
    topic: "ranges",
    scenario: { street: "preflop", hero, board: [], heroPos: "BTN", active: ["BTN", "SB", "BB"], pot: 0, bets: { SB: 0.5, BB: 1 }, unit: "bb", caption: preset.name },
    story: `Range: ${preset.name}. You're dealt ${cards(hero)} (${hand}).`,
    prompt: "What does your range do with this hand?",
    choices: actions.map((a) => ACTION_LABEL[a]),
    answer: actions.indexOf(correct),
    explain: `In “${preset.name}”, ${hand} is a ${ACTION_LABEL[correct].toLowerCase()}. The range plays ${rangePercent(preset.cells).toFixed(0)}% of hands.`,
  }
}

export function generateQuestion(topic: DrillTopic): Question {
  const t = topic === "mixed" ? pick(["potOdds", "ev", "outs", "preflop"] as const) : topic
  switch (t) {
    case "potOdds":
      return genPotOdds()
    case "ev":
      return genEV()
    case "outs":
      return genOuts()
    case "preflop":
      return genPreflop()
  }
}

export { CATEGORY, handClass, RANKS }
