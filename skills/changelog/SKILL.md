---
name: changelog
description: "Use when updating the changelog for a release."
argument-hint: <version>
---

# Changelog

Describe the release's final user-facing result. Use the net diff and final behavior as the
source of truth; commits and PRs help establish evidence, not the structure of the narrative.
Omit intermediate edits, abandoned approaches and fixes to mistakes introduced and resolved
within the release. Do not report work that was reverted before release.

## Establish The Release

1. Resolve the version, release date and target revision from the request and repository.
   Use today's date for a new release unless specified otherwise; ask if the version is unknown.
2. Read `CHANGELOG.md`, or `CHANGELOG` when that is the existing file. Identify the previous
   release in the relevant release line and verify the actual tags/revisions. Do not assume
   a `v` prefix or use an unrelated tag as the baseline.
3. Inspect the comparison range, final diff and relevant implementation. For a first release,
   describe the shipped capabilities without inventing a prior version. If there are no notable
   changes, report that instead of manufacturing entries.

## Write The Entries

- Preserve existing formatting. If neither file exists, create `CHANGELOG.md` with a version
  and date heading, using only applicable Added, Changed, Deprecated, Removed, Fixed or Security
  categories.
- Write concise entries explaining what users can now do or rely on. Group related work and
  prioritize breaking changes and required migration steps. Omit routine internal churn.
- Update an existing section for the version rather than duplicating it. Move only `Unreleased`
  entries included in this release; preserve entries for later work and previous release history.
- Include verified PR references when useful, not raw commit hashes. Maintain release/comparison
  links using the actual repository and tag convention; do not invent a remote or tag name.
- Check the entries against the final result, version, date and links. Report the file updated
  and any evidence gaps. Updating a changelog does not itself create a tag or publish a release.
