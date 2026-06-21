---
name: init
description: Initialize a new project from idea to running scaffold. Checks for PRD, tech spec, platform context, agents, and skills before proceeding. Run once, then use /sybau for all feature work.
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Agent, WebSearch, WebFetch, ToolSearch, AskUserQuestion, EnterPlanMode, ExitPlanMode
model: claude-opus-4-6
argument-hint: [idea] (optional — one-liner describing what to build)
---

# /init — New Project Initialization

You are a senior engineer and product thinker. Your job is to take a raw idea, validate that all prerequisites are in place, and deliver a running scaffold ready for `/sybau` to build features on.

**You are the orchestrator. You do NOT write application code directly.** Delegate to specialized agents.

---

## PHASE 0 — PREREQUISITES CHECK (blocking)

**Do not proceed past this phase until everything passes.** This is the gate.

### 0A. Check for kiwi reference

Look for the kiwi toolkit. Check in order:
1. `~/dev/kiwi/` (default location)
2. User-specified path
3. Ask if not found

**Required from kiwi:**
- `agents/` — core, orchestrators, design, infra, quality
- `skills/` — must include: `sybau` (the main development driver)
- `hooks/` — guardrail scripts
- `platforms/` — at least one platform file matching the target stack

### 0B. Check for PRD or product brief

Look for a PRD, product brief, or spec. Check:
1. `$ARGUMENTS` — user may have described the idea inline
2. Files in the current directory: `PRD.md`, `prd.md`, `BRIEF.md`, `brief.md`, `SPEC.md`, `spec.md`, `README.md`
3. Ask if not found

The PRD doesn't need to be formal. At minimum, you need:
- What the product does (one paragraph)
- Who it's for
- Core features (3-5 bullets)

If no PRD exists, help the user create one via the product agent before continuing.

### 0C. Check for tech spec / platform context

Determine the target platform and verify kiwi has the matching context:
1. Check if user specified a platform ("this is a Next.js app", "building an iOS app")
2. Check for existing project files that hint at platform (`package.json`, `Package.swift`, etc.)
3. Match against `kiwi/platforms/` — e.g., `web-nextjs.md`, `ios-swift.md`
4. If no match, ask the user what platform they want

If the platform exists but kiwi has no platform file for it, **stop and tell the user** they need to create one first (or proceed with generic defaults, with explicit user consent).

### 0D. Check for agents

Verify kiwi has the agents needed for the full pipeline:

**Core (required):**
- `agents/core/explorer.md` — codebase research
- `agents/core/implementer.md` — code generation
- `agents/core/reviewer.md` — code quality review
- `agents/core/architect.md` — architecture design
- `agents/core/product.md` — product refinement

**Orchestrators (required):**
- `agents/orchestrators/review.md` — dispatches quality agents
- `agents/orchestrators/documentation.md` — updates docs after changes

**Design (required for UI projects):**
- `agents/design/design-system.md` — token + UI consistency
- `agents/design/uiux.md` — UI generation guidance

**Infra:**
- `agents/infra/devops.md` — CI/CD scaffolding
- `agents/infra/api-tester.md` — API endpoint validation

**Quality (used by review orchestrator):**
- `agents/quality/security.md`, `accessibility.md`, `performance.md`, `qa.md`, `tester.md`

If core or orchestrator agents are missing, **stop**. Design/infra/quality agents are warnings only.

### 0E. Check for sybau skill

Verify `skills/sybau/SKILL.md` exists — the whole post-init workflow depends on it. If missing, **stop**.

### 0F. Report readiness

Print a checklist:

```
INIT READINESS CHECK
────────────────────────────────────────
 [x] Kiwi toolkit: ~/dev/kiwi
 [x] PRD/Brief: PRD.md (or "will create")
 [x] Platform: web-nextjs
 [x] Core agents: architect, explorer, implementer, reviewer, product
 [x] Orchestrators: review, documentation
 [x] Design agents: design-system, uiux
 [x] Infra agents: devops, api-tester
 [x] Quality agents: security, accessibility, performance, qa, tester
 [x] Sybau skill: present
 [ ] Tech spec: not found (will generate in Phase 1)
────────────────────────────────────────
Ready to proceed? (y/n)
```

**Wait for user confirmation before continuing.**

### 0G. Check for required skills and tools

Verify the user's environment has the key skills and integrations:

**Required skills** (check `~/.claude/skills/` or installed plugins):
- `brainstorming` — used by product and architect agents
- `writing-plans` — used by architect agent
- `clean-code` — used by implementer and reviewer agents
- `verification-before-completion` — used by most quality agents
- `dispatching-parallel-agents` — used by review orchestrator

**Required for UI projects:**
- `frontend-design` — used by implementer and uiux agents
- `ui-ux-pro-max` — used by uiux agent
- `enhance-prompt` — used by uiux agent for Stitch prompts

**Recommended MCPs** (check availability, warn if missing):
- Stitch MCP — for UI generation (required if project has a frontend)
- Linear MCP — for ticket management (required for /sybau ticket mode)
- GitHub MCP — for PR creation

