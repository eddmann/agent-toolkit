# Connection Setup

Connections live in `~/.config/agent-db/connections.json`, or in
`$DB_CONFIG_DIR/connections.json` when overridden. The user manages this file; do not create
or edit it. If an alias is missing, ask the user to add it without pasting credentials into chat.

Each connection is a URL string or an object containing `url` and `ssh`:

```json
{
  "connections": {
    "local": "sqlite:////absolute/path/data.db",
    "staging": "$STAGING_DATABASE_URL",
    "remote": {
      "url": "$REMOTE_DATABASE_URL",
      "ssh": {"host": "server.example.com", "user": "deploy", "port": 22}
    }
  }
}
```

Supported URL schemes include `postgres`/`postgresql`, `mysql`/`mariadb` and `sqlite`.
The helper expands `$VAR` and `${VAR}` in connection URLs at connect time. Ensure the required
environment variables are present without printing their values.

For this helper, an absolute SQLite path needs four slashes after `sqlite:` because it strips
`sqlite:///`. A plain absolute filesystem path also works. Relative paths resolve from the
process's working directory; verify the intended file exists when inspecting an existing DB.

SSH settings require `host`; optional fields are `user`, `port` (default 22) and `key`
(private-key path). Without `key`, the tunnel uses the SSH agent/default keys. The URL host
and port identify the database reachable from the SSH server.

`DB_CONNECT_TIMEOUT` defaults to 10 seconds and `DB_STATEMENT_TIMEOUT` to 30 seconds.
Timeout enforcement varies by backend; SQLite uses the latter as its lock-wait timeout,
not a query execution deadline.
