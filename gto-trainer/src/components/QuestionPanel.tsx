import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, Link2, X } from "lucide-react"
import { type Question, TOPIC_META, isCorrect, shareCode } from "@/lib/questions"
import { cn } from "@/lib/utils"
import { HelpButton } from "./Help"
import { sfx } from "@/lib/sound"

export const SHARE_BASE = "https://claude.ai/artifact/UhTR4hiSM9i9b6M3gtXK2Y"

interface Props {
  q: Question
  selected: number | null
  onSelect: (i: number) => void
  onNext?: () => void
  showExplain?: boolean
  locked?: boolean
  nextLabel?: string
  compact?: boolean
  help?: boolean
  share?: boolean
  quiet?: boolean
}

export function QuestionPanel({ q, selected, onSelect, onNext, showExplain = true, locked, nextLabel = "Deal next hand", compact, help = true, share = true, quiet }: Props) {
  const answered = selected !== null
  const right = answered && isCorrect(q, selected)

  useEffect(() => {
    if (!answered || quiet) return
    if (right) sfx.right()
    else sfx.wrong()
  }, [answered, right, quiet])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return
      if (document.querySelector('[role="dialog"]')) return
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

  const long = q.choices.some((c) => c.length > 18)
  const cols = long ? "grid-cols-1" : q.choices.length === 2 ? "grid-cols-2" : q.choices.length === 3 ? "grid-cols-3" : "grid-cols-2"

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-brass">
            {TOPIC_META[q.topic].name}
            <span className="text-ivory-dim"> {q.difficulty !== "medium" ? `(${q.difficulty})` : ""}</span>
          </span>
          {help && <HelpButton kind={q.kind} />}
        </div>
        <p className={cn("max-w-[62ch] text-ivory/85", compact ? "text-[15px]" : "text-[16px]")}>{q.story}</p>
        <h2 className={cn("font-display leading-tight text-ivory", compact ? "text-[22px]" : "text-[26px] sm:text-[30px]")}>{q.prompt}</h2>
      </div>

      <div className={cn("grid gap-2", cols)}>
        {q.choices.map((c, i) => {
          const good = isCorrect(q, i)
          const isPicked = i === selected
          const state = !answered ? "idle" : good ? "correct" : isPicked ? "wrong" : "dim"
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
                "group relative flex min-h-[52px] items-center justify-between gap-2 rounded-[14px] border px-4 py-3 text-left font-semibold transition-colors",
                long ? "text-[15.5px]" : "text-[17px]",
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
                {state === "idle" && <kbd className="hidden rounded-md border border-line px-1.5 text-[12px] font-medium text-ivory-dim sm:inline">{i + 1}</kbd>}
              </span>
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence initial={false}>
        {answered && showExplain && (
          <motion.div key="explain" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className={cn("rounded-[14px] border p-4", right ? "border-verdigris/40 bg-[rgba(99,201,160,.07)]" : "border-oxblood-bright/40 bg-[rgba(158,38,56,.12)]")}>
              <p className={cn("mb-1 font-display text-[20px]", right ? "text-verdigris" : "text-oxblood-bright")}>
                {right ? (q.accept?.length ? "Correct. This hand is mixed." : "Correct.") : `Not quite. The answer is ${q.choices[q.answer]}.`}
              </p>
              {q.freqs && q.freqs.length > 1 && <FreqBar freqs={q.freqs} />}
              <p className="max-w-[65ch] text-[15px] leading-relaxed text-ivory/85">{q.explain}</p>
              {q.formula && <p className="mt-2 text-[13px] text-ivory-dim">{q.formula}</p>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {onNext && (
                <button type="button" onClick={onNext} className="btn-brass inline-flex min-h-[48px] cursor-pointer items-center rounded-full px-6 text-[16px] font-semibold">
                  {nextLabel}
                </button>
              )}
              {share && q.kind !== "range" && <ShareHand q={q} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FreqBar({ freqs }: { freqs: { label: string; pct: number }[] }) {
  const colors = ["var(--act-raise)", "var(--act-call)", "var(--ivory-dim)"]
  return (
    <div className="my-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full" role="img" aria-label={freqs.map((f) => `${f.label} ${f.pct}%`).join(", ")}>
        {freqs.map((f, i) => (
          <div key={f.label} style={{ width: `${f.pct}%`, background: colors[i] }} className={i ? "border-l-2 border-panel" : ""} />
        ))}
      </div>
      <div className="mt-1 flex gap-4 text-[13px] text-ivory/85">
        {freqs.map((f, i) => (
          <span key={f.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors[i] }} />
            {f.label} {f.pct}%
          </span>
        ))}
      </div>
    </div>
  )
}

export function ShareHand({ q }: { q: Question }) {
  const [state, setState] = useState<"idle" | "copied" | "show">("idle")
  const url = `${SHARE_BASE}#${shareCode(q, q.scenario.table)}`
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setState("copied")
          } catch {
            setState("show")
          }
        }}
        className="btn-ghost inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full px-5 text-[15px] font-semibold"
      >
        <Link2 className="h-4 w-4" aria-hidden="true" />
        {state === "copied" ? "Link copied" : "Share this hand"}
      </button>
      {state === "show" && (
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} autoFocus className="min-w-0 max-w-full flex-1 rounded-[10px] border border-line bg-ink px-2 py-2 text-[13px] text-ivory" aria-label="Link to this hand" />
      )}
    </span>
  )
}
