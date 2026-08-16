# Markets from First Principles

A single-author learning site that teaches finance and economics to someone who already thinks
like a theoretical physicist. Eight tracks, 51 pages, one concept per page. No exercises —
every page ends with a real chart and a two-sentence reading of it.

Astro, KaTeX, static SVG figures, no runtime JavaScript except one live order book. Deploys to
GitHub Pages.

```
npm install
npm run dev        # http://localhost:4321/markets-first-principles/
npm run build
npm run audit:content   # what is written, what is missing
```

## Deploying

One manual step, once: **Settings → Pages → Source: GitHub Actions**. Creating or reconfiguring
the Pages site is not something the workflow's own `GITHUB_TOKEN` is permitted to do, so
`enablement: true` on `configure-pages` does not rescue it — it fails with *Resource not
accessible by integration*. Afterwards every push to `main` builds and publishes itself.

**Symptom that the source is still set to "Deploy from a branch":** a second workflow named
*pages build and deployment* appears on every push and fails, with a log mentioning
`jekyll-theme-primer`. That is GitHub's legacy Jekyll builder trying to render an Astro project.
It is harmless to the Actions deploy but leaves a permanently red run on every commit, and it
disappears once the source is switched to GitHub Actions.

## The editorial contract, enforced by the build

The site's value is that it defines the words. Four rules from the spec are mechanised rather
than left to discipline:

| Rule | How it is enforced |
|---|---|
| Every page uses the same eight slots, in order | `plugins/rehype-slots.mjs` throws if a page marked `status: written` is missing one or has them out of order |
| Every bolded term links to a glossary entry | `plugins/remark-glossary.mjs` rewrites `**bold**` into a glossary link, and warns at build time for terms with no entry |
| Every chart names its source, series, sample period and script | required fields in the `figure` schema in `src/content.config.ts` — a figure without provenance cannot be published |
| Placeholder data never passes as real | figure payloads carry `synthetic: true`, which renders a `SCHEMATIC` badge and a sentence saying the numbers are not real |

The eight slots are `IN ONE SENTENCE`, `WHY IT EXISTS`, `DEFINITION`, `FORMALLY`,
`PHYSICS BRIDGE`, `IN THE DATA`, `COMMON CONFUSIONS`, `GO DEEPER`. Write them as `## HEADING`
in the MDX body; the plugin wraps and styles each one.

## Layout

```
content-map.json            The site map: tracks, pages, terms, figure specs. Single source of truth.
scripts/scaffold-content.mjs  Generates stub pages from the map. Never overwrites. --check for CI drift.
scripts/audit-content.mjs     Editorial backlog: pages written, terms missing, figures without data.

plugins/rehype-slots.mjs      Wraps + validates the eight-slot template.
plugins/remark-glossary.mjs   Auto-links bolded terms to the glossary.
plugins/glossary-index.mjs    Builds the term → entry lookup from the glossary collection.

src/content/pages/<track>/<page>.mdx   One file per concept page.
src/content/glossary/<term>.md         One file per glossary entry.
src/data/figures/<id>.json             Committed figure data. Written only by the pipeline.
src/lib/figures.mjs                    Renders figure JSON to static SVG at build time.
src/components/OrderBookLive.astro     The one live component (Binance WebSocket).

pipeline/                    Python data fetchers. Standard library only.
```

## Adding a page

1. Add it to `content-map.json` under the right track, with its `terms` and its `figure` spec.
2. `npm run scaffold` — writes the stub with frontmatter and the eight empty slots.
3. Write the prose. Bold each term you are defining; add a matching file in
   `src/content/glossary/`.
4. Set `status: written` in the frontmatter. The build now enforces all eight slots.
5. Write the fetch script named in the figure spec, run it, commit the JSON it produces.

## Data architecture

**The browser talks to live services in exactly two places**, and nowhere else. The first is the
Binance WebSocket on the order book page, which is the point of that page. The second is the
notes widget (see below), which only ever writes. Everything else is pulled by a scheduled job,
reduced to small JSON, and committed. The site is therefore fast, key-free,
GitHub-Pages-compatible and reproducible, and a dead API breaks a future update rather than a
published page.

The original rule was "at most one live API". The notes widget is a deliberate, narrow exception
rather than a loosening: it sends data out, never reads any in, so no page's content can depend
on it and no reader is affected if it is down.

