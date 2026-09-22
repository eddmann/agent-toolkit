---
name: query
description: "Use when answering a specific question about the codebase."
argument-hint: <question>
---

# Query

Answer the user's specific question from code evidence. Keep the task read-only.

1. Read repository instructions and locate the relevant implementation. Read surrounding code
   and tests; follow callers or dependencies when the answer spans multiple locations.
2. Verify the behavior needed to answer the question. Distinguish observed facts from inference;
   absence in one search is not proof that behavior does not exist. State unresolved uncertainty
   or missing evidence.
3. Lead with a direct answer and support it with relevant file/line references. Include only
   the context needed to understand the answer, then stop. Do not expand into an unrelated
   review or implementation plan.
