import { useEffect, useState } from "react"
import { AnimatePresence, motion, MotionConfig } from "framer-motion"
import { Award, BarChart3, BookOpen, CalendarDays, Calculator, Grid3x3, Home, Menu, RotateCcw, Settings2, Swords, Target, Timer, Trophy, X } from "lucide-react"
import { StoreProvider, useStore, utcDayKey } from "@/lib/store"
import { go, routeKey, useRoute, type Route } from "@/lib/nav"
import { configureFeedback } from "@/lib/sound"
import { Lobby } from "@/pages/Lobby"
import { Drill } from "@/pages/Drill"
import { Timed } from "@/pages/Timed"
import { Ranges } from "@/pages/Ranges"
import { Stats } from "@/pages/Stats"
import { Leaderboard } from "@/pages/Leaderboard"
import { Learn } from "@/pages/Learn"
import { Daily } from "@/pages/Daily"
import { Review } from "@/pages/Review"
import { Race } from "@/pages/Race"
import { Tools } from "@/pages/Tools"
import { Prefs } from "@/pages/Prefs"
import { Hand } from "@/pages/Hand"
import { cn } from "@/lib/utils"

type NavItem = { hash: string; label: string; short: string; icon: typeof Home; match: (r: Route) => boolean }
const item = (hash: string, label: string, short: string, icon: typeof Home, match: (r: Route) => boolean): NavItem => ({ hash, label, short, icon, match })

const GROUPS: { title?: string; items: NavItem[] }[] = [
  { items: [item("lobby", "Lobby", "Lobby", Home, (r) => r.page === "lobby")] },
  {
    title: "Train",
    items: [
      item("drill-mixed", "Drills", "Drills", Target, (r) => r.page === "drill" || r.page === "hand"),
      item("daily", "Daily challenge", "Daily", CalendarDays, (r) => r.page === "daily"),
      item("timed", "Timed challenge", "Timed", Timer, (r) => r.page === "timed"),
      item("race", "Head-to-head", "Race", Swords, (r) => r.page === "race"),
      item("review", "Mistake review", "Review", RotateCcw, (r) => r.page === "review"),
    ],
  },
  {
    title: "Study",
    items: [
      item("learn", "Learn", "Learn", BookOpen, (r) => r.page === "learn"),
      item("ranges", "Range builder", "Ranges", Grid3x3, (r) => r.page === "ranges"),
      item("tools", "Calculators", "Tools", Calculator, (r) => r.page === "tools"),
    ],
  },
  {
    title: "You",
    items: [
      item("stats", "My stats", "Stats", BarChart3, (r) => r.page === "stats"),
      item("leaderboard", "Leaderboard", "Board", Trophy, (r) => r.page === "leaderboard"),
      item("prefs", "Preferences", "Prefs", Settings2, (r) => r.page === "prefs"),
    ],
  },
]
const ALL = GROUPS.flatMap((g) => g.items)
const TABS = ["learn", "drill-mixed", "daily", "stats"].map((h) => ALL.find((i) => i.hash === h)!)

function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="var(--brass)" />
      <circle cx="20" cy="20" r="19" fill="none" stroke="#1d140a" strokeWidth="3" strokeDasharray="6 6.4" strokeOpacity=".55" />
      <circle cx="20" cy="20" r="11.5" fill="var(--ink)" />
      <path d="M20 12.5c-3.6 4-6.3 5.8-6.3 8.6 0 2 1.6 3.4 3.4 3.4 1.1 0 2-.5 2.4-1.2-.2 1.6-.8 2.9-1.9 3.7h4.8c-1.1-.8-1.7-2.1-1.9-3.7.4.7 1.3 1.2 2.4 1.2 1.8 0 3.4-1.4 3.4-3.4 0-2.8-2.7-4.6-6.3-8.6z" fill="var(--ivory)" />
    </svg>
  )
}

