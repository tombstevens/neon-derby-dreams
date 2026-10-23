import { useEffect, useRef } from "react";
import { TRACK_LENGTH, horsePosition, type Race } from "./engine";
import { SPRITE_H, SPRITE_W, drawHorse } from "./sprites";

export const VIEW_W = 320;
export const VIEW_H = 180;
const TRACK_TOP = 96;
const LANE_GAP = 11;
const START_X = 40; // screen x of the gate when camera is at 0

export type RacePhase = "idle" | "racing" | "done";

interface Props {
  race: Race;
  phase: RacePhase;
  startedAt: number | null;
  highlightId?: number | null;
  onFinished?: () => void;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** PS1-style ordered dither + colour crush on the whole frame. */
function crush(ctx: CanvasRenderingContext2D) {
  const img = ctx.getImageData(0, 0, VIEW_W, VIEW_H);
  const d = img.data;
  const step = 255 / 12;
  for (let y = 0; y < VIEW_H; y++) {
    for (let x = 0; x < VIEW_W; x++) {
      const i = (y * VIEW_W + x) * 4;
      const th = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * step;
      d[i] = Math.round((d[i] + th) / step) * step;
      d[i + 1] = Math.round((d[i + 1] + th) / step) * step;
      d[i + 2] = Math.round((d[i + 2] + th) / step) * step;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function buildSky(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = VIEW_W;
  c.height = TRACK_TOP;
  const g = c.getContext("2d")!;
  const top = [8, 10, 22];
  const bottom = [70, 78, 74];
  for (let y = 0; y < TRACK_TOP; y++) {
    const t = Math.pow(y / TRACK_TOP, 1.6);
    g.fillStyle = `rgb(${lerp(top[0], bottom[0], t)},${lerp(top[1], bottom[1], t)},${lerp(top[2], bottom[2], t)})`;
    g.fillRect(0, y, VIEW_W, 1);
  }
  // Moon, slightly wrong.
  g.fillStyle = "rgb(214,206,160)";
  g.beginPath();
  g.arc(250, 26, 13, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgb(150,140,110)";
  g.fillRect(244, 22, 3, 2);
  g.fillRect(253, 22, 3, 2);
  g.fillRect(246, 31, 9, 1);
  // Stars
  for (let i = 0; i < 40; i++) {
    g.fillStyle = i % 5 === 0 ? "rgb(200,60,60)" : "rgb(170,170,190)";
    g.fillRect((i * 97) % VIEW_W, (i * 53) % 50, 1, 1);
  }
  return c;
}

function buildDirt(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = VIEW_H - TRACK_TOP;
  const g = c.getContext("2d")!;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < 64; x++) {
      const n = ((x * 73856093) ^ (y * 19349663)) & 15;
      const shade = 52 + n * 2 + (y % 11 === 0 ? -10 : 0);
      g.fillStyle = `rgb(${shade + 22},${shade},${shade - 22})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

export function RaceCanvas({ race, phase, startedAt, highlightId, onFinished }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const finishedRef = useRef(false);
  const cbRef = useRef(onFinished);
  cbRef.current = onFinished;

  useEffect(() => {
    finishedRef.current = false;
  }, [race, phase]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;
    const sky = buildSky();
    const dirt = buildDirt();
    let raf = 0;
    let lastCam = 0;
    const lastHorseFinish = Math.max(...Object.values(race.finishTimes));

    const render = (now: number) => {
      let t = phase === "idle" || startedAt == null ? 0 : (now - startedAt) / 1000;
      if (phase === "done") t = Math.min(t, lastHorseFinish + 0.8);
      const positions = race.horses.map((h) => ({ h, x: horsePosition(race, h.id, t) }));
      const leader = Math.max(...positions.map((p) => p.x));
      const last = Math.min(...positions.map((p) => p.x));
      let cam = Math.max((leader + last) / 2 - 150, leader - 250);
      cam = Math.max(0, Math.min(cam, TRACK_LENGTH - 230));
      cam = lerp(lastCam, cam, 0.15);
      lastCam = cam;
      const jitter = () => (Math.random() < 0.08 ? (Math.random() < 0.5 ? -1 : 1) : 0);

      // --- Sky
      ctx.drawImage(sky, 0, 0);

      // --- Far hills (low poly, jittery vertices)
      const far = cam * 0.1;
      ctx.fillStyle = "rgb(34,44,40)";
      ctx.beginPath();
      ctx.moveTo(0, TRACK_TOP);
      for (let i = -1; i < 12; i++) {
        const bx = i * 40 - (far % 40);
        const seed = Math.floor(far / 40) + i;
        const hy = 58 + ((seed * 37) % 17);
        ctx.lineTo(Math.round(bx) + jitter(), hy + jitter());
      }
      ctx.lineTo(VIEW_W, TRACK_TOP);
      ctx.fill();

      // --- Grandstand
      const gx = 30 - cam * 0.35;
      for (let k = 0; k < 4; k++) {
        const sx = Math.round(gx + k * 420);
        if (sx > VIEW_W || sx < -220) continue;
        ctx.fillStyle = "rgb(22,22,28)";
        ctx.fillRect(sx, 64, 200, 30);
        ctx.fillRect(sx - 6, 60, 212, 4);
        for (let wx = 0; wx < 20; wx++) {
          for (let wy = 0; wy < 3; wy++) {
            const flick = Math.sin(now / 300 + wx * 3.1 + wy * 7 + k) > 0.7;
            ctx.fillStyle = flick ? "rgb(40,40,40)" : (wx + wy + k) % 7 === 0 ? "rgb(220,40,40)" : "rgb(200,160,70)";
            ctx.fillRect(sx + 6 + wx * 10, 68 + wy * 8, 4, 3);
          }
        }
      }

      // --- Fog band
      ctx.fillStyle = "rgba(90,100,96,0.35)";
      ctx.fillRect(0, 78, VIEW_W, 18);

      // --- Dirt
      const dOff = -(Math.round(cam) % 64);
      for (let x = dOff; x < VIEW_W; x += 64) ctx.drawImage(dirt, x, TRACK_TOP);

      // --- Back rail
      ctx.fillStyle = "rgb(170,170,160)";
      ctx.fillRect(0, TRACK_TOP - 4, VIEW_W, 2);
      for (let wxp = Math.floor(cam / 24) * 24; wxp < cam + VIEW_W; wxp += 24) {
        ctx.fillRect(Math.round(wxp - cam), TRACK_TOP - 6, 2, 8);
      }

      // --- Markers, gate, finish
      for (let m = 200; m < TRACK_LENGTH; m += 200) {
        const sx = Math.round(START_X + m - cam);
        if (sx < -10 || sx > VIEW_W) continue;
        ctx.fillStyle = "rgb(200,30,30)";
        ctx.fillRect(sx, TRACK_TOP - 16, 2, 14);
        ctx.fillStyle = "rgb(230,230,220)";
        ctx.fillRect(sx - 3, TRACK_TOP - 18, 8, 5);
        ctx.fillStyle = "rgb(20,20,20)";
        const f = Math.round((TRACK_LENGTH - m) / 200);
        ctx.font = "5px monospace";
        ctx.fillText(String(f), sx - 1, TRACK_TOP - 14);
      }
      const finishX = Math.round(START_X + TRACK_LENGTH + SPRITE_W - cam);
      if (finishX > -10 && finishX < VIEW_W + 10) {
        for (let y = TRACK_TOP; y < VIEW_H - 6; y += 3) {
          ctx.fillStyle = (y / 3) % 2 ? "rgb(240,240,240)" : "rgb(10,10,10)";
          ctx.fillRect(finishX, y, 3, 3);
          ctx.fillStyle = (y / 3) % 2 ? "rgb(10,10,10)" : "rgb(240,240,240)";
          ctx.fillRect(finishX + 3, y, 3, 3);
        }
        ctx.fillStyle = "rgb(230,230,220)";
        ctx.fillRect(finishX - 1, TRACK_TOP - 30, 2, 30);
        ctx.fillStyle = "rgb(200,30,30)";
        ctx.fillRect(finishX - 14, TRACK_TOP - 36, 30, 8);
      }
      const gateX = Math.round(START_X + SPRITE_W + 2 - cam);
      if (gateX > -10 && gateX < VIEW_W) {
        ctx.fillStyle = "rgb(120,120,130)";
        ctx.fillRect(gateX, TRACK_TOP - 8, 3, VIEW_H - TRACK_TOP);
      }

      crush(ctx);

      // --- Horses (drawn after the crush so websafe colours stay pure)
      const behind: number[] = [];
      positions.forEach(({ h, x }, i) => {
        const y = TRACK_TOP + 1 + i * LANE_GAP;
        const sx = START_X + x - cam;
        const moving = phase !== "idle" && t > 0;
        const frame = moving ? Math.floor(now / 70 + i * 2) : 0;
        const bob = moving ? (Math.floor(now / 70 + i) % 2) : Math.floor(now / 500 + i) % 2;
        if (sx < -SPRITE_W) {
          behind.push(i);
          return;
        }
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(Math.round(sx + 3), y + SPRITE_H - 1, SPRITE_W - 5, 2);
        drawHorse(ctx, frame, sx, y - bob, h);
        // Saddle number
        ctx.fillStyle = "#000000";
        ctx.font = "bold 5px monospace";
        ctx.fillText(String(h.id), Math.round(sx + 10), y - bob + 11);
        if (highlightId === h.id) {
          ctx.fillStyle = Math.floor(now / 200) % 2 ? "#FFFF00" : "#FF0000";
          ctx.fillRect(Math.round(sx + 10), y - bob - 4, 3, 2);
          ctx.fillRect(Math.round(sx + 11), y - bob - 2, 1, 1);
        }
      });
      behind.forEach((i) => {
        const y = TRACK_TOP + 4 + i * LANE_GAP;
        ctx.fillStyle = race.horses[i].body;
        ctx.fillRect(1, y, 8, 7);
        ctx.fillStyle = "#000000";
        ctx.font = "bold 6px monospace";
        ctx.fillText(String(race.horses[i].id), 3, y + 6);
      });

      // --- Front rail (faster parallax)
      ctx.fillStyle = "rgb(200,200,190)";
      ctx.fillRect(0, VIEW_H - 6, VIEW_W, 2);
      for (let wxp = Math.floor((cam * 1.4) / 30) * 30; wxp < cam * 1.4 + VIEW_W; wxp += 30) {
        ctx.fillRect(Math.round(wxp - cam * 1.4), VIEW_H - 8, 3, 8);
      }

      if (phase === "racing" && !finishedRef.current && t > lastHorseFinish + 0.8) {
        finishedRef.current = true;
        cbRef.current?.();
      }

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [race, phase, startedAt, highlightId]);

  return <canvas ref={ref} width={VIEW_W} height={VIEW_H} className="ps1-canvas" />;
}
