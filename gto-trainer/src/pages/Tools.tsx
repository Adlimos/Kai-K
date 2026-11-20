import { useMemo, useState } from "react"
import { RotateCcw } from "lucide-react"
import { EvCalc, OutsCalc, PotOddsCalc, SprCalc } from "@/components/Calculators"
import { PlayingCard } from "@/components/PlayingCard"
import { type Card, RANKS, SUITS, SUIT_GLYPH, cardId } from "@/lib/cards"
import { equityHandVsHand, equityVsCombos, rangeCombos, type EquityResult } from "@/lib/equity"
import { builtInPresets, rangePercent } from "@/lib/ranges"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

type Slot = { group: "hero" | "villain" | "board"; idx: number }
const BUILT = builtInPresets()

export function Tools() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-[34px] leading-none sm:text-[42px]">Calculators</h1>
        <p className="mt-2 max-w-[60ch] text-ivory-dim">Check your own hands and numbers. Everything runs in your browser.</p>
      </header>
      <EquityCalc />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Pot odds, MDF and bluff break-even">
          <PotOddsCalc />
        </Section>
        <Section title="Expected value">
          <EvCalc />
        </Section>
        <Section title="Outs to equity">
          <OutsCalc />
        </Section>
        <Section title="Stack-to-pot ratio">
          <SprCalc />
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel flex flex-col gap-4 p-5 sm:p-6">
      <h2 className="font-display text-[24px]">{title}</h2>
      {children}
    </section>
  )
}

