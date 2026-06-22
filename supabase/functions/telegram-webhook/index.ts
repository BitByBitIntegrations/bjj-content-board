import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const URL_RE  = /https?:\/\/[^\s]+/i;
const TAG_MAP: Record<string, string> = {
  brainrot:  'brainrot',
  training:  'training',
  comp:      'comp',
  highlight: 'highlight',
  highlights:'highlight',
  educational:'training',
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  const body = await req.json().catch(() => null);
  const text = (body?.message?.text ?? '') as string;

  // Ignore bot commands like /start
  if (!text || text.startsWith('/')) return new Response('ok', { status: 200 });

  // Extract URL
  const urlMatch = text.match(URL_RE);
  const link     = urlMatch?.[0] ?? null;
  const cleaned  = text.replace(URL_RE, '').trim();

  // Extract tag from #hashtags
  const tagMatch = cleaned.match(/#(\w+)/i);
  const tagRaw   = tagMatch?.[1]?.toLowerCase() ?? 'brainrot';
  const tag      = TAG_MAP[tagRaw] ?? 'brainrot';
  const noTags   = cleaned.replace(/#\w+/gi, '').trim();

  // First line = label, rest = description
  const lines       = noTags.split('\n').map(l => l.trim()).filter(Boolean);
  let label         = lines[0] ?? link ?? 'Untitled';
  let description   = lines.slice(1).join('\n').trim() || null;

  // If we only got a URL and no text, fetch the page title
  if (link && !lines.length) {
    label = await fetchTitle(link);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error } = await db.from('cards').insert({
    label:       label.slice(0, 200),
    description: description?.slice(0, 1000) ?? null,
    link,
    tag,
    stage:       'imagined',
    position:    0,
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
