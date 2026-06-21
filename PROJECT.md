# BJJ Content Board — Project Summary

## What it is
A kanban board for tracking BJJ video ideas through **Imagined → Filmed → Edited → Shared**. Text ideas from your phone via Telegram and they appear on the board instantly.

## Live URLs
- **Board:** https://bitbybitintegrations.github.io/bjj-content-board/
- **Repo:** https://github.com/BitByBitIntegrations/bjj-content-board
- **Supabase project:** https://supabase.com/dashboard/project/abusswpafdzmiznrlcdz

## Stack
- **Frontend:** Single-file `index.html` — HTML/CSS/JS, no build step, hosted on GitHub Pages
- **Database:** Supabase (Postgres + realtime subscriptions)
- **Phone input:** Telegram bot → Supabase Edge Function → card appears on board live
- **Agents/hooks/skills:** Kiwi toolkit in `.claude/`

## How to use
- **Add from board:** Type an idea or paste a URL into the add bar and hit Add
- **Add from phone:** Message your Telegram bot — card appears in Imagined automatically
- **Move cards:** Drag between columns to advance stage
- **Edit/delete:** Hover a card for the edit (✎) and delete (✕) buttons

## Telegram Bot
- **Bot token:** stored as `TELEGRAM_BOT_TOKEN` secret in Supabase Edge Functions
- **Webhook URL:** `https://abusswpafdzmiznrlcdz.supabase.co/functions/v1/telegram-webhook`
- **Behavior:** plain text → card label; URL in message → fetches page title as label, saves URL as link

## Supabase
- **URL:** `https://abusswpafdzmiznrlcdz.supabase.co`
- **Table:** `cards` — id, label, description, link, tag, stage, position, created_at
- **Tags:** `brainrot` | `training` | `comp` | `highlight`
- **Stages:** `imagined` | `filmed` | `edited` | `shared`
- **RLS:** permissive (private single-user board)
- **Realtime:** enabled on `cards` table via `supabase_realtime` publication

## Local dev
```bash
npx serve .   # serve index.html locally
```
No build step. Open index.html directly or serve it.

## Supabase CLI
```bash
supabase login
supabase functions deploy telegram-webhook --project-ref abusswpafdzmiznrlcdz --no-verify-jwt
supabase secrets set --project-ref abusswpafdzmiznrlcdz KEY=value
```

## Future ideas
- iOS Shortcut → webhook as alternative to Telegram
- Audio ideas: Telegram voice message → Whisper transcription → card label/description
- Multi-board: generalize stage/tag config into JSON to drive a Claude Code projects tracker (Backlog → Building → Testing → Shipped)
- Tighten RLS if board becomes shared
