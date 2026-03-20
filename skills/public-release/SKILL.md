---
name: public-release
description: "Comprehensive pre-release audit for making a GitHub repository public"
argument-hint: [specific concerns]
---

ultrathink: Perform an exhaustive pre-release security and quality audit of this repository before making it public on GitHub. This is a critical review that protects the developer's reputation and prevents security incidents.

## Additional Context

$ARGUMENTS

## Project Context

- Current directory: !`pwd`
- Git branch: !`git branch --show-current 2>/dev/null || echo "not a git repo"`
- Git remote: !`git remote get-url origin 2>/dev/null || echo "no remote"`
- Repository size: !`git rev-list --count HEAD 2>/dev/null || echo "unknown"` commits
- Top-level files: !`ls -la 2>/dev/null | head -30`
- Package manager: !`[[ -f package.json ]] && echo "npm/node" || ([[ -f Cargo.toml ]] && echo "cargo/rust" || ([[ -f go.mod ]] && echo "go" || ([[ -f pyproject.toml || -f requirements.txt ]] && echo "python" || echo "unknown")))`

## Instructions

You MUST follow ALL phases completely. This audit protects the developer's professional reputation and prevents security incidents. Do not rush.

***

## Phase 1: Multi-Agent Deep Exploration

Launch **10 Explore agents** in parallel to gather comprehensive information:

***

### Agent 1: Security Scan - Secrets & Credentials

Search EXHAUSTIVELY for:

**API Keys & Tokens:**
- Generic patterns: `sk-`, `pk_`, `api_key`, `apikey`, `secret`, `token`, `password`, `credential`, `auth`
- AWS: `AKIA`, `aws_access_key`, `aws_secret`, `AWS_ACCESS_KEY_ID`
- GCP: `AIza`, service account JSON files
- Azure: `AccountKey=`, connection strings
- Stripe: `sk_live_`, `pk_live_`, `rk_live_`
- GitHub: `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`
- Slack: `xoxb-`, `xoxp-`, `xoxa-`, `xoxr-`
- OpenAI: `sk-`, API key patterns
- Anthropic: `sk-ant-`
- Twilio: `SK`, `AC` prefixes with account SIDs
- SendGrid: `SG.`
- Mailchimp: API key patterns
- Datadog: `DD_API_KEY`

**Private Keys & Certificates:**
- RSA/SSH/PGP: `-----BEGIN` patterns
- `.pem`, `.key`, `.p12`, `.pfx` files
- SSH keys: `id_rsa`, `id_ed25519`, `id_ecdsa`

**Connection Strings:**
- Database: `mongodb://`, `postgres://`, `mysql://`, `redis://`, `amqp://`
- With embedded credentials in URLs

**Other Secrets:**
- JWT tokens: `eyJ` patterns (especially in code, not legitimate auth flows)
- OAuth client secrets
- Webhook URLs with embedded tokens
- `.env` files that shouldn't be committed
- `.npmrc`, `.pypirc` with auth tokens
- `config.json`, `settings.json` with credentials

***

### Agent 2: Git History Audit

Search the ENTIRE git history for:

**Secrets in History:**
```bash
git log -p -S "password" --all
git log -p -S "api_key" --all
git log -p -S "secret" --all
git log -p -S "token" --all
git log -p -S "AKIA" --all
git log -p -S "sk-" --all
```

**Sensitive Files Ever Committed:**
```bash
git log --all --full-history -- "*.env"
git log --all --full-history -- "*credentials*"
git log --all --full-history -- "*secret*"
git log --all --full-history -- "*.pem"
git log --all --full-history -- "*.key"
```

**Large Files in History:**
```bash
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | sort -k3 -n -r | head -20
```

**Author Information:**
- Check `git log --format='%an <%ae>'` for private email exposure
- Look for commits with personal vs work email inconsistency

**Commit Messages:**
- Embarrassing or unprofessional messages
- Messages containing sensitive info (ticket numbers with internal URLs, etc.)
- Profanity or inappropriate content

**Problematic History:**
- Force-pushed commits that might have hidden issues
- Merge commits from private/internal branches

***

### Agent 3: PII & Privacy Scan

Search for Personal Identifiable Information:

