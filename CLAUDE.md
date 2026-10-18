# Claude Code instructions

## Project

Astro/TypeScript educational site with content pipelines, flashcards, and
validation scripts.

## Verification

- Install with `npm ci` when needed.
- Run `npm run test` and `npm run build` after application changes.
- Run `npm run typecheck` or the narrowest relevant validation script when available.
- Use `npm run dev` for browser-facing changes and inspect the affected page.

## Workflow

- Read `README.md`, `ROADMAP.md` and the relevant content/schema/component/pipeline
  files first. `ROADMAP.md` lists what is half-done and what has already been tried
  and reverted (e.g. the `katex` 0.18 bump) — check it before repeating that work.
- Keep authored content separate from generated/fallback data.
- Treat external data and credentials as untrusted; never commit secrets.
- Do not run refresh scripts against live services unless explicitly requested.
- Inspect `git diff` and report verification results before committing.

## Dependencies

- `astro` and `@astrojs/mdx` are pinned to major versions 5/4 on purpose — see
  `ROADMAP.md` for why, and for the `npm audit` findings that make the eventual
  Astro 7 upgrade more than a style preference.
- `worker/` and `worker-flashcards/` are separate npm projects (Cloudflare Workers); run
  `npm install`/`npm outdated` inside each one, not from the root.

## Roadmap, idee e progressi

`ROADMAP.md` nella root è l'**unico** file per todo, idee, decisioni e diario del progetto
(niente `FUTURE-ARCHITECTURE.md`, `IDEE.md`, `TODO.md`). È letto da https://alessiomartini.github.io/projects-overview/.
Sezioni: `## <fase>` (checkbox, contano nella percentuale), `## Idee` (checkbox, non contano),
`## Decisioni e cose provate` (prosa: scartato/rimandato e perché, provato e annullato, limiti e bug noti), `## Log`.

- Alla fine di ogni sessione di lavoro (prima del commit finale), aggiorna `ROADMAP.md`:
  - spunta (`- [x]`) i punti completati in questa sessione;
  - aggiungi come `- [ ]` i nuovi compiti nella fase giusta, e le idee non decise in `## Idee`;
  - annota in `## Decisioni e cose provate` ciò che è stato scartato, rimandato o annullato, col perché;
  - aggiungi in cima a `## Log` una riga `- AAAA-MM-GG: <cosa è stato fatto, in una frase>`
    (se esiste già una riga con la data di oggi, estendila invece di crearne un'altra).
- Non riscrivere né riordinare le voci esistenti senza motivo; non cancellare le voci completate.
- Se `ROADMAP.md` non esiste, crealo da `templates/ROADMAP.md` di projects-overview.
- Includi l'aggiornamento di `ROADMAP.md` nello stesso commit del lavoro.
