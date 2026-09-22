---
name: github-issue
description: "Use when drafting or creating a GitHub issue from a problem, feature request or conversation."
argument-hint: <issue description>
---

# GitHub Issue

Turn the requested problem or feature into an actionable issue. Draft when asked to draft;
create when asked to create, honoring existing authorization without another approval step.

## Prepare

1. Resolve the repository from the request or checkout and read its issue templates and relevant
   instructions. Use conversation context to fill known details; ask only for missing decisions
   that materially affect the issue.
2. Search open and closed issues for likely duplicates using relevant terms. Inspect promising
   matches and their resolution before treating them as duplicates. If an active issue already
   covers the request, return its link; do not silently create a duplicate or update it instead.
3. Verify supporting code, logs or reproduction steps where available. Label unverified user
   reports as such; do not invent evidence or expand the request into speculative implementation.

## Write

Use `<type>(<scope>): <summary>` for the title, under 80 characters total. Choose `feat`, `fix`,
`docs`, `refactor`, `perf`, `test` or `chore`; scope is optional.

Follow the repository template. Otherwise include only useful sections:

- **Problem:** the current behavior or unmet need and who it affects.
- **Evidence:** relevant code, logs or user reports; reproduction and expected behavior for bugs.
- **Impact:** the practical consequence.
- **Acceptance criteria:** observable outcomes that demonstrate completion.

Write for someone without conversation context. Omit discussion chronology, abandoned ideas,
unsupported claims and sensitive data. Link related issues when they clarify scope.

## Deliver

For a draft, return the proposed title and body. For creation, save the exact body to a temporary
Markdown file with real newlines, then use
`gh issue create --repo <owner/repo> --title "<title>" --body-file <body-path>`.
Verify the resulting issue's repository, title and body, and return its URL. If creation times
out or has an ambiguous result, check whether the issue exists before retrying. Add labels,
assignees or project placement only when requested or required by repository instructions.
