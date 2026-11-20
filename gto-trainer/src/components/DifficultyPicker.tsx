import { motion } from "framer-motion"
import { DIFFICULTIES, type Difficulty } from "@/lib/questions"
import { cn } from "@/lib/utils"

const LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" }

export function DifficultyPicker({ value, onChange, id = "difficulty" }: { value: Difficulty; onChange: (d: Difficulty) => void; id?: string }) {
  return (
    <div role="radiogroup" aria-label="Difficulty" className="inline-flex rounded-full border border-line bg-panel p-1">
      {DIFFICULTIES.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={value === d}
          onClick={() => onChange(d)}
          className={cn("relative min-h-[36px] cursor-pointer rounded-full px-3.5 text-[13px] font-semibold", value === d ? "text-[#1d140a]" : "text-ivory/75 hover:text-ivory")}
        >
          {value === d && <motion.span layoutId={`${id}-pill`} className="btn-brass absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          <span className="relative">{LABEL[d]}</span>
        </button>
      ))}
    </div>
  )
}
