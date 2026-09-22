# Python Packaging

Keep an existing package's build backend unless changing it is part of the request. `uv build`
can invoke the configured backend; adopting uv for commands does not require adopting `uv_build`.

## New Packages

Use `uv init --lib package-name` for a new library, then inspect the generated `pyproject.toml`
and layout. Select a different backend through the installed version's `--build-backend` option
when needed; check `uv init --help` for supported values.

- `uv_build` suits pure Python packages with a conventional layout.
- Native extensions need a backend that supports their toolchain, such as maturin for Rust or
  scikit-build-core for C/C++.
- Keep the generated compatible backend requirement, including its upper bound where appropriate,
  rather than copying an old version pin. Respect the package's supported Python versions.

## Layout And Contents

For `uv_build`, the default layout is `src/<package_name>/__init__.py`. Custom layouts use
`tool.uv.build-backend.module-name` and `module-root`; these settings do not apply to other backends.
Read the selected backend's documentation when changing namespaces or including package data.
Keep runtime assets in the distribution and exclude unintended local files.

Build with `uv build` and inspect the resulting wheel and source distribution when packaging
changes. Verify imports and required assets from an installed wheel in an isolated environment;
a source-checkout import alone does not establish that the package contains everything needed.
Building does not publish the package.

Sources: [build backends](https://docs.astral.sh/uv/concepts/build-backend/) and
[creating projects](https://docs.astral.sh/uv/concepts/projects/init/).
