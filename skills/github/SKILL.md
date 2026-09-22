---
name: github
description: "Use when interacting with GitHub repositories, issues, pull requests or Actions through the gh CLI."
user-invocable: false
---

# GitHub

Use `gh` for GitHub operations. Resolve the repository from the request or checkout; pass
`--repo <owner/repo>` or a resource URL when the destination could be ambiguous. For `gh api`,
use the resolved repository in the endpoint path.

## Read And Verify

Prefer `--json` with selected fields and `--jq` for focused output. Check result limits;
paginate or narrow the query before concluding that an issue, PR or run does not exist.
Use `gh api --paginate` for paginated REST listings; GraphQL requires cursor pagination.

```sh
gh pr view <pr> --repo <owner/repo> --json url,title,body,baseRefName,headRefOid,state
gh pr checks <pr> --repo <owner/repo>
gh run list --repo <owner/repo> --commit <sha> --json databaseId,headSha,status,conclusion,url
gh run view <run-id> --repo <owner/repo> --json headSha,status,conclusion,jobs,url
gh run view <run-id> --repo <owner/repo> --log-failed
gh issue list --repo <owner/repo> --state all --search "<terms>" --json number,title,state,url
```

Match CI evidence to the intended workflow, commit, run and attempt. Queued or running checks
are incomplete; a successful older run does not establish the current revision's status.
Use command help for unfamiliar flags rather than guessing.

## Write

Make only requested changes. Use `--body-file <path>` for multiline issue, PR and comment bodies,
keeping real newlines in the file. Re-read the resource after a mutation before reporting success.
If a request times out ambiguously, inspect remote state before retrying to avoid duplicate writes.

Use [pr](../pr/SKILL.md) for preparing or opening PRs,
[pr-review](../pr-review/SKILL.md) for reviewing them, and
[github-issue](../github-issue/SKILL.md) for drafting or creating issues.
