import type { ReactNode } from "react"
import type { DrillTopic } from "./questions"
import { EvCalc, OutsCalc, PotOddsCalc, SprCalc } from "@/components/Calculators"

export interface Lesson {
  id: string
  title: string
  summary: string
  minutes: number
  practice?: DrillTopic
  body: () => ReactNode
}

// ---------- Typographic building blocks ----------
const H = ({ children }: { children: ReactNode }) => <h3 className="mt-8 font-display text-[24px] leading-tight text-ivory first:mt-0">{children}</h3>
const P = ({ children }: { children: ReactNode }) => <p className="mt-3 max-w-[66ch] text-[16.5px] leading-[1.65] text-ivory/85">{children}</p>
const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-ivory">{children}</strong>

export function Formula({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="my-5 rounded-[14px] border border-brass/40 bg-[rgba(214,169,78,.08)] px-5 py-4">
      <div className="text-[20px] font-semibold leading-snug text-brass">{children}</div>
      {note && <div className="mt-1 text-[14px] text-ivory-dim">{note}</div>}
    </div>
  )
}

function Example({ title, steps, result }: { title: string; steps: ReactNode[]; result: ReactNode }) {
  return (
    <div className="my-5 rounded-[14px] border border-line bg-panel-2 p-5">
      <div className="text-[15px] font-semibold text-ivory">{title}</div>
      <ol className="mt-3 flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-[15.5px] leading-relaxed text-ivory/85">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-[12px] text-ivory-dim">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 border-t border-line pt-3 text-[15.5px] text-verdigris">{result}</div>
    </div>
  )
}