**Direct PII:**
- Email addresses (especially personal @gmail, @hotmail, etc.)
- Phone numbers (various formats)
- Physical addresses
- Social Security Numbers, National ID numbers
- Credit card numbers (even test ones that look real)
- Names in comments, test data, or fixtures

**Indirect PII:**
- IP addresses (especially internal/private ranges: 10.x, 192.168.x, 172.16-31.x)
- MAC addresses
- User IDs, account numbers
- Device identifiers
- GPS coordinates

**Data Files:**
- Database dumps or fixtures with real user data
- Log files with user information
- CSV/JSON exports with PII
- Test data that uses real information
- Screenshots containing user data

***

### Agent 4: Code Quality & Senior-Level Review

Evaluate code for professional standards:

**Security Vulnerabilities:**
- XSS (Cross-Site Scripting)
- SQL Injection
- Command Injection
- Path Traversal
- SSRF (Server-Side Request Forgery)
- Insecure deserialization
- Hardcoded credentials (even "temporary" ones)

**Code Smells:**
- Error handling: Are errors swallowed silently?
- Obvious bugs or race conditions
- Dead code or commented-out code blocks
- Excessive complexity
- Copy-pasted code blocks
- Magic numbers without constants

**Debug Code Left In:**
- `console.log`, `print()`, `fmt.Println` debug statements
- `debugger` statements
- Commented-out debug code
- Test code in production files

**Unprofessional Patterns:**
- TODO/FIXME/HACK/XXX comments with sensitive info or complaints
- Hardcoded `localhost`, `127.0.0.1`, dev URLs
- Sleep/delay hacks
- Swallowed exceptions
- `any` types everywhere (TypeScript)

**Architecture:**
- Is the code organization logical?
- Are there clear separation of concerns?
- Would a senior engineer be impressed or concerned?

***

### Agent 5: Documentation Audit

Check project documentation:

**Required Files:**
- `README.md` - exists, professional, accurate, has badges/screenshots if appropriate
- `LICENSE` - CRITICAL: required for open source, correct license type
- `AGENTS.md` - for AI coding assistants
- `CLAUDE.md` - should be symlink to AGENTS.md

**Recommended Files:**
- `CONTRIBUTING.md` - contribution guidelines
- `CODE_OF_CONDUCT.md` - community standards
- `SECURITY.md` - security policy and vulnerability reporting
- `CHANGELOG.md` - version history

**Documentation Quality:**
- No internal URLs, company wikis, or private references
- No employee names or internal team references
- No outdated information that exposes old infrastructure
- Setup instructions actually work
- No placeholder text or TODOs

**GitHub-Specific Files:**
- `.github/ISSUE_TEMPLATE/` - appropriate for public use
- `.github/PULL_REQUEST_TEMPLATE.md` - no internal references
- `.github/CODEOWNERS` - no internal usernames/teams
- `.github/FUNDING.yml` - if sponsorship desired
- `.github/dependabot.yml` - security updates configured

***

### Agent 6: Configuration & Build Files

Review all config files:

**Git Configuration:**
- `.gitignore` is comprehensive - check for missing:
  - `.env*` (except `.env.example`)
  - IDE folders (`.idea/`, `.vscode/`, `*.swp`)
  - OS files (`.DS_Store`, `Thumbs.db`)
  - Build outputs (`dist/`, `build/`, `node_modules/`, `__pycache__/`)
  - Coverage reports
  - Log files
- `.gitattributes` for line endings, LFS

**Environment Files:**
- `.env.example` exists WITHOUT real values
- No `.env`, `.env.local`, `.env.production` committed
- Environment variable names don't reveal internal systems

**Package Manager Configs:**
- `package.json`: Check `author`, `repository`, `bugs`, `homepage` fields
- No private registry URLs (`registry.npmjs.org` is fine, `npm.internal.company.com` is not)
- `.npmrc`, `.yarnrc`, `.pnpmrc` - no auth tokens
- `pyproject.toml`, `setup.py` - no internal references
- `Cargo.toml` - no private registries

**CI/CD Configs:**
- `.github/workflows/*.yml` - no hardcoded secrets (should use `${{ secrets.X }}`)
- `.gitlab-ci.yml`, `.circleci/config.yml`, etc.
- No internal CI server references
- No hardcoded deployment targets