`.github/workflows/refresh-data.yml` runs `pipeline/run_all.py` daily, commits any changed
figure JSON, and that push triggers a deploy. Individual fetch failures are tolerated: the
figures that could not refresh keep their previous values.

Three figures currently have scripts: `fetch_order_book.py` (Binance REST),
`fetch_tails.py` (Stooq + Binance) and `fetch_market_sizes.py`. The remaining figure specs in
`content-map.json` name the script that still has to be written.

**`fetch_market_sizes.py` needs one manual step.** Global equity capitalisation, bond
outstandings and FX turnover are published as annual reports, not APIs, so they are transcribed
by hand into `pipeline/manual/market_sizes.csv` with a source URL on every row. Rows without a
source URL are dropped, which is what keeps an unverified number off the site. Until the CSV is
filled in, that figure stays synthetic and stamped `SCHEMATIC`.

### Which sources survive CI

Free market-data endpoints have a specific failure mode: they work from a laptop and refuse a
datacenter IP. Measured on GitHub runners:

| Source | From a runner |
|---|---|
| Kraken, Coinbase, ECB, CoinGecko | fine |
| Binance | `HTTP 451` — refuses the runner outright |
| Yahoo Finance | `HTTP 429` — the shared runner IPs are rate-limited |
| Stooq | returns an empty body, not an error |

So every series is fetched through a list of sources tried in turn, and the payload records which
one answered — the figure caption prints that rather than the source named in the frontmatter, so
provenance is a record of what happened rather than a statement of intent. Binance stays first in
the crypto list because it is the venue the live order book streams from, and it works fine from a
reader's browser; on CI it simply falls through to Kraken.

**Optional: `FRED_API_KEY`.** Set it as a repository secret to give the equity series a source that
CI can actually reach — without it, `fetch_tails.py` falls through to Yahoo and Stooq, which
currently means the S&P curve is dropped and the figure ships with the FX and crypto curves only.
The Economics track needs the same key, so setting it once unlocks both. Get one free at
<https://fredaccount.stlouisfed.org/apikeys>.

### The notes widget

A floating **+ Note** button on every page opens a box for leaving myself notes while reading —
"this caption is wrong", "this page needs a figure". Notes POST to a Cloudflare Worker
(`worker/`) which appends them to a D1 database, and are read later straight from D1 rather than
copied out of a browser.

There is no read endpoint on the Worker, deliberately: anything that can serve the notes over
HTTP can leak them. Writes are guarded by a CORS allowlist, a length cap, and a hidden honeypot
field that silently discards bot submissions.

Deploy it with the manual **Deploy notes worker** workflow, which needs a `CLOUDFLARE_API_TOKEN`
repository secret. See `worker/README.md` for the whole path, including reading and deleting
notes.

### Working offline

`python3 pipeline/synthesize_fallback.py` writes synthetic stand-ins for figures that have no
data yet, so the design can be reviewed without network access. It never overwrites real data
unless passed `--force`, and everything it writes is stamped `synthetic: true`.

## Colour

Figures are rendered once against the light palette, and the hexes are rewritten into
`var(--series-N, #fallback)` so one CSS swap repaints every chart for dark mode. The palette is
the validated default: series `#2a78d6` / `#eb6834` / `#1baf7a`, with `#e34948` for the ask side
of the book. All pairs clear the colour-vision-deficiency and normal-vision separation floors in
both modes. Aqua sits below 3:1 on the light surface, which is why every series carries a direct
label and every figure ships a data table — identity is never carried by colour alone.

Figures are static SVG rather than interactive charts, which is a deliberate trade against the
usual hover-layer advice: a tooltip would cost every reader a chart library, against the site's
no-JavaScript budget. The direct labels and the data table carry the accessibility load instead.

## Known follow-ups

- **Astro 5, not 7.** Astro 7 is current; this project is pinned to 5 with `@astrojs/mdx@4`
  because that pairing is known-good. The upgrade is a separate, mechanical change.
- 48 of 51 pages are stubs, with their vocabulary and figure specs already written.
- 29 of ~300 declared glossary terms are written. `npm run audit:content` lists the rest.
- Figure scripts exist for 3 of the 51 specified figures; the other 48 name the script still to
  be written.

## Not for indexing

`robots.txt` disallows everything and every page carries `noindex`, matching the convention of
its sibling repository.
