---
name: generate-landing-page
description: "Generate a landing page for the current project"
argument-hint: [design direction]
---

# Generate Landing Page

Generate a landing page for this project.

## Design Direction

$ARGUMENTS

## Instructions

**IMPORTANT:** Use the `/frontend-design` skill to generate the actual landing page HTML. This skill produces distinctive, production-grade frontend interfaces with high design quality that avoids generic AI aesthetics.

### Phase 1: Project Discovery

Explore the codebase to determine:

1. **Project identity** - Read README.md, package.json, Cargo.toml, or similar to find:
   - Project name
   - Description/tagline
   - Author information
   - License

2. **Branding assets** - Search for existing logos/icons:
   - Check for `icon.png`, `logo.png`, `favicon.ico`
   - Look in common locations: `assets/`, `public/`, `src-tauri/icons/`, `static/`

3. **Installation method** - Determine how users install:
   - Homebrew formula?
   - npm/yarn package?
   - Direct download?
   - Check existing GitHub releases

4. **Repository info** - Extract from git remote:
   - GitHub URL
   - Releases URL
   - Issues URL

5. **Key features** - Identify 4-6 main features from README or docs

6. **Platforms** - Determine supported platforms from build configs

### Phase 2: Set Variables

Based on discovery, populate these variables:

```
PROJECT_NAME        - From package.json/Cargo.toml name or README title
TAGLINE             - First line of README description or package description
DESCRIPTION         - 150-160 char summary for SEO
KEYWORDS            - Relevant keywords from project context
AUTHOR              - From package.json author, Cargo.toml, or git config
AUTHOR_URL          - Author's website if found
CANONICAL_URL       - https://{author}.github.io/{repo}/ or custom domain
GITHUB_URL          - From git remote origin
GITHUB_RELEASES_URL - {GITHUB_URL}/releases/latest
DOCS_URL            - From README links or infer
PLATFORMS           - From build targets/CI matrix
HEX_COLOR           - Extract from existing theme or choose based on branding
FONT_FAMILY         - Choose appropriate Google Font
FONT_NAME           - CSS font-family name
INSTALL_COMMAND     - Primary installation command
```

### Phase 3: Generate Files

Create the following structure:

```
site/
├── index.html
└── logo.png (copy from discovered location)

.github/workflows/
└── deploy-pages.yml (if not exists)
```

#### index.html Requirements

**Head section must include:**
- All meta tags (charset, viewport, SEO, theme-color)
- Canonical URL
- Favicon links
- Open Graph tags (og:title, og:description, og:image, og:url, og:type, og:site_name)
- Twitter Card tags (twitter:card, twitter:title, twitter:description, twitter:image)
- JSON-LD structured data (SoftwareApplication schema)
- Google Fonts (preconnect + stylesheet)
- Tailwind CSS via CDN with custom config
- Inline `<style>` for custom CSS

**Required CSS must include:**
```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }
}
```

**Body content:** Design based on the design direction provided. Include sections appropriate for the project (hero, features, installation, etc.)

#### deploy-pages.yml

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
    paths: ['site/**']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v6

      - name: Inject version from latest release
        id: version
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          VERSION=$(gh release view --json tagName --jq '.tagName' 2>/dev/null | sed 's/^v//' || echo "")
          [ -n "$VERSION" ] && sed -i 's/"softwareVersion": "[^"]*"/"softwareVersion": "'"$VERSION"'"/' site/index.html

      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: './site'
      - uses: actions/deploy-pages@v4
```

### Phase 4: Summary

After generating, report:
- All discovered/chosen variable values
- Files created
- Any assumptions made
- Next steps (e.g., "push to main to deploy", "add preview.png for social sharing")
