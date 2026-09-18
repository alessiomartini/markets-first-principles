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

- Read `README.md` and the relevant content/schema/component/pipeline files first.
- Keep authored content separate from generated/fallback data.
- Treat external data and credentials as untrusted; never commit secrets.
- Do not run refresh scripts against live services unless explicitly requested.
- Inspect `git diff` and report verification results before committing.
