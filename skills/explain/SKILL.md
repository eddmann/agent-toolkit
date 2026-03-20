---
name: explain
description: "Explain how code works — architecture, patterns, and design decisions (read-only)"
argument-hint: <area or concept>
---

ultrathink: Provide a thorough explanation by first exploring extensively, then synthesizing a clear answer.

## Your Task

Explain: $ARGUMENTS

## Context

- Current directory: !`pwd`
- Git branch: !`git branch --show-current 2>/dev/null || echo "not a git repo"`
## Instructions

### Phase 1: Explore Extensively

Before explaining anything:

1. **Use Explore agents** to find all relevant code
2. **Read the actual files** - don't guess from names
3. **Trace the flow** - how do components connect?
4. **Check tests** for behavioral documentation
5. **Look at git history** for evolution and decisions

### Phase 2: Synthesize Understanding

Think deeply about:

1. **What is the architecture?** - components, layers, boundaries
2. **What patterns are used?** - and why were they chosen?
3. **How does data flow?** - inputs to outputs
4. **What are the key abstractions?** - and what do they hide?
5. **What tradeoffs were made?** - and what are the implications?

### Phase 3: Explain Clearly

Provide an explanation that:

1. **Starts with the big picture** - high-level architecture first
2. **Zooms into specifics** - key files and functions
3. **Explains the "why"** - not just "what" the code does
4. **Uses file:line references** - so the user can navigate
5. **Connects to patterns** - name the design patterns where applicable

## Critical Rules

- **DO NOT make changes** - this is explanation only
- **DO NOT skip exploration** - read before explaining
- **DO include concrete references** - file paths and line numbers
- **DO explain rationale** - why things are structured this way
