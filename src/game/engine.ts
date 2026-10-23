// Pure game rules for DEAD MAN'S DOWNS. No DOM, no React — easy to test.

export const CHIP_VALUE = 5; // dollars per chip
export const STARTING_CHIPS = 10; // the found $50 chip, broken into 10 x $5
export const GOAL_DOLLARS = 5000;
export const GOAL_CHIPS = GOAL_DOLLARS / CHIP_VALUE;
export const FIELD_SIZE = 6;
export const TRACK_LENGTH = 1400; // world pixels

export type BetType = "WIN" | "PLACE";

export interface Horse {
  id: number; // saddle number 1..N
  name: string;
  body: string; // websafe hex
  mane: string;
  silk: string;
  form: string; // last 3 finishes, flavour only
  publicStrength: number;
  trueStrength: number;
  winMult: number; // total return per chip staked
  placeMult: number;
  style: number; // pace exponent: <1 front runner, >1 closer
}

export interface Race {
  number: number;
  horses: Horse[];
  tipHorseId: number;
  tipLine: string;
  order: number[]; // horse ids in finishing order
  finishTimes: Record<number, number>; // seconds
  wobble: Record<number, { a: number; w: number; phase: number }>;
}

export interface Bet {
  horseId: number;
  type: BetType;
  stake: number; // chips
}

// 216-colour "websafe" palette — every channel is a multiple of 0x33.
const WEBSAFE_LOUD = [
  "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
  "#FF9900", "#99FF00", "#FF0099", "#9900FF", "#00FF99", "#0099FF",
  "#FFFFFF", "#FF6666", "#66FF66", "#6666FF", "#FFCC00", "#CC00FF",
];
const WEBSAFE_DARK = ["#000000", "#330033", "#003333", "#333300", "#660000", "#000066", "#663300"];

const NAMES = [
  "ROT GUT", "MAMA'S ASHES", "LAST PAYCHECK", "BAD TOOTH", "GLUE FACTORY",
  "SUNDAY REGRET", "STATIC GHOST", "NO REFUNDS", "WET CIGARETTE", "PAWN TICKET",
  "DEAD BATTERY", "SECOND MORTGAGE", "LUCKY PETE (DEC.)", "TEETH IN A JAR",
  "VELVET LUNG", "MEMORY CARD", "LOW POLY LARRY", "DISC 2 OF 4", "THE LANDLORD",
  "FOG MACHINE", "UNPAID TAB", "CHEAP MOTEL", "ASHTRAY HEART", "GRANDMA'S RING",
];

const TIP_SOURCES = [
  "A man in the bathroom whispers: #%n \"can't lose.\"",
  "The vending machine dispenses a note: \"#%n\".",
  "A jockey with no face winks at you. His silks say #%n.",
  "Your ex calls. She just says \"%name\" and hangs up.",
  "The PA crackles: \"...%name... ...%name...\"",
  "A pigeon lands on the #%n board and stares at you.",
  "Old Sal says %name's been eating good. Old Sal is often wrong.",
];

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: Rng) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Sample a finishing order (Plackett–Luce) from exp(strength) weights. */
export function sampleOrder(strengths: { id: number; s: number }[], rng: Rng): number[] {
  const pool = strengths.map((h) => ({ id: h.id, w: Math.exp(h.s) }));
  const order: number[] = [];
  while (pool.length) {
    const total = pool.reduce((t, h) => t + h.w, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx].w;
      if (r <= 0) break;
    }
    order.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  return order;
}

const roundTo = (x: number, step: number) => Math.round(x / step) * step;

/** Chips returned for a winning bet (stake included), rounded down to whole chips. */
export function payout(stake: number, mult: number): number {
  return Math.floor(stake * mult + 1e-9);
}

/** Did this bet cash, given the finishing order? */
export function betWins(bet: Bet, order: number[]): boolean {
  if (bet.type === "WIN") return order[0] === bet.horseId;
  return order.slice(0, 2).includes(bet.horseId);
}

export function settleBet(bet: Bet, race: Race): number {
  const horse = race.horses.find((h) => h.id === bet.horseId);
  if (!horse || !betWins(bet, race.order)) return 0;
  return payout(bet.stake, bet.type === "WIN" ? horse.winMult : horse.placeMult);
}

