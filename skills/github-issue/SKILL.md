---
name: github-issue
description: "Create a GitHub issue from context or conversation"
argument-hint: <issue description>
---

Create a GitHub issue based on provided context or the current conversation.

## Title Format

`<type>(<scope>): <summary>`

- `type` REQUIRED: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`
- `scope` OPTIONAL: affected area (e.g., `api`, `auth`, `ui`)
- `summary` REQUIRED: concise description, under 80 chars total

## Body

Include relevant sections only:

- **Summary** - brief overview
- **Description** - detailed explanation
- **Steps to reproduce** - if it's a bug
- **Expected behavior** - what should happen
- **Code snippets / error messages** - if applicable

## Steps

1. If no context is provided, extract it from the current conversation (bugs, features, errors discussed).
2. Draft a title and body. Present to the user for approval.
3. Iterate if the user requests changes.
4. ONLY after approval, create with `gh issue create`:
   ```bash
   gh issue create --title "type(scope): summary" --body "$(cat <<'EOF'
   Body content here...
   EOF
   )"
   ```
5. Report the issue URL.

## Notes

- Do NOT create the issue until the user explicitly approves.
- Use the current working directory's git repository.
- Format code and errors properly in markdown.
