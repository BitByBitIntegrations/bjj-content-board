#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash): baby-proof the agent.
# Blocks commands that can't be undone — merges, deploys, prod migrations,
# force-pushes, pushes to main. Always on.
#
# STRICT MODE: when .claude/overnight/ACTIVE exists (armed by /overnight),
# also blocks anything that reaches outside the sandbox: pushes to non-
# overnight branches, publishing, outbound writes, closing issues, etc.
#
# Exit 0 = allow, Exit 2 = block (stderr is shown to the agent).
#
# CUSTOMIZE: uncomment / add patterns for your platform and project.

INPUT=$(cat)

if command -v jq >/dev/null 2>&1; then
  CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')
else
  CMD=$(printf '%s' "$INPUT" | grep -oE '"command"[[:space:]]*:[[:space:]]*"([^"\\]|\\.)*"' | head -1 \
        | sed -E 's/^"command"[[:space:]]*:[[:space:]]*"//; s/"$//; s/\\"/"/g')
fi

[ -z "$CMD" ] && exit 0

# ── Always blocked: irreversible ────────────────────────────────────────────
# Format: "regex|||reason"
ALWAYS=(
  # Git
  '(^|[;&| ])git[[:space:]]+merge([[:space:]]|$)|||merging is the founder'"'"'s call'
  # '(^|[;&| ])gh[[:space:]]+pr[[:space:]]+merge|||merging PRs is the founder'"'"'s call'
  'git[[:space:]]+push.*([[:space:]]|:)(main|master)([[:space:]]|$)|||never push to main/master'
  'git[[:space:]]+push.*[[:space:]](-f|--force|--force-with-lease)([[:space:]=]|$)|||no force-pushing'
  'git[[:space:]]+push[[:space:]]+[^-]*\+|||no force-pushing (+refspec)'
  'git[[:space:]]+(checkout|switch)[[:space:]]+(main|master)([[:space:]]|$)|||stay off main — work on a branch'
  'git[[:space:]]+branch[[:space:]]+-D|||no deleting branches'

  # Filesystem
  'rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*f?[[:space:]]+(/|~|\$HOME|\.)([[:space:]]|$)|||no recursive delete of root/home/project'

  # Database migrations / prod data
  # 'supabase[[:space:]]+db[[:space:]]+(push|reset)|||production migrations are applied by the founder'
  'prisma[[:space:]]+migrate[[:space:]]+(deploy|reset)|||production migrations are applied by the founder'
  'prisma[[:space:]]+db[[:space:]]+push.*--accept-data-loss|||data-loss schema push'
  '(DROP|TRUNCATE)[[:space:]]+(TABLE|DATABASE|SCHEMA)|||destructive SQL'
  # 'rails[[:space:]]+db:migrate[[:space:]]+RAILS_ENV=production|||prod migration'
  # 'alembic[[:space:]]+upgrade.*prod|||prod migration'

  # Deploys
  'vercel[[:space:]].*--prod|||production deploy'
  'netlify[[:space:]]+deploy.*--prod|||production deploy'
  'fly[[:space:]]+deploy|||deploy'
  'railway[[:space:]]+up|||deploy'
  'eas[[:space:]]+(submit|update).*(production|--branch[[:space:]]+prod)|||app store / production OTA update'
  'firebase[[:space:]]+deploy|||deploy'
  # 'fastlane[[:space:]]+(release|deliver|pilot)|||App Store submission'
  # 'kubectl[[:space:]]+(apply|delete).*prod|||prod cluster change'
  # 'terraform[[:space:]]+(apply|destroy)|||infra change'

  # Publishing / money
  '(npm|pnpm|yarn)[[:space:]]+publish|||publishing a package'
  'stripe[[:space:]].*--live|||live Stripe call'
)

# ── Strict mode only: anything that leaves the sandbox ──────────────────────
STRICT=(
  'git[[:space:]]+push|||PUSH_CHECK'
  'gh[[:space:]]+(issue|pr)[[:space:]]+(close|delete|edit|comment|review)|||writing to GitHub issues/PRs (draft PR create is allowed)'
  'gh[[:space:]]+pr[[:space:]]+ready|||marking a PR ready — keep it draft'
  'gh[[:space:]]+(release|repo|secret|variable)|||repo/release/secret changes'
  'gh[[:space:]]+workflow[[:space:]]+(run|enable|disable)|||triggering GitHub Actions workflows by hand'
  'gh[[:space:]]+api.*(-X|--method)[[:space:]]*(POST|PUT|PATCH|DELETE)|||GitHub API writes'
  'curl.*(-X|--request)[[:space:]]*(POST|PUT|PATCH|DELETE)|||outbound write request'
  'curl.*[[:space:]](-d|--data|--data-raw|-F|--form)[[:space:]]|||outbound write request'
  '(^|[;&| ])(ssh|scp|rsync)[[:space:]]|||remote machine access'
  '(supabase|psql|mysql|mongosh).*(prod|production)|||touching production data'
  # 'twilio|sendgrid|resend|mailgun|||sending messages to real users'
)

block() {
  echo "BLOCKED by hooks/guard-overnight.sh: $1" >&2
  echo "  command: $CMD" >&2
  echo "  Do not retry another way. If you believe you need this, stop and add it as a decision for the founder (overnight: a line in REPORT.md)." >&2
  exit 2
}

for entry in "${ALWAYS[@]}"; do
  re="${entry%%|||*}"; why="${entry##*|||}"
  if printf '%s' "$CMD" | grep -qiE -- "$re"; then block "$why"; fi
done

ACTIVE_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/overnight/ACTIVE"
if [ -f "$ACTIVE_FILE" ] || [ -f ".claude/overnight/ACTIVE" ]; then
  for entry in "${STRICT[@]}"; do
    re="${entry%%|||*}"; why="${entry##*|||}"
    if printf '%s' "$CMD" | grep -qiE -- "$re"; then
      if [ "$why" = "PUSH_CHECK" ]; then
        # Overnight: only allow pushing overnight/* branches.
        if printf '%s' "$CMD" | grep -qE 'git[[:space:]]+push([[:space:]]+(-u|--set-upstream))?[[:space:]]+origin[[:space:]]+(HEAD:)?(refs/heads/)?overnight/[A-Za-z0-9._/-]+[[:space:]]*$'; then
          continue
        fi
        block "overnight mode only allows: git push [-u] origin overnight/<branch>"
      fi
      block "$why (overnight strict mode)"
    fi
  done
fi

exit 0