**Docker & Containers:**
- `Dockerfile` - no secrets in ENV or COPY
- `docker-compose.yml` - no real passwords (use env vars)
- No internal registry references

**Infrastructure as Code:**
- Terraform: No hardcoded credentials, no state files committed
- CloudFormation: No embedded secrets
- Kubernetes manifests: No secrets in plain text

***

### Agent 7: Dependency & License Audit

Check dependencies for security and legal issues:

**Security Vulnerabilities:**
Run appropriate audit command:
- Node.js: `npm audit` or `yarn audit` or `pnpm audit`
- Python: `pip-audit` or `safety check`
- Rust: `cargo audit`
- Go: `govulncheck`
- Ruby: `bundle audit`

**License Compatibility:**
- Check that all dependency licenses are compatible with your chosen LICENSE
- Watch for: GPL (viral), AGPL (very viral), SSPL, Commons Clause
- Ensure you can legally open-source with your dependency mix
- Check for "license unknown" dependencies

**Dependency Concerns:**
- Deprecated packages
- Unmaintained packages (no updates in 2+ years)
- Packages with known issues
- Internal/private packages that shouldn't be referenced

***

### Agent 8: File Hygiene & Artifacts

Check for files that shouldn't be committed:

**OS & Editor Artifacts:**
- `.DS_Store` (macOS)
- `Thumbs.db`, `desktop.ini` (Windows)
- `*.swp`, `*.swo`, `*~` (Vim)
- `.idea/`, `*.iml` (JetBrains)
- `.vscode/` (VS Code - unless intentionally shared)
- `*.sublime-*` (Sublime Text)

**Build Artifacts:**
- `node_modules/`
- `dist/`, `build/`, `out/`
- `__pycache__/`, `*.pyc`, `*.pyo`
- `target/` (Rust/Java)
- `vendor/` (Go, unless intentional)
- `*.class`, `*.jar` (Java)
- Coverage reports with local paths

**Temporary & Backup Files:**
- `*.bak`, `*.backup`, `*.old`
- `*.tmp`, `*.temp`
- `*.log` files
- `*.orig` (merge artifacts)

**Large Files:**
- Files > 10MB that should be in Git LFS or excluded
- Accidentally committed datasets, databases, binaries
- Media files that should be hosted elsewhere
- Check: `find . -size +10M -type f`

**Compiled/Binary Files:**
- Executable binaries
- `.exe`, `.dll`, `.so`, `.dylib`
- Compiled assets that should be built, not committed

***

### Agent 9: Hardcoded Paths & Internal References

Search for environment-specific or internal references:

