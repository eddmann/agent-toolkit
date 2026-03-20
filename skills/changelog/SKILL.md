---
name: changelog
description: "Update the changelog for a new release"
argument-hint: <version>
---

Update the repository changelog with changes between the last release and the current version. The caller provides the version number being released. If `CHANGELOG.md` does not exist, use `CHANGELOG` instead.

## Step-by-Step Process

### 1. Determine baseline version
If no baseline version is provided, use the most recent git tag. You can find it with `git describe --tags --abbrev=0`.

### 2. Find the commits from git

Use the following commands to gather commit information:

```bash
# Get the baseline version (if not provided)
git describe --tags --abbrev=0

# Get all commits since the baseline version
git log <baseline-version>..HEAD
```

### 3. Update the changelog
Read the existing changelog file (`CHANGELOG.md`, or `CHANGELOG` if missing) and add a new versioned section for the release. Use the version provided by the caller and today's date. Add the section at the top, below any existing header, in the same style as the existing changelog.

If no changelog file exists, create `CHANGELOG.md` using this template:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [<version>] - YYYY-MM-DD

### Added

- First entry here

[<version>]: https://github.com/OWNER/REPO/releases/tag/v<version>
```

For existing changelogs, add the new version section below the header:

```markdown
## [<version>] - YYYY-MM-DD
```

Categorize entries under [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) headings. Only include categories that have entries:

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Vulnerability fixes

Add a comparison link at the bottom of the file for the new version:

```markdown
[<version>]: https://github.com/OWNER/REPO/compare/v<previous>...v<version>
```

If there is an existing "Unreleased" section, move its content into the new versioned section and leave "Unreleased" empty or remove it.

## Ground Rules When Writing Changelogs

### Content Guidelines
* Focus on **notable changes** that affect users (features, fixes, breaking changes)
* Mention pull requests (`#NUMBER`) when available, but not raw commit hashes
* Ignore insignificant changes (typo fixes, internal refactoring, minor documentation updates)
* Group related changes together when appropriate
* Order entries by importance: breaking changes first, then features, then fixes

### Style Guidelines
* Use valid markdown syntax
* Start each entry with a past-tense verb or descriptive phrase
* Keep entries concise but descriptive enough to understand the change
* Use bullet points (`*` or `-`) for individual changes
* Format code references with backticks (e.g., `` `foo.cleanup` ``)

### Example Format

```markdown
## [1.2.0] - 2026-01-04

### Added

- Right-click context menu with quit option
- Animated processing indicators to floating record bar

### Changed

- Improved menu bar with icons and cleaner structure

### Fixed

- Remove ellipsis from menu bar item titles

## [1.1.0] - 2026-01-01

### Added

- Compact floating record bar with waveform visualization
- Landing page with GitHub Pages deployment

### Changed

- Use native macOS Settings scene with streamlined UI

[1.2.0]: https://github.com/eddmann/project/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/eddmann/project/compare/v1.0.0...v1.1.0
```

### Good vs. Bad Examples

**Good:**
* `Fixed an issue with the TypeScript SDK which caused an incorrect config for CJS.`
* `Added support for claim timeout extension on checkpoint writes.`
* `Improved error reporting when task claim expires.`

**Bad:**
* `Fixed bug` (too vague)
* `Updated dependencies` (insignificant unless it fixes a security issue)
* `Refactored internal code structure` (internal change, not user-facing)
* `Fixed typo in comment` (insignificant)

## Notes

* Preserve the existing changelog style and formatting (headings, bullet style, ordering, and spacing)
* If the repo uses a different default branch name, treat that as the "current version" instead of `main`
* When in doubt about whether a change is significant, err on the side of including it
* If no commits since last tag, inform the user instead of updating
