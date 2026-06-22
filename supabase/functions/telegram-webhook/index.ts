import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const URL_RE = /https?:\/\/[^\s]+/gi;

function extractLinks(text: string): [string | null, string | null, string | null] {
  const matches = [...text.matchAll(URL_RE)].map(m => m[0]);
  return [matches[0] ?? null, matches[1] ?? null, matches[2] ?? null];
}

const VALID_STAGES = new Set(['imagined', 'filmed', 'edited', 'shared']);

// Keyword lists for smart stage guessing (checked in order — most specific first)
const STAGE_KEYWORDS: Array<{ stage: string; keywords: string[] }> = [
  { stage: 'shared',  keywords: ['posted', 'already posted', 'already shared', 'shared it'] },
  { stage: 'edited',  keywords: ['edited', 'already edited'] },
  { stage: 'filmed',  keywords: ['filmed', 'already filmed', 'just filmed', 'filmed it'] },
];

function guessStageFromKeywords(text: string): string {
  const lower = text.toLowerCase();
  for (const { stage, keywords } of STAGE_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) return stage;
  }
  return 'imagined';
}

const TAG_MAP: Record<string, string> = {
  brainrot:     'brainrot',
  training:     'training',
  comp:         'comp',
  competition:  'comp',
  highlight:    'highlight',
  highlights:   'highlight',
  educational:  'education',
  education:    'education',
};

// Keyword lists for smart tag guessing (case-insensitive)
const HIGHLIGHT_KEYWORDS  = ['highlight', 'highlights', 'compilation', 'best of', 'montage'];
const EDUCATION_KEYWORDS  = [
  'educational', 'education', 'lesson', 'concept', 'theory', 'explain',
];
const TRAINING_KEYWORDS   = [
  'training', 'drill', 'technique', 'instructional', 'how to', 'tutorial',
  'purple belt', 'blue belt', 'white belt', 'guard', 'sweep',
  'pass', 'submission', 'kimura', 'armbar', 'triangle', 'choke',
];
const COMP_KEYWORDS      = ['comp', 'competition', 'match', 'tournament', 'fight', 'bracket', 'medal'];
const BRAINROT_KEYWORDS  = ['meme', 'funny', 'viral', 'brainrot'];

function guessTagFromKeywords(text: string): string {
  const lower = text.toLowerCase();
  if (HIGHLIGHT_KEYWORDS.some(k => lower.includes(k)))  return 'highlight';
  if (EDUCATION_KEYWORDS.some(k => lower.includes(k)))  return 'education';
  if (TRAINING_KEYWORDS.some(k => lower.includes(k)))   return 'training';
  if (COMP_KEYWORDS.some(k => lower.includes(k)))       return 'comp';
  if (BRAINROT_KEYWORDS.some(k => lower.includes(k)))   return 'brainrot';
  return 'brainrot';
}

async function sendTelegram(chatId: number, message: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  });
}

// ── Flexible command matching helpers ─────────────────────────────────────────

const RECENCY_WORDS = ['last', 'latest', 'previous', 'most recent', 'newest', 'recent'];
const ITEM_WORDS    = ['card', 'item', 'idea', 'thing', 'content', 'post', 'video', 'note', 'one'];

/**
 * Returns true if `text` contains any of the given verbs followed (anywhere
 * after it) by any recency word and any item word, in that left-to-right order.
 * Extra words (e.g. "the", "my") between tokens are allowed.
 */
function matchesCommand(
  text: string,
  verbs: string[],
  recency: string[] = RECENCY_WORDS,
  items: string[]   = ITEM_WORDS,
): boolean {
  // Build an alternation regex for each group, escaping special chars
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Sort multi-word phrases longest first so they take priority in alternation
  const byLen = (a: string, b: string) => b.length - a.length;

  const vPart = verbs.sort(byLen).map(esc).join('|');
  const rPart = recency.sort(byLen).map(esc).join('|');
  const iPart = items.sort(byLen).map(esc).join('|');

  // Pattern: <verb> ... <recency> ... <item>  (each separated by \b and \W+)
  const re = new RegExp(
    `(?:^|\\b)(?:${vPart})\\b[\\s\\S]*?\\b(?:${rPart})\\b[\\s\\S]*?\\b(?:${iPart})\\b`,
    'i',
  );
  return re.test(text);
}

/**
 * Extract the last word/phrase after "to X" or a bare tag/stage word at the
 * end of a command, given the verb+recency+item prefix was already matched.
 */
function extractTrailingWord(text: string): string | null {
  // "… to <word>" pattern
  const toMatch = text.match(/\bto\s+(\w+)\s*$/i);
  if (toMatch) return toMatch[1].toLowerCase();
  return null;
}

/**
 * Detect "make [the] [recency] [item] <tag/stage>" pattern.
 * Returns the trailing bare word (the override) or null.
 */