**Absolute Paths:**
- `/Users/` (macOS home directories)
- `/home/` (Linux home directories)
- `C:\Users\` (Windows)
- Any path containing usernames

**Internal Infrastructure:**
- Internal hostnames (`*.internal`, `*.local`, `*.corp`)
- Private IP ranges in configs
- Internal DNS names
- VPN endpoints
- Internal load balancer URLs

**Internal Tools & Services:**
- Slack webhook URLs
- Internal Jira/Linear/Asana URLs
- Company wiki/Confluence/Notion links
- Internal monitoring (Datadog, Grafana dashboards)
- Internal artifact repositories

**Development Environment:**
- Hardcoded `localhost` in production configs
- Dev database URLs
- Staging environment references
- Internal API endpoints

***

### Agent 10: Media Files & Metadata

Check images, documents, and binary files:

**Image Metadata (EXIF):**
If images exist, check for:
- GPS coordinates (location exposure)
- Camera/device information
- Timestamps
- Author information
- Software used
- Thumbnails with sensitive content

Use: `exiftool -r -ext jpg -ext png -ext jpeg .` if available

**Document Metadata:**
- PDF author, creator, timestamps
- Office documents (docx, xlsx) with author info
- Comments or tracked changes in documents

**Screenshots:**
- Browser tabs showing internal URLs
- Desktop showing file paths or usernames
- Notification contents
- Sensitive data visible

**Other Binary Files:**
- Database files (`.sqlite`, `.db`)
- Compiled binaries
- Archives (`.zip`, `.tar.gz`) - what's inside?

***

## Phase 2: Test Verification

Before public release, verify:

**Tests Pass:**
- Run the test suite: Are there failures?
- Broken tests reflect poorly on professionalism
- Tests that require internal resources will fail for external users

**Build Works:**
- Does the project build from a clean clone?
- Are all build dependencies documented?
- Does `npm install && npm build` (or equivalent) work?

**Setup Instructions:**
- Can someone follow the README and get running?
- Are there undocumented prerequisites?

***

## Phase 3: Detailed Analysis

After exploration, analyze findings by severity:

1. **CRITICAL BLOCKERS** - Secrets, security issues - MUST fix
2. **HIGH PRIORITY** - PII, vulnerabilities, broken builds
3. **MEDIUM PRIORITY** - Quality issues, missing docs, professional concerns
4. **LOW PRIORITY** - Nice-to-haves, polish items

***

## Phase 4: Generate Comprehensive Report

Output a detailed report with these EXACT sections:

***

## 🚨 CRITICAL BLOCKERS

Issues that absolutely MUST be fixed before making this repository public:

| Issue | Location | Risk Level | Immediate Action |
|-------|----------|------------|------------------|
| ... | file:line or "git history" | Critical/High | ... |

***

## 🔐 SECURITY FINDINGS

### Secrets & Credentials Found
| Secret Type | Location | In Git History? | Action Required |
|-------------|----------|-----------------|-----------------|
| ... | ... | Yes/No | Rotate & remove |

### Code Vulnerabilities
| Vulnerability | Location | Severity | Fix |
|--------------|----------|----------|-----|
| ... | file:line | Critical/High/Medium | ... |

### Git History Concerns
- Secrets ever committed: [list]
- Problematic commits: [list with hashes]
- Author email exposure: [assessment]

***

## 👤 PII & PRIVACY

| PII Type | Location | Action |
|----------|----------|--------|
| ... | file:line | Remove/Anonymize |

***

## 📦 DEPENDENCY AUDIT

### Security Vulnerabilities
| Package | Severity | CVE | Fix |
|---------|----------|-----|-----|
| ... | Critical/High/Medium/Low | ... | Upgrade to X.X.X |

### License Concerns
| Package | License | Compatibility | Action |
|---------|---------|---------------|--------|
| ... | ... | ✅/⚠️/❌ | ... |

***

## 📊 CODE QUALITY

### Senior-Level Assessment
**Overall Grade: A/B/C/D/F**

[Assessment: Does this code reflect senior-level work? Would you be proud to show this in an interview?]

### Issues Found
| Category | Location | Issue | Suggestion |
|----------|----------|-------|------------|
| ... | file:line | ... | ... |

### Positive Observations
[What's done well - briefly]

***

## 🗂️ FILE HYGIENE

### Files to Remove/Gitignore
| File/Pattern | Issue | Action |
|--------------|-------|--------|
| ... | ... | Add to .gitignore / Delete |

### Large Files
| File | Size | Action |
|------|------|--------|
| ... | ... | Git LFS / Remove / Compress |

### Metadata Issues
| File | Metadata Found | Action |
|------|---------------|--------|
| ... | GPS coords, author info, etc. | Strip metadata |

***

## 🔗 INTERNAL REFERENCES

| Type | Location | Reference | Action |
|------|----------|-----------|--------|
| Hardcoded path | file:line | `/Users/edd/...` | Remove |
| Internal URL | file:line | `https://internal.company.com` | Remove |
| ... | ... | ... | ... |

***

## 📝 DOCUMENTATION STATUS

| Document | Status | Quality | Action Required |
|----------|--------|---------|-----------------|
| README.md | ✅/❌ | Good/Needs Work | ... |
| LICENSE | ✅/❌ | - | ... |
| AGENTS.md | ✅/❌ | - | Run /generate-agents-md |
| CLAUDE.md → AGENTS.md | ✅/❌ | - | Create symlink |
| CONTRIBUTING.md | ✅/❌/N/A | - | ... |
| SECURITY.md | ✅/❌ | - | ... |
| CHANGELOG.md | ✅/❌/N/A | - | ... |
| CODE_OF_CONDUCT.md | ✅/❌/N/A | - | ... |

### .gitignore Completeness
| Pattern | Present | Should Add |
|---------|---------|------------|
| `.env*` | ✅/❌ | ... |
| `.DS_Store` | ✅/❌ | ... |
| `node_modules/` | ✅/❌ | ... |
| IDE folders | ✅/❌ | ... |
| Build outputs | ✅/❌ | ... |

