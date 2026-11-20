import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { PlayingCard } from "./PlayingCard"
import { ChipStack } from "./Chips"
import { POS_LABEL, seatsFor, type Position } from "@/lib/ranges"
import type { Scenario } from "@/lib/questions"
import { cn } from "@/lib/utils"
import { sfx } from "@/lib/sound"

interface Props {
  scenario: Scenario
  dealKey: string
  className?: string
  verdict?: "right" | "wrong" | null
  quiet?: boolean
}

const DEALER = { x: 50, y: 6 }

export function PokerTable({ scenario, dealKey, className, verdict, quiet }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 720, h: 420 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const hasChips = Object.keys(scenario.bets).length > 0 || scenario.pot > 0
  useEffect(() => {
    if (quiet) return
    sfx.deal()
    const t = hasChips ? window.setTimeout(() => sfx.chips(), 520) : undefined
    return () => window.clearTimeout(t)
  }, [dealKey, quiet, hasChips])

  const compact = box.w < 520
  const positions = seatsFor(scenario.table ?? 6)
  const n = positions.length
  const heroIdx = Math.max(0, positions.indexOf(scenario.heroPos))
  const seats = positions.map((_, i) => positions[(heroIdx + i) % n])
  const step = 360 / n
  const seatPoint = (i: number, r = 1) => {
    const a = ((90 + step * i) * Math.PI) / 180
    return { x: 50 + 47 * r * Math.cos(a), y: 50 + 45 * r * Math.sin(a) }
  }
  const fromDealer = (p: { x: number; y: number }) => ({ x: ((DEALER.x - p.x) / 100) * box.w, y: ((DEALER.y - p.y) / 100) * box.h })
  const potAmount = scenario.pot
  const boardY = compact ? 50 : 47
  const cardSize = compact ? "sm" : "md"
  const heroSize = compact ? "md" : "lg"
  const btnSeat = seats.indexOf("BTN")
  const showStacks = scenario.unit === "bb" && scenario.stack !== undefined

  return (
    <div className={cn("relative w-full", className)}>
      <div ref={ref} className="relative mx-auto aspect-[10/9] w-full sm:aspect-[16/10]">
        <div className="rail absolute inset-[3%_1%] rounded-[999px] shadow-[0_30px_60px_rgba(0,0,0,.55),inset_0_2px_0_rgba(255,255,255,.12)]" />
        <div
          className={cn(
            "felt absolute inset-[7%_4.5%] rounded-[999px] shadow-[inset_0_0_60px_rgba(0,0,0,.55),inset_0_0_0_2px_rgba(0,0,0,.35)] transition-[box-shadow] duration-300",
            verdict === "right" && "shadow-[inset_0_0_60px_rgba(0,0,0,.5),inset_0_0_0_3px_var(--verdigris)]",
            verdict === "wrong" && "shadow-[inset_0_0_60px_rgba(0,0,0,.5),inset_0_0_0_3px_var(--oxblood-bright)]",
          )}
        >
          <div className="pointer-events-none absolute inset-[9%_7%] rounded-[999px] border border-[rgba(239,230,210,.14)]" />
          <span className="pointer-events-none absolute left-1/2 top-[66%] -translate-x-1/2 select-none whitespace-nowrap font-display text-[clamp(14px,2.4vw,22px)] tracking-wide text-[rgba(239,230,210,.12)]">
            {scenario.caption ?? "Felt Lab"}
          </span>
        </div>

        <AnimatePresence mode="popLayout">
          <motion.div key={dealKey} className="absolute inset-0" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}>
            <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1" style={{ top: compact ? "17%" : "22%" }}>
              <span className="rounded-full border border-[rgba(239,230,210,.18)] bg-black/25 px-2.5 text-[12px] font-medium leading-6 text-ivory/80">
                {scenario.street === "preflop" ? "Pre-flop" : scenario.street[0].toUpperCase() + scenario.street.slice(1)}
              </span>
              {potAmount > 0 && <ChipStack amount={potAmount} unit={scenario.unit} from={{ x: 0, y: -30 }} delay={0.1} size={compact ? 18 : 22} />}
            </div>

            <div className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-1 sm:gap-1.5" style={{ top: `${boardY + (potAmount > 0 ? 6 : 0)}%` }}>
              {[0, 1, 2, 3, 4].map((i) => {
                const c = scenario.board[i]
                if (!c) {
                  if (scenario.street === "preflop") return null
                  return (
                    <div
                      key={i}
                      className="rounded-[6px] border border-dashed border-[rgba(239,230,210,.18)]"
                      style={{ width: `calc(${compact ? 38 : 52}px * var(--card-scale, 1))`, height: `calc(${compact ? 54 : 74}px * var(--card-scale, 1))` }}
                    />
                  )
                }
                return <PlayingCard key={i} card={c} size={cardSize} delay={0.35 + i * 0.09} from={{ x: (i - 2) * -40, y: -box.h * 0.35 }} />
              })}
            </div>

            {seats.map((pos, i) => {
              const p = seatPoint(i)
              const active = scenario.active.includes(pos)
              const isHero = i === 0
              const isVillain = pos === scenario.villainPos
              const bet = scenario.bets[pos]
              const betPt = isHero ? { x: 64, y: 70 } : seatPoint(i, 0.6)
              const faceUp = isVillain && scenario.villainCards
              return (
                <div key={pos}>
                  {!isHero && (
                    <Seat pos={pos} active={active} villain={isVillain} x={p.x} y={p.y} compact={compact || n > 6} stack={showStacks && active ? scenario.stack : undefined}>
                      {active &&
                        (faceUp ? (
                          <div className="flex gap-0.5">
                            {scenario.villainCards!.map((c, k) => (
                              <PlayingCard key={k} card={c} size="sm" delay={0.1 + k * 0.08} from={fromDealer(p)} />
                            ))}
                          </div>
                        ) : (
                          <div className="flex -space-x-3">
                            <PlayingCard faceDown size="xs" delay={0.05 + i * 0.04} from={fromDealer(p)} />
                            <PlayingCard faceDown size="xs" delay={0.1 + i * 0.04} from={fromDealer(p)} className="rotate-6" />
                          </div>
                        ))}
                    </Seat>
                  )}
                  {bet !== undefined && bet > 0 && (
                    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${betPt.x}%`, top: `${betPt.y}%` }}>
                      <ChipStack
                        amount={bet}
                        unit={scenario.unit}
                        from={{ x: ((p.x - betPt.x) / 100) * box.w, y: ((p.y - betPt.y) / 100) * box.h }}
                        delay={0.55}
                        size={compact ? 16 : 20}
                      />
                    </div>
                  )}
                </div>
              )
            })}

            {btnSeat >= 0 && (
              <div
                className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#f6efe0] text-[11px] font-bold text-[#1d140a] shadow-[0_2px_6px_rgba(0,0,0,.5),inset_0_-2px_0_rgba(0,0,0,.15)]"
                style={(() => {
                  if (btnSeat === 0) return { left: compact ? "24%" : "33%", top: "79%" }
                  const a = ((90 + step * btnSeat + step * 0.36) * Math.PI) / 180
                  return { left: `${50 + 36 * Math.cos(a)}%`, top: `${50 + 33 * Math.sin(a)}%` }
                })()}
                aria-label="Dealer button"
              >
                D
              </div>
            )}

            <div className="absolute left-1/2 top-[100%] flex -translate-x-1/2 -translate-y-[88%] flex-col items-center gap-1">
              <div className="flex gap-1.5">
                {scenario.hero.map((c, i) => (
                  <PlayingCard key={i} card={c} size={heroSize} delay={0.08 + i * 0.12} from={fromDealer({ x: 50, y: 92 })} className={i === 0 ? "-rotate-3" : "rotate-3"} />
                ))}
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-brass/50 bg-[rgba(14,33,27,.92)] px-3 py-0.5 text-[13px] font-semibold">
                <span className="text-brass">{POS_LABEL[scenario.heroPos]}</span>
                <span className="text-ivory/85">You</span>
                {showStacks && <span className="font-normal text-ivory-dim">{scenario.stack}bb</span>}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function Seat({
  pos,
  active,
  villain,
  x,
  y,
  compact,
  stack,
  children,
}: {
  pos: Position
  active: boolean
  villain: boolean
  x: number
  y: number
  compact: boolean
  stack?: number
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn("absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 transition-opacity", !active && "opacity-45")}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {children}
      <div
        className={cn(
          "flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-[rgba(14,33,27,.92)] font-semibold",
          compact ? "px-2 text-[11px] leading-5" : "px-2.5 text-[12px] leading-6",
          villain ? "border-oxblood-bright/60" : "border-[rgba(239,230,210,.16)]",
        )}
      >
        <span className={villain ? "text-oxblood-bright" : "text-ivory/90"}>{POS_LABEL[pos]}</span>
        {!active && <span className="font-normal text-ivory-dim">folded</span>}
        {active && stack !== undefined && <span className="font-normal text-ivory-dim">{stack}bb</span>}
      </div>
    </div>
  )
}
