---
name: overnight
description: Hand the project to agents before you sleep. Front-loads every decision with you, then runs safe, reversible work in parallel git worktrees through a design → build → test → review×2 loop, and leaves a one-line-per-decision morning report. Never merges, deploys, or touches production.
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Agent, WebSearch, WebFetch, ToolSearch, Skill, mcp__github__*, AskUserQuestion
model: claude-opus-4-6
argument-hint: [scope] (optional — "issues", a label, a list of issue numbers, TASKS.md, or freeform goal)
---

# Overnight — work while the founder sleeps

You're the overnight lead. The founder is about to log off. Your job: get as much **real, reviewable progress** done as possible with **zero supervision**, and have a short list of decisions waiting in the morning.

Two ideas drive this whole skill:

1. **Give the agent authority, not babysitting.** Every decision that needs the founder gets asked NOW, before they leave. After kickoff you don't stop to ask — you decide, mark it `ASSUMED`, or park it as a morning decision.
2. **Baby-proof the house.** Everything you do overnight is local, on a branch, or on staging — and reversible. The `guard-overnight.sh` hook enforces this. If it blocks you, that's the system working: log it, move on.

**Read the platform context** (CLAUDE.md or `.claude/platforms/`) for build, test, and protected-path rules.

---

## PHASE 0 — KICKOFF (founder is still here)

### 0A. Ask yourself the overnight question

Scan the backlog (`gh issue list`, Linear via MCP if available, `TASKS.md`, open PRs, failing tests, TODOs). Dispatch the `overnight-triage` agent to classify every candidate. Then answer, in writing:

> "What can I do overnight, without supervision, that would actually lead to progress happening?"

Produce the plan in this exact shape:

```
OVERNIGHT PLAN — <date>

What I'll run overnight (all local, branch, or staging — all reversible):
  1. <task> — <why it's safe> — <worktree name>
  2. ...

What I won't do unsupervised:
  merge, deploy, apply migrations, touch production data, push to main,
  spend money, send messages to real users, change secrets/env, <project-specific>

Decisions I need from you before you go:
  Q1. <question> — default if no answer: <default>
  Q2. ...
```

### 0B. Front-load every decision

Use AskUserQuestion for the "Decisions I need" list (max 4 per batch; batch again if needed). Ask about anything that would otherwise make you stop mid-night: scope, naming/copy choices, which approach when two are reasonable, test accounts/staging URLs, budget limits.

End with one open question: **"Any other questions, permissions, or off-limits areas before I start?"**

Record answers + defaults in `.claude/overnight/<date>/KICKOFF.md`. This is your authority for the night. Anything not covered → decide yourself and mark `ASSUMED`, or park it as a morning decision if it's not reversible.

### 0C. Arm the guard

```bash
mkdir -p .claude/overnight && date -u +%FT%TZ > .claude/overnight/ACTIVE
grep -qxF '.claude/overnight/' .gitignore 2>/dev/null || echo '.claude/overnight/' >> .gitignore
```

(Overnight logs/reports stay local. The `ACTIVE` file must never get committed, or it would arm strict mode for everyone who clones the repo.)

The `ACTIVE` file switches `guard-overnight.sh` into strict mode (blocks pushes outside `overnight/*` branches, outbound writes, publishes, etc.). Remove it in Phase 4.

Tell the founder: "Starting. Go to sleep. Report will be at `.claude/overnight/<date>/REPORT.md`." Then never ask another question until morning.

---

## PHASE 1 — ONE WORKTREE PER TASK

Each task gets its own copy of the repo so agents can run in parallel without stepping on each other:

```bash
git fetch origin
git worktree add ../wt-overnight-<id> -b overnight/<id>-<slug> origin/main
```

- Name worktrees `wt-overnight-<id>` and branches `overnight/<id>-<slug>`.
- Install deps / run setup inside each worktree per the platform context.
- Cap parallelism at **5 worktrees** unless KICKOFF says otherwise.
- `git worktree list` at the end goes in the report.

---

## PHASE 2 — THE LOOP (per task, in parallel across worktrees)

Agents check each other's work until the output is clean. Don't let one agent grade its own homework.

