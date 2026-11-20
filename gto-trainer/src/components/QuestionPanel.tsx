import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, X } from "lucide-react"
import type { Question } from "@/lib/questions"
import { TOPIC_META } from "@/lib/questions"
import { cn } from "@/lib/utils"

interface Props {
  q: Question
  selected: number | null
  onSelect: (i: number) => void
  onNext?: () => void
  showExplain?: boolean
  locked?: boolean
  nextLabel?: string
  compact?: boolean
}

export function QuestionPanel({ q, selected, onSelect, onNext, showExplain = true, locked, nextLabel = "Deal next hand", compact }: Props) {
  const answered = selected !== null
  const right = answered && selected === q.answer

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return
      if (!answered && !locked) {
        const n = Number(e.key)
        if (n >= 1 && n <= q.choices.length) {
          e.preventDefault()
          onSelect(n - 1)
        }
      } else if (answered && onNext && (e.key === "Enter" || e.key === " ")) {
        if (t?.tagName === "BUTTON") return
        e.preventDefault()
        onNext()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [answered, locked, onNext, onSelect, q.choices.length])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-brass">{TOPIC_META[q.topic].name}</span>
        <p className={cn("max-w-[62ch] text-ivory/85", compact ? "text-[15px]" : "text-[16px]")}>{q.story}</p>
        <h2 className={cn("font-display leading-tight text-ivory", compact ? "text-[22px]" : "text-[26px] sm:text-[30px]")}>{q.prompt}</h2>
      </div>

      <div className={cn("grid gap-2", q.choices.length === 2 ? "grid-cols-2" : q.choices.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {q.choices.map((c, i) => {
          const isAnswer = i === q.answer
          const isPicked = i === selected
          const state = !answered ? "idle" : isAnswer ? "correct" : isPicked ? "wrong" : "dim"
          return (
            <motion.button
              key={q.id + i}
              type="button"
              disabled={answered || locked}
              onClick={() => onSelect(i)}
              whileTap={answered ? undefined : { scale: 0.97 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.25 + i * 0.04 } }}
              className={cn(
                "group relative flex min-h-[52px] items-center justify-between gap-2 rounded-[14px] border px-4 py-3 text-left text-[17px] font-semibold transition-colors",
                state === "idle" && "cursor-pointer border-line bg-panel-2 hover:border-brass/60 hover:bg-[#1f3e31]",
                state === "correct" && "border-verdigris bg-[rgba(99,201,160,.14)] text-ivory",
                state === "wrong" && "border-oxblood-bright bg-[rgba(158,38,56,.28)] text-ivory",
                state === "dim" && "border-line bg-panel opacity-55",
              )}
            >
              <span>{c}</span>
              <span className="flex items-center">
                {state === "correct" && <Check className="h-5 w-5 text-verdigris" aria-label="Correct answer" />}
                {state === "wrong" && <X className="h-5 w-5 text-oxblood-bright" aria-label="Your answer" />}
                {state === "idle" && (
                  <kbd className="hidden rounded-md border border-line px-1.5 text-[12px] font-medium text-ivory-dim sm:inline">{i + 1}</kbd>
                )}
              </span>
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence initial={false}>
        {answered && showExplain && (
          <motion.div
            key="explain"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className={cn("rounded-[14px] border p-4", right ? "border-verdigris/40 bg-[rgba(99,201,160,.07)]" : "border-oxblood-bright/40 bg-[rgba(158,38,56,.12)]")}>
              <p className={cn("mb-1 font-display text-[20px]", right ? "text-verdigris" : "text-oxblood-bright")}>
                {right ? "Correct." : `Not quite. The answer is ${q.choices[q.answer]}.`}
              </p>
              <p className="max-w-[65ch] text-[15px] leading-relaxed text-ivory/85">{q.explain}</p>
              {q.formula && <p className="mt-2 text-[13px] text-ivory-dim">{q.formula}</p>}
            </div>
            {onNext && (
              <button type="button" onClick={onNext} className="btn-brass mt-3 inline-flex min-h-[48px] items-center rounded-full px-6 text-[16px] font-semibold">
                {nextLabel}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
