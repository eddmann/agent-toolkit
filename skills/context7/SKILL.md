---
name: context7
description: "Use when looking up library or framework documentation and version-specific API examples."
argument-hint: <library> <topic>
user-invocable: true
config:
  CONTEXT7_API_KEY:
    description: "API key when required for access or higher rate limits"
    default: ""
---

# Context7

Resolve the library and retrieve documentation relevant to the user's question. Check the
project's installed version when API compatibility matters; do not silently substitute latest.

## Lookup

Set `library` and `question` to the requested package and topic. Use a configured key without
printing it; public access may be limited or rejected. These examples use Bash arrays.

```bash
auth=()
if [ -n "${CONTEXT7_API_KEY:-}" ]; then
  auth=(-H "Authorization: Bearer $CONTEXT7_API_KEY")
fi
curl --silent --show-error --fail-with-body --max-time 30 --get \
  "${auth[@]}" 'https://context7.com/api/v2/libs/search' \
  --data-urlencode "libraryName=$library" --data-urlencode "query=$question"
```

Inspect the results and select the matching library/source, not merely the first result.
Set `library_id` to its returned ID. When available, append a listed version as `/<version>`
to match the project; otherwise state that exact-version coverage is unavailable.

```bash
curl --silent --show-error --fail-with-body --max-time 30 --get \
  "${auth[@]}" 'https://context7.com/api/v2/context' \
  --data-urlencode "libraryId=$library_id" --data-urlencode "query=$question" \
  --data-urlencode 'type=txt'
```

Inspect exit status and response before using the result. Report authentication, access,
missing-library or unavailable-version errors accurately. For rate limits, honor `Retry-After`
with a bounded retry; do not repeatedly retry unchanged authentication failures. A pending or
empty result is not documentation. If unavailable, use the library's official docs and state
that fallback. See the [API guide](https://context7.com/docs/api-guide) for response details.

## Answer

Summarize the relevant guidance and cite source URLs returned with the snippets. Identify the
version covered and any mismatch. Adapt examples to the project's stack; documentation examples
do not prove that code runs in the project. Distinguish retrieved guidance from your own inference.
