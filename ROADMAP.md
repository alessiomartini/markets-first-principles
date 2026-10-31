# Roadmap

<!--
Unico file per todo, idee, decisioni e diario, letto da Projects Overview
(https://alessiomartini.github.io/projects-overview/). Protocollo: templates/ROADMAP.md di projects-overview.
-->

## Contenuti
- [x] Struttura: 8 percorsi e 51 pagine con vocabolario e specifiche delle figure
- [x] 3 pagine scritte
- [ ] Scrivere le altre 48 pagine (oggi sono bozze)
  - [x] Pagina "Derivatives: what the word actually means" scritta (conteggio reale ora 24/51 scritte secondo `npm run audit:content`)
  - [x] Pagina "Options" scritta (conteggio reale ora 25/51 scritte secondo `npm run audit:content`)
  - [x] Pagina "Swaps and the rest" scritta (conteggio reale ora 26/51 scritte secondo `npm run audit:content`)
  - [x] Pagina "Hedging vs speculation vs arbitrage" scritta (conteggio reale ora 27/51 scritte secondo `npm run audit:content`)
  - [x] Pagina "No-arbitrage and replication" scritta (conteggio reale ora 28/51 scritte secondo `npm run audit:content`; apre il percorso Pricing and risk)
  - [x] Pagina "Bachelier and Black-Scholes" scritta (conteggio reale ora 29/51 scritte secondo `npm run audit:content`)
  - [x] Pagina "The volatility surface" scritta (conteggio reale ora 30/51 scritte secondo `npm run audit:content`)
  - [x] Pagina "Portfolio construction" scritta (conteggio reale ora 31/51 scritte secondo `npm run audit:content`)
  - [x] Pagina "Risk measures" scritta (conteggio reale ora 32/51 scritte secondo `npm run audit:content`)
  - [x] Pagina "Position sizing" scritta (conteggio reale ora 33/51 scritte secondo `npm run audit:content`; chiude il percorso Pricing and risk)
  - [x] Pagina "What GDP actually measures" scritta (conteggio reale ora 34/51 scritte secondo `npm run audit:content`; apre il percorso Economics)
  - [x] Pagina "Money and inflation" scritta (conteggio reale ora 35/51 scritte secondo `npm run audit:content`)
  - [x] Pagina "Interest rates and central banks" scritta (conteggio reale ora 36/51 scritte secondo `npm run audit:content`)
  - [x] Pagina "The yield curve" scritta (conteggio reale ora 37/51 scritte secondo `npm run audit:content`)
  - [x] Pagina "Labour, output, prices" scritta (conteggio reale ora 38/51 scritte secondo `npm run audit:content`)
  - [x] Pagina "Exchange rates" scritta (conteggio reale ora 39/51 scritte secondo `npm run audit:content`)
  - [x] Pagina "Credit and the cycle" scritta (conteggio reale ora 40/51 scritte secondo `npm run audit:content`)
  - [x] Pagina "Economics as a complex system" scritta (conteggio reale ora 41/51 scritte secondo `npm run audit:content`; chiude il percorso Economics)
  - [x] Pagina "Clearing and settlement" scritta (conteggio reale ora 42/51 scritte secondo `npm run audit:content`; apre il percorso Plumbing and institutions)
  - [x] Pagina "Margin and leverage" scritta (conteggio reale ora 43/51 scritte secondo `npm run audit:content`)
- [ ] Glossario: 259 termini scritti su 300 dichiarati
  - [x] 20 voci (Volatility surface, già usata dalla pagina del percorso Pricing and risk; 19 termini del percorso Economics: PIL nominale/reale/deflatore, identità della spesa, base monetaria, M2, velocità, CPI/PCE/HICP, attese di inflazione, tasso di policy, tasso reale, term premium, QE, trasmissione monetaria, steepening/flattening/inversione) (221/300)
  - [x] 6 voci (Position sizing, Fractional Kelly, Volatility targeting, Risk budgeting, già usate dalla pagina Position sizing; Flow, Stock per la pagina "What GDP actually measures") (227/300)
  - [x] 4 voci (Unemployment rate, Output gap, Phillips curve, NAIRU, per la pagina "Labour, output, prices") (237/300)
  - [x] 6 voci (Spot FX, Forward FX, Purchasing power parity, Uncovered/Covered interest parity, Carry trade, per la pagina "Exchange rates") (243/300)
  - [x] 5 voci (Deleveraging, Financial accelerator, Systemic risk, Credit-to-GDP gap, Financial instability hypothesis, per la pagina "Credit and the cycle") (248/300)
  - [x] 4 voci (Equilibrium, Agent-based model, Reflexivity, Herding, per la pagina "Economics as a complex system") (252/300)
  - [x] 5 voci (Novation, Netting, T+1, Delivery versus payment, Settlement fail, per la pagina "Clearing and settlement") (257/300)
  - [x] 2 voci (Haircut, Rehypothecation, per la pagina "Margin and leverage") (259/300)
- [ ] Script per le figure: 3 su 51
- [ ] Compilare `pipeline/manual/market_sizes.csv`

## Tecnica
- [x] Notes worker: rate limiting su `POST /notes` (spostato nel repo `site-notes`, che ora riceve le note)

## Idee

### Feedback centralizzato (idea, non ancora decisa)

- [x] Feedback centralizzato (fatto il 2026-10-19: backend unico `site-notes`)

Oggi ogni sito di Alessio che vuole raccogliere note (questo, e
`realtime-earth`) ha il proprio D1 dedicato più un Worker dedicato: qui è
`worker/` (tabella `notes(id, text, page, created_at)`, vedi `worker/schema.sql`
e `worker/README.md`). Non è un feedback pubblico dei lettori: è una casella
per note personali di Alessio mentre rilegge il sito, senza endpoint di
lettura HTTP — le note si leggono solo da D1 direttamente (wrangler o il
connettore Cloudflare).

Idea, non decisa: consolidare in un **unico database D1 condiviso fra tutti i
siti**, dietro un **unico Worker** con una allowlist CORS per dominio
chiamante, invece di un D1 + Worker per sito. Schema tipo
`notes(id, site, page, text, created_at, ...)`, dove `site` distingue le note
di questo sito da quelle di `realtime-earth` (e di eventuali altri in
futuro).

**Pro:**
- Meno infrastruttura Cloudflare da mantenere (un D1, un Worker, un deploy
  workflow invece di N).
- Un solo posto dove leggere tutte le note di tutti i siti.

**Contro:**
- Un bug nel Worker condiviso rompe la raccolta note ovunque, non solo su un
  sito.
- Va migrato lo storico esistente (le note già in
  `markets-first-principles-notes` e in quella di `realtime-earth`) nel nuovo
  schema con colonna `site`.

**Priorità bassa** — il sistema attuale funziona, non ci sono bug noti, e
questo repo ha lavoro editoriale molto più urgente (vedi sopra). Non
implementare senza che Alessio lo chieda esplicitamente.

## Decisioni e cose provate

Ideas not yet decided, work left half-done, and known blockers. Read this
before starting new work so effort does not go toward something already
tried and reverted, or already ruled out.

### Content, half-finished

- **48 of 51 pages are stubs.** Vocabulary and figure specs are already
  written in `content-map.json`; the prose is not. `npm run audit:content`
  lists exactly which ones.
- **180 of 300 declared glossary terms are written** (count from `npm run audit:content`, 2026-10-18; it was stale at 29). Same command lists the
  rest.
- **Figure scripts exist for 3 of the 51 specified figures**
  (`fetch_order_book.py`, `fetch_tails.py`, `fetch_market_sizes.py`). The other
  48 figure specs in `content-map.json` name a script that still has to be
  written.
- **`pipeline/manual/market_sizes.csv` is not filled in.** Global equity
  capitalisation, bond outstandings and FX turnover are annual-report numbers,
  not API data, so they have to be transcribed by hand with a source URL per
  row. Until then that figure stays `synthetic: true` and shows `SCHEMATIC`.

### Astro 7 upgrade — deliberately not done

The project is pinned to Astro 5 (`^5.6.1`) with `@astrojs/mdx@4`, a pairing
verified to work together. Astro 7 and `@astrojs/mdx@8` are current upstream.
This is described in the README as "a separate, mechanical change" rather
than a blocker — it has not been attempted, just deferred, because it is a
major-version jump across the templating engine that the whole site depends
on and deserves its own pass with its own verification, not a drive-by bump
alongside documentation work.

**This is no longer just a style preference.** `npm audit` (run 2026-09-21)
reports the installed Astro line (`<=7.2.7`, which covers everything back
through the current 5.18.2) as carrying several vulnerabilities marked
critical/high — multiple XSS advisories, a host-header SSRF in the
prerendered error page, and an RCE via AVIF image optimisation — fixed only
by upgrading to `astro@7.3.3`. The site builds to static HTML
(`output: "static"`) and is not indexed, which narrows the real exposure, but
"narrows" is not "removes": run `npm audit` again before treating this as
settled, and prioritise the Astro 7 migration over other dependency work.

### katex 0.18 upgrade — attempted this session, reverted

`katex` was bumped from `^0.16.22` to `^0.18.7` (current `latest`) to close
the gap `npm outdated` reported. `npm run test` passed unchanged (123/123),
but `npm run build` crashed partway through static-route generation:

```
Cannot find module '...\dist\chunks\the-order-book_C36RiKmu.mjs' imported from
'...\dist\chunks\content-modules_C_k3y3Xx.mjs'
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
```

Reverting `katex` to `^0.16.22` (current `0.16.47`) and rebuilding with an
otherwise-identical lockfile succeeds cleanly (63 pages built). The failure
is isolated to the katex bump, but the root cause was not chased further —
the crash is a Node/libuv assertion on Windows during ESM chunk resolution
for `src/pages/tracks/[...id].astro` → the order-book page specifically,
which is the one page that imports `katex` alongside a live WebSocket
component. Whether this is a katex 0.18 regression, a Vite/Rollup chunking
interaction, or Windows-specific should be checked on Linux/macOS (or in CI)
before retrying the bump.

`ts-fsrs` (`5.4.1` → `5.4.2`) and `vitest` (`4.1.10` → `4.1.11`) were updated
in the same session — both patch releases within the existing `package.json`
ranges, both verified green (`npm run test`, `npm run build`).

### Note nel backend unico (2026-10-19)

Il widget scrive in `site-notes` (repo `alessiomartini/site-notes`, `site = 'markets-first-principles'`);
tolti `worker/` e il workflow *Deploy notes worker*. Il vecchio worker `markets-first-principles-notes` e il
suo D1 vanno spenti da Alessio dopo la migrazione. Rate limiting e pulizia delle note ora sono temi di quel repo.
`worker-flashcards/` non è toccato.

## Log
- 2026-10-31: 🤖 aggiunte 20 voci di glossario (volatility surface + percorso Economics, 221/300); pagina "Risk measures" scritta (32/51, percorso Pricing and risk); la figura var-exceedances non ha ancora lo script dati `pipeline/fetch_var.py`; i termini di glossario esistevano già; pagina "Position sizing" scritta (33/51), chiude il percorso Pricing and risk; aggiunta la voce di glossario "Growth rate" (201/300); la figura kelly-curve non ha ancora lo script dati `pipeline/fetch_kelly.py`; pagina "What GDP actually measures" scritta (34/51, apre il percorso Economics); la figura gdp-decomposition non ha ancora lo script dati `pipeline/fetch_gdp.py`; aggiunte 6 voci di glossario (227/300), tra cui le 4 che mancavano a Position sizing; pagina "Money and inflation" scritta (35/51); la figura m2-vs-cpi non ha ancora lo script dati `pipeline/fetch_money.py`; i termini di glossario esistevano già; pagina "Interest rates and central banks" scritta (36/51); la figura policy-vs-curve non ha ancora lo script dati `pipeline/fetch_policy_rates.py`; aggiunte 3 voci di glossario (Corridor system, Floor system, Quantitative tightening; 230/300); pagina "The yield curve" scritta (37/51); la figura curve-inversions non ha ancora lo script dati `pipeline/fetch_yield_curve.py`; aggiunte 3 voci di glossario (Yield curve, Expectations hypothesis, Nelson-Siegel model; 233/300); pagina "Labour, output, prices" scritta (38/51); la figura phillips-by-decade non ha ancora lo script dati `pipeline/fetch_phillips.py`; aggiunte 4 voci di glossario (Unemployment rate, Output gap, Phillips curve, NAIRU; 237/300); pagina "Exchange rates" scritta (39/51); la figura carry-and-cip non ha ancora lo script dati `pipeline/fetch_fx.py`; aggiunte 6 voci di glossario (Spot FX, Forward FX, PPP, UIP, CIP, Carry trade; 243/300); pagina "Credit and the cycle" scritta (40/51); la figura hy-spread-vs-recessions non ha ancora lo script dati `pipeline/fetch_credit.py`; aggiunte 5 voci di glossario (Deleveraging, Financial accelerator, Systemic risk, Credit-to-GDP gap, Financial instability hypothesis; 248/300); pagina "Economics as a complex system" scritta (41/51); la figura agent-based-vs-real non ha ancora lo script dati `pipeline/simulate_herding.py`; aggiunte 4 voci di glossario (Equilibrium, Agent-based model, Reflexivity, Herding; 252/300); pagina "Clearing and settlement" scritta (42/51); la figura settlement-fails non ha ancora lo script dati `pipeline/fetch_fails.py`; aggiunte 5 voci di glossario (Novation, Netting, T+1, Delivery versus payment, Settlement fail; 257/300); pagina "Margin and leverage" scritta (43/51); la figura margin-debt non ha ancora lo script dati `pipeline/fetch_margin_debt.py`; aggiunte 2 voci di glossario (Haircut, Rehypothecation; 259/300)
- 2026-10-24: 🤖 pagina "Portfolio construction" scritta (31/51, percorso Pricing and risk); la figura frontier-out-of-sample non ha ancora lo script dati `pipeline/fetch_frontier.py`; aggiunte 4 voci di glossario (Markowitz optimisation, efficient frontier, factor, alpha)
- 2026-10-23: 🤖 scritta la pagina "Bachelier and Black-Scholes" (29/51, percorso Pricing and risk); la figura delta-hedge-pnl non ha ancora lo script dati `pipeline/fetch_delta_hedge.py`; poi scritta la pagina "The volatility surface" (30/51); la figura vol-surface non ha ancora lo script dati `pipeline/fetch_vol_surface.py`; poi 16 voci di glossario per il percorso Pricing and risk
- 2026-10-22: 🤖 scritta anche la pagina "No-arbitrage and replication" (28/51, apre il percorso Pricing and risk; la figura put-call-parity non ha ancora lo script `pipeline/fetch_parity.py`); prima scritta la pagina "Hedging vs speculation vs arbitrage" (27/51, track 1 completo); la figura airline-hedge non ha ancora lo script dati `pipeline/fetch_fuel_hedge.py`
- 2026-10-21: 🤖 pagine "Options" (25/51) e "Swaps and the rest" (26/51) scritte; le figure option-chain e swap-spread non hanno ancora lo script dati
- 2026-10-20: 🤖 scritta la pagina "Derivatives: what the word actually means" (track 1), prima delle bozze del percorso Contracts and instruments; la figura BIS non ha ancora lo script dati
- 2026-10-19: note spostate nel backend unico `site-notes`; nota del sito su call/put e opzioni americane/europee: già nel glossario (`call-option`, `put-option`, `exercise-style`); le note mandano l'autore (`?sono-alessio` segna il browser di Alessio, le altre sono di visitatori); installabile come app a sé dal telefono (manifest con nome, icona e perimetro propri)
- 2026-10-18: FUTURE-ARCHITECTURE.md unito in ROADMAP.md (protocollo unico); 🤖 scritti 10 nuovi termini del glossario (Sharpe ratio, delta, gamma, delta hedging, put-call parity, expected shortfall, repo, margin call, overfitting, beta)
- 2026-10-15: creata la roadmap per Projects Overview
