import { useState, type ReactNode } from "react"
import { DifficultyPicker } from "@/components/DifficultyPicker"
import { PlayingCard } from "@/components/PlayingCard"
import { useStore, type Settings } from "@/lib/store"
import { cn } from "@/lib/utils"
import { sfx } from "@/lib/sound"

function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-[46ch]">
        <div className="text-[16px] font-semibold">{title}</div>
        {desc && <div className="text-[14px] text-ivory-dim">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-full border border-line bg-panel p-1">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn("min-h-[36px] cursor-pointer rounded-full px-3.5 text-[13px] font-semibold", value === o.v ? "btn-brass" : "text-ivory/75 hover:text-ivory")}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative h-8 w-14 cursor-pointer rounded-full border transition-colors", on ? "border-brass bg-brass" : "border-line bg-panel-2")}
    >
      <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-ivory shadow transition-transform", on ? "translate-x-7" : "translate-x-1")} />
    </button>
  )
}

const CLUB_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function Prefs() {
  const { settings, updateSettings, mode } = useStore()
  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => updateSettings({ [k]: v } as Partial<Settings>)
  const [nick, setNick] = useState(settings.nick)
  const [clubInput, setClubInput] = useState("")
  const [clubErr, setClubErr] = useState("")

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-[34px] leading-none sm:text-[42px]">Preferences</h1>
        <p className="mt-2 text-ivory-dim">{mode === "shared" ? "Saved to your account and used on every device." : "Saved in this browser."}</p>
      </header>

      <section className="panel px-5 sm:px-6">
        <h2 className="pt-5 font-display text-[22px]">Training</h2>
        <Row title="Difficulty" desc="Easy uses round numbers and clear-cut spots. Hard uses odd sizes, close decisions and borderline hands.">
          <DifficultyPicker id="prefs-diff" value={settings.difficulty} onChange={set("difficulty")} />
        </Row>
        <Row title="Table size" desc="9-handed adds UTG+1, UTG+2 and LJ seats with tighter opening ranges.">
          <Seg label="Table size" value={settings.table} onChange={set("table")} options={[{ v: 6, l: "6-max" }, { v: 9, l: "9-handed" }]} />
        </Row>
        <Row title="Stack depth" desc="Changes stacks shown at the table and the SPR questions. Pre-flop charts are built for 100bb.">
          <Seg label="Stack depth" value={settings.stack} onChange={set("stack")} options={[{ v: 50, l: "50bb" }, { v: 100, l: "100bb" }, { v: 200, l: "200bb" }]} />
        </Row>
        <Row title="Daily goal" desc="How many questions you aim to answer each day.">
          <Seg label="Daily goal" value={settings.goal} onChange={set("goal")} options={[10, 20, 30, 50, 100].map((v) => ({ v, l: String(v) }))} />
        </Row>
      </section>

      <section className="panel px-5 sm:px-6">
        <h2 className="pt-5 font-display text-[22px]">Table and cards</h2>
        <Row title="Deck colours" desc="Four colours make flushes easier to spot: blue diamonds, green clubs.">
          <div className="flex items-center gap-4">
            <div className="flex gap-1" aria-hidden="true">
              <PlayingCard card={{ r: 12, s: 2 }} size="sm" from={{ x: 0, y: 0 }} />
              <PlayingCard card={{ r: 11, s: 3 }} size="sm" from={{ x: 0, y: 0 }} />
            </div>
            <Seg label="Deck colours" value={settings.deck} onChange={set("deck")} options={[{ v: "four", l: "Four colour" }, { v: "two", l: "Two colour" }]} />
          </div>
        </Row>
        <Row title="Card size">
          <Seg label="Card size" value={settings.cardScale} onChange={set("cardScale")} options={[{ v: 1, l: "Standard" }, { v: 1.2, l: "Large" }]} />
        </Row>
        <Row title="Sound effects" desc="Dealing, chips, right and wrong answers.">
          <Toggle
            label="Sound effects"
            on={settings.sound}
            onChange={(v) => {
              set("sound")(v)
              if (v) window.setTimeout(() => sfx.right(), 50)
            }}
          />
        </Row>
        <Row title="Vibration" desc="A short buzz on answers, on phones that support it.">
          <Toggle label="Vibration" on={settings.haptics} onChange={set("haptics")} />
        </Row>
      </section>

      <section className="panel px-5 sm:px-6">
        <h2 className="pt-5 font-display text-[22px]">Leaderboards</h2>
        <Row title="Nickname" desc="Shown on leaderboards and in races instead of your account name.">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              updateSettings({ nick: nick.trim().slice(0, 24) })
            }}
          >
            <label htmlFor="nick" className="sr-only">
              Nickname
            </label>
            <input id="nick" value={nick} maxLength={24} onChange={(e) => setNick(e.target.value)} placeholder="e.g. RiverRat" className="min-h-[44px] w-48 rounded-[12px] border border-line bg-ink px-3 text-ivory outline-none focus:border-brass" />
            <button type="submit" disabled={nick.trim() === settings.nick} className="btn-ghost min-h-[44px] cursor-pointer rounded-full px-4 font-semibold disabled:opacity-40">
              Save
            </button>
          </form>
        </Row>
        <Row title="Club" desc={settings.club ? "Share this code with friends. Leaderboards can filter to your club." : "Make a private board for your study group, or join one with a code."}>
          {settings.club ? (
            <div className="flex items-center gap-3">
              <span className="font-display text-[26px] tracking-[0.12em] text-brass">{settings.club}</span>
              <button type="button" onClick={() => updateSettings({ club: "" })} className="btn-ghost min-h-[40px] cursor-pointer rounded-full px-4 text-[14px] font-semibold">
                Leave club
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateSettings({ club: Array.from({ length: 6 }, () => CLUB_CHARS[Math.floor(Math.random() * CLUB_CHARS.length)]).join("") })}
                  className="btn-brass min-h-[44px] cursor-pointer rounded-full px-4 font-semibold"
                >
                  Create a club
                </button>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const c = clubInput.trim().toUpperCase()
                    if (!/^[A-Z0-9]{6}$/.test(c)) return setClubErr("Club codes are 6 letters and numbers.")
                    setClubErr("")
                    updateSettings({ club: c })
                  }}
                >
                  <label htmlFor="club-code" className="sr-only">
                    Club code
                  </label>
                  <input id="club-code" value={clubInput} onChange={(e) => setClubInput(e.target.value)} placeholder="Club code" className="min-h-[44px] w-32 rounded-[12px] border border-line bg-ink px-3 uppercase text-ivory outline-none focus:border-brass" />
                  <button type="submit" className="btn-ghost min-h-[44px] cursor-pointer rounded-full px-4 font-semibold">
                    Join
                  </button>
                </form>
              </div>
              {clubErr && <span className="text-[14px] text-oxblood-bright">{clubErr}</span>}
            </div>
          )}
        </Row>
      </section>
    </div>
  )
}
