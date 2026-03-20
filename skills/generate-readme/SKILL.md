---
name: generate-readme
description: "Generate README.md by deeply exploring the codebase"
---

ultrathink: Thoroughly explore this codebase to understand its purpose, architecture, and usage patterns before generating a high-quality README.md in an established documentation style.

## Additional Context

$ARGUMENTS

## Project Context

- Current directory: !`pwd`
- Project name: !`basename $(pwd)`
- Git branch: !`git branch --show-current 2>/dev/null || echo "not a git repo"`
- Git remote: !`git remote get-url origin 2>/dev/null || echo "no remote"`
- Top-level files: !`ls -la 2>/dev/null | head -30`
- Makefile targets: !`make help 2>/dev/null | head -20 || echo "no Makefile or no help target"`

## Instructions

You MUST follow this process exactly. DO NOT skip phases or rush to writing.

### Phase 1: Deep Codebase Exploration

Use multiple **Explore agents** in parallel to gather comprehensive information:

#### Agent 1: Project Identity & Purpose
- What does this project do? (one-line summary)
- What problem does it solve?
- Who is the target user?
- Is it a CLI tool, web app, macOS app, library, language implementation, or something else?
- Check: README.md (if exists), package.json description, Cargo.toml, pyproject.toml, go.mod

#### Agent 2: Tech Stack & Architecture
- Primary language(s) and framework(s)
- Key dependencies and their purposes
- Directory structure and what each folder contains
- Entry points (main files, index files)
- Architecture patterns (monolith, microservices, serverless, etc.)
- Data flow and component relationships

#### Agent 3: Installation & Setup
- Package manager (npm, bun, cargo, go, pip, composer)
- Is it distributed via Homebrew? Check for Formula/Cask
- Is there a curl install script?
- Docker support?
- Prerequisites and system requirements
- Environment variables needed

#### Agent 4: Features & Usage
- Core features and capabilities
- CLI commands and flags (if applicable)
- API endpoints (if applicable)
- Screenshots or demos (check for images in README/, docs/, or screenshots/)
- Example usage patterns

#### Agent 5: Development Workflow
- Build commands (Makefile targets, npm scripts, cargo commands)
- Test framework and commands
- Linting and formatting tools
- CI/CD setup
- How to run locally

#### Agent 6: Project Type Detection
Determine if this project matches one of these patterns:
- **CLI Tool with AI Agent Skills**: Has SKILL.md, install-skill.sh, "AI agent" mentions
- **macOS Menu Bar App**: Swift, .xcodeproj, menu bar references
- **Web App**: React, Cloudflare Workers, Vite, frontend frameworks
- **Sandboxed Runner**: Network filtering, sandbox, security features
- **Secret Santa Project**: Allocation, draws, participants
- **Other**: General project

### Phase 2: Analyze & Determine Structure

Based on exploration, select the appropriate README structure:

#### For CLI Tools (especially AI Agent Skills):
1. Heading image
2. Tagline: "[Service] from your terminal. Pipe it, script it, automate it."
3. Blockquote about AI agents if applicable
4. Features (4 bullets)
5. Installation (Quick Install → Homebrew → From Source)
6. Quick Start (5 steps)
7. Command Reference with tables
8. Composability (jq examples)
9. Configuration (storage, env vars)
10. AI Agent Integration (if applicable)
11. Development (make targets)
12. Background (if exploring new paradigms)
13. License + Credits

#### For macOS Apps:
1. Heading image
2. One-line tagline
3. Features (bold names + descriptions)
4. Screenshots (multiple sub-sections)
5. Installation (Homebrew → Manual Download)
6. Usage with "First Launch" workflow
7. Requirements (macOS version)
8. Building from Source
9. Disclaimer/Privacy (if accessing third-party services)
10. License

