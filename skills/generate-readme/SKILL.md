---
name: generate-readme
description: "Use when creating or updating a project's README from its actual capabilities and usage."
---

# Generate README

Write for the project's intended users. Explain what the current product does and how to use
it, without development chronology, abandoned approaches or unsupported claims.

## Establish The Facts

Read repository instructions, the existing README, relevant manifests, entrypoints, examples,
tests and build/CI configuration. Establish the audience, purpose, supported installation paths,
requirements and smallest useful example. Explore only as far as needed to support the content.

Check commands and flags against actual scripts or CLI help. Confirm configuration names,
defaults, required credentials and platform support from the implementation. Verify externally
published packages or downloads before presenting them as available. If a fact remains unknown,
report the gap rather than inventing a feature, command, URL or requirement.

## Write

- Preserve useful existing content, links and project conventions. For a targeted update, edit
  the relevant sections rather than replacing the whole document.
- Lead with the purpose and a practical way to get started. Include installation, usage,
  configuration, development or deployment sections only when they help this project's reader.
- Use runnable examples with necessary prerequisites and working directories. Clearly identify
  values the user must supply, and explain data-resetting or externally acting commands.
- Keep implementation details only when they help someone use or contribute to the project.
  Link to detailed documentation instead of duplicating it. Use tables, screenshots or diagrams
  where they improve understanding; do not require them for every README.
- Describe supported behavior plainly. Omit marketing filler, guessed badges, empty sections
  and planned capabilities presented as shipped. Preserve the actual license and attribution;
  never select a license as part of writing the README.

## Verify

Review the rendered structure, local links and referenced files. Exercise the documented quick
start when practical and within the task's scope, using an isolated environment if needed.
Do not run destructive setup or publish anything merely to validate documentation. Distinguish
commands inspected from commands actually executed, and report material verification gaps.