function SyncNote() {
  const { mode } = useStore()
  const text = mode === "shared" ? "Saved to your account" : mode === "connecting" ? "Connecting…" : "Saved on this device"
  return (
    <span className="flex items-center gap-2 text-[13px] text-ivory-dim">
      <span className={cn("h-2 w-2 rounded-full", mode === "shared" ? "bg-verdigris" : mode === "connecting" ? "bg-brass" : "bg-ivory-dim")} aria-hidden="true" />
      {text}
    </span>
  )
}

function Badge({ n }: { n: number }) {
  if (!n) return null
  return <span className="relative ml-auto rounded-full bg-brass px-1.5 text-[11px] font-bold leading-[18px] text-[#1d140a]">{n}</span>
}

function useCounts() {
  const { data } = useStore()
  return {
    review: data.mistakes.filter((m) => m.due <= Date.now()).length,
    daily: data.daily[utcDayKey()] ? 0 : 1,
  }
}

function Toasts() {
  const { toasts, dismiss } = useStore()
  return (
    <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] right-4 z-[70] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2 lg:bottom-6" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            className="pointer-events-auto flex items-start gap-3 rounded-[14px] border border-brass/50 bg-panel p-4 shadow-2xl"
          >
            <Award className="mt-0.5 h-5 w-5 shrink-0 text-brass" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{t.title}</div>
              {t.body && <div className="text-[14px] text-ivory-dim">{t.body}</div>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="cursor-pointer text-ivory-dim hover:text-ivory" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function Shell() {
  const route = useRoute()
  const key = routeKey(route)
  const { settings } = useStore()
  const counts = useCounts()
  const [more, setMore] = useState(false)

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty("--card-scale", String(settings.cardScale))
    root.setProperty("--suit-d", settings.deck === "four" ? "#2c5aa8" : "#b4233a")
    root.setProperty("--suit-c", settings.deck === "four" ? "#2a7a4b" : "#1c1c1c")
    configureFeedback({ sound: settings.sound, haptics: settings.haptics })
  }, [settings.cardScale, settings.deck, settings.sound, settings.haptics])
  useEffect(() => setMore(false), [key])

  const countFor = (h: string) => (h === "review" ? counts.review : h === "daily" ? counts.daily : 0)

  return (
    <div className="room-bg min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col overflow-y-auto border-r border-line bg-[rgba(10,26,21,.85)] px-4 pb-6 pt-[calc(env(safe-area-inset-top,0px)+22px)] backdrop-blur lg:flex">
        <button type="button" onClick={() => go("lobby")} className="mb-6 flex cursor-pointer items-center gap-3 px-2">
          <Mark />
          <span className="font-display text-[26px] leading-none">Felt Lab</span>
        </button>
        <nav aria-label="Main" className="flex flex-col gap-4">
          {GROUPS.map((g, gi) => (
            <div key={gi} className="flex flex-col gap-0.5">
              {g.title && <div className="px-3 pb-1 text-[12px] font-semibold text-ivory-dim/80">{g.title}</div>}
              {g.items.map((n) => {
                const active = n.match(route)
                const Icon = n.icon
                return (
                  <button
                    key={n.hash}
                    type="button"
                    onClick={() => go(n.hash)}
                    aria-current={active ? "page" : undefined}
                    className={cn("relative flex min-h-[40px] cursor-pointer items-center gap-3 rounded-[12px] px-3 text-[15px] font-semibold transition-colors", active ? "text-ivory" : "text-ivory/65 hover:text-ivory")}
                  >
                    {active && <motion.span layoutId="rail-active" className="absolute inset-0 rounded-[12px] border border-brass/35 bg-[rgba(214,169,78,.1)]" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                    <Icon className={cn("relative h-[18px] w-[18px]", active && "text-brass")} aria-hidden="true" />
                    <span className="relative">{n.label}</span>
                    <Badge n={countFor(n.hash)} />
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto px-2 pt-6">
          <SyncNote />
        </div>
      </aside>

      <header className="gutter sticky top-0 z-30 flex items-center justify-between border-b border-line bg-[rgba(10,26,21,.9)] pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] backdrop-blur lg:hidden">
        <button type="button" onClick={() => go("lobby")} className="flex cursor-pointer items-center gap-2.5">
          <Mark size={26} />
          <span className="font-display text-[22px] leading-none">Felt Lab</span>
        </button>
        <SyncNote />
      </header>

      <div className="lg:pl-[232px]">
        <div className="gutter mx-auto max-w-[1280px] pb-[calc(env(safe-area-inset-bottom,0px)+96px)] pt-6 sm:pt-10 lg:pb-16">
          <AnimatePresence mode="wait" initial={false}>
            <motion.main key={key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}>
              {route.page === "lobby" && <Lobby />}
              {route.page === "drill" && <Drill topic={route.topic} />}
              {route.page === "learn" && <Learn lesson={route.lesson} />}
              {route.page === "daily" && <Daily />}
              {route.page === "timed" && <Timed />}
              {route.page === "race" && <Race />}
              {route.page === "review" && <Review />}
              {route.page === "ranges" && <Ranges />}
              {route.page === "tools" && <Tools />}
              {route.page === "stats" && <Stats />}
              {route.page === "leaderboard" && <Leaderboard />}
              {route.page === "prefs" && <Prefs />}
              {route.page === "hand" && <Hand code={route.code} />}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-[rgba(10,26,21,.96)] pb-[env(safe-area-inset-bottom,0px)] backdrop-blur lg:hidden"
        style={{ paddingLeft: "env(safe-area-inset-left, 0px)", paddingRight: "env(safe-area-inset-right, 0px)" }}
      >
        {TABS.map((n) => {
          const active = n.match(route) && !more
          const Icon = n.icon
          return (
            <button
              key={n.hash}
              type="button"
              onClick={() => go(n.hash)}
              aria-current={active ? "page" : undefined}
              className={cn("relative flex min-h-[60px] cursor-pointer flex-col items-center justify-center gap-1 text-[12px] font-semibold", active ? "text-brass" : "text-ivory/65")}
            >
              {active && <motion.span layoutId="tab-active" className="absolute inset-x-4 top-0 h-[2px] rounded-full bg-brass" />}
              <Icon className="h-5 w-5" aria-hidden="true" />
              {n.short}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className={cn("relative flex min-h-[60px] cursor-pointer flex-col items-center justify-center gap-1 text-[12px] font-semibold", more ? "text-brass" : "text-ivory/65")}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          More
          {counts.review > 0 && <span className="absolute right-[22%] top-2 h-2 w-2 rounded-full bg-brass" />}
        </button>
      </nav>

      <AnimatePresence>
        {more && (
          <>
            <motion.div className="fixed inset-0 z-30 bg-black/50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)} />
            <motion.div
              className="gutter fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+60px)] z-[35] max-h-[70vh] overflow-y-auto rounded-t-[22px] border-t border-line bg-panel pb-4 pt-5 lg:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              role="dialog"
              aria-label="All pages"
            >
              {GROUPS.map((g, gi) => (
                <div key={gi} className="mb-3">
                  {g.title && <div className="mb-1 text-[12px] font-semibold text-ivory-dim">{g.title}</div>}
                  <div className="grid grid-cols-3 gap-2">
                    {g.items.map((n) => {
                      const Icon = n.icon
                      const active = n.match(route)
                      return (
                        <button
                          key={n.hash}
                          type="button"
                          onClick={() => go(n.hash)}
                          className={cn("relative flex min-h-[68px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[14px] border text-[13px] font-semibold", active ? "border-brass/60 text-brass" : "border-line text-ivory/85")}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                          {n.short}
                          {countFor(n.hash) > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brass" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <Toasts />
    </div>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </MotionConfig>
  )
}
