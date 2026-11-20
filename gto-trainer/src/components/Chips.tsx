import { motion, useReducedMotion } from "framer-motion"

const DENOMS = [
  { v: 100, c: "var(--chip-black)", edge: "#d8cdb4" },
  { v: 25, c: "var(--chip-green)", edge: "#f1e9d6" },
  { v: 5, c: "var(--chip-red)", edge: "#f1e9d6" },
  { v: 1, c: "var(--chip-blue)", edge: "#f1e9d6" },
  { v: 0.5, c: "var(--chip-white)", edge: "#2f5ea6" },
]

function breakdown(amount: number, unit: "$" | "bb") {
  // Map bb to a $ scale so small blind amounts still produce a few chips.
  let rest = unit === "bb" ? amount * 2 : amount
  const out: { c: string; edge: string }[] = []
  for (const d of DENOMS) {
    while (rest >= d.v - 1e-9 && out.length < 14) {
      out.push({ c: d.c, edge: d.edge })
      rest -= d.v
    }
  }
  return out
}

export function Chip({ color, edge, size = 22 }: { color: string; edge: string; size?: number }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 40 25" aria-hidden="true">
      <ellipse cx="20" cy="15" rx="19" ry="9" fill="rgba(0,0,0,.35)" />
      <ellipse cx="20" cy="12" rx="19" ry="9.5" fill={color} />
      <ellipse cx="20" cy="12" rx="19" ry="9.5" fill="none" stroke={edge} strokeWidth="2.4" strokeDasharray="5 6.4" />
      <ellipse cx="20" cy="11.5" rx="11" ry="5.2" fill="none" stroke={edge} strokeOpacity=".7" strokeWidth="1" />
    </svg>
  )
}

interface StackProps {
  amount: number
  unit: "$" | "bb"
  from?: { x: number; y: number }
  delay?: number
  label?: boolean
  size?: number
}

export function ChipStack({ amount, unit, from, delay = 0, label = true, size = 22 }: StackProps) {
  const reduce = useReducedMotion()
  const chips = breakdown(amount, unit)
  const cols: (typeof chips)[] = []
  chips.forEach((ch, i) => {
    const col = Math.floor(i / 5)
    ;(cols[col] ??= []).push(ch)
  })
  const text = unit === "bb" ? `${amount}bb` : `$${amount}`
  return (
    <motion.div
      className="flex flex-col items-center gap-0.5"
      initial={reduce || !from ? false : { x: from.x, y: from.y, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      transition={{ delay, type: "spring", stiffness: 180, damping: 20 }}
    >
      <div className="flex items-end gap-0.5">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col-reverse">
            {col.map((ch, i) => (
              <div key={i} style={{ marginTop: i === col.length - 1 ? 0 : -size * 0.44 }}>
                <Chip color={ch.c} edge={ch.edge} size={size} />
              </div>
            ))}
          </div>
        ))}
      </div>
      {label && (
        <span className="rounded-full bg-black/45 px-2 py-px text-[12px] font-semibold leading-5 text-ivory backdrop-blur-sm">{text}</span>
      )}
    </motion.div>
  )
}
