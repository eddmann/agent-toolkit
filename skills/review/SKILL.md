---
name: review
description: "Review code against coding guidelines and best practices"
argument-hint: <file, directory, or area>
config:
  GUIDELINES_DIR:
    description: "Path to the agent-guidelines directory"
    default: "/Users/edd/Projects/agent-guidelines"
---

ultrathink: Perform a thorough code review by first reading all relevant code and guidelines, then providing specific, actionable feedback.

## Your Task

Review: $ARGUMENTS

## Context

- Current directory: !`pwd`
- Git status: !`git status --short 2>/dev/null | head -20`

## Guidelines to Apply

Read and apply these standards from the guidelines directory (`$GUIDELINES_DIR`):
- `$GUIDELINES_DIR/foundation/code-philosophy.md`
- `$GUIDELINES_DIR/practices/clean-code-practices.md`
- `$GUIDELINES_DIR/practices/design-principles.md`
- `$GUIDELINES_DIR/practices/testing.md`
- `$GUIDELINES_DIR/practices/error-handling.md`

## Instructions

### Phase 1: Load Guidelines

First, read ALL the guideline files above. Understand:
- Code philosophy: predictable, boring, declarative, immutable
- Clean code: small functions, descriptive naming, early returns, no magic numbers
- Design: KISS, single responsibility, dependency injection, composition
- Testing: classical school, behavior-focused, AAA pattern, stubs over mocks
- Errors: fail fast, don't hide failures, validate at boundaries

### Phase 2: Read the Code

Thoroughly read the code to review:
1. **Read all relevant files** in the target area
2. **Understand the context** - what does this code do?
3. **Trace dependencies** - what does it interact with?
4. **Check tests** - are behaviors well-tested?

### Phase 3: Evaluate Against Guidelines

For each issue found:
1. **Identify the specific guideline** being violated
2. **Quote the relevant code** with file:line reference
3. **Explain why it matters** - what's the risk or cost?
4. **Suggest a fix** - be specific and actionable

### Phase 4: Provide Summary

Organize your review:
1. **Critical issues** - must fix, violates core principles
2. **Improvements** - should fix, better aligns with guidelines
3. **Nitpicks** - optional, minor style preferences
4. **Praise** - what's done well (briefly)

## Output Format

For each issue:
```
### [Critical/Improvement/Nitpick]: Brief title

**Location**: `path/to/file.swift:42`
**Guideline**: [Quote relevant guideline]
**Issue**: [What's wrong]
**Suggestion**: [How to fix]
```

## Critical Rules

- **DO NOT make changes** - this is review only
- **Cite specific guidelines** - not just "this is bad"
- **Be actionable** - every issue should have a clear fix
- **Include file:line** - make issues easy to find
