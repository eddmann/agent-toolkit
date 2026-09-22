# Release Readiness Checks

## Dependencies And Licensing

Inspect manifests and lockfiles. Use the ecosystem's available vulnerability tooling for the
resolved versions, recording the command, advisory source and scan date. Do not run automatic
fixes or dependency upgrades. Corroborate material findings with current authoritative advisories
and assess how the dependency is used; scanner severity alone does not prove exploitability.

Identify the actual project license and third-party notices, including bundled code/assets.
Flag concrete distribution restrictions or unresolved licensing questions. Do not assume MIT,
choose a license for the user, or treat a license family as automatically incompatible. Public
visibility and permission to reuse code are separate decisions.

## Code And Configuration

Trace relevant entrypoints and trust boundaries for concrete release risks: injection,
unsafe file/URL handling, missing authorization and insecure deployment defaults. Prioritize
reachable behavior and explain the trigger and impact; this is not an unrelated architecture
rewrite or a guarantee of a comprehensive security assessment.

Check CI permissions, secret handling, installation/build scripts and deployment configuration.
Look for credentials copied into images/artifacts, private dependencies required by public
setup and commands that act on live environments. Separate demonstrated defects from optional
hardening. Intentional vendoring, shared editor settings and generated distributions may be valid.

## Documentation And Verification

Check that the README describes actual capabilities, prerequisites, configuration and working
installation/usage paths. Verify referenced files, commands and publicly offered artifacts.
Recommend contribution/security guidance when relevant to the intended audience; AGENTS.md,
CLAUDE.md, badges and a prescribed set of community files are not universal release requirements.

Inspect setup commands before running them. Use an isolated temporary checkout/environment
for build and test verification when necessary, preserving the reviewed revision and user's work.
Do not run destructive setup, production migrations, deployments or outbound messages merely
to prove readiness. Keep original lockfiles and report missing services or credentials.

Run repository-required checks and the relevant build/setup path where practical. Record which
checks ran against which revision, their result and gaps. A passing test suite does not prove
that installation works, and a dependency/setup failure does not automatically establish a code
regression. Reuse valid evidence instead of repeating successful checks without a reason.
