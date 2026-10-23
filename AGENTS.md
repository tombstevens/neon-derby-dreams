<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Game rules (chips, odds, payouts, race outcomes) live as pure functions in `src/game/engine.ts`; UI and canvas only read from it, so rules stay unit-testable.
- The race is drawn on a low-res canvas with a colour-crush/dither pass applied before sprites, so horse sprites keep their exact palette colours.
