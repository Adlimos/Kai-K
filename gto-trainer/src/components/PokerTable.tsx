import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { PlayingCard } from "./PlayingCard"
import { ChipStack } from "./Chips"
import { POSITIONS, type Position } from "@/lib/ranges"
import type { Scenario } from "@/lib/questions"
import { cn } from "@/lib/utils"

interface Props {
  scenario: Scenario
  dealKey: string
  className?: string
  /** Highlight state for the felt after an answer. */
  verdict?: "right" | "wrong" | null
}

const DEALER = { x: 50, y: 6 }

function seatPoint(i: number, r = 1) {
  const a = ((90 + 60 * i) * Math.PI) / 180
  return { x: 50 + 47 * r * Math.cos(a), y: 50 + 45 * r * Math.sin(a) }
}

export function PokerTable({ scenario, dealKey, className, verdict }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 720, h: 420 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const compact = box.w < 520
  const heroIdx = POSITIONS.indexOf(scenario.heroPos)
  const seats = POSITIONS.map((_, i) => POSITIONS[(heroIdx + i) % 6])
  const fromDealer = (p: { x: number; y: number }) => ({ x: ((DEALER.x - p.x) / 100) * box.w, y: ((DEALER.y - p.y) / 100) * box.h })
  const potAmount = scenario.pot
  const boardY = compact ? 50 : 47
  const cardSize = compact ? "sm" : "md"
  const heroSize = compact ? "md" : "lg"
  const btnSeat = seats.indexOf("BTN")

  return (
    <div className={cn("relative w-full", className)}>
      <div ref={ref} className="relative mx-auto aspect-[10/9] w-full sm:aspect-[16/10]">
        {/* rail + felt */}
        <div className="rail absolute inset-[3%_1%] rounded-[999px] shadow-[0_30px_60px_rgba(0,0,0,.55),inset_0_2px_0_rgba(255,255,255,.12)]" />
        <div
          className={cn(
            "felt absolute inset-[7%_4.5%] rounded-[999px] shadow-[inset_0_0_60px_rgba(0,0,0,.55),inset_0_0_0_2px_rgba(0,0,0,.35)] transition-[box-shadow] duration-300",
            verdict === "right" && "shadow-[inset_0_0_60px_rgba(0,0,0,.5),inset_0_0_0_3px_var(--verdigris)]",
            verdict === "wrong" && "shadow-[inset_0_0_60px_rgba(0,0,0,.5),inset_0_0_0_3px_var(--oxblood-bright)]",
          )}
        >
          <div className="pointer-events-none absolute inset-[9%_7%] rounded-[999px] border border-[rgba(239,230,210,.14)]" />
          <span className="pointer-events-none absolute left-1/2 top-[66%] -translate-x-1/2 select-none font-display text-[clamp(14px,2.4vw,22px)] tracking-wide text-[rgba(239,230,210,.12)]">
            {scenario.caption ?? "Felt Lab"}
          </span>
        </div>

        <AnimatePresence mode="popLayout">
          <motion.div
            key={dealKey}
            className="absolute inset-0"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
          >
            {/* Street + pot */}
            <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1" style={{ top: compact ? "17%" : "22%" }}>
              <span className="rounded-full border border-[rgba(239,230,210,.18)] bg-black/25 px-2.5 text-[12px] font-medium leading-6 text-ivory/80">
                {scenario.street === "preflop" ? "Pre-flop" : scenario.street[0].toUpperCase() + scenario.street.slice(1)}
              </span>
              {potAmount > 0 && (
                <ChipStack amount={potAmount} unit={scenario.unit} from={{ x: 0, y: -30 }} delay={0.1} size={compact ? 18 : 22} />
              )}
            </div>

            {/* Board */}
            <div className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-1 sm:gap-1.5" style={{ top: `${boardY + (potAmount > 0 ? 6 : 0)}%` }}>
              {[0, 1, 2, 3, 4].map((i) => {
                const c = scenario.board[i]
                if (!c) {
                  if (scenario.street === "preflop") return null
                  return (
                    <div
                      key={i}
                      className="rounded-[6px] border border-dashed border-[rgba(239,230,210,.18)]"
                      style={{ width: compact ? 38 : 52, height: compact ? 54 : 74 }}
                    />
                  )
                }
                return <PlayingCard key={i} card={c} size={cardSize} delay={0.35 + i * 0.09} from={{ x: (i - 2) * -40, y: -box.h * 0.35 }} />
              })}
            </div>

            {/* Seats */}
            {seats.map((pos, i) => {
              const p = seatPoint(i)
              const active = scenario.active.includes(pos)
              const isHero = i === 0
              const isVillain = pos === scenario.villainPos
              const bet = scenario.bets[pos]
              const betPt = seatPoint(i, isHero ? 0.5 : 0.6)
              return (
                <div key={pos}>
                  {!isHero && (
                    <Seat pos={pos} active={active} villain={isVillain} x={p.x} y={p.y} compact={compact}>
                      {active && (
                        <div className="flex -space-x-3">
                          <PlayingCard faceDown size="xs" delay={0.05 + i * 0.04} from={fromDealer(p)} />
                          <PlayingCard faceDown size="xs" delay={0.1 + i * 0.04} from={fromDealer(p)} className="rotate-6" />
                        </div>
                      )}
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

            {/* Dealer button */}
            {btnSeat >= 0 && (
              <motion.div
                className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#f6efe0] text-[11px] font-bold text-[#1d140a] shadow-[0_2px_6px_rgba(0,0,0,.5),inset_0_-2px_0_rgba(0,0,0,.15)]"
                style={(() => {
                  const a = ((90 + 60 * btnSeat + 22) * Math.PI) / 180
                  return { left: `${50 + 36 * Math.cos(a)}%`, top: `${50 + 33 * Math.sin(a)}%` }
                })()}
                layout
                aria-label="Dealer button"
              >
                D
              </motion.div>
            )}

            {/* Hero */}
            <div className="absolute left-1/2 top-[100%] flex -translate-x-1/2 -translate-y-[88%] flex-col items-center gap-1">
              <div className="flex gap-1.5">
                {scenario.hero.map((c, i) => (
                  <PlayingCard key={i} card={c} size={heroSize} delay={0.08 + i * 0.12} from={fromDealer({ x: 50, y: 92 })} className={i === 0 ? "-rotate-3" : "rotate-3"} />
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-brass/50 bg-[rgba(14,33,27,.92)] px-3 py-0.5 text-[13px] font-semibold">
                <span className="text-brass">{scenario.heroPos}</span>
                <span className="text-ivory/85">You</span>
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
  children,
}: {
  pos: Position
  active: boolean
  villain: boolean
  x: number
  y: number
  compact: boolean
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
          "flex items-center gap-1.5 rounded-full border bg-[rgba(14,33,27,.92)] font-semibold",
          compact ? "px-2 text-[11px] leading-5" : "px-2.5 text-[12px] leading-6",
          villain ? "border-oxblood-bright/60" : "border-[rgba(239,230,210,.16)]",
        )}
      >
        <span className={villain ? "text-oxblood-bright" : "text-ivory/90"}>{pos}</span>
        {!active && <span className="font-normal text-ivory-dim">folded</span>}
      </div>
    </div>
  )
}