***

## 🧪 BUILD & TEST STATUS

| Check | Status | Notes |
|-------|--------|-------|
| Tests pass | ✅/❌/⚠️ | ... |
| Build succeeds | ✅/❌/⚠️ | ... |
| Dependencies install | ✅/❌/⚠️ | ... |
| README instructions work | ✅/❌/⚠️ | ... |

***

## 🔧 RECOMMENDED ACTIONS

### 🔴 Must Do Before Public Release
1. ...
2. ...

### 🟡 Should Do (Professional Quality)
1. ...
2. ...

### 🟢 Nice to Have
1. ...
2. ...

***

## 📋 PRE-RELEASE CHECKLIST

### Security
- [ ] All secrets removed from current code
- [ ] Git history cleaned if secrets were ever committed
- [ ] All exposed credentials rotated
- [ ] No API keys, tokens, or passwords in code
- [ ] No private keys or certificates committed

### Privacy
- [ ] PII removed or anonymized
- [ ] No personal email addresses in code
- [ ] Test data doesn't contain real user info
- [ ] Image metadata stripped (EXIF)

### Dependencies
- [ ] No critical security vulnerabilities
- [ ] All licenses compatible with project license
- [ ] No private/internal package references

### Documentation
- [ ] LICENSE file present and correct
- [ ] README.md professional and complete
- [ ] AGENTS.md created
- [ ] CLAUDE.md symlinked to AGENTS.md
- [ ] Setup instructions verified working

### Code Quality
- [ ] No debug code (console.log, etc.)
- [ ] No TODO/FIXME with sensitive info
- [ ] No hardcoded localhost/dev URLs
- [ ] Code reflects senior-level quality
- [ ] Tests pass

### File Hygiene
- [ ] .gitignore is comprehensive
- [ ] No .env files committed (only .env.example)
- [ ] No OS artifacts (.DS_Store, Thumbs.db)
- [ ] No IDE folders with personal settings
- [ ] No large files that should be in LFS
- [ ] No build artifacts committed

### Git History
- [ ] No secrets in commit history
- [ ] No embarrassing commit messages
- [ ] Author emails are appropriate for public
- [ ] No internal branch references

### References
- [ ] No hardcoded absolute paths
- [ ] No internal URLs or hostnames
- [ ] No company-specific references
- [ ] Package metadata is public-appropriate

***

## ⚠️ GIT HISTORY CLEANUP

If secrets were found in git history:

### Option 1: BFG Repo-Cleaner (Recommended)
```bash
# Install BFG
brew install bfg

# Remove specific files from history
bfg --delete-files "*.env" --no-blob-protection

# Remove specific strings
bfg --replace-text passwords.txt --no-blob-protection

# Clean up
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

### Option 2: git filter-repo
```bash
# Install
pip install git-filter-repo

# Remove file from history
git filter-repo --path .env --invert-paths

# Remove string pattern
git filter-repo --replace-text <(echo 'ACTUAL_SECRET==>REMOVED')
```

### After Cleanup
1. **ROTATE ALL EXPOSED CREDENTIALS IMMEDIATELY**
2. Force push to remote (coordinate with team)
3. All collaborators must re-clone (their copies have the secrets)
4. GitHub caches: Contact GitHub support to clear cached views

***

## Critical Rules

- **DO NOT make any changes** - this is audit only
- **BE EXHAUSTIVE** - missing a secret can cause real damage
- **CHECK GIT HISTORY** - current code isn't enough, secrets in history are just as dangerous
- **BE SPECIFIC** - include file:line for every finding
- **PRIORITIZE BY RISK** - critical blockers must be unmissable
- **THINK REPUTATION** - would this code impress a senior hiring manager?
- **VERIFY CLAIMS** - don't just check file existence, verify contents

***

## After This Audit

1. **Fix all critical blockers** - no exceptions
2. **Rotate any exposed credentials** - even if "probably not used"
3. Run `/generate-agents-md` if AGENTS.md is missing
4. Run `/generate-readme` if README needs improvement
5. **Re-run `/public-release`** to verify all fixes
6. Only then: Make repository public