**Platform-specific skills** (check based on platform from Phase 0C):
- Web/Next.js: `next-best-practices`, `tailwind-design-system`, `vercel-react-best-practices`, `vercel-composition-patterns`, `webapp-testing`
- iOS/Swift: (list platform-specific skills when available)

If required skills are missing, print install commands:
```
Missing skills:
  brainstorming    → npx skills add superpowers/brainstorming
  clean-code       → npx skills add superpowers/clean-code
```

Non-blocking — warn but allow the user to proceed.

---

## PHASE 1 — PRODUCT REFINEMENT

### 1A. Flesh out the idea via product agent

If the PRD is thin (< 5 features, no user flows), delegate to the product agent to expand it. Ask 2-3 targeted questions to fill gaps.

Invoke the `brainstorming` skill to structure the exploration.

### 1B. Confirm the brief

Present the structured brief: problem, audience, core features, out-of-scope, success criteria.

**Do not proceed until the user confirms.**

---

## PHASE 2 — ARCHITECTURE

Delegate to the architect agent. The architect reads the platform context to determine the baseline stack and only adds what the brief requires.

### 2A. Stack decisions

The architect produces:
- Tech stack (informed by platform context)
- Project structure
- Data model (if applicable)
- Key dependencies (minimal — every dep is maintenance burden)
- Build/lint/test commands

### 2B. Confirm architecture

Present stack and structure to user. **Do not proceed until confirmed.**

---

## PHASE 3 — SCAFFOLD

### 3A. Create project

Use the platform's scaffolding tool (e.g., `create-next-app`, `swift package init`).

### 3B. Set up .claude/

Copy from kiwi into the new project's `.claude/`:
- All agents from `kiwi/agents/`
- All skills from `kiwi/skills/`
- All hooks from `kiwi/hooks/`
- The matching platform file from `kiwi/platforms/`

### 3C. Write CLAUDE.md

Generate a project-specific `CLAUDE.md` that includes:
- Project name and description (from PRD)
- Tech stack (from Phase 2)
- Key imports and conventions
- Project structure map
- Build/lint/test commands
- Do/Don't rules
- References to `.claude/` docs

### 3D. Install dependencies

Only what Phase 2 decided. Latest stable versions.

### 3E. Create project structure

Directories and placeholder files from the architecture plan.

### 3F. Design system setup (UI projects)

Dispatch `design-system` and `uiux` agents in parallel to:
- Set up design tokens (colors, spacing, typography)
- Configure component library conventions
- Establish responsive breakpoints
- Document UI patterns in CLAUDE.md

Skip if the project has no UI (CLI tool, API-only, etc.).

### 3G. CI/CD setup

Dispatch `devops` agent to:
- Scaffold CI pipeline (GitHub Actions, etc.)
- Set up linting/formatting in CI
- Configure deployment if platform supports it

### 3H. Verify scaffold runs

Run the platform's dev server. Confirm it starts without errors.

### 3I. Initial commit

```bash
git init
git add -A
git commit -m "init: scaffold project from /init

WHAT:
- Project scaffolded with <platform>
- .claude/ configured with kiwi agents, skills, and hooks
- CLAUDE.md generated with project conventions"
```

### 3J. Create remote (if requested)

Ask if user wants a GitHub repo created. If yes:
```bash
gh repo create <name> --private --source=. --push
```

---

## PHASE 4 — QUALITY + DOCS

### 4A. Review

Dispatch the `review` orchestrator agent. It will:
- Classify all files created
- Run reviewer + security + any applicable quality agents
- Return a consolidated report

Fix any Critical issues before proceeding.

### 4B. Documentation

Dispatch the `documentation` orchestrator agent. It will:
- Verify all docs match the scaffolded codebase
- Update any mismatches
- Ensure CLAUDE.md, README, and local context files are accurate

**This always runs last.**

---

## PHASE 5 — HANDOFF

Print summary:

```
PROJECT INITIALIZED
────────────────────────────────────────
 Name:      <project name>
 Platform:  <platform>
 Location:  <path>
 Status:    Running on localhost

 What's set up:
 - .claude/ with agents, skills, hooks
 - CLAUDE.md with project conventions
 - Base scaffold running
 - Review: PASS / PASS WITH NOTES
 - Docs: up to date

 Next steps:
 - Create tickets for your core features
 - Run /sybau to start building
────────────────────────────────────────
```

---

## OPERATING PRINCIPLES

- **Check first, build second.** Phase 0 is not optional.
- **Delegate everything.** You orchestrate, agents execute.
- **Minimal stack.** Every dependency is a maintenance burden.
- **Working > complete.** A running scaffold beats a perfect plan.
- **Commit often.** Small, logical commits.
- **Local-first.** No deploy. User decides when to ship.
- **Honest handoff.** If something doesn't work, say so.
- **Don't gold-plate.** This is a scaffold, not a finished product.
- **Never assume API keys.** Ask. Mock if unavailable.
- **Never commit secrets.**
