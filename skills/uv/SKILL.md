---
name: uv
description: "Use when running Python scripts, managing dependencies or configuring Python packaging."
user-invocable: false
---

# uv

Prefer `uv` for Python execution and dependencies. Read the project's Python requirements,
package configuration and repository instructions first. Preserve existing tooling, lockfiles
and build backends; ordinary Python work does not require a tooling migration.

```bash
uv run script.py                        # Run within the project environment
uv run --no-project --with httpx tool.py # Run an independent script with an ad-hoc dependency
uv add httpx                            # Add a dependency to a uv-managed project
uv init --script tool.py                 # Initialize a standalone script
```

For reusable standalone scripts, declare dependencies with inline script metadata instead of
modifying an unrelated project's dependencies. Match the required Python version to the code
and target environment. Read [scripts.md](scripts.md) for metadata, locking and executable scripts.

Read [build.md](build.md) when creating or changing a distributable package. Keep backend
selection specific to the package's needs. Check `uv --version` and command help when flags
or generated defaults matter; do not copy a fixed backend version from an old example.
