import { useCallback, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { PokerTable } from "@/components/PokerTable"
import { QuestionPanel } from "@/components/QuestionPanel"
import { GRID_RANKS, gridHand } from "@/lib/cards"
import { genRangeQuestion, type Question } from "@/lib/questions"
import { ACTION_LABEL, actionFor, builtInPresets, rangePercent, type RangeAction, type RangeMap, type RangePreset } from "@/lib/ranges"
import { useGenOpts, useStore } from "@/lib/store"
import { useAnswerClock } from "@/lib/useTimer"
import { cn } from "@/lib/utils"

const BUILT_INS = builtInPresets()
const BRUSHES: RangeAction[] = ["raise", "call", "fold"]
const cellBg: Record<RangeAction, string> = {
  raise: "var(--act-raise)",
  call: "var(--act-call)",
  fold: "var(--panel-2)",
}

interface Draft {
  id: string
  name: string
  cells: RangeMap
  builtIn: boolean
}

const newId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function Ranges() {
  const { data, savePreset, deletePreset } = useStore()
  const mine = [...data.presets].sort((a, b) => b.updatedAt - a.updatedAt)
  const initial: RangePreset = mine[0] ?? BUILT_INS[3]
  const [draft, setDraft] = useState<Draft>({ id: initial.id, name: initial.name, cells: { ...initial.cells }, builtIn: !!initial.builtIn })
  const [brush, setBrush] = useState<RangeAction>("raise")
  const [practice, setPractice] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const source = [...mine, ...BUILT_INS].find((p) => p.id === draft.id)
  const dirty = !source || source.name !== draft.name || JSON.stringify(normalize(source.cells)) !== JSON.stringify(normalize(draft.cells))

  const load = (p: RangePreset) => {
    setDraft({ id: p.id, name: p.name, cells: { ...p.cells }, builtIn: !!p.builtIn })
    setPractice(false)
    setConfirmDelete(false)
  }

  const save = (asNew = false) => {
    const isNew = asNew || draft.builtIn
    const id = isNew ? newId() : draft.id
    const name = draft.name.trim() || "Untitled range"
    const finalName = isNew && draft.builtIn && name === source?.name ? `${name} (my copy)` : name
    savePreset({ id, name: finalName, cells: normalize(draft.cells), updatedAt: Date.now() })
    setDraft({ id, name: finalName, cells: normalize(draft.cells), builtIn: false })
    setFlash(isNew ? "Saved as a new preset" : "Preset saved")
    window.setTimeout(() => setFlash(null), 1800)
  }

  const blank = () => {
    setDraft({ id: newId(), name: "New range", cells: {}, builtIn: false })
    setPractice(false)
  }

  const paint = useCallback(
    (hand: string) =>
      setDraft((d) => {
        if (actionFor(d.cells, hand) === brush) return d
        const cells = { ...d.cells }
        if (brush === "fold") delete cells[hand]
        else cells[hand] = brush
        return { ...d, cells }
      }),
    [brush],
  )

  const pctRaise = rangePercent(draft.cells, "raise")
  const pctCall = rangePercent(draft.cells, "call")
  const canPractice = pctRaise + pctCall > 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] leading-none sm:text-[42px]">Range builder</h1>
          <p className="mt-2 max-w-[60ch] text-ivory-dim">Paint a 13×13 chart, save it as a preset, then drill it until every hand is automatic.</p>
        </div>
        <div className="flex flex-wrap gap-2 whitespace-nowrap">
          <button type="button" onClick={blank} className="btn-ghost min-h-[46px] cursor-pointer rounded-full px-5 font-semibold">
            New blank range
          </button>
          <button
            type="button"
            disabled={!canPractice}
            onClick={() => setPractice((p) => !p)}
            className="btn-brass min-h-[46px] cursor-pointer rounded-full px-6 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {practice ? "Back to editor" : "Practice this range"}
          </button>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="panel order-2 flex flex-col gap-5 p-4 lg:order-1">
          <PresetList title="My presets" presets={mine} activeId={draft.id} onPick={load} empty="Nothing saved yet. Start from a chart below or a blank range." />
          <PresetList title="Starting charts (6-max, 100bb)" presets={BUILT_INS} activeId={draft.id} onPick={load} />
        </aside>

        <div className="order-1 min-w-0 lg:order-2">
          <AnimatePresence mode="wait">
            {practice ? (
              <motion.div key="practice" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <RangePractice preset={{ id: draft.id, name: draft.name, cells: draft.cells, updatedAt: 0 }} />
              </motion.div>
            ) : (
              <motion.section key="editor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="panel flex flex-col gap-5 p-4 sm:p-6">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                    <span className="text-[14px] text-ivory-dim">Preset name</span>
                    <input
                      id="preset-name"
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      className="min-h-[46px] rounded-[12px] border border-line bg-ink px-3 font-display text-[20px] text-ivory outline-none focus:border-brass"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => save(false)}
                      disabled={!dirty && !draft.builtIn}
                      className="btn-brass min-h-[46px] cursor-pointer rounded-full px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {draft.builtIn ? "Save as my preset" : "Save preset"}
                    </button>
                    {!draft.builtIn && source && (
                      <button type="button" onClick={() => save(true)} className="btn-ghost min-h-[46px] cursor-pointer rounded-full px-4 font-semibold">
                        Save a copy
                      </button>
                    )}
                    {!draft.builtIn && source && !source.builtIn && (
                      confirmDelete ? (
                        <button
                          type="button"
                          onClick={() => {
                            deletePreset(draft.id)
                            load(BUILT_INS[3])
                          }}
                          className="min-h-[46px] cursor-pointer rounded-full border border-oxblood-bright px-4 font-semibold text-oxblood-bright"
                        >
                          Confirm delete
                        </button>
                      ) : (
                        <button type="button" onClick={() => setConfirmDelete(true)} className="btn-ghost min-h-[46px] cursor-pointer rounded-full px-4 font-semibold">
                          Delete
                        </button>
                      )
                    )}
                  </div>
                </div>
                {draft.builtIn && <p className="-mt-2 text-[14px] text-ivory-dim">This is a starting chart. Edits are saved as your own copy.</p>}
                <AnimatePresence>
                  {flash && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="-mt-2 text-[14px] text-verdigris" role="status">
                      {flash}
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-1.5" role="group" aria-label="Brush">
                    {BRUSHES.map((b) => (
                      <button
                        key={b}
                        type="button"
                        aria-pressed={brush === b}
                        onClick={() => setBrush(b)}
                        className={cn(
                          "flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full border px-4 text-[14px] font-semibold",
                          brush === b ? "border-ivory/70 bg-panel-2" : "border-line text-ivory/75",
                        )}
                      >
                        <span className="h-3.5 w-3.5 rounded-[4px]" style={{ background: cellBg[b], boxShadow: "inset 0 0 0 1px rgba(239,230,210,.25)" }} />
                        {ACTION_LABEL[b]}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-4 text-[14px]">
                    <span>
                      <span className="text-ivory-dim">Raise </span>
                      <span className="font-semibold">{pctRaise.toFixed(1)}%</span>
                    </span>
                    <span>
                      <span className="text-ivory-dim">Call </span>
                      <span className="font-semibold">{pctCall.toFixed(1)}%</span>
                    </span>
                    <span>
                      <span className="text-ivory-dim">Fold </span>
                      <span className="font-semibold">{(100 - pctRaise - pctCall).toFixed(1)}%</span>
                    </span>
                  </div>
                </div>

                <RangeGrid cells={draft.cells} onPaint={paint} />
                <p className="text-[13px] text-ivory-dim">Click or drag across cells to paint. Suited hands sit above the diagonal, offsuit below.</p>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function normalize(cells: RangeMap): RangeMap {
  const out: RangeMap = {}
  for (const k of Object.keys(cells).sort()) if (cells[k] !== "fold") out[k] = cells[k]
  return out
}

function PresetList({ title, presets, activeId, onPick, empty }: { title: string; presets: RangePreset[]; activeId: string; onPick: (p: RangePreset) => void; empty?: string }) {
  return (
    <div>
      <h2 className="mb-2 px-1 text-[14px] font-semibold text-ivory-dim">{title}</h2>
      {presets.length === 0 && empty ? (
        <p className="px-1 text-[14px] text-ivory-dim/80">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {presets.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className={cn(
                  "flex min-h-[42px] w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] px-3 text-left text-[15px] transition-colors",
                  activeId === p.id ? "bg-[rgba(214,169,78,.14)] text-brass" : "text-ivory/85 hover:bg-panel-2",
                )}
              >
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-[12px] text-ivory-dim">{rangePercent(p.cells).toFixed(0)}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RangeGrid({ cells, onPaint }: { cells: RangeMap; onPaint: (h: string) => void }) {
  const painting = useRef(false)
  const last = useRef<string | null>(null)
  const handAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-hand]")?.dataset.hand
  const apply = (h?: string) => {
    if (!h || h === last.current) return
    last.current = h
    onPaint(h)
  }
  const grid = useMemo(() => Array.from({ length: 13 }, (_, r) => Array.from({ length: 13 }, (_, c) => gridHand(r, c))), [])
  return (
    <div className="overflow-x-auto">
      <div
        className="grid select-none gap-[2px] rounded-[10px] bg-ink p-[2px]"
        style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))", touchAction: "none" }}
        onPointerDown={(e) => {
          painting.current = true
          last.current = null
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          apply(handAt(e.clientX, e.clientY))
        }}
        onPointerMove={(e) => painting.current && apply(handAt(e.clientX, e.clientY))}
        onPointerUp={() => (painting.current = false)}
        onPointerCancel={() => (painting.current = false)}
        role="grid"
        aria-label="Starting hand grid"
      >
        {grid.flat().map((h, i) => {
          const a = actionFor(cells, h)
          const r = Math.floor(i / 13)
          const c = i % 13
          return (
            <div
              key={h}
              data-hand={h}
              role="gridcell"
              aria-label={`${h}: ${ACTION_LABEL[a]}`}
              className={cn(
                "relative flex aspect-square cursor-crosshair items-center justify-center rounded-[3px] text-[clamp(9px,1.35vw,14px)] font-semibold transition-colors duration-150",
                a === "fold" ? "text-ivory/45" : "text-[#1d140a]",
                r === c && a === "fold" && "text-ivory/70",
              )}
              style={{ background: cellBg[a] }}
            >
              {h.length === 2 ? h : h.slice(0, 2)}
              {h.length === 3 && <span className="absolute bottom-[1px] right-[3px] text-[0.6em] opacity-70">{h[2]}</span>}
            </div>
          )
        })}
      </div>
      <div className="sr-only">Ranks from left to right: {GRID_RANKS.split("").join(", ")}</div>
    </div>
  )
}

function RangePractice({ preset }: { preset: RangePreset }) {
  const { recordAnswer } = useStore()
  const opts = useGenOpts()
  const [q, setQ] = useState<Question>(() => genRangeQuestion(preset, opts))
  const clock = useAnswerClock(q.id)
  const [sel, setSel] = useState<number | null>(null)
  const [tally, setTally] = useState({ r: 0, w: 0 })
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[24px]">Practising {preset.name}</h2>
        <span className="text-ivory-dim">
          {tally.r} of {tally.r + tally.w} right
        </span>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <PokerTable scenario={q.scenario} dealKey={q.id} verdict={sel === null ? null : sel === q.answer ? "right" : "wrong"} />
        <div className="panel p-5">
          <QuestionPanel
            q={q}
            selected={sel}
            onSelect={(i) => {
              if (sel !== null) return
              setSel(i)
              const ok = i === q.answer
              recordAnswer(q, ok, clock())
              setTally((t) => ({ r: t.r + (ok ? 1 : 0), w: t.w + (ok ? 0 : 1) }))
            }}
            onNext={() => {
              setQ(genRangeQuestion(preset, opts))
              setSel(null)
            }}
          />
        </div>
      </div>
    </div>
  )
}
