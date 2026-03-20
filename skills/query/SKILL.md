---
name: query
description: "Answer a specific question about the codebase (read-only)"
argument-hint: <question>
---

ultrathink: Answer this question by first exploring the codebase thoroughly, then providing a well-researched answer with specific references.

## Your Question

$ARGUMENTS

## Context

- Current directory: !`pwd`
- Git branch: !`git branch --show-current 2>/dev/null || echo "not a git repo"`

## Instructions

### Phase 1: Understand the Question

Before searching:
1. **Parse what's being asked** - what information is needed?
2. **Identify likely locations** - where might the answer be?
3. **Plan your search** - what patterns, files, or concepts to look for?

### Phase 2: Explore Thoroughly

Search the codebase comprehensively:
1. **Use Explore agents** for broad searches
2. **Read relevant files** - don't just grep, read context
3. **Trace connections** - follow the code paths
4. **Check multiple locations** - the answer might be spread across files
5. **Look at tests** - they often document behavior clearly

Spend time here. Read widely. Don't answer until you've explored thoroughly.

### Phase 3: Synthesize Answer

Provide a complete answer:
1. **Answer the question directly** - lead with the answer
2. **Provide evidence** - file:line references for claims
3. **Explain context** - why things work this way
4. **Note related info** - things the user might want to know

## Output Format

```
## Answer

[Direct answer to the question]

## Details

[Explanation with file:line references]

## Related

[Optional: related things worth knowing]
```

## Critical Rules

- **DO NOT make changes** - this is research only
- **DO NOT guess** - if unsure, say so and explain what you found
- **DO include references** - file paths and line numbers
- **DO explore thoroughly** - read before answering
