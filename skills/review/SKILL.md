---
name: review
description: "Use when reviewing local code against repository conventions and coding guidelines."
argument-hint: <file, directory, or area>
config:
  GUIDELINES_DIR:
    description: "Path to the agent-guidelines directory"
    default: "/Users/edd/Projects/agent-guidelines"
---

# Review

Review the requested files or area for correctness and the simplest sufficient implementation.
Keep the review read-only unless fixes are also requested. Preserve unrelated work.

## Guidelines

Read repository instructions and the relevant standards under `GUIDELINES_DIR`, defaulting to
`/Users/edd/Projects/agent-guidelines` when unset:

- `foundation/code-philosophy.md`
- `practices/clean-code-practices.md`
- `practices/design-principles.md`
- `practices/testing.md`
- `practices/error-handling.md`

Repository-specific requirements take precedence over general preferences. If a guideline file
is unavailable, state the gap and continue with available repository guidance and code evidence.

## Review And Report

1. Establish the intended behavior and scope from the request, code and tests. Trace relevant
   callers and dependencies; inspect the diff when reviewing changes.
2. Look for concrete failure cases and avoidable complexity. Flag unnecessary abstractions,
   speculative features or redundant tests only when their cost is clear. Prefer existing
   patterns and the smallest sufficient fix; do not turn style preferences into blockers.
3. Use focused checks when they help verify a finding. Distinguish observed behavior from
   inference, and do not claim checks that were not run.
4. Report blockers first, then worthwhile optional improvements. For each finding, include
   file/line evidence, the trigger or concrete concern, impact and a suggested fix. Cite the
   relevant guideline when the finding depends on one.

State the reviewed scope and material verification gaps. If there are no actionable findings,
say so; do not add praise or nitpicks merely to fill a report.
