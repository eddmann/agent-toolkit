---
name: simplify
description: "Use when simplifying a completed chunk of work without changing its intended behavior."
---

# Simplify

Find the simplest sufficient implementation: no gold plating, over-architecting,
over-engineering or over-testing. Prefer fewer concepts, branches and responsibilities to
fewer lines. A clear existing solution may need no changes.

## Establish The Scope

Read repository instructions and the [shared guidelines](../review/references/guidelines.md).
Identify the requested files, commits or PR, including staged and unstaged task work. Establish
the intended behavior from the request and relevant contracts. Read nearby callers, tests and
architecture before judging an abstraction; keep unrelated work intact.

## Simplify

- Look for speculative extensibility, one-use layers without a boundary purpose, duplicate
  state or validation, redundant branches and indirection that obscures behavior.
- Reuse established patterns. Keep abstractions that enforce real boundaries or make behavior
  easier to understand; inlining everything is not inherently simpler.
- For each candidate, identify its concrete cost, a smaller alternative, behavior to preserve
  and verification needed. Independent reviewers can help when available, authorized and useful;
  keep straightforward reviews local and verify any delegated findings against the code.
- Remove or consolidate tests only when their observable coverage is duplicated or tied to
  implementation details. Preserve distinct regression, refusal, failure and integration cases.
  Do not replace meaningful coverage with mocks merely to make tests shorter.
- Apply worthwhile changes when simplification is requested; assessment-only requests stay
  read-only. Preserve public contracts, authorization, isolation, failure handling, observability
  and operational requirements. Raise uncertain product changes separately.

Run focused checks and repository-required validation. Reuse applicable passing results;
avoid repeated suites or new tests that merely restate the refactor.

## Finish

Describe the resulting implementation, why it is simpler, validation and remaining uncertainty.
Say plainly when no worthwhile simplification was found. Stay within the user's scope and
authorization; invoking this skill alone does not request a commit, publication or merge.
