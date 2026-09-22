---
name: db
description: "Use when inspecting schemas, querying data or making authorized database changes."
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/db *)
---

# Database Access

Use the bundled `scripts/db` CLI for PostgreSQL, MySQL/MariaDB and SQLite. Set `DB_CLI` to its
absolute path, resolved relative to this skill's directory, so commands work from any checkout.
The helper requires `uv`; it declares its own Python dependencies.

Resolve the intended connection alias and environment from the request. Every command requires
`--alias <name>` before the subcommand. Connections are user-managed; read
[connection setup](references/connections.md) when an alias is missing or connection details
need clarification. Do not print credentials or raw connection configuration.

## Inspect And Query

Inspect unfamiliar tables before querying them. Use `db_type` from the JSON response to choose
SQL syntax; `--schema` is PostgreSQL-only, defaulting to `public`.

```bash
"$DB_CLI" --alias <alias> ping
"$DB_CLI" --alias <alias> databases
"$DB_CLI" --alias <alias> schemas
"$DB_CLI" --alias <alias> tables --views
"$DB_CLI" --alias <alias> describe <table>
"$DB_CLI" --alias <alias> schema --table <table>
"$DB_CLI" --alias <alias> query 'SELECT id, name FROM users WHERE id = ?' --params '[42]'
```

Bind data values using `?` placeholders and `--params`; do not interpolate them into SQL.
Identifiers cannot be bound this way: resolve them from the schema and quote for the backend.
Statements without supplied data values need no parameters.

Keep reads narrow. `query` returns at most 500 rows by default and reports `truncated` when
more exist. `--limit` controls returned rows, not database execution cost; add appropriate SQL
filters and limits. Use `--limit 0` only for a known-small result or an explicitly requested export.
The helper does not enforce read-only SQL: use genuinely read-only statements for inspection,
including any functions they call.

## Write And Verify

1. Establish the intended change and inspect the affected records. Before DELETE, DROP,
   TRUNCATE or UPDATE without WHERE, show the concrete SQL and ensure that operation is
   authorized. Honor authorization already given for the same scope.
2. Execute the smallest intended change with bound values:

   ```bash
   "$DB_CLI" --alias <alias> exec 'UPDATE users SET name = ? WHERE id = ?' --params '["Alex", 42]'
   ```

3. Inspect `rows_affected` when returned and re-query the relevant records to verify the final
   state. Unexpected row counts or an ambiguous failure require inspection before retrying.

`exec` commits on success and attempts rollback on error. Do not assume every statement or
backend operation is reversible. Both `query` and `exec` accept `-` to read SQL from stdin;
`exec` supports simple multi-statement input without parameters, but its splitter is not a full
SQL parser. Use the project's migration tooling for complex scripts. `RETURNING` works only
where supported by the backend.

Output is JSON; errors use stderr and a nonzero exit status. Report the selected alias,
relevant results, verified changes and any uncertainty without exposing unnecessary data.
