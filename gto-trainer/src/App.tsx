import { AnimatePresence, motion, MotionConfig } from "framer-motion"
import { BarChart3, Grid3x3, Home, Target, Timer, Trophy } from "lucide-react"
import { StoreProvider, useStore } from "@/lib/store"
import { go, routeKey, useRoute, type Route } from "@/lib/nav"
import { Lobby } from "@/pages/Lobby"
import { Drill } from "@/pages/Drill"
import { Timed } from "@/pages/Timed"
import { Ranges } from "@/pages/Ranges"
import { Stats } from "@/pages/Stats"
import { Leaderboard } from "@/pages/Leaderboard"
import { cn } from "@/lib/utils"

const NAV = [
  { hash: "lobby", label: "Lobby", short: "Lobby", icon: Home, match: (r: Route) => r.page === "lobby" },
  { hash: "drill-mixed", label: "Drills", short: "Drills", icon: Target, match: (r: Route) => r.page === "drill" },
  { hash: "timed", label: "Timed challenge", short: "Timed", icon: Timer, match: (r: Route) => r.page === "timed" },
  { hash: "ranges", label: "Range builder", short: "Ranges", icon: Grid3x3, match: (r: Route) => r.page === "ranges" },
  { hash: "stats", label: "My stats", short: "Stats", icon: BarChart3, match: (r: Route) => r.page === "stats" },
  { hash: "leaderboard", label: "Leaderboard", short: "Board", icon: Trophy, match: (r: Route) => r.page === "leaderboard" },
]

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

function Shell() {
  const route = useRoute()
  const key = routeKey(route)
  return (
    <div className="room-bg min-h-screen">
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-line bg-[rgba(10,26,21,.85)] px-4 pb-6 pt-[calc(env(safe-area-inset-top,0px)+24px)] backdrop-blur lg:flex">
        <button type="button" onClick={() => go("lobby")} className="mb-8 flex cursor-pointer items-center gap-3 px-2">
          <Mark />
          <span className="font-display text-[26px] leading-none">Felt Lab</span>
        </button>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active = n.match(route)
            const Icon = n.icon
            return (
              <button
                key={n.hash}
                type="button"
                onClick={() => go(n.hash)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[12px] px-3 text-[15px] font-semibold transition-colors",
                  active ? "text-ivory" : "text-ivory/65 hover:text-ivory",
                )}
              >
                {active && (
                  <motion.span layoutId="rail-active" className="absolute inset-0 rounded-[12px] border border-brass/35 bg-[rgba(214,169,78,.1)]" transition={{ type: "spring", stiffness: 420, damping: 36 }} />
                )}
                <Icon className={cn("relative h-[18px] w-[18px]", active && "text-brass")} aria-hidden="true" />
                <span className="relative">{n.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="mt-auto px-2">
          <SyncNote />
        </div>
      </aside>

      {/* Phone top bar */}
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
            <motion.main
              key={key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {route.page === "lobby" && <Lobby />}
              {route.page === "drill" && <Drill topic={route.topic} />}
              {route.page === "timed" && <Timed />}
              {route.page === "ranges" && <Ranges />}
              {route.page === "stats" && <Stats />}
              {route.page === "leaderboard" && <Leaderboard />}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>

      {/* Phone bottom nav */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-[rgba(10,26,21,.94)] pb-[env(safe-area-inset-bottom,0px)] backdrop-blur lg:hidden"
        style={{ paddingLeft: "env(safe-area-inset-left, 0px)", paddingRight: "env(safe-area-inset-right, 0px)" }}
      >
        {NAV.slice(1).map((n) => {
          const active = n.match(route)
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
      </nav>
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
