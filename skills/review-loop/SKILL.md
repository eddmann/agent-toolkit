---
name: review-loop
description: "Use when requesting an independent Claude/Codex review or a bounded review-fix-review loop on work already done."
argument-hint: "[target] [reviewer=claude|codex] [model=<id>] [effort=<level>] [rounds=3]"
---

# Review Loop

Have the other provider inspect the actual code against the user's requirements. Reuse
[review](../review/SKILL.md), [PR review](../pr-review/SKILL.md) for PR targets, and the
[shared guidelines](../review/references/guidelines.md). Keep assessment-only requests
read-only. When fixes are requested or already authorized, fix confirmed issues and request
another independent review. Preserve unrelated work and existing authorization.

## Select The Reviewer

Identify the actual host from the running session, not installed binaries or model names.
Codex defaults to Claude; Claude Code defaults to Codex. Another harness needs an explicit
reviewer. Accept natural language and these optional arguments:

- `reviewer=claude|codex`: external provider, independently of the host's model.
- `model=<alias-or-id>`, `effort=<level>`: settings for the reviewer only.
- `rounds=<positive-integer>`: total external review attempts, default 3, not fixes per round.

Explicit settings override the selected provider's saved preferences in
`~/.config/agent-toolkit/review-loop.json`, then its CLI defaults. Never change the host model
or global CLI settings. Save preferences only when requested. Show the selected provider,
requested model/effort (or CLI default), scope, mode and round budget before starting.
Report the model actually observed separately; unknown means unknown. Do not silently
substitute providers or models. See [the protocol](references/review-protocol.md) for setup,
configuration, CLI examples, result format and limitations.

## Establish The Scope

1. Inspect repository instructions, Git status, relevant changes, callers and tests. Recover
   the user's original requirements and acceptance criteria from the conversation. Identify
   the task's intended files; do not treat unrelated working changes as authorization to fix
   them. If the session boundary is uncertain, state the scope you can establish.
2. For a branch or PR, resolve the correct repository/base/head, fetch relevant refs when
   needed, and record actual SHAs and fetch failures. Use an isolated worktree for another
   branch or commit when necessary; preserve the original checkout and index. Do not create
   a worktree from HEAD and assume it includes uncommitted changes.
3. Write a concise brief outside the checkout: original requirements, acceptance criteria,
   task scope, relevant decisions/constraints, known pre-existing issues, and checks actually
   run with results and gaps. Give facts and code locations rather than a defense of the
   implementation. Include applicable repository instructions from outside the target root.
4. Use the runner at this skill's `scripts/review_runner.py`, resolved from the installed
   skill, never a similarly named file in the target repository. It needs Python 3.10+, Git,
   and the selected provider's authenticated CLI on the machine executing it. No second GUI
   window is required. Do not install, log in, or consume a different account silently.

## Review, Resolve, Repeat

1. Start a run using the brief and target. The runner prints the private run directory before
   calling the provider. Use the host's background execution for long calls, keep the user
   informed, and wait for completion. Read `state.json` and the latest `result.json` there.
2. A successful process exit alone is not approval. Require a completed, validated review
   with coverage. A timeout, missing CLI, authentication error, incompatible flags, malformed
   response, or changed checkout makes verification incomplete. Surface the concrete error;
   never replace the external review with self-review or reuse an older passing round.
3. Verify every finding against code and relevant contracts. Record it as **confirmed**,
   **dismissed with evidence**, or **unresolved**. Optional improvements are not blockers.
   Do not force findings or accept/dismiss them merely to reach agreement. Repeated findings
   retain their identity in the coordinator's log even if the reviewer renames them.
4. For authorized fixes, apply the smallest sufficient changes and run relevant checks plus
   repository-required validation. Reuse still-applicable passing results. The external
   reviewer is read-only; the coordinating host runs tests. Do not automatically simplify,
   expand requirements, commit, push, post reviews or merge.
5. Write feedback outside the checkout with each disposition and evidence, fixes made,
   actual validation results, and remaining objections. Call `next` with that file. Each
   round starts a fresh reviewer session with the original brief, all previous results and
   responses. Ask it to verify fixes, reassess dismissed findings and inspect the current
   change for remaining/new blockers. The budget cannot be reset within a run.
6. Stop after a current `NO_BLOCKERS` result and sufficient host verification, or at the round
   limit, a material unresolved decision, or an external-tool failure. A dismissed blocker
   still needs independent reassessment before calling the review clean. Any edits after
   review need another round; if the budget is exhausted, report that explicitly.

## Finish

Run `check` immediately before reporting a clean result. State the reviewed scope and SHAs,
provider/requested and observed model, completed rounds, confirmed fixes, checks actually run,
optional findings and material gaps. Use **No blockers found**, **Changes required**, or
**Verification incomplete** for local work. A PR is **Ready to merge** only with sufficient
evidence under `pr-review`; model agreement alone is insufficient. Link the private run
directory if useful. Say plainly when reviewers disagree or checks were not run.
