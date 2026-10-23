// 8-bit horse sprites. Each char is one pixel:
// . transparent  B body  M mane/tail  J jockey silk  H helmet  W saddle cloth  K black
const FRAME_A = [
  "..........HHH...........",
  ".........HHHHH..........",
  "..........KJJ...........",
  ".........JJJJ.......MM..",
  "........JJJJJ......MBBB.",
  "...MM...JJWW......MBBKBB",
  "..MMMBBBBWWWBBBBBMBBBBBB",
  ".MM.BBBBBBBBBBBBBBB..BBK",
  ".M..BBBBBBBBBBBBBBB.....",
  "....BBBBBBBBBBBBBB......",
  "....BB.BB......BB.BB....",
  "...BB...BB....BB...BB...",
  "..BB.....BB..BB.....BB..",
  ".KK.......KKKK.......KK.",
];

const FRAME_B = [
  "..........HHH...........",
  ".........HHHHH..........",
  "..........KJJ...........",
  ".........JJJJ.......MM..",
  "........JJJJJ......MBBB.",
  "..MMM...JJWW......MBBKBB",
  ".MM.BBBBBWWWBBBBBMBBBBBB",
  ".M..BBBBBBBBBBBBBBB..BBK",
  "....BBBBBBBBBBBBBBB.....",
  "....BBBBBBBBBBBBBB......",
  ".....BBBB.....BBBB......",
  ".....B..BB...BB..B......",
  "......B..B...B...B......",
  "......K..K...K...K......",
];

const FRAME_C = [
  "..........HHH...........",
  ".........HHHHH..........",
  "..........KJJ...........",
  ".........JJJJ.......MM..",
  "........JJJJJ......MBBB.",
  "...MM...JJWW......MBBKBB",
  "..M.MBBBBWWWBBBBBMBBBBBB",
  "..M.BBBBBBBBBBBBBBB..BBK",
  "....BBBBBBBBBBBBBBB.....",
  "....BBBBBBBBBBBBBB......",
  "......BBB......BBB......",
  ".....BB.B.....B..BB.....",
  "....BB...B...B....BB....",
  "...KK....K...K.....KK...",
];

export const HORSE_FRAMES = [FRAME_A, FRAME_C, FRAME_B, FRAME_C];
export const SPRITE_W = 24;
export const SPRITE_H = 14;

export interface HorseColors {
  body: string;
  mane: string;
  silk: string;
}

export function drawHorse(
  ctx: CanvasRenderingContext2D,
  frame: number,
  x: number,
  y: number,
  colors: HorseColors,
  scale = 1,
) {
  const rows = HORSE_FRAMES[frame % HORSE_FRAMES.length];
  const map: Record<string, string> = {
    B: colors.body,
    M: colors.mane,
    J: colors.silk,
    H: colors.silk,
    W: "#FFFFFF",
    K: "#000000",
  };
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === ".") continue;
      ctx.fillStyle = map[ch];
      ctx.fillRect(Math.round(x + c * scale), Math.round(y + r * scale), scale, scale);
    }
  }
}
