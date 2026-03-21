---
name: context7
description: "Retrieve up-to-date documentation for libraries and frameworks via the Context7 API. Use when looking up docs for any library, finding code examples, verifying API usage, or getting current info that may have changed since training."
argument-hint: <library> <topic>
user-invocable: true
config:
  CONTEXT7_API_KEY:
    description: "Optional API key for higher rate limits"
    default: ""
---

# Context7

Fetch current documentation for any library or framework via the Context7 API. Use this instead of relying on potentially outdated training data.

## Arguments

$ARGUMENTS

Parse the arguments as `<library> <topic>`. If only a library name is given, use a general query.

## Workflow

### Step 1: Resolve the library ID

```bash
curl -s ${CONTEXT7_API_KEY:+-H "x-api-key: $CONTEXT7_API_KEY"} "https://context7.com/api/v2/libs/search?libraryName=LIBRARY_NAME&query=TOPIC" | jq '.results[:3]'
```

Pick the best match. The `id` field is the library ID for step 2. If no results, try alternative names (e.g. "nextjs" vs "next.js").

### Step 2: Fetch documentation

```bash
curl -s ${CONTEXT7_API_KEY:+-H "x-api-key: $CONTEXT7_API_KEY"} "https://context7.com/api/v2/context?libraryId=LIBRARY_ID&query=TOPIC&type=txt"
```

Summarize the relevant documentation. Include code examples where available.

## Tips

- Works without an API key (rate-limited). Set `CONTEXT7_API_KEY` for higher limits
- Be specific with `query` to improve relevance
- URL-encode query parameters containing spaces (use `+` or `%20`)
- If the first result isn't right, check other results from the search
