# Coding Guidelines

Repository-specific requirements take precedence over these general preferences. Ground
findings in code evidence and concrete costs; do not turn style preferences into blockers.

## Correctness And Simplicity

Find the simplest sufficient implementation: no gold plating, over-architecting,
over-engineering or over-testing. Prefer fewer concepts, branches and responsibilities to
fewer lines. A clear existing solution may need no changes.

Establish intended behavior and trace relevant callers, state transitions and failure paths.
Preserve public contracts, authorization, isolation, observability and operational requirements.
Flag speculative features, duplicate state and unnecessary indirection when their cost is clear.
Keep changes within the requested scope.

## Readability And Design

Code should be descriptive, predictable and boring. Names should communicate behavior; make
side effects explicit and contained. Prefer clear data transformations and avoid surprising
mutation of caller-owned data.

Keep responsibilities cohesive and dependencies clear. Reuse established patterns and keep
abstractions that protect a real boundary or clarify behavior. Introduce interfaces, factories
or layers when they serve a present need. Avoid arbitrary size limits and speculative reuse.

## Testing Philosophy

Tests are living documentation of intended behavior. Follow the classical (Detroit/Chicago)
school: a unit is a unit of behavior, which may involve several real objects working together.
Exercise public entrypoints and assert outcomes observable by users, callers or operators.
Behavior-preserving refactors should not require rewriting assertions about private internals.

Use doubles only at external boundaries, such as APIs, storage, clocks and network calls;
keep internal collaborators real. Prefer stubs and fakes. Verify boundary interactions when
the interaction is the observable contract. Use real infrastructure when its behavior matters,
including queries, constraints and transactions; a fake cannot establish those guarantees.
Do not add abstractions solely to satisfy a mocking pattern.

Organize and name tests around behavior. Keep arrange, act and assert clear, with multiple
assertions when they describe one coherent outcome. Prefer readable, self-contained tests over
DRY helpers; use factories or builders when they make relevant setup clearer. Isolate test
state and use controlled clocks or bounded synchronization instead of arbitrary sleeps.

Use feature/integration tests as the workhorse where practical, focused unit tests for logic,
and end-to-end tests for critical journeys. Choose coverage for confidence in important behavior,
not a percentage or prescribed pyramid. Preserve distinct regression, authorization, failure
and integration cases. Remove redundant or implementation-coupled tests only after checking
what observable coverage remains; do not add tests that merely restate the implementation.

## Error Handling

Validate untrusted inputs at boundaries and follow established error conventions. Handle
expected failures where recovery is possible; surface unexpected failures with useful context.
Do not silently swallow errors or expose sensitive data. Keep validation and recovery logic
where it can act meaningfully, avoiding redundant checks without a distinct purpose.
