---
name: review-loop
description: "Use when requesting an independent Claude/Codex review or a bounded review-fix-review loop on work already done."
argument-hint: "[target] [reviewer=claude|codex] [model=<id>] [effort=<level>] [rounds=3]"
---

# Review Loop

Get an independent review of completed work. Keep assessment-only requests read-only; apply
fixes only when requested or already authorized. Preserve unrelated work and existing scope.

Read the [shared guidelines](../review/references/guidelines.md) and
[runner protocol](references/review-protocol.md). Use [pr-review](../pr-review/SKILL.md)
for PR context and readiness checks.

## Setup

Identify the host from the current session. Codex defaults to Claude; Claude Code defaults
to Codex; another harness requires an explicit reviewer. Accept natural language or
`reviewer=claude|codex model=<alias-or-id> effort=<level> rounds=<count>`.

Explicit settings override saved review preferences, then the external CLI's defaults.
Keep the host model and global CLI settings unchanged; save preferences only when requested.
Show scope, review-only/fix mode, reviewer, requested model/effort and budget before starting.
Default to three external attempts, including failures. Never silently substitute providers
or models; report observed model identity separately from requested settings.

## Review Loop

1. Establish the user's original requirements, acceptance criteria and intended changes from
   the conversation, repository instructions, code and tests. Resolve target refs and SHAs;
   fetch when needed and report failures. Prepare another checkout only when necessary,
   preserving the original index and working changes. State any uncertain scope.
2. Write a brief outside the checkout with requirements, task scope, constraints, relevant
   decisions, pre-existing issues, actual checks and gaps. Include applicable instructions
   outside the target root. Give evidence rather than a defense of the implementation.
3. Resolve `scripts/review_runner.py` from this installed skill and call `start`. Use
   background execution for long calls, communicate progress, and read the latest result.
   Surface external failures as incomplete; never replace them with self-review or an older
   passing result. Do not silently install tools, log in or change accounts.
4. Verify findings against code. Record **confirmed**, **dismissed with evidence**, or
   **unresolved**, tracking the same issue across rounds. Optional improvements are not
   blockers. Apply authorized fixes and run relevant checks plus required validation,
   reusing applicable passing results. The external reviewer stays read-only.
5. Write feedback outside the checkout with dispositions, evidence, fixes, check results and
   remaining objections. Call `next`; each fresh review receives the original brief and
   complete history to reassess findings, verify fixes and inspect the updated changes.
6. Stop at current `NO_BLOCKERS` with sufficient host verification, the attempt limit,
   a material unresolved decision or a tool failure. Do not reset the budget to force
   agreement. Dismissed blockers need independent reassessment; edits need another review.

## Finish

Run `check` before reporting a clean result. Summarize scope/SHAs, reviewer and observed model
(unknown if unavailable), attempts, fixes, actual validation, optional findings and gaps.
Use **No blockers found**, **Changes required**, or **Verification incomplete**; PR readiness
also requires `pr-review` evidence. Report disagreements plainly. This skill does not itself
authorize commits, pushes, publication or merging.
