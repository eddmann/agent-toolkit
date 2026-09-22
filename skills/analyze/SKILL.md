---
name: analyze
description: "Use when investigating a complex code change or comparing implementation approaches."
argument-hint: <request or question>
---

# Analyze

Investigate the requested problem and recommend the simplest sufficient approach. Keep analysis
read-only unless implementation is requested; preserve the user's scope and existing work.

## Investigate

1. Establish the intended outcome, constraints and unresolved decisions from the request and
   repository instructions. Ask only when missing information materially changes the answer.
2. Read the relevant implementation, callers, dependencies and tests. Trace behavior far enough
   to understand the cause or proposed change; use history when it helps explain a decision.
3. Verify important assumptions with focused inspection or checks. Distinguish observed facts
   from inference and identify evidence gaps. Stop expanding the search when the recommendation
   is supported; do not use file counts or compulsory agent passes as a measure of thoroughness.

## Recommend

Compare alternatives only where they represent a meaningful choice. Assess correctness,
complexity, compatibility and relevant failure cases. Prefer existing patterns and targeted
changes; do not add abstractions or features for hypothetical future needs. Consider leaving
the code unchanged when the evidence does not justify a change.

Lead with the recommendation and explain why it fits the problem. Include relevant file/line
references, material tradeoffs, risks and unresolved questions. For a proposed implementation,
outline the affected areas and how to verify the resulting behavior. Scale detail to the task;
do not force a report template or an additional approval step.
