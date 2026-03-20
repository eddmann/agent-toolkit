---
name: analyze
description: "Deep codebase analysis with extended thinking — use for complex tasks that may lead to implementation"
argument-hint: <request or question>
---

ultrathink: Gather deep context and analyze the following request with extreme thoroughness. Do NOT begin planning until you have built a comprehensive mental model of the relevant code.

## Request

$ARGUMENTS

## Context

- Current directory: !`pwd`
- Git branch: !`git branch --show-current 2>/dev/null || echo "not a git repo"`
- Recent commits: !`git log --oneline -10 2>/dev/null || echo "no commits"`

## Phase 1: Broad Context Gathering (MANDATORY — do this FIRST)

Before forming ANY opinions or plans, gather context aggressively:

1. **Map the project structure** — use Glob to understand the directory layout, then read project config files (CLAUDE.md, AGENTS.md, package.json, Cargo.toml, Makefile, tsconfig.json, or equivalent). This tells you the conventions.
2. **Launch Explore agents** (set to "very thorough") in parallel to map all code areas relevant to the request. Cast a wide net.
3. **Read ALL files** that might be relevant — err on the side of reading MORE, not less. Read files in parallel batches. If you're unsure whether a file matters, read it.
4. **Read tests** to understand expected behavior, test patterns, and edge cases already covered.
5. **Check git history** (`git log --oneline --all -- <relevant paths>`) if it helps understand design decisions or recent changes.

**You should have read 10+ files before moving to Phase 2.** If you haven't, you haven't read enough. Spend real effort here — this is where the quality comes from.

## Phase 2: Resolve Ambiguity

If the request is ambiguous or there are meaningful choices that affect the approach (e.g., which library, what scope, performance vs simplicity), use `AskUserQuestion` to resolve them NOW — before committing to any direction. Don't guess at intent.

## Phase 3: Deep Analysis

Now think deeply about what you've learned:

1. **Consider multiple approaches** — don't settle on the first idea
2. **Identify tradeoffs** — performance, maintainability, complexity, risk
3. **Think about edge cases** and failure modes
4. **Consider how changes fit** with existing patterns and conventions
5. **Anticipate problems** that might arise during implementation

## Phase 4: Output

Decide whether this request is an **implementation task** or **pure analysis**.

**If implementation:** Use `EnterPlanMode`. Do any remaining exploration there, write the plan to the plan file with specific file:line references, then use `ExitPlanMode` for approval. Once approved, proceed with implementation directly.

**If pure analysis:** Output findings directly. Include file:line references. No plan mode needed.
