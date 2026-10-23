import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHIP_VALUE,
  GOAL_CHIPS,
  STARTING_CHIPS,
  TRACK_LENGTH,
  betWins,
  dollars,
  generateRace,
  horsePosition,
  settleBet,
  type Bet,
  type BetType,
  type Race,
} from "./engine";
import { RaceCanvas, type RacePhase } from "./RaceCanvas";

type Screen = "title" | "intro" | "bet" | "race" | "result" | "broke" | "win";

const INTRO = [
  "SAT. 3:12 AM. DEAD MAN'S DOWNS.",
  "The night races never stopped after the fire. Nobody remembers the fire.",
  "Behind the vending machine you find a single $50 chip. It is warm.",
  "The cashier has no eyes. She slides you ten $5 chips anyway.",
  "You owe a man named Teeth $5,000 by sunrise.",
  "Better start winning.",
];

const WIN_LINES = [
  "The chips are warm. They smell like pennies.",
  "Somewhere a slot machine screams in celebration.",
  "The cashier with no eyes nods at you. Approval?",
  "You feel lucky. You feel watched.",
  "Teeth's men in the stands lower their binoculars.",
];
const LOSE_LINES = [
  "You hear the moon laugh.",
  "That was rent money. You think. You don't remember.",
  "The horse looks back at you as it crosses. It knows.",
  "A man hands you a napkin. It says 'SOON'.",
  "The fog gets a little closer.",
  "Your memory card is full. Overwrite?",
];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;

function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => setN(0), [text]);
  useEffect(() => {
    if (n >= text.length) {
      onDone?.();
      return;
    }
    const id = setTimeout(() => setN((x) => x + 1), 28);
    return () => clearTimeout(id);
  }, [n, text, onDone]);
  return (
    <span>
      {text.slice(0, n)}
      {n < text.length && <span className="opacity-0">{text.slice(n)}</span>}
    </span>
  );
}

function ChipStack({ chips }: { chips: number }) {
  const shown = Math.min(chips, 14);
  return (
    <div className="flex items-end gap-0.5" aria-hidden>
      {Array.from({ length: shown }).map((_, i) => (
        <span key={i} className="ps1-chip" style={{ animationDelay: `${i * 60}ms` }} />
      ))}
      {chips > shown && <span className="ml-1 text-accent">+{chips - shown}</span>}
    </div>
  );
}

