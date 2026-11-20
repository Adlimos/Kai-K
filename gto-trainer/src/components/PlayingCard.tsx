import { motion, useReducedMotion } from "framer-motion"
import { type Card, RANKS, SUITS, SUIT_GLYPH, SUIT_NAME, RANK_NAME } from "@/lib/cards"

type Size = "xs" | "sm" | "md" | "lg"
const DIM: Record<Size, { w: number; h: number; rank: number; pip: number; corner: number }> = {
  xs: { w: 26, h: 37, rank: 13, pip: 12, corner: 4 },
  sm: { w: 38, h: 54, rank: 17, pip: 18, corner: 5 },
  md: { w: 52, h: 74, rank: 22, pip: 28, corner: 6 },
  lg: { w: 64, h: 90, rank: 27, pip: 34, corner: 7 },
}

interface Props {
  card?: Card
  faceDown?: boolean
  size?: Size
  delay?: number
  from?: { x: number; y: number }
  highlight?: boolean
  className?: string
}

const rankText = (r: number) => (RANKS[r] === "T" ? "10" : RANKS[r])

export function PlayingCard({ card, faceDown, size = "md", delay = 0, from = { x: 0, y: -120 }, highlight, className }: Props) {
  const d = DIM[size]
  const reduce = useReducedMotion()
  const suit = card ? SUITS[card.s] : "s"
  const color = `var(--suit-${suit})`
  const label = card && !faceDown ? `${RANK_NAME[card.r]} of ${SUIT_NAME[suit]}` : "face-down card"
  return (
    <motion.div
      role="img"
      aria-label={label}
      className={className}
      style={{ width: `calc(${d.w}px * var(--card-scale, 1))`, height: `calc(${d.h}px * var(--card-scale, 1))`, perspective: 600 }}
      initial={reduce ? false : { x: from.x, y: from.y, opacity: 0, rotate: -12, scale: 0.8 }}
      animate={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 24 }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        initial={reduce ? false : { rotateY: faceDown ? 180 : 180 }}
        animate={{ rotateY: faceDown ? 180 : 0 }}
        transition={{ delay: delay + 0.18, duration: 0.42, ease: [0.2, 0.7, 0.2, 1] }}
      >
        {/* face */}
        <div
          className="absolute inset-0 select-none overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            borderRadius: d.corner,
            background: "linear-gradient(160deg, #fffaf0, var(--card) 60%, #ece3cf)",
            boxShadow: highlight
              ? "0 0 0 2px var(--brass), 0 6px 14px rgba(0,0,0,.45)"
              : "0 1px 0 rgba(255,255,255,.6) inset, 0 6px 14px rgba(0,0,0,.4)",
          }}
        >
          {card && (
            <>
              <div className="absolute left-[9%] top-[5%] flex flex-col items-center leading-none" style={{ color }}>
                <span className="font-display" style={{ fontSize: `calc(${d.rank}px * var(--card-scale, 1))`, letterSpacing: card.r === 8 ? "-0.06em" : 0 }}>
                  {rankText(card.r)}
                </span>
                <span style={{ fontSize: `calc(${d.rank * 0.72}px * var(--card-scale, 1))`, marginTop: 1 }}>{SUIT_GLYPH[suit]}</span>
              </div>
              <span className="absolute bottom-[4%] right-[8%] leading-none" style={{ color, fontSize: `calc(${d.pip}px * var(--card-scale, 1))` }}>
                {SUIT_GLYPH[suit]}
              </span>
            </>
          )}
        </div>
        {/* back */}
        <div
          className="absolute inset-0"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderRadius: d.corner,
            border: "2px solid #f3ead6",
            background:
              "repeating-linear-gradient(45deg, #7d1d2c 0 3px, #8f2535 3px 6px), repeating-linear-gradient(-45deg, transparent 0 3px, rgba(255,255,255,.08) 3px 6px)",
            boxShadow: "inset 0 0 0 3px #7d1d2c, inset 0 0 0 4px rgba(243,234,214,.55), 0 6px 14px rgba(0,0,0,.4)",
          }}
        />
      </motion.div>
    </motion.div>
  )
}

export function CardRow({ cards, size = "sm" }: { cards: Card[]; size?: Size }) {
  return (
    <span className="inline-flex gap-1 align-middle">
      {cards.map((c, i) => (
        <PlayingCard key={i} card={c} size={size} from={{ x: 0, y: 0 }} />
      ))}
    </span>
  )
}