export function generateRace(raceNumber: number, rng: Rng): Race {
  const names = shuffle(NAMES, rng).slice(0, FIELD_SIZE);
  const bodies = shuffle(WEBSAFE_LOUD, rng);
  const silks = shuffle(WEBSAFE_LOUD, rng);

  const horses: Horse[] = names.map((name, i) => {
    const publicStrength = gauss(rng) * 0.85;
    const body = bodies[i];
    let silk = silks[i];
    if (silk === body) silk = silks[(i + 7) % silks.length];
    return {
      id: i + 1,
      name,
      body,
      mane: WEBSAFE_DARK[Math.floor(rng() * WEBSAFE_DARK.length)],
      silk,
      form: Array.from({ length: 3 }, () => 1 + Math.floor(rng() * FIELD_SIZE)).join("-"),
      publicStrength,
      // The crowd is wrong sometimes. That's the whole game.
      trueStrength: publicStrength + gauss(rng) * 0.45,
      winMult: 0,
      placeMult: 0,
      style: 0.82 + rng() * 0.4,
    };
  });

  // Odds come from public opinion, with a ~10% house cut.
  const pubWeights = horses.map((h) => Math.exp(h.publicStrength));
  const total = pubWeights.reduce((a, b) => a + b, 0);
  const sim = mulberry32(Math.floor(rng() * 1e9));
  const placeCounts: Record<number, number> = {};
  const N = 1500;
  for (let k = 0; k < N; k++) {
    const o = sampleOrder(horses.map((h) => ({ id: h.id, s: h.publicStrength })), sim);
    placeCounts[o[0]] = (placeCounts[o[0]] ?? 0) + 1;
    placeCounts[o[1]] = (placeCounts[o[1]] ?? 0) + 1;
  }
  horses.forEach((h, i) => {
    const pWin = pubWeights[i] / total;
    const pPlace = Math.max((placeCounts[h.id] ?? 1) / N, 0.02);
    h.winMult = Math.min(60, Math.max(1.5, roundTo(0.9 / pWin, 0.5)));
    h.placeMult = Math.min(20, Math.max(1.1, roundTo(0.9 / pPlace, 0.1)));
  });

  // Tips: half the time the tip points at the horse the crowd underrates most.
  const underrated = [...horses].sort(
    (a, b) => b.trueStrength - b.publicStrength - (a.trueStrength - a.publicStrength),
  )[0];
  const tipHorse = rng() < 0.5 ? underrated : horses[Math.floor(rng() * horses.length)];
  const tipLine = TIP_SOURCES[Math.floor(rng() * TIP_SOURCES.length)]
    .replaceAll("%name", tipHorse.name)
    .replaceAll("%n", String(tipHorse.id));

  const order = sampleOrder(horses.map((h) => ({ id: h.id, s: h.trueStrength })), rng);

  const finishTimes: Record<number, number> = {};
  let t = 11 + rng() * 2;
  order.forEach((id, i) => {
    if (i > 0) t += 0.12 + rng() * 0.55;
    finishTimes[id] = t;
  });

  const wobble: Race["wobble"] = {};
  horses.forEach((h) => {
    wobble[h.id] = { a: 0.02 + rng() * 0.035, w: 1 + rng() * 2, phase: rng() * Math.PI * 2 };
  });

  return { number: raceNumber, horses, tipHorseId: tipHorse.id, tipLine, order, finishTimes, wobble };
}

/** World x-position of a horse at time t (seconds since the gate opened). */
export function horsePosition(race: Race, horseId: number, t: number): number {
  const T = race.finishTimes[horseId];
  const horse = race.horses.find((h) => h.id === horseId)!;
  if (t <= 0) return 0;
  const u = Math.min(t / T, 1);
  const wb = race.wobble[horseId];
  let f = Math.pow(u, horse.style) + wb.a * Math.sin(Math.PI * u) * Math.sin(wb.w * Math.PI * u + wb.phase);
  f = Math.max(0, Math.min(1, f));
  if (t > T) {
    // Pull up gently past the line.
    return TRACK_LENGTH + 40 * (1 - Math.exp(-(t - T) * 1.5));
  }
  return f * TRACK_LENGTH;
}

export const dollars = (chips: number) => `$${(chips * CHIP_VALUE).toLocaleString("en-US")}`;
