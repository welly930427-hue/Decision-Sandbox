---
name: OpenAI integration quirks (Replit AI proxy)
description: Non-obvious model/param constraints when using the Replit OpenAI integration for chat completions
---

# OpenAI via Replit AI integration — model & param constraints

- Use model `gpt-5.4` for chat completions. `gpt-5` returned an EMPTY `message.content` (`raw: ""`) for structured/JSON-only prompts, causing silent JSON-parse failures. Switching to `gpt-5.4` fixed it immediately.
  **Why:** cost multiple debugging attempts; the failure looked like a JSON-format bug but was actually an empty model response.
  **How to apply:** if a completion comes back empty, log `finish_reason` + `message.refusal` + raw content first, then try `gpt-5.4` before assuming a parsing/prompt problem.

- For gpt-5+ models: use `max_completion_tokens` (NOT `max_tokens`), and do NOT send `temperature` (only default 1 is allowed).

- For reliable JSON output: make the system prompt English, state "respond with ONLY valid JSON, no markdown/code fences, start with { end with }", and include an example output object. Keep a tolerant `extractJson()` that strips ```json fences and slices the first {...} as a fallback.
