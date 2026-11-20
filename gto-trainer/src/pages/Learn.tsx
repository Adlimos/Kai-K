import { ArrowLeft } from "lucide-react"
import { LESSONS, lessonById } from "@/lib/lessons"
import { TOPIC_META } from "@/lib/questions"
import { go, topicSlug } from "@/lib/nav"
import { cn } from "@/lib/utils"

export function Learn({ lesson }: { lesson?: string }) {
  const l = lesson ? lessonById(lesson) : undefined
  if (l) return <LessonPage id={l.id} />
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-[34px] leading-none sm:text-[42px]">Learn the math</h1>
        <p className="mt-3 max-w-[60ch] text-[17px] text-ivory/80">
          Short lessons that explain every calculation in the trainer, with worked examples and calculators you can play with. Start at the top if you're new; each one ends with a
          drill.
        </p>
      </header>
      <ol className="grid gap-x-8 md:grid-cols-2">
        {LESSONS.map((x, i) => (
          <li key={x.id} className="border-b border-line">
            <button type="button" onClick={() => go(`learn-${x.id}`)} className="group flex w-full cursor-pointer items-start gap-4 py-5 text-left">
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border font-display text-[18px]", i === 0 ? "border-brass bg-[rgba(214,169,78,.14)] text-brass" : "border-line text-ivory-dim")}>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[22px] leading-tight group-hover:text-brass">{x.title}</span>
                <span className="mt-1 block text-[15px] text-ivory-dim">{x.summary}</span>
              </span>
              <span className="shrink-0 pt-1 text-[13px] text-ivory-dim">{x.minutes} min</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

function LessonPage({ id }: { id: string }) {
  const i = LESSONS.findIndex((x) => x.id === id)
  const l = LESSONS[i]
  const prev = LESSONS[i - 1]
  const next = LESSONS[i + 1]
  return (
    <article className="mx-auto flex max-w-[780px] flex-col">
      <button type="button" onClick={() => go("learn")} className="mb-6 inline-flex w-fit cursor-pointer items-center gap-2 text-[14px] font-semibold text-ivory-dim hover:text-ivory">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All lessons
      </button>
      <p className="text-[14px] text-brass">
        Lesson {i + 1} of {LESSONS.length}, {l.minutes} min read
      </p>
      <h1 className="mt-2 font-display text-[38px] leading-[1.05] sm:text-[48px]">{l.title}</h1>
      <p className="mt-3 max-w-[60ch] text-[18px] text-ivory/75">{l.summary}</p>
      <div className="mt-8">{l.body()}</div>

      {l.practice && (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-brass/40 bg-[rgba(214,169,78,.08)] p-5">
          <div>
            <div className="font-display text-[22px]">Put it into practice</div>
            <div className="text-ivory-dim">{TOPIC_META[l.practice].blurb}</div>
          </div>
          <button type="button" onClick={() => go(`drill-${topicSlug(l.practice!)}`)} className="btn-brass min-h-[48px] cursor-pointer rounded-full px-6 font-semibold">
            Drill {TOPIC_META[l.practice].name.toLowerCase()}
          </button>
        </div>
      )}

      <nav className="mt-10 grid gap-3 border-t border-line pt-6 sm:grid-cols-2" aria-label="More lessons">
        {prev ? (
          <button type="button" onClick={() => go(`learn-${prev.id}`)} className="cursor-pointer rounded-[14px] border border-line p-4 text-left hover:border-brass/50">
            <div className="text-[13px] text-ivory-dim">Previous</div>
            <div className="font-display text-[19px]">{prev.title}</div>
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button type="button" onClick={() => go(`learn-${next.id}`)} className="cursor-pointer rounded-[14px] border border-line p-4 text-left hover:border-brass/50 sm:text-right">
            <div className="text-[13px] text-ivory-dim">Next</div>
            <div className="font-display text-[19px]">{next.title}</div>
          </button>
        )}
      </nav>
    </article>
  )
}
