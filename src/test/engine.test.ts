import { describe, expect, it } from "vitest";
import {
  CHIP_VALUE,
  GOAL_CHIPS,
  STARTING_CHIPS,
  generateRace,
  mulberry32,
  payout,
  settleBet,
} from "@/game/engine";

describe("game rules", () => {
  it("starts with ten $5 chips ($50)", () => {
    expect(STARTING_CHIPS).toBe(10);
    expect(CHIP_VALUE).toBe(5);
    expect(STARTING_CHIPS * CHIP_VALUE).toBe(50);
  });

  it("goal is $5000", () => {
    expect(GOAL_CHIPS * CHIP_VALUE).toBe(5000);
  });

  it("pays out whole chips, rounded down", () => {
    expect(payout(2, 4.5)).toBe(9);
    expect(payout(3, 1.5)).toBe(4);
  });

  it("WIN bet only pays on first place; PLACE pays on first or second", () => {
    const race = generateRace(1, mulberry32(42));
    const [first, second, third] = race.order;
    const h1 = race.horses.find((h) => h.id === first)!;
    expect(settleBet({ horseId: first, type: "WIN", stake: 2 }, race)).toBe(payout(2, h1.winMult));
    expect(settleBet({ horseId: second, type: "WIN", stake: 2 }, race)).toBe(0);
    expect(settleBet({ horseId: second, type: "PLACE", stake: 2 }, race)).toBeGreaterThan(0);
    expect(settleBet({ horseId: third, type: "PLACE", stake: 2 }, race)).toBe(0);
  });
});
