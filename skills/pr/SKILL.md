---
name: pr
description: "Use when preparing changes for a pull request, writing its description or opening it on GitHub."
---

# Pull Requests

Explain the problem, resulting behavior and validation so a reviewer can assess the change
before opening the diff. Scale detail to complexity. Drafting or readiness review alone stays
read-only; opening a requested PR includes committing and pushing its intended changes.

## Prepare The Change

1. Inspect `git status --short --branch`, remotes and any existing PR for the branch. Resolve
   the target repository and base from the user or existing PR; otherwise discover the target
   repository's default branch. Identify the base remote and push destination separately when
   working with a fork. Ask only if the destination remains ambiguous.
2. Fetch the relevant base/head refs and record their SHAs. Report fetch failures rather than
   claiming current-base verification. Inspect commits with `git log --oneline <base-ref>..HEAD`
   and changes with `git diff --stat <base-ref>...HEAD` and `git diff <base-ref>...HEAD`.
   Three-dot measures the PR diff; a two-dot file comparison includes base-only changes.
   Account separately for uncommitted changes intended for the PR.
3. Identify unrelated commits or edits. For authorized branch preparation, use an isolated
   branch/worktree from the refreshed base when needed and include only intended changes.
   Preserve the original checkout, index and uncommitted work. For a draft-only request,
   describe scope problems without changing the branch.
4. Read repository instructions, CI and available test targets. Run required checks and focused
   behavioral verification appropriate to the change. Record actual commands, results and gaps;
   reuse applicable passing results unless the revision or relevant conditions changed.

## Write The Description

Use a short, outcome-focused title in plain language and follow the repository's PR template
when present. A small PR usually needs a problem/outcome paragraph and validation. Add detail
only when useful for implementation, migrations, risks, tradeoffs or review focus.

Describe the final behavior and implementation for a reviewer without conversation context.
Use the final diff as the source of truth; omit intermediate edits, abandoned approaches,
fixes to mistakes introduced during the task and file-by-file narration. When scope changes,
rewrite the title and body around the final result. Include relevant UI screenshots when
available; do not invent evidence.

## Open Or Update

1. Reuse an existing PR for the intended branch when appropriate. A description-only update
   does not require new commits or a push. When publishing code changes, use
   [commit](../commit/SKILL.md) for intended edits, inspect the final commit range/diff, then
   push to the resolved destination without overwriting unrelated remote work.
2. Save the exact description to a temporary Markdown file with real newlines. Create with
   `gh pr create --repo <owner/repo> --base <base> --head <head> --title "<title>" --body-file <body-path>`;
   update with `gh pr edit <pr> --repo <owner/repo> --title "<title>" --body-file <body-path>`.
   Honor the requested draft/ready state. Do not interpolate multiline bodies into shell commands.
3. Re-read the PR to verify its repository, base/head, title, body and draft state. Attach every
   created or updated PR to the current task when the host provides that capability. Return its
   URL, validation and any material remaining gaps. Creating a PR does not authorize merging it.
