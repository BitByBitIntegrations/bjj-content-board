import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const URL_RE = /https?:\/\/[^\s]+/i;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  const body = await req.json().catch(() => null);
  const text = body?.message?.text as string | undefined;
  if (!text) return new Response('no text', { status: 200 });

  const urlMatch = text.match(URL_RE);
  const link     = urlMatch?.[0] ?? null;
  const label    = link ? text.replace(link, '').trim() || await fetchTitle(link) : text;

  const db = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error } = await db.from('cards').insert({
    label:    label.slice(0, 200),
    link,
    tag:      'brainrot',
    stage:    'imagined',
    position: 0,
  });

  if (error) {
    console.error(error);
    return new Response('db error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
});

async function fetchTitle(url: string): Promise<string> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const html = await r.text();
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return m ? m[1].trim().slice(0, 200) : url;
  } catch {
    return url;
  }
}
