import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { BookOpen, CircleHelp, X } from "lucide-react"
import { helpFor, lessonById } from "@/lib/lessons"
import { go } from "@/lib/nav"
import { cn } from "@/lib/utils"

/** "How do I solve this?" — a side sheet with the steps for this exact kind of question. */
export function HelpButton({ kind, className, label = "How to solve this" }: { kind: string; className?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const h = helpFor(kind)
  const lesson = lessonById(h.lesson)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 text-[13px] font-semibold text-ivory/85 hover:border-brass/60 hover:text-ivory", className)}
        aria-haspopup="dialog"
      >
        <CircleHelp className="h-4 w-4 text-brass" aria-hidden="true" />
        {label}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-[74] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={h.title}
              className="fixed inset-y-0 right-0 z-[75] flex w-[min(440px,100vw)] flex-col gap-5 overflow-y-auto border-l border-line bg-panel p-6 pt-[calc(env(safe-area-inset-top,0px)+24px)] shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-[26px] leading-tight">{h.title}</h2>
                <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-line" aria-label="Close help">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ol className="flex flex-col gap-3">
                {h.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-[16px] leading-relaxed text-ivory/90">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-brass/50 font-display text-[15px] text-brass">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              {h.formula && (
                <div className="rounded-[14px] border border-brass/40 bg-[rgba(214,169,78,.08)] px-4 py-3">
                  <div className="text-[13px] text-ivory-dim">Formula</div>
                  <div className="text-[18px] font-semibold text-brass">{h.formula}</div>
                </div>
              )}
              {lesson && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    go(`learn-${lesson.id}`)
                  }}
                  className="btn-ghost mt-auto inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-full px-5 font-semibold"
                >
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  Read the full lesson: {lesson.title}
                </button>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