function EquityCalc() {
  const { data } = useStore()
  const [hero, setHero] = useState<(Card | null)[]>([null, null])
  const [villain, setVillain] = useState<(Card | null)[]>([null, null])
  const [board, setBoard] = useState<(Card | null)[]>([null, null, null, null, null])
  const [mode, setMode] = useState<"hand" | "range">("hand")
  const presets = useMemo(() => [...data.presets, ...BUILT], [data.presets])
  const [presetId, setPresetId] = useState(BUILT[3]?.id ?? "")
  const [active, setActive] = useState<Slot>({ group: "hero", idx: 0 })
  const [result, setResult] = useState<EquityResult | null>(null)
  const [busy, setBusy] = useState(false)

  const used = new Set([...hero, ...villain, ...board].filter(Boolean).map((c) => cardId(c!)))
  const groups = { hero, villain, board }
  const setters = { hero: setHero, villain: setVillain, board: setBoard }

  const place = (c: Card) => {
    if (used.has(cardId(c))) return
    const arr = [...groups[active.group]]
    arr[active.idx] = c
    setters[active.group](arr)
    setResult(null)
    // advance to the next empty slot
    const order: Slot[] = [
      { group: "hero", idx: 0 },
      { group: "hero", idx: 1 },
      ...(mode === "hand" ? [{ group: "villain" as const, idx: 0 }, { group: "villain" as const, idx: 1 }] : []),
      ...[0, 1, 2, 3, 4].map((i) => ({ group: "board" as const, idx: i })),
    ]
    const filled = (s: Slot) => (s.group === active.group && s.idx === active.idx ? true : !!groups[s.group][s.idx])
    const next = order.find((s) => !filled(s))
    if (next) setActive(next)
  }

  const boardCards = board.filter(Boolean) as Card[]
  const boardValid = [0, 3, 4, 5].includes(boardCards.length) && board.slice(0, boardCards.length).every(Boolean)
  const heroReady = hero.every(Boolean)
  const villainReady = mode === "range" || villain.every(Boolean)
  const preset = presets.find((p) => p.id === presetId)

  const run = () => {
    if (!heroReady || !villainReady || !boardValid) return
    setBusy(true)
    window.setTimeout(() => {
      const h = hero as Card[]
      const r =
        mode === "hand"
          ? equityHandVsHand(h, villain as Card[], boardCards, 40000)
          : equityVsCombos(h, boardCards, rangeCombos(preset?.cells ?? {}, [...h, ...boardCards]), boardCards.length === 5 ? 0 : 20000)
      setResult(r)
      setBusy(false)
    }, 30)
  }

  const reset = () => {
    setHero([null, null])
    setVillain([null, null])
    setBoard([null, null, null, null, null])
    setActive({ group: "hero", idx: 0 })
    setResult(null)
  }

  const slot = ({ group, idx, label }: Slot & { label: string }) => {
    const c = groups[group][idx]
    const on = active.group === group && active.idx === idx
    return (
      <button
        type="button"
        onClick={() => {
          if (c && on) {
            const arr = [...groups[group]]
            arr[idx] = null
            setters[group](arr)
            setResult(null)
          }
          setActive({ group, idx })
        }}
        aria-label={`${label}${c ? `, ${RANKS[c.r]} of ${SUITS[c.s]}` : ", empty"}${on ? ", selected" : ""}`}
        className={cn("grid cursor-pointer place-items-center rounded-[8px] transition-shadow", on && "ring-2 ring-brass ring-offset-2 ring-offset-panel")}
        style={{ width: 52, height: 74 }}
      >
        {c ? <PlayingCard card={c} size="md" from={{ x: 0, y: 0 }} /> : <span className="h-full w-full rounded-[8px] border border-dashed border-ivory/25" />}
      </button>
    )
  }

  return (
    <section className="panel flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[24px]">Equity calculator</h2>
        <button type="button" onClick={reset} className="btn-ghost inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full px-4 text-[14px] font-semibold">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Clear cards
        </button>
      </div>
      <div className="grid gap-5 md:grid-cols-[auto_auto_1fr]">
        <div>
          <div className="mb-2 text-[14px] text-ivory-dim">Your hand</div>
          <div className="flex gap-2">
            {slot({ group: "hero", idx: 0, label: "Your first card" })}
            {slot({ group: "hero", idx: 1, label: "Your second card" })}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-[14px] text-ivory-dim">
            Against
            <span className="inline-flex rounded-full border border-line p-0.5">
              {(["hand", "range"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => (setMode(m), setResult(null))} className={cn("cursor-pointer rounded-full px-2.5 py-0.5 text-[13px] font-semibold", mode === m ? "bg-panel-2 text-ivory" : "text-ivory-dim")}>
                  {m === "hand" ? "a hand" : "a range"}
                </button>
              ))}
            </span>
          </div>
          {mode === "hand" ? (
            <div className="flex gap-2">
              {slot({ group: "villain", idx: 0, label: "Opponent's first card" })}
              {slot({ group: "villain", idx: 1, label: "Opponent's second card" })}
            </div>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="sr-only">Opponent range</span>
              <select
                id="equity-range"
                value={presetId}
                onChange={(e) => (setPresetId(e.target.value), setResult(null))}
                className="min-h-[46px] rounded-[12px] border border-line bg-ink px-3 text-ivory outline-none focus:border-brass"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({rangePercent(p.cells).toFixed(0)}%)
                  </option>
                ))}
              </select>
              <span className="text-[13px] text-ivory-dim">Raise and call hands both count.</span>
            </label>
          )}
        </div>
        <div className="min-w-0">
          <div className="mb-2 text-[14px] text-ivory-dim">Board (optional: flop, turn or river)</div>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i}>{slot({ group: "board", idx: i, label: `Board card ${i + 1}` })}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[520px] gap-1" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }} role="group" aria-label="Pick a card">
          {[0, 1, 2, 3].map((s) =>
            [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((r) => {
              const c = { r, s }
              const taken = used.has(cardId(c))
              return (
                <button
                  key={`${r}${s}`}
                  type="button"
                  disabled={taken}
                  onClick={() => place(c)}
                  className={cn("min-h-[38px] cursor-pointer rounded-[6px] bg-[var(--card)] text-[14px] font-bold disabled:cursor-not-allowed disabled:opacity-20")}
                  style={{ color: `var(--suit-${SUITS[s]})` }}
                  aria-label={`${RANKS[r]} of ${SUITS[s]}`}
                >
                  {RANKS[r]}
                  {SUIT_GLYPH[SUITS[s]]}
                </button>
              )
            }),
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={run}
          disabled={!heroReady || !villainReady || !boardValid || busy}
          className="btn-brass min-h-[50px] cursor-pointer rounded-full px-7 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Calculating…" : "Calculate equity"}
        </button>
        {!boardValid && <span className="text-[14px] text-oxblood-bright">Fill the board left to right with 3, 4 or 5 cards, or leave it empty.</span>}
        {result && (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="font-display text-[40px] leading-none text-brass">{(result.equity * 100).toFixed(1)}%</span>
            <span className="text-ivory-dim">
              win {(result.win * 100).toFixed(1)}%, tie {(result.tie * 100).toFixed(1)}%, {result.exact ? "exact" : `${result.samples.toLocaleString()} simulated runouts`}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
