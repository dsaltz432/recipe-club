# Combine-Ingredients Audit - Activity Log

## Codebase Patterns
<!-- Reusable patterns discovered during implementation go here -->

- **Supabase REST API**: http://127.0.0.1:54321/rest/v1/, auth key: REDACTED
- **Edge function URL**: http://127.0.0.1:54321/functions/v1/combine-ingredients
- **Anthropic API key**: from env ANTHROPIC_API_KEY or supabase/functions/.env
- **Existing scripts pattern**: see test-combine/scripts/batch-parse.mjs and evaluate-parsed.mjs for auth, batching, and evaluation patterns
- **DB state**: 154 recipes, 1898 ingredients (148 with ingredients, 6 empty)

## Current Status
**Last Updated:** 2026-02-16
**Tasks Completed:** 0
**Current Task:** Awaiting first iteration

---

## Session Log

<!-- Agent will append dated entries here -->
