# Notes worker

Collects the notes written in the site's "+ Note" box and appends them to a
Cloudflare D1 database. One route, `POST /notes`, and nothing else.

**There is no read endpoint, deliberately.** Notes are read straight out of D1 —
through the Cloudflare MCP connector, the dashboard, or `wrangler` — so nothing
on the public internet can serve them back.

## Normal path: deploy from CI

Run the **Deploy notes worker** workflow from the Actions tab. It is
`workflow_dispatch` only — never on push — because it provisions real cloud
infrastructure. It looks the database up by name, creates it if missing, applies
`schema.sql`, substitutes the id into `wrangler.jsonc`, and deploys.

It needs one repository secret, `CLOUDFLARE_API_TOKEN`, with **Account → Workers
Scripts → Edit** and **Account → D1 → Edit** (the "Edit Cloudflare Workers"
template covers both).

A token missing the D1 permission fails with `Authentication error [code: 10000]`
against `/d1/database` — which reads like a bad token rather than a token with
the wrong scopes. If the deploy fails that way, check the permissions before
regenerating anything.

The database itself already exists:

| | |
|---|---|
| name | `markets-first-principles-notes` |
| id | `baf64edb-7ba8-49a3-9141-5fc0d8017727` |
| region | WEUR |

## Fallback: deploy from a laptop

```bash
cd worker
npm install
npx wrangler login

npx wrangler d1 create markets-first-principles-notes   # copy the id it prints
# paste the id over REPLACE_WITH_DATABASE_ID in wrangler.jsonc

npx wrangler d1 execute markets-first-principles-notes --remote --file=schema.sql
npx wrangler deploy
```

Then put the URL `wrangler deploy` prints into `WORKER_URL` at the top of
`public/js/notes-widget.js`.

## Reading the notes

```bash
npx wrangler d1 execute markets-first-principles-notes --remote \
  --command "SELECT id, created_at, page, text FROM notes ORDER BY id DESC LIMIT 50"
```

Or ask Claude, which reads the same table through the Cloudflare connector.

## Deleting notes once they are done

```bash
npx wrangler d1 execute markets-first-principles-notes --remote \
  --command "DELETE FROM notes WHERE id IN (1,2,3)"
```
