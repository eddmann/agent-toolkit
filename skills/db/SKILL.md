---
name: db
description: "Query and modify databases (PostgreSQL, MySQL/MariaDB, SQLite). Use when the user asks to inspect, query, or write to a database, or when you need to understand a database schema."
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/db *)
---

# Database Access

Single CLI for PostgreSQL, MySQL/MariaDB, and SQLite. All output is JSON. Use `${CLAUDE_SKILL_DIR}/scripts/db` for all commands.

## Connections

Ask the **user** to run `connect` (contains credentials — never run this yourself). First connection becomes the default. Alias is auto-derived from URL if `--alias` is omitted.

```bash
scripts/db connect postgres://user:pass@host:5432/mydb --alias prod
scripts/db connect /path/to/data.db
scripts/db list                    # saved connections
scripts/db use <alias>             # switch default
scripts/db drop-alias <alias>
scripts/db ping                    # test default connection
```

Any command that hits the database accepts `--alias <name>` to target a specific connection.

## Schema exploration

Always explore schema before writing queries against an unfamiliar database.

```bash
scripts/db databases                          # list databases on server
scripts/db schemas                            # list schemas in current database
scripts/db tables [--views] [--schema <name>] # list tables [and views]
scripts/db describe <table> [--schema <name>] # columns, FKs, indexes
scripts/db schema [--table <name>]            # full schema or single table
```

`--schema <name>` selects a non-public schema (postgres only, default: `public`).

## Queries

```bash
scripts/db query "SELECT * FROM users WHERE id = ?" --params '[42]'
scripts/db query "SELECT * FROM users"              # default limit: 500 rows
scripts/db query "SELECT * FROM users" --limit 0    # unlimited
cat query.sql | scripts/db query -                  # SQL from stdin
```

## Writes

```bash
scripts/db exec "INSERT INTO t (a, b) VALUES (?, ?)" --params '["x", 1]'
scripts/db exec "CREATE TABLE t (id SERIAL PRIMARY KEY, name TEXT)"
cat migration.sql | scripts/db exec -               # multi-statement (no --params)
```

`exec` auto-commits on success, rolls back on error. Returns `rows_affected` and supports `RETURNING`.

## Output format

JSON to stdout. Errors: `{"error": "..."}` to stderr with non-zero exit.

```jsonc
// query
{"db_type": "postgres", "rows": [{"id": 1, "name": "Alice"}], "truncated": true, "limit": 500}
// exec
{"ok": true, "db_type": "postgres", "rows_affected": 3, "statements": 1}
// schema commands return db_type + structured metadata (columns, foreign_keys, indexes)
```

## Parameterisation — MANDATORY

**Always use `--params` with `?` placeholders.** Never concatenate values into SQL.

```bash
# CORRECT
scripts/db query "SELECT * FROM users WHERE email = ?" --params '["a@b.com"]'
# WRONG — SQL injection risk
scripts/db query "SELECT * FROM users WHERE email = 'a@b.com'"
```

`?` is auto-converted to the backend's native format. Exception: DDL and queries with no user-supplied data don't need `--params`.

## Rules

1. **Parameterise all data values** — no exceptions for reads or writes
2. **Explore schema first** — run `schema` or `describe` before querying unfamiliar tables
3. **Prefer `query` over `exec`** — only use `exec` to modify data
4. **Confirm destructive operations** — show SQL and get user approval before DELETE, DROP, TRUNCATE, or UPDATE without WHERE
5. **Respect limits** — don't use `--limit 0` unless you know the result set is small

## Notes

- `$VAR` / `${VAR}` in URLs expand at connect time
- Timeouts: connect 10s (`DB_CONNECT_TIMEOUT`), statement 30s (`DB_STATEMENT_TIMEOUT`)
- `--schema` is postgres-only — errors on MySQL/SQLite
- Parse `db_type` from output to determine SQL dialect
