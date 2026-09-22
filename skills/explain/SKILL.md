---
name: explain
description: "Use when explaining how code works, including architecture, execution flow and design decisions."
argument-hint: <area or concept>
---

# Explain

Explain the requested code or concept at the user's level of detail. Keep the task read-only.

1. Read repository instructions, the relevant implementation and tests. Trace the connections
   needed to understand the behavior; consult documentation or history when the question depends
   on design rationale.
2. Start with the purpose and main components, then follow a concrete input through the code
   to its outcome. Explain responsibilities, state changes and important failure paths where
   they matter to the requested topic.
3. Support key points with file/line references. Distinguish documented decisions from inferred
   reasons, and state gaps rather than inventing an author's intent.
4. Use a small example or diagram when it makes the flow easier to understand. Explain relevant
   tradeoffs in plain language; name patterns only when the name helps.

Focus on how the existing code works. Do not turn the explanation into an unsolicited review
or redesign, and stop once the requested concept is clear.