function Mistakes({ items }: { items: ReactNode[] }) {
  return (
    <div className="my-5 rounded-[14px] border border-oxblood-bright/35 bg-[rgba(158,38,56,.1)] p-5">
      <div className="text-[15px] font-semibold text-oxblood-bright">Common mistakes</div>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[15.5px] text-ivory/85">
        {items.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </div>
  )
}

function Try({ children, label = "Try it" }: { children: ReactNode; label?: string }) {
  return (
    <div className="my-6 rounded-[14px] border border-line bg-ink/60 p-5">
      <div className="mb-3 text-[15px] font-semibold text-ivory">{label}</div>
      {children}
    </div>
  )
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="my-5 overflow-x-auto">
      <table className="w-full min-w-[360px] border-collapse text-left text-[15px]">
        <thead>
          <tr className="text-[13px] text-ivory-dim">
            {head.map((h) => (
              <th key={h} className="border-b border-line py-2 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60">
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? "py-2 pr-4 text-ivory" : "py-2 pr-4 text-ivory/80"}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------- Lessons ----------
export const LESSONS: Lesson[] = [
  {
    id: "basics",
    title: "Start here: the three numbers",
    summary: "Equity, price and frequency. Every decision in this trainer is one of them.",
    minutes: 4,
    body: () => (
      <>
        <P>
          Poker math looks like a lot of formulas, but almost every decision comes down to comparing two numbers: <B>how often you win</B> and{" "}
          <B>how much it costs</B>. Get comfortable with three ideas and the rest falls into place.
        </P>
        <H>1. Equity: how often you win</H>
        <P>
          Your equity is your share of the pot if the hand were played out many times. A flush draw on the flop wins about 35% of the time by the river, so it has about 35%
          equity. Equity is always measured against something: one hand, or a whole range of hands.
        </P>
        <H>2. Price: what a call costs</H>
        <P>
          When someone bets, you're offered a price. If the pot is $100 and they bet $50, you put in $50 to play for a final pot of $200. You need to win at least 50 ÷ 200 = 25% of
          the time to break even. That's your <B>required equity</B>.
        </P>
        <Formula note="Call when your equity is higher than this.">Required equity = call ÷ final pot</Formula>
        <H>3. Frequency: how often you do something</H>
        <P>
          Good strategies are about how often, not just what. How often should you bluff? How often must you defend so opponents can't bluff you off every pot? The answers come
          from the same price math.
        </P>
        <H>Ratios and percentages</H>
        <P>Players say pot odds two ways. Here's how to convert:</P>
        <Formula note="Example: 3 : 1 odds = 1 ÷ 4 = 25%">Percentage = 1 ÷ (ratio + 1)</Formula>
        <Table
          head={["Bet size", "Pot odds", "Equity needed"]}
          rows={[
            ["¼ pot", "5 : 1", "16.7%"],
            ["⅓ pot", "4 : 1", "20%"],
            ["½ pot", "3 : 1", "25%"],
            ["⅔ pot", "2.5 : 1", "28.6%"],
            ["¾ pot", "2.33 : 1", "30%"],
            ["Pot", "2 : 1", "33.3%"],
            ["2× pot", "1.5 : 1", "40%"],
          ]}
        />
        <P>Memorising this table will make you faster than any formula. The timed challenges are a good place to drill it.</P>
      </>
    ),
  },
  {
    id: "pot-odds",
    title: "Pot odds",
    summary: "The equity you need to call, and how to read the ratio you're being offered.",
    minutes: 5,
    practice: "potOdds",
    body: () => (
      <>
        <P>
          Pot odds tell you whether a call is cheap enough for your hand. You compare the price of calling with the size of the pot you're trying to win.
        </P>
        <Formula note="Count your own call in the final pot.">Required equity = call ÷ (pot + bet + call)</Formula>
        <Example
          title="The pot is $60. Villain bets $30."
          steps={["Your call is $30.", "The final pot will be $60 + $30 (their bet) + $30 (your call) = $120.", "$30 ÷ $120 = 0.25."]}
          result="You need 25% equity. A flush draw on the turn (about 19.6%) isn't enough; an open-ended straight draw plus flush draw (about 33%) is."
        />
        <H>The ratio version</H>
        <P>
          Pot odds as a ratio compare what you win to what you risk: (pot + bet) : call. In the example that's $90 : $30, or 3 : 1. Convert with 1 ÷ (3 + 1) = 25%. Both ways
          give the same answer; use whichever is faster for you.
        </P>
        <Formula>Pot odds = (pot + bet) : call</Formula>
        <H>Turning it into a decision</H>
        <P>
          With a draw, estimate your equity using outs (see the next lesson) and compare. If your equity is higher than the required equity, calling makes money in the long run.
          If it's lower, fold, unless implied odds make up the difference.
        </P>
        <Mistakes
          items={[
            "Forgetting your own call: $30 ÷ $90 = 33% is wrong; the final pot includes your $30.",
            "Using the pot before the bet as the reward. The bet in front of you is money you can win.",
            "Comparing two-card equity (4× rule) when only one card is coming because villain will bet again on the river.",
          ]}
        />
        <Try>
          <PotOddsCalc />
        </Try>
      </>
    ),
  },
  {
    id: "outs",
    title: "Outs and the 4-2 rule",
    summary: "Count the cards that complete your hand, then turn them into equity in your head.",
    minutes: 5,
    practice: "outs",
    body: () => (
      <>
        <P>
          An <B>out</B> is an unseen card that turns your hand into the winner. On the flop you've seen 5 cards (2 in your hand, 3 on the board), so 47 are unseen. On the turn, 46.
        </P>
        <Table
          head={["Draw", "Outs", "Flop → river", "Turn → river"]}
          rows={[
            ["Gutshot straight draw", 4, "≈ 16%", "≈ 8%"],
            ["Open-ended straight draw", 8, "≈ 32%", "≈ 16%"],
            ["Flush draw", 9, "≈ 35%", "≈ 18%"],
            ["Flush draw + gutshot", 12, "≈ 45%", "≈ 24%"],
            ["Flush draw + open-ended", 15, "≈ 54%", "≈ 30%"],
          ]}
        />
        <H>How to count</H>
        <P>
          Count each card once. With a flush draw and an open-ended straight draw you have 9 flush cards and 8 straight cards, but 2 of the straight cards are also your suit.
          So it's 9 + 6 = 15 outs, not 17.
        </P>
        <Example
          title="You hold J♠ T♠ on 9♠ 8♦ 2♠."
          steps={["Spades left: 13 − 4 seen = 9 flush outs.", "Queens and sevens make a straight: 8 cards, but Q♠ and 7♠ are already counted.", "9 + 6 = 15 outs."]}
          result="15 outs on the flop: about 54% to hit by the river. You're actually a favourite against one pair."
        />
        <H>The 4-2 rule</H>
        <Formula note="Fast mental estimate of your equity.">Two cards to come: outs × 4. One card to come: outs × 2</Formula>
        <P>
          Use × 4 on the flop only when you'll see both the turn and river for one price, for example when someone is all-in. If you'll face another bet on the turn, use × 2
          for the single next card.
        </P>
        <P>
          The rule overshoots with big draws. A quick fix for more than 8 outs on the flop: subtract (outs − 8). 15 outs → 60 − 7 = 53%, very close to the true 54.1%.
        </P>
        <Mistakes
          items={[
            "Counting the same card twice when draws overlap.",
            "Counting outs that give your opponent a better hand too, like a fourth flush card when they might hold a bigger flush draw. These are dirty outs; discount them.",
            "Using × 4 on the flop when you'll have to call another bet on the turn.",
          ]}
        />
        <Try>
          <OutsCalc />
        </Try>
      </>
    ),
  },
  {
    id: "expected-value",
    title: "Expected value",
    summary: "What a decision earns on average, in dollars. The number every other number serves.",
    minutes: 6,
    practice: "ev",
    body: () => (
      <>
        <P>
          Expected value (EV) is the average result of a decision if you could make it thousands of times. Folding always has an EV of $0 from this point on, so any call or bet with
          positive EV is better than folding.
        </P>
        <Formula>EV = (chance of winning × amount won) − (chance of losing × amount lost)</Formula>
        <H>EV of a call</H>
        <Example
          title="Pot $80, villain bets $40, your equity is 30%."
          steps={["When you win (30%), you collect the $80 pot plus the $40 bet = $120.", "When you lose (70%), you lose your $40 call.", "EV = 0.30 × 120 − 0.70 × 40 = 36 − 28."]}
          result="EV = +$8. Calling earns $8 on average, so it beats folding."
        />
        <P>
          Notice you don't count your own $40 call in the winnings: it was yours to begin with. Counting it is the most common EV error.
        </P>
        <H>EV of a bluff</H>
        <Formula>EV(bluff) = fold% × pot − (1 − fold%) × bet</Formula>
        <Example
          title="You bluff $60 into $100 and expect folds 45% of the time."
          steps={["When villain folds (45%), you win the $100 pot.", "When villain calls (55%), you lose $60.", "EV = 0.45 × 100 − 0.55 × 60 = 45 − 33."]}
          result="EV = +$12. A good bluff."
        />
        <H>Break-even fold frequency</H>
        <P>Set the bluff EV to zero and solve for fold%. You get a neat shortcut:</P>
        <Formula note="Half-pot bluff: 33%. Pot-size bluff: 50%.">Break-even fold% = bet ÷ (pot + bet)</Formula>
        <Mistakes
          items={["Adding your own call to the amount you win.", "Using the pot after the bet as the reward for a bluff. You only win what was there before you bet.", "Ignoring that EV is an average: a +EV call still loses most of the time when equity is under 50%."]}
        />
        <Try>
          <EvCalc />
        </Try>
      </>
    ),
  },
  {
    id: "implied-odds",
    title: "Implied odds",
    summary: "When the price is too high now, but the money you'll win later can make up the difference.",
    minutes: 4,
    practice: "potOdds",
    body: () => (
      <>
        <P>
          Pot odds only count the money in the pot right now. <B>Implied odds</B> add the money you expect to win on later streets when you hit. A small draw against a deep-stacked
          opponent who'll pay you off can be a profitable call even when the pot odds say fold.
        </P>
        <Formula note="Set the EV of calling to zero and solve for the extra winnings.">Extra needed = (1 − equity) × call ÷ equity − (pot + bet)</Formula>
        <Example
          title="Turn: pot $50, villain bets $50. You have a gutshot (4 outs)."
          steps={[
            "Equity with one card to come: 4 ÷ 46 = 8.7%.",
            "Required equity: 50 ÷ 150 = 33%. Far too expensive on pot odds alone.",
            "Extra needed = 0.913 × 50 ÷ 0.087 − 100 ≈ 425.",
          ]}
          result="You'd need to win about $425 more on the river every time you hit. Unless stacks are deep and villain pays off huge bets, fold."
        />
        <H>When implied odds are good</H>
        <P>
          Deep stacks, hidden draws (a gutshot is harder to see than a flush draw), opponents who can't fold strong one-pair hands, and hands that make the nuts when they hit.
        </P>
        <H>Reverse implied odds</H>
        <P>
          The opposite problem: when you hit but still lose a big pot. Drawing to a low flush, a non-nut straight, or making top pair with a weak kicker can cost you more after you
          "hit" than you'd win. Discount draws that aren't to the nuts.
        </P>
        <Mistakes items={["Assuming you'll always get paid when the flush card lands. Scary cards slow opponents down.", "Ignoring stack sizes: you can't win more than what's behind."]} />
      </>
    ),
  },
  {
    id: "preflop",
    title: "Pre-flop ranges and position",
    summary: "Why ranges widen as you approach the button, and how to read mixed strategies.",
    minutes: 6,
    practice: "preflop",
    body: () => (
      <>
        <P>
          Pre-flop decisions are about ranges: the full set of hands you play from a seat. The later you act, the fewer players are left behind you, and the more hands you can play.
        </P>
        <Table
          head={["Seat (6-max)", "Opens about", "Why"]}
          rows={[
            ["UTG", "16%", "Five players still to act; anyone could wake up with a big hand."],
            ["HJ", "20%", "Four players behind."],
            ["CO", "28%", "Three players behind; you'll often have position after the flop."],
            ["BTN", "45%", "Only the blinds left, and you act last on every later street."],
            ["SB", "37%", "Only one player left, but you're out of position after the flop."],
          ]}
        />
        <H>Raise first in</H>
        <P>
          When it folds to you, the GTO play is almost always raise or fold. Limping (just calling the big blind) is rarely part of a solid strategy outside the small blind.
        </P>
        <H>Facing a raise</H>
        <P>
          Against an open you can 3-bet, call or fold. 3-bets combine strong hands (value) with hands that block strong hands and play well, like A5s (bluffs). The big blind
          defends very wide because it already has 1bb in the pot and gets a great price.
        </P>
        <H>Mixed strategies</H>
        <P>
          Solvers sometimes play the same hand two ways, for example raising 44 from UTG 60% of the time and folding 40%. Both choices earn about the same, and mixing keeps the
          range balanced. In the drills, any action a hand takes at least 25% of the time counts as correct, and you'll see the full split after you answer.
        </P>
        <H>Stack depth and table size</H>
        <P>
          These charts assume 100bb and a 6-max or 9-handed table. Shorter stacks favour hands that play well all-in (pairs, big aces); deeper stacks favour suited connectors.
          At a 9-handed table the early seats open even tighter because more players are left to act.
        </P>
        <Mistakes items={["Playing the same range from every seat.", "Calling too much from the small blind. 3-bet or fold is the simpler, stronger approach.", "Folding too much in the big blind against a button open."]} />
      </>
    ),
  },
  {
    id: "reading-ranges",
    title: "Reading the 13×13 grid",
    summary: "Suited above the diagonal, offsuit below, pairs on it. And why combos matter.",
    minutes: 3,
    body: () => (
      <>
        <P>
          Every starting hand fits in a 13 × 13 grid. Pairs run down the diagonal. Above it are suited hands (both cards the same suit, marked s); below it are offsuit hands (o).
        </P>
        <H>Combos</H>
        <Table
          head={["Hand type", "Combos", "Example"]}
          rows={[
            ["Pair", 6, "AA: A♠A♥, A♠A♦, A♠A♣, A♥A♦, A♥A♣, A♦A♣"],
            ["Suited", 4, "AKs: one per suit"],
            ["Offsuit", 12, "AKo: 4 × 4 − 4 suited"],
          ]}
        />
        <P>
          There are 1,326 two-card combinations in total. That's why an offsuit hand counts three times as much as a suited one when you add up a range's percentage: AKo is 12
          combos, AKs only 4.
        </P>
        <H>Card removal</H>
        <P>
          Cards you hold can't be in your opponent's hand. Holding the A♠ on a board with three spades means villain can never have the nut flush. This is why blockers matter
          when you choose bluffs.
        </P>
      </>
    ),
  },
  {
    id: "postflop",
    title: "Post-flop strategy",
    summary: "Range advantage, c-bet sizing by texture, minimum defense frequency, bluff ratios and SPR.",
    minutes: 8,
    practice: "postflop",
    body: () => (
      <>
        <H>Range advantage and nut advantage</H>
        <P>
          Whoever's range hits a board harder has the <B>range advantage</B>. Whoever holds more of the very best hands has the <B>nut advantage</B>. These two ideas decide how often
          and how big you bet.
        </P>
        <Table
          head={["Flop type", "Example", "BTN vs BB strategy"]}
          rows={[
            ["High and dry", "K♠ 7♦ 2♣", "Bet small (25–33%) with most of the range"],
            ["Paired", "8♠ 8♦ 3♣", "Bet small with most of the range"],
            ["Low and dry", "9♠ 5♦ 2♣", "Bet small often"],
            ["High and connected, two-tone", "Q♥ J♥ 9♣", "Bet bigger (66–75%) with a polarized range"],
            ["Low and connected", "7♠ 6♦ 5♣", "Check most of the range"],
            ["Monotone", "K♥ 8♥ 3♥", "Bet small, less often"],
          ]}
        />
        <P>
          A <B>polarized</B> range bets very strong hands and bluffs, and checks the medium-strength hands. A <B>merged</B> or range-wide strategy bets lots of everything small.
        </P>
        <H>Minimum defense frequency</H>
        <Formula note="How often you must continue so any-two-card bluffs don't profit.">MDF = pot ÷ (pot + bet)</Formula>
        <P>
          Facing a pot-size bet you must continue with 50% of your range; facing a half-pot bet, 67%. MDF is a reference point. Against players who almost never bluff, folding more
          is correct.
        </P>
        <H>Bluff-to-value ratio</H>
        <Formula note="Makes the caller indifferent: their required equity equals your bluff share.">Bluff share = bet ÷ (pot + 2 × bet)</Formula>
        <P>A pot-size river bet can be 1 bluff for every 2 value bets (33%). A half-pot bet: 1 bluff for every 3 (25%).</P>
        <H>Stack-to-pot ratio (SPR)</H>
        <Formula>SPR = effective stack ÷ pot</Formula>
        <P>
          SPR tells you how committed you are. Below about 4, top pair is usually happy to get all-in. Above 10, one pair is rarely worth a whole stack, and hands that make
          strong hands (sets, draws) gain value.
        </P>
        <Try>
          <SprCalc />
        </Try>
        <Mistakes
          items={[
            "C-betting big on every flop. Small sizes are often better on boards that favour you.",
            "Defending exactly MDF against a player who never bluffs.",
            "Bluffing with hands that block the hands you want to fold.",
          ]}
        />
      </>
    ),
  },
  {
    id: "range-equity",
    title: "Equity against a range",
    summary: "Your hand never plays against one hand. Learn to think in ranges, and when to value bet or bluff.",
    minutes: 5,
    practice: "equity",
    body: () => (
      <>
        <P>
          You almost never know your opponent's exact cards, so you estimate your equity against all the hands they could have. A hand that crushes one holding can be behind a whole
          range.
        </P>
        <H>All-in benchmarks</H>
        <Table
          head={["Matchup", "Equity", "Example"]}
          rows={[
            ["Bigger pair vs smaller pair", "≈ 80%", "KK vs 99"],
            ["Small pair vs two overcards", "≈ 52%", "22 vs AKo"],
            ["Overpair vs one overcard", "≈ 70%", "QQ vs AQ"],
            ["Two overcards vs two undercards", "≈ 63%", "AK vs 76"],
            ["Dominated hand", "≈ 25–30%", "AJ vs AK"],
          ]}
        />
        <H>Value bet, check or bluff</H>
        <P>
          On the river, think about the hands that will <B>call</B> your bet, not every hand villain might hold. If you win more than half the time against those calling hands, bet
          for value. If you beat the hands that fold but lose to the hands that call, check. If your hand can't win at showdown at all, it's a candidate to bluff.
        </P>
        <Formula>Value bet when your equity against calling hands is above 50%</Formula>
        <Example
          title="River: you have second pair. Villain calls bets with any pair or better."
          steps={["Hands that call: top pair, overpairs, two pair (you lose), and a few weaker pairs (you win).", "Against the calling range you win maybe 30%.", "Hands that fold: missed draws, which you already beat."]}
          result="Check. Betting only gets called by better hands and folds out worse."
        />
        <Mistakes items={["Valuing your hand against villain's whole range instead of their calling range.", "Turning a hand with showdown value into a bluff."]} />
      </>
    ),
  },
  {
    id: "glossary",
    title: "Glossary",
    summary: "Every term the trainer uses, in one place.",
    minutes: 3,
    body: () => (
      <dl className="mt-2 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {[
          ["3-bet", "A re-raise before the flop (the blinds count as the first bet, the open as the second)."],
          ["bb", "Big blind. Stack sizes and bets are often measured in big blinds."],
          ["Blocker", "A card in your hand that makes certain opponent hands less likely."],
          ["C-bet", "Continuation bet: the pre-flop raiser bets again on the flop."],
          ["Combo", "One specific two-card holding, like A♠K♠."],
          ["Equity", "Your share of the pot if all cards were dealt out; how often you win."],
          ["EV", "Expected value: the average profit of a decision."],
          ["GTO", "Game-theory optimal: a strategy that can't be exploited, even by an opponent who knows it."],
          ["Implied odds", "Money you expect to win on later streets when you hit."],
          ["MDF", "Minimum defense frequency: how often you must continue so bluffs don't auto-profit."],
          ["Outs", "Unseen cards that improve your hand to the likely winner."],
          ["Polarized", "A betting range of very strong hands and bluffs, with no medium hands."],
          ["Position", "Acting after your opponent. The button has position on everyone after the flop."],
          ["Pot odds", "The ratio of the pot to the cost of calling."],
          ["Range", "All the hands a player could have in a spot."],
          ["RFI", "Raise first in: opening the pot with a raise when everyone has folded to you."],
          ["SPR", "Stack-to-pot ratio: how many pots are left behind."],
          ["SRP", "Single-raised pot: one raise and a call before the flop."],
        ].map(([t, d]) => (
          <div key={t}>
            <dt className="font-display text-[19px] text-ivory">{t}</dt>
            <dd className="text-[15.5px] text-ivory/80">{d}</dd>
          </div>
        ))}
      </dl>
    ),
  },
]

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)

// ---------- Quick help for each question kind ----------
export interface QuickHelp {
  title: string
  steps: string[]
  formula?: string
  lesson: string
}

const PRE_HELP: QuickHelp = {
  title: "Choosing a pre-flop action",
  steps: [
    "Find your seat: earlier seats play tighter ranges, the button plays the widest.",
    "If everyone folded to you, the choice is raise or fold.",
    "Facing an open: 3-bet strong hands and some suited aces, call hands that play well after the flop, fold the rest.",
    "Hands on the edge of a range are often mixed; either action can be right.",
  ],
  lesson: "preflop",
}

export const HELP: Record<string, QuickHelp> = {
  "po-equity": { title: "Required equity", steps: ["Find the call amount (the bet you face).", "Add pot + bet + your call for the final pot.", "Divide the call by the final pot."], formula: "call ÷ (pot + bet + call)", lesson: "pot-odds" },
  "po-ratio": { title: "Pot odds as a ratio", steps: ["Add the pot and the bet: that's what you can win.", "Divide by the call amount.", "Write it as X : 1."], formula: "(pot + bet) : call", lesson: "pot-odds" },
  "po-draw": { title: "Draw: call or fold", steps: ["Count your outs.", "One card to come: equity ≈ outs × 2 (exact: outs ÷ 46).", "Work out required equity: call ÷ (pot + bet + call).", "Call if your equity is higher."], formula: "Call if equity > call ÷ final pot", lesson: "pot-odds" },
  "po-implied": { title: "Implied odds", steps: ["Equity e = outs ÷ 46.", "Break-even: e × (pot + bet + extra) = (1 − e) × call.", "Solve: extra = (1 − e) × call ÷ e − (pot + bet)."], formula: "(1 − e) × call ÷ e − (pot + bet)", lesson: "implied-odds" },
  "ev-call": { title: "EV of a call", steps: ["Win amount = pot + bet (not your own call).", "Multiply by your equity.", "Subtract (1 − equity) × your call."], formula: "e × (pot + bet) − (1 − e) × call", lesson: "expected-value" },
  "ev-bluff": { title: "EV of a bluff", steps: ["When they fold you win the pot.", "When they call you lose your bet.", "EV = fold% × pot − call% × bet."], formula: "f × pot − (1 − f) × bet", lesson: "expected-value" },
  "ev-breakeven": { title: "Break-even fold %", steps: ["You risk the bet to win the pot.", "Break-even = risk ÷ (risk + reward)."], formula: "bet ÷ (pot + bet)", lesson: "expected-value" },
  "outs-count": { title: "Counting outs", steps: ["Flush draw: 13 − the 4 suited cards you see = 9.", "Open-ended straight: 2 ranks × 4 = 8. Gutshot: 4.", "Combined draws: don't count the overlapping cards twice."], lesson: "outs" },
  "outs-rule": { title: "The 4-2 rule", steps: ["Count your outs.", "On the flop with two cards to come: × 4.", "On the turn: × 2."], formula: "outs × 4 (flop) or × 2 (turn)", lesson: "outs" },
  "post-cbet": { title: "C-bet strategy by texture", steps: ["Who does this board favour? High, dry boards favour the raiser.", "Low, connected boards favour the big blind: check more.", "Dynamic high boards: bet bigger with strong hands and draws, check medium hands."], lesson: "postflop" },
  "post-mdf": { title: "Minimum defense frequency", steps: ["A bluff risks the bet to win the pot.", "Continue often enough that it doesn't auto-profit.", "MDF = pot ÷ (pot + bet)."], formula: "pot ÷ (pot + bet)", lesson: "postflop" },
  "post-bluff": { title: "Bluff share of a bet", steps: ["Work out the caller's required equity: bet ÷ (pot + 2 × bet).", "Bluff that share of your bets."], formula: "bet ÷ (pot + 2 × bet)", lesson: "postflop" },
  "post-spr": { title: "Stack-to-pot ratio", steps: ["Effective stack behind = starting stack − chips already put in.", "Divide by the pot on the flop."], formula: "stack behind ÷ pot", lesson: "postflop" },
  "eq-river": { title: "Value, check or bluff", steps: ["List the hands that will call.", "If you beat more than half of them: value bet.", "If you beat the folders but lose to the callers: check.", "If you can't win at showdown: consider a bluff."], lesson: "range-equity" },
  "eq-flop": { title: "Equity against a range", steps: ["Ask how much of their range you beat now.", "Then how much of it can outdraw you, or you can outdraw.", "Strong made hands on dry boards often sit above 60%; weak pairs on wet boards much lower."], lesson: "range-equity" },
  "eq-preflop": { title: "All-in matchups", steps: ["Pair vs two overs ≈ 55%.", "Pair vs one over ≈ 70%.", "Bigger pair vs smaller pair ≈ 80%.", "Dominated (same top card) ≈ 25–30%."], lesson: "range-equity" },
  range: { title: "Your own range", steps: ["Picture the grid: pairs on the diagonal, suited above, offsuit below.", "Find the hand and recall its colour."], lesson: "reading-ranges" },
}
export const helpFor = (kind: string): QuickHelp => HELP[kind] ?? (kind.startsWith("pre-") ? PRE_HELP : HELP["po-equity"])
