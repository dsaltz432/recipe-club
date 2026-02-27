@ralph/prd.json @ralph/activity.md

You are an autonomous coding agent. You work on ONE user story per iteration, then commit and stop.

## Step 1: Understand Current State

1. Read `ralph/activity.md` — check the **Codebase Patterns** section first for reusable context
2. Read `ralph/prd.json` to find the highest-priority user story where `"passes": false`
3. Verify you're on the correct branch from `prd.json` `branchName`. If not, check it out or create from the default branch (`main` or `master`).

Print your orientation:
```
ORIENTATION
- Branch: [current branch]
- Next story: [ID] — [Title]
- Priority: [N]
- ACs to meet: [count]
```

## Step 2: Implement the Story

Before starting work, print:
```
STARTING: [Story ID] — [Story Title]
```

Work on exactly ONE story:
1. Read the acceptance criteria carefully
2. Read the `notes` field for the story — it contains critical context
3. Implement the change following existing code patterns
4. After each acceptance criterion is met, print:
   ```
   AC [N/total]: [brief description]
   ```
5. If an AC fails or needs rework, print:
   ```
   AC [N/total] RETRY: [what went wrong] → [what you're trying]
   ```

### Quality Checks

After implementation, run the relevant checks:
- If code was changed: `npm run build` (verify TypeScript compilation)
- If code was changed: `npm run test:run` (verify tests still pass)
- If no code was changed (test-only story): skip quality checks, note "N/A — no code changes"

## Step 3: Log Progress

Append a dated entry to `ralph/activity.md`:

```markdown
## [YYYY-MM-DD HH:MM] — [Story ID]: [Story Title]

### What was implemented
- [bullet points of changes]

### Files changed
- [file paths]

### Quality checks
- Build: pass/fail
- Tests: pass/fail (or N/A)
- Lint: pass/fail

### Learnings for future iterations
- [patterns discovered]
- [gotchas encountered]
- [useful context]

---
```

If you discover a **reusable pattern**, also add it to the `## Codebase Patterns` section at the TOP of `ralph/activity.md`. This is critical — future iterations start by reading this section.

## Step 4: Update PRD

Set `"passes": true` for the completed story in `ralph/prd.json`.

## Step 5: Commit

```bash
git add -A
git commit -m "feat: [Story ID] - [Story Title]"
```

Do NOT run `git init`, do NOT change git remotes, and do NOT push.

## Step 6: Print Status Summary

Always end your response with this exact block:

```
---
RALPH STATUS
- Story: [ID] — [Title]
- Result: PASSED | FAILED (reason)
- ACs met: [X/Y]
- Remaining stories: [N] with passes: false
- Quality: build pass/fail | tests pass/fail | lint pass/fail
---
```

## Important Rules

- ONLY work on a SINGLE story per iteration
- Always read ralph/activity.md Codebase Patterns BEFORE starting implementation
- Always log progress in ralph/activity.md BEFORE committing
- Always commit after completing a story
- Keep changes focused and minimal
- Do NOT commit broken code — if checks fail, fix before committing
- Do NOT skip acceptance criteria — every AC must be verified

## Completion

After completing a story, end your response normally. The loop script checks `ralph/prd.json` directly to determine if all stories are complete.
