---
name: commit
description: "Use when committing task changes using Conventional Commits."
---

# Commit

Commit task-owned changes using `<type>(<scope>): <summary>`:

- Use `feat`, `fix`, `docs`, `refactor`, `chore`, `test` or `perf` as appropriate.
- Scope is optional: a short noun such as `api` or `ui`.
- Write an imperative summary without a trailing period. Keep the entire subject, including
  type and scope, at most 72 characters.
- Add an optional body in short paragraphs after a blank line. No breaking-change markers,
  footers or sign-offs.

Describe the final result of the committed diff and why it matters. Omit intermediate edits,
abandoned approaches and fixes to mistakes introduced during the task. Write the subject and
body for someone who has not seen the conversation.

Commit by default; push only when requested. Honor caller instructions and path/glob limits.
Missing filenames do not expand scope to every checkout change. Resolve ownership from the
current task and diff; ask only if ambiguity remains.

## Isolate And Verify

1. Read `git status --short`, `git diff` and `git diff --cached`, including the entire index.
   Select intended files or hunks; a requested path does not establish ownership of every hunk.
2. Prepare and inspect the exact proposed commit:
   - **Only intended changes in the index:** stage selected files/hunks, inspect
     `git diff --cached`, then commit normally.
   - **Whole intended files with unrelated files staged:** use `git commit --only -- <paths>`.
     Review those files against `HEAD` first: this commits their working-tree contents,
     including unstaged hunks.
   - **Partial files with unrelated staged work:** use a temporary index based on `HEAD`,
     apply only the intended patch and inspect its cached diff. Commit through that index,
     then reconcile only committed hunks in the normal index. Preserve excluded staged and
     unstaged hunks; do not substitute `--only`, blanket unstaging or `git add .`.
3. Commit with `-m "<subject>"` and optional `-m "<body>"`. If a hook fails, inspect the
   failure; do not bypass hooks or expand the commit's scope to unrelated fixes. Verify the
   resulting commit and `git status --short`, confirming unrelated edits and staging remain
   intact. Never run a normal commit against an index containing unrelated changes.
