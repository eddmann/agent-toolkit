---
name: public-release
description: "Use when auditing a repository before making it public."
argument-hint: "[specific concerns]"
---

# Public Release Audit

Assess whether the intended public repository exposes sensitive material or has concrete
release blockers. Keep the audit read-only: do not rewrite history, rotate credentials,
change visibility, publish artifacts or apply fixes. Preserve existing work.

## Establish Coverage

Read repository instructions and identify the revision, intended branches/tags, dirty changes
and publication scope. Distinguish committed content from local files that would not be
published. Check whether the clone is shallow or refs, submodules or LFS content are missing;
report incomplete coverage rather than assuming the checkout represents the whole repository.

## Audit

- Read [exposure checks](references/exposure.md) for secrets, private data, history, metadata
  and internal references. Current-tree checks alone cannot establish that history is clean.
- Read [readiness checks](references/readiness.md) for dependencies, licenses, configuration,
  documentation and build/test evidence. Apply only checks relevant to the repository.

Investigate candidate findings before reporting them. Distinguish real exposure or defects
from placeholders, intentional public information and optional polish. Keep detailed scan
output private and redact secret values. Use local tools where possible; do not upload private
source or credentials to a scanning service as part of the audit.

## Report

Lead with **blockers found**, **no blockers found within checked scope**, or **verification
incomplete**. List findings by severity with file/line or commit evidence, concrete impact and
the smallest necessary remediation. Separate optional improvements from release blockers.

State reviewed revisions and refs, checks performed, results and material gaps. A missing tool,
truncated scan or failed setup is incomplete verification, not a passing result. Avoid security
guarantees, reputation grades and empty report sections. Recommend credential rotation for
confirmed exposure, but leave remediation and publication to a separately authorized task.
