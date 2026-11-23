---
name: spec
description: Turn a rough feature or bug request into a one-shot-able task spec with three sections (Goal, Context, Verification) and file it as a GitHub issue or TASKS.md entry. Use before /sybau or /overnight, or when the user says "spec this", "write the ticket", "make an issue for". /sybau also uses it to fill gaps in thin tickets.
argument-hint: [rough request] (optional — issue number to tighten, or freeform text)
allowed-tools: Read, Grep, Glob, Bash, Agent, AskUserQuestion
---

# Spec — front-load the engineering into the prompt

Agents one-shot features when the prompt does the hard thinking up front. Every spec has exactly three sections. The third one matters most.

**Read the platform context** (CLAUDE.md or `.claude/platforms/`).

## 1. Gather

- If `$ARGUMENTS` is an issue number, fetch it (`gh issue view <n>`). Otherwise treat it as the request.
- Dispatch the `explorer` agent to find the code paths, similar existing features, data models, and tests this touches. Don't guess paths; cite real files.
- Find the project's verification skill (`.claude/skills/verify-*/`) and its feature map. If there isn't one, say so and suggest `/create-verification-skill`.
- Ask the user only what the code can't answer (copy, product decisions, edge-case policy). Batch it into one AskUserQuestion. If they're not around, decide and mark it `ASSUMED`.

## 2. Write it in this shape

```markdown
## Goal
<1–3 sentences: what the user can do after this ships, and why. Outcome, not implementation.>

Out of scope: <what this deliberately does not do>

## Context
- Code paths: `path/to/file.ext` (what's there), `path/to/other` (...)
- Follow the pattern in: `path/to/similar/feature`
- Data: <models/tables/endpoints involved>
- Constraints: <platform rules, perf, auth, existing conventions>
- References: <PRD / design / related issues / docs links>
- Decisions: <answers from the user, or ASSUMED: ...>

## Verification
Done means every scenario below passes, proven by driving the real app (verifier agent + verify-<app> skill):
1. <User does X> → <observable result Y> (and side effect Z, e.g. row in table, email sent)
2. <Edge case> → <result>
3. <Failure path, e.g. bad input / offline> → <graceful result>
4. Regression: <existing behavior that must still work>
Plus: lint, typecheck, tests, build all green.
```

Rules for **Verification**: every scenario is observable from the user's side, names the end state, and could fail. "It works" or "tests pass" alone is not a scenario. Include at least one edge case and one failure path.

## 3. File it

- GitHub repo → `gh issue create --title "<type>: <short title>" --body-file <spec.md>` (or `gh issue edit <n> --body-file` when tightening an existing issue).
- No GitHub → append to `TASKS.md`.
- Print the issue URL / TASKS.md entry and the one-line command to build it: `/sybau #<n>`.