export function Game() {
  const [screen, setScreen] = useState<Screen>("title");
  const [chips, setChips] = useState(STARTING_CHIPS);
  const [peak, setPeak] = useState(STARTING_CHIPS);
  const [runs, setRuns] = useState(1);
  const [race, setRace] = useState<Race | null>(null);
  const [introIdx, setIntroIdx] = useState(0);
  const [sel, setSel] = useState(0);
  const [betType, setBetType] = useState<BetType>("WIN");
  const [stake, setStake] = useState(1);
  const [bet, setBet] = useState<Bet | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [phase, setPhase] = useState<RacePhase>("idle");
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<{ won: number; line: string } | null>(null);
  const settledRef = useRef(false);

  const newRace = useCallback((n: number) => {
    setRace(generateRace(n, Math.random));
    setPhase("idle");
    setStartedAt(null);
    setBet(null);
    setResult(null);
    setSel(0);
    settledRef.current = false;
  }, []);

  // Title screen idles over a race so the gate isn't empty.
  useEffect(() => {
    if (!race) newRace(1);
  }, [race, newRace]);

  useEffect(() => {
    setStake((s) => Math.max(1, Math.min(s, chips)));
  }, [chips]);

  // Clock for countdown + commentary.
  useEffect(() => {
    if (screen !== "race") return;
    const id = setInterval(() => setNow(performance.now()), 150);
    return () => clearInterval(id);
  }, [screen]);

  const startRun = () => {
    setChips(STARTING_CHIPS);
    setPeak(STARTING_CHIPS);
    newRace(1);
    setIntroIdx(0);
    setScreen("intro");
  };

  const placeBet = (pass = false) => {
    if (!race) return;
    if (!pass) {
      const h = race.horses[sel]!;
      setBet({ horseId: h.id, type: betType, stake });
      setChips((c) => c - stake);
    } else {
      setBet(null);
    }
    setStartedAt(performance.now() + 3000);
    setNow(performance.now());
    setPhase("racing");
    setScreen("race");
  };

  const onFinished = useCallback(() => {
    if (!race || settledRef.current) return;
    settledRef.current = true;
    setPhase("done");
    const won = bet ? settleBet(bet, race) : 0;
    const line = !bet
      ? "You kept your chips in your pocket. They hum quietly."
      : won > 0
        ? pick(WIN_LINES)
        : pick(LOSE_LINES);
    setChips((c) => {
      const next = c + won;
      setPeak((p) => Math.max(p, next));
      return next;
    });
    setResult({ won, line });
    setScreen("result");
  }, [race, bet]);

  const continueAfterResult = () => {
    if (!race) return;
    if (chips >= GOAL_CHIPS) return setScreen("win");
    if (chips <= 0) return setScreen("broke");
    newRace(race.number + 1);
    setScreen("bet");
  };

  // Keyboard controls on the betting screen.
  useEffect(() => {
    if (screen !== "bet" || !race) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") setSel((s) => (s + race.horses.length - 1) % race.horses.length);
      else if (e.key === "ArrowDown") setSel((s) => (s + 1) % race.horses.length);
      else if (e.key === "ArrowLeft") setStake((s) => Math.max(1, s - 1));
      else if (e.key === "ArrowRight") setStake((s) => Math.min(chips, s + 1));
      else if (e.key.toLowerCase() === "t") setBetType((b) => (b === "WIN" ? "PLACE" : "WIN"));
      else if (e.key === "Enter") placeBet();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const raceInfo = useMemo(() => {
    if (!race || startedAt == null || screen !== "race") return null;
    const t = (now - startedAt) / 1000;
    if (t < 0) return { countdown: Math.ceil(-t), line: "The horses are loaded into the gate..." };
    const pos = race.horses
      .map((h) => ({ h, x: horsePosition(race, h.id, t) }))
      .sort((a, b) => b.x - a.x);
    const lead = pos[0]!;
    const second = pos[1]!;
    const prog = lead.x / TRACK_LENGTH;
    let line: string;
    if (t < 1.2) line = "AND THEY'RE OFF!";
    else if (prog >= 1) line = `#${race.order[0]} ${race.horses.find((h) => h.id === race.order[0])!.name} WINS IT!`;
    else if (prog > 0.8) line = `Final furlong! #${lead.h.id} ${lead.h.name} by a nose from #${second.h.id}!`;
    else line = `#${lead.h.id} ${lead.h.name} leads, #${second.h.id} ${second.h.name} in second...`;
    const mine = bet ? pos.findIndex((p) => p.h.id === bet.horseId) + 1 : null;
    return { countdown: 0, line, mine };
  }, [race, startedAt, now, screen, bet]);

  const progress = Math.min(1, chips / GOAL_CHIPS);
  const selHorse = race?.horses[sel];
  const potential =
    selHorse && Math.floor(stake * (betType === "WIN" ? selHorse.winMult : selHorse.placeMult));

  return (
    <main className="ps1-room min-h-screen w-full px-2 py-4 sm:px-6 sm:py-8">
      <div className="crt mx-auto w-full max-w-5xl">
        <div className="crt-inner ps1-wobble">
          {/* HUD */}
          <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border px-3 py-2 sm:px-4">
            <div className="font-display text-[10px] leading-relaxed text-primary sm:text-xs">
              DEAD MAN'S DOWNS
              <span className="ml-3 text-muted-foreground">RACE {race?.number ?? 1}</span>
            </div>
            <div className="flex items-center gap-4">
              <ChipStack chips={chips} />
              <div className="text-right leading-none">
                <div className="font-display text-xs text-accent sm:text-sm">{dollars(chips)}</div>
                <div className="text-lg text-muted-foreground">{chips} × ${CHIP_VALUE} chips</div>
              </div>
            </div>
            <div className="w-full">
              <div className="flex justify-between text-base text-muted-foreground">
                <span>DEBT TO TEETH</span>
                <span>{dollars(GOAL_CHIPS)}</span>
              </div>
              <div className="ps1-bar">
                <div className="ps1-bar-fill" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          </header>

          {/* Track */}
          <div className="relative">
            {race && (
              <RaceCanvas
                race={race}
                phase={phase}
                startedAt={startedAt}
                highlightId={(screen === "bet" ? selHorse?.id : bet?.horseId) ?? null}
                onFinished={onFinished}
              />
            )}
            {screen === "race" && raceInfo && raceInfo.countdown > 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="font-display chroma text-5xl text-accent sm:text-7xl">{raceInfo.countdown}</span>
              </div>
            )}
            {screen === "title" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/40 text-center">
                <h1 className="font-display chroma title-float text-2xl leading-snug text-primary sm:text-5xl">
                  DEAD MAN'S
                  <br />
                  DOWNS
                </h1>
                <p className="text-xl text-foreground sm:text-2xl">$50 → $5,000 BEFORE SUNRISE</p>
              </div>
            )}
          </div>

          {/* Bottom panel */}
          <section className="p-3 sm:p-4">
            {screen === "title" && (
              <div className="flex flex-col items-center gap-3 py-4">
                <button onClick={startRun} className="ps1-btn ps1-btn-primary blink-slow">
                  ▶ PRESS START
                </button>
                <p className="text-lg text-muted-foreground">© 1997 SUNKEN SOFTWARE · DISC 1 OF 1</p>
              </div>
            )}

            {screen === "intro" && (
              <button
                className="ps1-window w-full cursor-pointer p-4 text-left text-2xl leading-snug sm:p-6 sm:text-3xl"
                onClick={() =>
                  introIdx < INTRO.length - 1 ? setIntroIdx((i) => i + 1) : setScreen("bet")
                }
              >
                <Typewriter text={INTRO[introIdx] ?? ""} />
                <span className="blink mt-3 block text-right text-accent">▼</span>
              </button>
            )}

            {screen === "bet" && race && (
              <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
                <div className="ps1-window p-2 sm:p-3">
                  <div className="mb-1 grid grid-cols-[1.5rem_2rem_1fr_3.5rem_3.5rem_4rem] gap-1 px-1 text-base text-muted-foreground sm:grid-cols-[1.5rem_2rem_1fr_4.5rem_4.5rem_4.5rem]">
                    <span />
                    <span>#</span>
                    <span>HORSE</span>
                    <span className="hidden sm:block">FORM</span>
                    <span className="sm:hidden" />
                    <span className="text-right">WIN</span>
                    <span className="text-right">PLACE</span>
                  </div>
                  {race.horses.map((h, i) => (
                    <button
                      key={h.id}
                      onClick={() => setSel(i)}
                      onDoubleClick={() => placeBet()}
                      className={`ps1-row grid w-full grid-cols-[1.5rem_2rem_1fr_3.5rem_3.5rem_4rem] items-center gap-1 px-1 text-left text-xl sm:grid-cols-[1.5rem_2rem_1fr_4.5rem_4.5rem_4.5rem] sm:text-2xl ${i === sel ? "ps1-row-active" : ""}`}
                    >
                      <span className="text-accent">{i === sel ? "▶" : ""}</span>
                      <span className="saddle" style={{ backgroundColor: h.body }}>
                        {h.id}
                      </span>
                      <span className="truncate">{h.name}</span>
                      <span className="hidden whitespace-nowrap text-muted-foreground sm:block">{h.form}</span>
                      <span className="sm:hidden" />
                      <span className={`text-right ${betType === "WIN" ? "text-accent" : ""}`}>×{h.winMult}</span>
                      <span className={`text-right ${betType === "PLACE" ? "text-accent" : ""}`}>×{h.placeMult.toFixed(1)}</span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  <div className="ps1-window p-3 text-xl leading-tight text-foreground">
                    <span className="text-primary">TIP: </span>
                    {race.tipLine}
                  </div>
                  <div className="ps1-window flex flex-col gap-3 p-3">
                    <div className="flex gap-2">
                      {(["WIN", "PLACE"] as BetType[]).map((b) => (
                        <button
                          key={b}
                          onClick={() => setBetType(b)}
                          className={`ps1-btn flex-1 ${betType === b ? "ps1-btn-primary" : ""}`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                    <p className="text-lg leading-tight text-muted-foreground">
                      {betType === "WIN" ? "Your horse must finish 1st." : "Your horse must finish 1st or 2nd."}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <button className="ps1-btn" onClick={() => setStake((s) => Math.max(1, s - 1))}>
                        −
                      </button>
                      <div className="text-center leading-none">
                        <div className="font-display text-sm text-accent">{stake} CHIP{stake > 1 ? "S" : ""}</div>
                        <div className="text-lg text-muted-foreground">{dollars(stake)}</div>
                      </div>
                      <button className="ps1-btn" onClick={() => setStake((s) => Math.min(chips, s + 1))}>
                        +
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button className="ps1-btn flex-1" onClick={() => setStake((s) => Math.min(chips, s * 2))}>
                        ×2
                      </button>
                      <button className="ps1-btn flex-1" onClick={() => setStake(Math.max(1, Math.floor(chips / 2)))}>
                        HALF
                      </button>
                      <button className="ps1-btn ps1-btn-danger flex-1" onClick={() => setStake(chips)}>
                        ALL IN
                      </button>
                    </div>
                    <div className="text-xl leading-tight">
                      #{selHorse?.id} {selHorse?.name} to {betType} → returns{" "}
                      <span className="text-accent">
                        {potential} chips ({dollars(potential ?? 0)})
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button className="ps1-btn ps1-btn-primary flex-[2]" onClick={() => placeBet()}>
                        ▶ BET
                      </button>
                      <button className="ps1-btn flex-1" onClick={() => placeBet(true)}>
                        PASS
                      </button>
                    </div>
                  </div>
                  <p className="hidden text-base text-muted-foreground md:block">↑↓ HORSE · ←→ STAKE · T TYPE · ENTER BET</p>
                </div>
              </div>
            )}

            {screen === "race" && race && (
              <div className="ps1-window p-4 text-2xl leading-snug sm:text-3xl">
                <p>{raceInfo?.line}</p>
                {bet && raceInfo?.mine ? (
                  <p className="mt-2 text-xl text-muted-foreground">
                    YOUR {bet.type} BET: #{bet.horseId} ({bet.stake} chips) — currently{" "}
                    <span className="text-accent">{ordinal(raceInfo.mine)}</span>
                  </p>
                ) : (
                  <p className="mt-2 text-xl text-muted-foreground">You're just watching. Coward.</p>
                )}
              </div>
            )}

            {screen === "result" && race && result && (
              <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                <div className="ps1-window p-3">
                  <div className="mb-1 font-display text-xs text-primary">OFFICIAL RESULT</div>
                  {race.order.map((id, i) => {
                    const h = race.horses.find((x) => x.id === id)!;
                    return (
                      <div
                        key={id}
                        className={`flex items-center gap-2 text-2xl ${bet?.horseId === id ? "text-accent" : ""}`}
                      >
                        <span className="w-10 text-muted-foreground">{ordinal(i + 1)}</span>
                        <span className="saddle" style={{ backgroundColor: h.body }}>
                          {h.id}
                        </span>
                        <span className="truncate">{h.name}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="ps1-window flex flex-col justify-between gap-3 p-4">
                  <div>
                    {bet ? (
                      betWins(bet, race.order) ? (
                        <div className="font-display chroma text-xl text-accent sm:text-2xl">+{result.won} CHIPS</div>
                      ) : (
                        <div className="font-display chroma text-xl text-primary sm:text-2xl">−{bet.stake} CHIPS</div>
                      )
                    ) : (
                      <div className="font-display text-xl text-muted-foreground">NO BET</div>
                    )}
                    <p className="mt-3 text-2xl leading-snug">
                      <Typewriter text={result.line} />
                    </p>
                  </div>
                  <button className="ps1-btn ps1-btn-primary" onClick={continueAfterResult}>
                    ▶ {chips <= 0 ? "..." : chips >= GOAL_CHIPS ? "CASH OUT" : "NEXT RACE"}
                  </button>
                </div>
              </div>
            )}

            {screen === "broke" && (
              <GameOver
                peak={peak}
                races={race?.number ?? 1}
                onContinue={() => {
                  setRuns((r) => r + 1);
                  startRunAgain();
                }}
                onQuit={() => setScreen("title")}
                runs={runs}
              />
            )}

            {screen === "win" && (
              <div className="ps1-window flex flex-col items-center gap-3 p-6 text-center">
                <div className="font-display chroma text-xl leading-relaxed text-accent sm:text-3xl">YOU PAID TEETH</div>
                <p className="text-2xl">
                  {dollars(chips)} in {race?.number} races. The sun comes up. It looks wrong, but it's up.
                </p>
                <p className="text-xl text-muted-foreground">Times you found the chip: {runs}</p>
                <button className="ps1-btn ps1-btn-primary" onClick={() => setScreen("title")}>
                  ▶ RETURN TO TITLE
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );

  function startRunAgain() {
    setChips(STARTING_CHIPS);
    setPeak(STARTING_CHIPS);
    newRace(1);
    setIntroIdx(INTRO.length - 1);
    setScreen("bet");
  }
}

function GameOver({
  peak,
  races,
  runs,
  onContinue,
  onQuit,
}: {
  peak: number;
  races: number;
  runs: number;
  onContinue: () => void;
  onQuit: () => void;
}) {
  const [count, setCount] = useState(9);
  useEffect(() => {
    if (count <= 0) {
      onQuit();
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [count, onQuit]);
  return (
    <div className="ps1-window flex flex-col items-center gap-3 p-6 text-center">
      <div className="font-display chroma text-2xl text-primary sm:text-4xl">YOU ARE BROKE</div>
      <p className="text-2xl">
        {races} races. Peak bankroll {dollars(peak)}. Teeth is waiting in the parking lot.
      </p>
      <div className="font-display text-sm text-accent">CONTINUE? {count}</div>
      <p className="text-xl text-muted-foreground">
        (There's another $50 chip behind the vending machine. There always is. Run #{runs + 1}.)
      </p>
      <div className="flex gap-2">
        <button className="ps1-btn ps1-btn-primary" onClick={onContinue}>
          ▶ YES
        </button>
        <button className="ps1-btn" onClick={onQuit}>
          NO
        </button>
      </div>
    </div>
  );
}

function ordinal(n: number) {
  return n + (["TH", "ST", "ND", "RD"][n % 10 > 3 || Math.floor(n / 10) === 1 ? 0 : n % 10] ?? "TH");
}
