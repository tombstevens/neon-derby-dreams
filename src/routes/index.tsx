import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/game/Game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dead Man's Downs — Gamble $50 into $5,000" },
      {
        name: "description",
        content:
          "A cursed PS1-style horse racing game. Ten $5 chips, 8-bit websafe horses, and a debt of $5,000 due by sunrise.",
      },
      { property: "og:title", content: "Dead Man's Downs — Gamble $50 into $5,000" },
      {
        property: "og:description",
        content: "A cursed PS1-style horse racing game with 8-bit websafe horses. Win $5,000 before sunrise.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <Game />;
}