function matchesMakeCommand(text: string): string | null {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byLen = (a: string, b: string) => b.length - a.length;
  const rPart = [...RECENCY_WORDS].sort(byLen).map(esc).join('|');
  const iPart = [...ITEM_WORDS].sort(byLen).map(esc).join('|');

  const re = new RegExp(
    `^make\\b[\\s\\S]*?\\b(?:${rPart})\\b[\\s\\S]*?\\b(?:${iPart})\\b\\s+(\\w+)\\s*$`,
    'i',
  );
  const m = text.match(re);
  return m ? m[1].toLowerCase() : null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  const body   = await req.json().catch(() => null);
  const text   = (body?.message?.text ?? '') as string;
  const chatId = body?.message?.chat?.id as number | undefined;

  // Ignore bot commands like /start
  if (!text || text.startsWith('/')) return new Response('ok', { status: 200 });

  const db    = createClient(SUPABASE_URL, SUPABASE_KEY);
  const lower = text.toLowerCase().trim();

  // ── Command: delete [recency] [item] ─────────────────────────────────────
  const DELETE_VERBS = ['delete', 'remove', 'get rid of'];
  if (matchesCommand(lower, DELETE_VERBS)) {
    const { data, error } = await db
      .from('cards')
      .select('id, label')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      if (chatId) await sendTelegram(chatId, 'No cards found to delete.');
      return new Response('ok', { status: 200 });
    }

    await db.from('cards').delete().eq('id', data.id);
    if (chatId) await sendTelegram(chatId, `🗑️ Deleted: <b>${data.label}</b>`);
    return new Response('ok', { status: 200 });
  }

  // ── Command: update/change/set [recency] [item]('s)? tag to <tag> ────────
  //            make [recency] [item] <tag> (when override is a known tag)
  const TAG_VERBS = ['update', 'change', 'set'];

  // "make" variant — handled separately because the word order differs
  const makeOverride = matchesMakeCommand(lower);
  const isTagMake    = makeOverride !== null && TAG_MAP[makeOverride] !== undefined;

  const isTagCommand = isTagMake || (
    matchesCommand(lower, TAG_VERBS) &&
    /\btag\b/.test(lower) &&
    /\bto\s+\w+/.test(lower)
  );

  if (isTagCommand) {
    const rawTag   = isTagMake ? makeOverride! : extractTrailingWord(lower);
    const mappedTag = rawTag ? (TAG_MAP[rawTag] ?? 'brainrot') : 'brainrot';

    const { data, error } = await db
      .from('cards')
      .select('id, label')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      if (chatId) await sendTelegram(chatId, 'No cards found to update.');
      return new Response('ok', { status: 200 });
    }

    await db.from('cards').update({ tag: mappedTag }).eq('id', data.id);
    if (chatId) await sendTelegram(chatId, `✏️ Updated tag of <b>${data.label}</b> to #${mappedTag}`);
    return new Response('ok', { status: 200 });
  }

  // ── Command: move/send/put/mark [recency] [item] to/in/into/as <stage> ───
  const MOVE_VERBS = ['move', 'send', 'put', 'mark'];

  // "make" variant for stage — when override is a valid stage
  const isStageMake = makeOverride !== null && VALID_STAGES.has(makeOverride);

  const isMoveCommand = isStageMake || (
    matchesCommand(lower, MOVE_VERBS) &&
    /\b(to|in|into|as)\s+\w+/.test(lower)
  );

  if (isMoveCommand) {
    let stage: string | undefined;

    if (isStageMake) {
      stage = makeOverride!;
    } else {
      // Extract stage from "to/in/into/as <word>"
      const stageMatch = lower.match(/\b(?:to|in|into|as)\s+(\w+)/);
      const candidate  = stageMatch?.[1];
      stage = candidate && VALID_STAGES.has(candidate) ? candidate : undefined;
    }

    if (!stage) {
      if (chatId) await sendTelegram(chatId, `Unknown stage. Use: imagined, filmed, edited, shared.`);
      return new Response('ok', { status: 200 });
    }

    const { data, error } = await db
      .from('cards')
      .select('id, label')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      if (chatId) await sendTelegram(chatId, 'No cards found to move.');
      return new Response('ok', { status: 200 });
    }

    await db.from('cards').update({ stage }).eq('id', data.id);
    if (chatId) await sendTelegram(chatId, `📌 Moved <b>${data.label}</b> to ${stage}`);
    return new Response('ok', { status: 200 });
  }

  // ── Confirmation: "yes", "yes #<tag>", "yes <stage>", "yes #<tag> <stage>", "yes <stage> #<tag>" ──
  const yesMatch = lower.match(/^yes(?:\s+(?:#(\w+)\s+(\w+)|(\w+)\s+#(\w+)|#(\w+)|(\w+)))?$/);
  if (yesMatch) {
    if (!chatId) return new Response('ok', { status: 200 });

    // Query with maybeSingle() to avoid PostgREST error on empty result
    const { data: draft, error } = await db
      .from('drafts')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // maybeSingle() returns null data (not an error) when no rows found
    if (error) {
      console.error('drafts query error:', error);
      await sendTelegram(chatId, 'Error checking for pending card. Please try again.');
      return new Response('db error', { status: 500 });
    }

    if (!draft) {
      await sendTelegram(chatId, 'No pending card to confirm.');
      return new Response('ok', { status: 200 });
    }

    // Parse overrides from "yes [#tag] [stage]" in any order
    // Groups: [1]=#tag [2]=stage (form: #tag stage)
    //         [3]=stage [4]=#tag (form: stage #tag)
    //         [5]=#tag only
    //         [6]=word only (stage or tag)
    const rawTagA   = yesMatch[1] ?? yesMatch[4] ?? yesMatch[5];
    const rawStageA = yesMatch[2] ?? yesMatch[3];
    const rawSolo   = yesMatch[6];

    // Solo word: determine if it's a stage or a tag
    let overrideTagRaw: string | undefined;
    let overrideStageRaw: string | undefined;

    if (rawSolo) {
      if (VALID_STAGES.has(rawSolo)) overrideStageRaw = rawSolo;
      else overrideTagRaw = rawSolo;
    } else {
      overrideTagRaw   = rawTagA?.toLowerCase();
      overrideStageRaw = rawStageA?.toLowerCase();
    }

    const finalTag   = overrideTagRaw   ? (TAG_MAP[overrideTagRaw] ?? draft.tag) : draft.tag;
    const finalStage = (overrideStageRaw && VALID_STAGES.has(overrideStageRaw))
      ? overrideStageRaw
      : (draft.stage ?? 'imagined');

    const { error: insertErr } = await db.from('cards').insert({
      label:       draft.label,
      description: draft.description ?? null,
      link:        draft.link  ?? null,
      link2:       draft.link2 ?? null,
      link3:       draft.link3 ?? null,
      tag:         finalTag,
      stage:       finalStage,
      position:    0,
    });

    if (insertErr) {
      console.error(insertErr);
      await sendTelegram(chatId, 'Error saving card. Please try again.');
      return new Response('db error', { status: 500 });
    }

    await db.from('drafts').delete().eq('id', draft.id);
    await sendTelegram(chatId, '✅ Added to board!');
    return new Response('ok', { status: 200 });
  }

  // ── New card — parse and store as draft ───────────────────────────────────
  const [link, link2, link3] = extractLinks(text);
  const cleaned  = text.replace(URL_RE, '').trim();

  // Explicit #hashtag overrides keyword guessing
  const tagMatch = cleaned.match(/#(\w+)/i);
  const noTags   = cleaned.replace(/#\w+/gi, '').trim();
  const lines    = noTags.split('\n').map((l: string) => l.trim()).filter(Boolean);
  let label      = lines[0] ?? link ?? 'Untitled';
  let description: string | null = lines.slice(1).join('\n').trim() || null;

  const tag = tagMatch
    ? (TAG_MAP[tagMatch[1].toLowerCase()] ?? 'brainrot')
    : guessTagFromKeywords(cleaned);

  // Detect stage from keywords in the original message
  const stage = guessStageFromKeywords(cleaned);

  // If we only got a URL and no text, fetch the page title
  if (link && !lines.length) {
    label = await fetchTitle(link);
  }

  label       = label.slice(0, 200);
  description = description?.slice(0, 5000) ?? null;

  if (chatId) {
    // Store as draft and ask for confirmation
    const { error: draftErr } = await db.from('drafts').insert({
      chat_id:     chatId,
      label,
      description,
      link,
      link2,
      link3,
      tag,
      stage,
    });

    if (draftErr) {
      console.error(draftErr);
      return new Response('db error', { status: 500 });
    }

    const descPreview = description ? description.slice(0, 100) : 'none';
    const linkLines = [link, link2, link3]
      .filter(Boolean)
      .map((l, i) => `Link ${i + 1}: ${l}`)
      .join('\n');
    await sendTelegram(
      chatId,
      `📋 Ready to post:\nLabel: ${label}\nTag: #${tag}\nStage: ${stage}\nDescription: ${descPreview}${linkLines ? '\n' + linkLines : ''}\n\nReply <b>yes</b> to confirm.\nOverride examples:\n  yes #training → change tag\n  yes filmed → change stage\n  yes #comp filmed → change both`,
    );
  } else {
    // No chat_id (direct webhook without Telegram user) — insert directly
    const { error } = await db.from('cards').insert({
      label,
      description,
      link,
      link2,
      link3,
      tag,
      stage:    'imagined',
      position: 0,
    });

    if (error) {
      console.error(error);
      return new Response('db error', { status: 500 });
    }
  }

  return new Response('ok', { status: 200 });
});

async function fetchTitle(url: string): Promise<string> {
  try {
    const r    = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const html = await r.text();
    const m    = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return m ? m[1].trim().slice(0, 200) : url;
  } catch {
    return url;
  }
}