#### For Web Apps:
1. Title + tagline
2. Features
3. Tech Stack (single line: React 19, TypeScript, Tailwind CSS v4, etc.)
4. Getting Started (Prerequisites + commands)
5. Configuration
6. Deployment
7. Project Structure (directory tree)
8. License

#### For General Projects:
1. Title + tagline
2. Features
3. Tech Stack (if multi-tech)
4. Installation
5. Quick Start / Usage
6. Architecture (if complex)
7. Development
8. Project Structure (if large)
9. License

### Phase 3: Write README.md

Create `README.md` in project root following the selected structure.

## Style Rules

**ALWAYS:**
- Use **bold feature names** in bullet lists: `- **Feature** - Description`
- Use tables for structured data (commands, flags, options, platforms)
- Use ASCII diagrams for architecture:
  ```
  Source → Component → Component → Result
  ```
- Put Homebrew installation first when available, labeled "(Recommended)"
- Include `make help` and standard make targets (build, test, lint, fmt, can-release)
- Use code blocks with language hints (bash, typescript, rust, etc.)
- Keep taglines punchy (1-2 sentences max)
- End with MIT License (link to LICENSE file)
- Credit underlying libraries at the bottom

**FOR CLI TOOLS:**
- Command Reference as tables with Flag | Short | Description columns
- Include Composability section with jq piping examples
- Environment Variables as tables
- Storage location documentation

**FOR macOS APPS:**
- Screenshots in `<p align="center">` with specified widths
- Requirements section with macOS version
- Disclaimer section if accessing third-party APIs

**FOR RELATED PROJECTS:**
- Include "Other Years" or "Related Projects" section with cross-references
- Use ⭐ to mark current project in lists

**NEVER:**
- Use emojis (except in playful projects like Secret Santa)
- Use marketing fluff or superlatives
- Invent features or commands that don't exist
- Include placeholder text like `<your-thing-here>`
- Add sections that don't apply to this project type
- Over-explain obvious things

## Example Sections

### Features (CLI Tool)
```markdown
## Features

- All your [Service] data — activities, stats, sleep, heart rate, stress
- Script and automate — composable with jq, pipes, xargs, and standard Unix tools
- [AI agent ready](#ai-agent-integration) — install the skill for Claude, Cursor, and other assistants
- Flexible output — JSON for scripts, CSV for spreadsheets, tables for humans
```

### Features (macOS App)
```markdown
## Features

- **Real-time monitoring** - Track usage at a glance in your menu bar
- **Smart notifications** - Configurable alerts at warning and critical thresholds
- **Auto-refresh** - Automatic updates every 1, 5, or 10 minutes
```

### Installation
```markdown
## Installation

### Homebrew (Recommended)

\`\`\`bash
brew install eddmann/tap/project-name
\`\`\`

### Quick Install

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/eddmann/project/main/install.sh | sh
\`\`\`

### From Source

\`\`\`bash
git clone https://github.com/eddmann/project
cd project
make build
\`\`\`
```

### Command Reference
```markdown
## Command Reference

### Global Options

| Flag | Short | Description |
|------|-------|-------------|
| `--format` | `-f` | Output format: json, csv, human |
| `--verbose` | `-v` | Verbose output |
| `--version` | `-V` | Show version |
```

### Development
```markdown
## Development

\`\`\`bash
git clone https://github.com/eddmann/project
cd project
make install    # Install dependencies
make test       # Run tests
make build      # Build
\`\`\`
```

### Tech Stack (Web App - single line)
```markdown
## Tech Stack

React 19, TypeScript, Tailwind CSS v4, React Router 7, Cloudflare Workers, D1 (SQLite), Vite, Bun
```

## Critical Rules

- **DO NOT skip exploration** - use Explore agents first
- **DO NOT invent features** - only document what actually exists
- **DO NOT write until Phase 3** - gather all information first
- **DO verify commands work** - check Makefile targets, package.json scripts
- **DO match the project type** to the appropriate template
- **DO use exact section headers** from the selected structure
- **DO keep it concise** - every word must add value
