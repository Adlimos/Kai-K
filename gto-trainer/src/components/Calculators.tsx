import { useId, useState } from "react"
import { exactEquity } from "@/lib/questions"

function Slider({ label, value, min, max, step = 1, onChange, suffix = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-[14px] text-ivory-dim">
        {label}
        <span className="font-display text-[20px] text-ivory">
          {suffix === "$" ? `$${value}` : `${value}${suffix}`}
        </span>
      </span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[var(--brass)]" />
    </label>
  )
}

function Out({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[12px] border border-line bg-ink px-3 py-2.5">
      <div className="text-[13px] text-ivory-dim">{label}</div>
      <div className="font-display text-[24px] leading-tight text-brass">{value}</div>
      {sub && <div className="text-[12px] text-ivory-dim">{sub}</div>}
    </div>
  )
}

export function PotOddsCalc() {
  const [pot, setPot] = useState(100)
  const [bet, setBet] = useState(50)
  const req = (bet / (pot + 2 * bet)) * 100
  const r = (pot + bet) / bet
  return (
    <div className="flex flex-col gap-4">
      <Slider label="Pot before the bet" value={pot} min={5} max={500} step={5} onChange={setPot} suffix="$" />
      <Slider label="Villain's bet" value={bet} min={5} max={500} step={5} onChange={setBet} suffix="$" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Out label="Equity to call" value={`${req.toFixed(1)}%`} />
        <Out label="Pot odds" value={`${r.toFixed(1)} : 1`} />
        <Out label="Defend at least" value={`${((pot / (pot + bet)) * 100).toFixed(0)}%`} sub="MDF" />
        <Out label="Bluff break-even" value={`${((bet / (pot + bet)) * 100).toFixed(0)}%`} sub="folds needed" />
      </div>
    </div>
  )
}

export function OutsCalc() {
  const [outs, setOuts] = useState(9)
  return (
    <div className="flex flex-col gap-4">
      <Slider label="Outs" value={outs} min={1} max={21} onChange={setOuts} />
      <div className="grid grid-cols-2 gap-2">
        <Out label="Flop to river, 4× rule" value={`≈ ${outs * 4}%`} sub={`exact ${exactEquity(outs, "flop").toFixed(1)}%`} />
        <Out label="One card, 2× rule" value={`≈ ${outs * 2}%`} sub={`exact ${exactEquity(outs, "turn").toFixed(1)}%`} />
      </div>
      {outs > 8 && <p className="text-[13px] text-ivory-dim">Above 8 outs the 4× rule overshoots. Subtract (outs − 8) to correct it: {outs * 4 - (outs - 8)}%.</p>}
    </div>
  )
}

export function EvCalc() {
  const [pot, setPot] = useState(100)
  const [bet, setBet] = useState(50)
  const [eq, setEq] = useState(30)
  const [fold, setFold] = useState(40)
  const e = eq / 100
  const f = fold / 100
  const evCall = e * (pot + bet) - (1 - e) * bet
  const evBluff = f * pot - (1 - f) * bet
  const sign = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(1)}`
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider label="Pot" value={pot} min={5} max={500} step={5} onChange={setPot} suffix="$" />
        <Slider label="Bet" value={bet} min={5} max={500} step={5} onChange={setBet} suffix="$" />
        <Slider label="Your equity when calling" value={eq} min={0} max={100} onChange={setEq} suffix="%" />
        <Slider label="Villain folds to your bluff" value={fold} min={0} max={100} onChange={setFold} suffix="%" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Out label="EV of calling" value={sign(evCall)} sub={evCall >= 0 ? "profitable call" : "fold instead"} />
        <Out label="EV of bluffing" value={sign(evBluff)} sub={evBluff >= 0 ? "profitable bluff" : "give up"} />
      </div>
    </div>
  )
}

export function SprCalc() {
  const [stack, setStack] = useState(100)
  const [pot, setPot] = useState(6)
  const spr = (stack - 0) / pot
  return (
    <div className="flex flex-col gap-4">
      <Slider label="Effective stack behind (bb)" value={stack} min={5} max={300} onChange={setStack} />
      <Slider label="Pot on the flop (bb)" value={pot} min={2} max={60} step={0.5} onChange={setPot} />
      <div className="grid grid-cols-2 gap-2">
        <Out label="SPR" value={spr.toFixed(1)} />
        <Out label="What it means" value={spr < 4 ? "Commit" : spr < 10 ? "Careful" : "Deep"} sub={spr < 4 ? "top pair can stack off" : spr < 10 ? "one pair is a bluff-catcher vs big raises" : "sets and draws gain value"} />
      </div>
    </div>
  )
}
