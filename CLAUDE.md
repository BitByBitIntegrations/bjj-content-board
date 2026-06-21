# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

BJJ content kanban board — tracks video ideas through **Imagined → Filmed → Edited → Shared** stages. Cards hold a label, optional description, optional link, a tag, and a created date. The board updates in real time when new cards arrive from a phone (via n8n webhook → Supabase).

## Stack

- **Frontend:** single-file `index.html` (HTML/CSS/JS inline, no build step) — matches the pattern at bitbybitintegrations.com
- **Backend:** Supabase (Postgres + auto REST API + realtime subscriptions)
- **Remote input:** n8n flow — phone sends Telegram message or hits a webhook → n8n parses it → inserts a card into Supabase → board updates live
- **Deploy:** GitHub Pages under `BitByBitIntegrations/content-board`, custom DNS via Namecheap

## Local dev

No build step. Open `index.html` directly in a browser, or serve it:

```bash
npx serve .          # or python3 -m http.server 8080
```

Supabase local dev (migrations):

```bash
supabase start       # starts local Postgres + Studio
supabase db push     # apply migrations to remote
supabase migration new <name>   # create a new migration file
```

## Supabase schema

Single `cards` table (see `supabase/migrations/`):

| column | type | notes |
|---|---|---|
| id | uuid | PK, `gen_random_uuid()` |
| label | text | required |
| description | text | nullable |
| link | text | nullable |
| tag | text | `brainrot` \| `training` \| `comp` \| `highlight` |
| stage | text | `imagined` \| `filmed` \| `edited` \| `shared` |
| position | int | ordering within a column |
| created_at | timestamptz | `now()` |

## Architecture

### Frontend (`index.html`)

The JS has three logical layers:

1. **State** — cards array held in memory, grouped by stage
2. **Persistence** — originally `localStorage`; now Supabase via `@supabase/supabase-js` (loaded from CDN). Three operations: `load()` → `SELECT * FROM cards ORDER BY stage, position`, `save(card)` → upsert, `deleteCard(id)` → delete row
3. **Realtime** — Supabase channel subscription on the `cards` table; on `INSERT`/`UPDATE`/`DELETE` events, re-render the affected column without a full page reload

Drag-and-drop reorders cards within a column and updates `position` values; moving between columns updates `stage`.

### n8n flow

```
Trigger (Telegram bot message OR iOS Shortcut POST to webhook)
  → detect URL in text → if found, fetch page title as label candidate
  → Supabase insert: { label, link, tag='brainrot', stage='imagined' }
```

Board's realtime subscription receives the insert and appends the card automatically.

### Env vars

The frontend needs two values injected at deploy time (or hardcoded for private-only use):

```
SUPABASE_URL
SUPABASE_ANON_KEY
```

For GitHub Pages (no server-side env), inline these directly in `index.html` or use a small build script that replaces `__SUPABASE_URL__` placeholders.

## Open decisions (from spec)

- **Auth / RLS:** currently permissive (private board, single user). Tighten if board becomes shared.
- **Phone input channel:** Telegram bot is the default choice; iOS Shortcut is the alternative.
- **Audio ideas (phase 2):** n8n → Whisper transcription → card label/description. Out of scope for v1.
- **Multi-board generalization:** stage/tag config as a small JSON object so one codebase drives multiple boards (e.g., a Claude Code projects tracker with Backlog → Building → Testing → Shipped).
