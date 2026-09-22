# Exposure Checks

## Files And History

Inventory tracked content, intended uncommitted additions and relevant refs. Include hidden
files; default search ignores can hide material that is nevertheless tracked. Check deleted
files and earlier revisions, not just current content or commit messages. Record scanner
version, configuration, exclusions and refs covered; sample searches are not a complete scan.

Use an available secret scanner with redacted output and history support, checking its current
CLI help. Supplement it with targeted inspection for the repository's providers and formats:

- Credentials, private keys, service-account files, signed URLs and tokens in source/config.
- Embedded passwords in connection strings, package registry configuration and CI files.
- Environment files, logs, dumps, archives, fixtures and generated artifacts.
- Sensitive values or private information in commit messages and author metadata.

Treat matches as candidates. Public keys, example credentials and intentionally published
contact information are not automatically secrets. Confirm context without testing credentials
against live services. Report locations and redacted identifiers, never complete secret values.
Deleting a current file or adding it to `.gitignore` does not remove historical exposure.

If relevant remote refs or historical objects are unavailable, state that limit. Include
submodules and LFS objects when part of the proposed publication; a pointer is not inspection
of its referenced content. Do not claim access to deleted remote objects or cached copies.

## Private Data And Internal References

Inspect sample data, exports, logs, screenshots and documents for real customer records,
private messages, personal identifiers, addresses and confidential business information.
Distinguish synthetic fixtures from real records; unfamiliar names alone are not proof of PII.

Check hardcoded local paths, internal URLs, private registries and service endpoints for
sensitive disclosure or broken public setup. A private IP, localhost URL or employee name
is not inherently a release blocker; explain the actual consequence.

Where media/documents are included, inspect visible content and relevant metadata such as
GPS, authors, comments or tracked changes. Inspect archive contents when their inclusion
matters. Keep extraction and reports in a private temporary location outside tracked files.

## Report Exposure

Identify whether evidence occurs in the current tree, history or another intended artifact.
For confirmed credentials, recommend revocation/rotation and appropriate content/history
remediation. Do not print raw secret-bearing diffs or run cleanup commands during the audit.