```
   design ──► build ──► test ──► review ×2 ──┐
     ▲                                        │
     └───────────── findings ◄────────────────┘
```

1. **Design** — `architect` agent writes a short plan for the task into `.claude/overnight/<date>/<id>-plan.md`. Skip for tiny fixes.
2. **Build** — `implementer` agent works in the task's worktree.
3. **Test** — `tester` agent writes/runs tests; run the platform's lint/typecheck/build/test.
3b. **Verify** — `verifier` agent drives the real app through every scenario in the task's Verification section (tasks get Goal / Context / Verification at kickoff, per the `spec` skill). No evidence = not done.
4. **Review ×2** — run BOTH in parallel:
   - `review` orchestrator (normal quality pipeline)
   - `second-opinion` agent (fresh eyes, never saw the build; uses a different model/CLI if available)
5. Any Critical/Important finding or failed verification → back to step 2 with the findings. **Max 4 loops per task.**
5b. **Simplify ×2** — once clean, run the `code-quality` agent two more times in a row (pass 2 and 3, each given earlier findings). Apply what they find, re-test, re-verify. Done when a pass reports 0 new findings.
6. Clean → commit on the `overnight/*` branch, push the branch, open a PR. Never merge it yourself.
   - Fully clean (VERIFIED + review clean + code-quality CLEAN): open it ready for review with `--label agent:auto-merge`. If the founder opted this repo into auto-merge, GitHub merges it after CI passes. Skip the label for auth, payments, migrations, CI/CD, or `.claude/` changes.
   - Anything less: open as **draft**, no label.
   If the repo has GitHub Actions, wait for CI (`gh pr checks <pr> --watch`). Red CI = back to step 2 with the failure as a finding. Only green-CI PRs count as "clean" in the report.
7. Stuck after 4 loops → draft PR with a "STUCK" note + what you tried. Draft PR beats silence.

Log every loop to `.claude/overnight/<date>/<id>-log.md` (one line per pass: stage, verdict, finding count).

### When the guard blocks you

You'll get a `BLOCKED by guard-overnight` message. Do NOT try another way around it (different command, script, alias, API call). Add a decision line to the report — what you needed and why — and continue with the next step or task.

---

## PHASE 3 — MORNING REPORT

Write `.claude/overnight/<date>/REPORT.md`. The founder should be able to clear it over coffee.

```
OVERNIGHT REPORT — <date>   (<N> tasks, <M> draft PRs, <K> decisions)

<N> decisions, one line each:
  D1  Push the 3 local fixes onto their PRs?            → yes / no
  D2  #221 copy: "Other" OK?                            → yes / edit
  D3  Guard blocked `<command>` on #219 — needed for X  → allow / skip
  ...

Shipped to draft PRs:
  #217 rename "More" → "Other"         PR #221   CI ✅  reviewed ×2   3 loops
  #215 150-char limit not shown        PR #222   CI ✅  reviewed ×2   2 loops
  #213 pinch feels awkward             PR #226   STUCK — see log      4 loops

ASSUMED (decided without you — skim these):
  - <decision> — <why>

Blocked by guard:
  - <command> — <task> — <what it was trying to do>

Worktrees left open:
  <git worktree list output>
```

Rules for the decisions list: one line each, answerable with a word, most important first, max 10. If there are more, group the rest under "Lower priority".

---

## PHASE 4 — DISARM

```bash
rm -f .claude/overnight/ACTIVE
```

Leave the worktrees in place (the founder reviews them). Print the path to REPORT.md as the final message.

---

## OPERATING PRINCIPLES

- Ask everything up front. After kickoff, zero questions.
- Reversible only: local, `overnight/*` branches, draft PRs, staging.
- Never merge, deploy, run prod migrations, touch prod data, push main, force-push, publish, spend money, or message real users.
- Never route around the guard. Blocked = decision line.
- `.github/workflows/` is locked overnight. CI is the referee, so you don't edit the referee.
- Agents review each other. Nothing ships without review ×2.
- Max 4 loops per task, max 5 parallel worktrees (unless KICKOFF says otherwise).
- Mark judgment calls `ASSUMED`. Keep the morning report short.
- Same branch/security rules as `/sybau` apply (no secrets, no `.env`, scan diffs before commit).
