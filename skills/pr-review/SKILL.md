---
name: pr-review
description: "Use when reviewing an existing pull request for correctness, scope and readiness to merge."
---

# PR Review

Assess whether the PR solves its intended problem correctly with the simplest sufficient
change. Flag unnecessary abstractions, speculative features and redundant tests only when
their concrete cost is clear. Do not impose personal style or invent findings.

## Review

1. Read repository instructions, the PR description, linked issues, discussion, diff and checks.
   Resolve the actual base branch and fetch current base/head refs; record both SHAs. State
   any missing evidence. Preserve local work; use an isolated worktree when necessary.
2. Trace changed behavior through relevant callers, dependencies and tests. Look for concrete
   failure cases and compatibility with the current base. Distinguish introduced regressions
   from pre-existing issues; a clean merge or historical green CI alone does not prove readiness.
3. Run repository-required checks and focused verification for the affected behavior. Reuse
   applicable passing results. Distinguish checks of the PR head from temporary integration
   checks against the base; do not change the shared branch merely to test integration.
   Add tests only for meaningful regression risks, not to mirror the implementation.
4. Use subagents only when available, authorized and useful for independent review areas;
   verify and reconcile their findings. Keep straightforward reviews local.
5. Report findings before fixing unless fixes are already requested. For authorized fixes,
   make the smallest sufficient change and rerun affected checks. Post a GitHub review only
   when requested; reviewing does not authorize merging.

## Assessment

Lead with what the PR achieves and one verdict:

- **Ready to merge:** sufficient evidence and no unresolved blockers.
- **Changes required:** concrete blockers, even if some verification is incomplete.
- **Verification incomplete:** missing evidence prevents a readiness verdict.

List blockers by severity with file/line references, the trigger, impact and smallest sufficient
fix. Separate optional improvements. Include reviewed SHAs, validation and material gaps.
