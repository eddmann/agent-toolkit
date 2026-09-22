# Running Scripts

Use `uv run script.py [args]` for project scripts. Use `uv run --no-project script.py` for
independent work that should not load the surrounding project. For one-off dependencies,
use `--with`, for example `uv run --no-project --with httpx tool.py`.

## Reusable Standalone Scripts

Initialize a script with `uv init --script tool.py`. Declare its actual Python requirements
and dependencies using inline metadata:

```python
# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx"]
# ///
```

The Python version above is an example, not a universal minimum. Scripts with inline metadata
use their own dependency environment. Add dependencies with `uv add --script tool.py httpx`.

For reproducible resolution, run `uv lock --script tool.py` and retain the resulting
`tool.py.lock` alongside the script. Avoid unrelated upgrades to an existing lockfile.
Use an alternative index only when required by the project; keep credentials out of scripts.

## Executable Scripts

For a script without a `.py` suffix, use the script shebang and inline metadata:

```python
#!/usr/bin/env -S uv run --script
# /// script
# dependencies = []
# ///

print("Hello")
```

Make it executable with `chmod +x tool`, then run `./tool`.

See the [uv script guide](https://docs.astral.sh/uv/guides/scripts/) for version-specific options.
