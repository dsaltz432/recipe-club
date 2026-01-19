# Recipe Club Hub - Claude Code Instructions

## ⚠️ MANDATORY: 100% Test Coverage Requirement

**This is an absolute requirement. Every code change MUST achieve 100% test coverage before completion.**

### Coverage Requirements

All files in the following directories **MUST have 100% coverage** across ALL metrics (Statements, Branch, Functions, Lines):

| Directory | Required Coverage |
|-----------|------------------|
| `src/components/events/` | 100% |
| `src/components/ingredients/` | 100% |
| `src/components/recipes/` | 100% |
| `src/lib/` | 100% |

### The Only Exception

`src/components/wheel/IngredientWheel.tsx` is the **only file exempt** from 100% coverage (~55% acceptable). This is due to Radix UI Dialog combined with fake timer testing limitations.

### Verification Process

Run this sequence for ALL changes:

```bash
# Step 1: Run coverage - ALL covered files must show 100%
npm run test:coverage

# Step 2: Verify build compiles
npm run build

# Step 3: Check lint
npm run lint
```

### What To Do If Coverage Is Below 100%

1. Check the coverage report for uncovered lines (shown in "Uncovered Line #s" column)
2. Read the source file to understand what code path isn't covered
3. Add tests that exercise the uncovered branches/lines
4. For defensive code that's hard to reach, consider:
   - Adding a `_testOverride*` prop for testing (see `AddRecipeForm.tsx` for example)
   - Refactoring to make the code more testable
5. Re-run `npm run test:coverage` until 100% is achieved

### Coverage Report Example

A passing coverage report should look like this:

```
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
components/events  |     100 |      100 |     100 |     100 |
components/ingredients |  100 |      100 |     100 |     100 |
components/recipes |     100 |      100 |     100 |     100 |
lib                |     100 |      100 |     100 |     100 |
components/wheel   |   ~55   |    ~60   |   ~46   |   ~57   | (EXEMPT)
```

---

## Project Structure

- `src/components/` - React components (auth, events, ingredients, recipes, ui, wheel)
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utilities and constants
- `src/integrations/` - Supabase client
- `tests/unit/` - Unit tests mirroring src/ structure
- `tests/integration/` - Data flow tests
- `tests/utils.tsx` - Mock factories (`createMockUser`, `createMockIngredient`, `createMockNote`, `createMockEvent`, etc.)

## Key Concepts

**Event lifecycle:** `scheduled` → `completed` (increments ingredient usedCount) or `canceled` (no count change)

**Recipe vs Notes:** Recipes are canonical definitions with `event_id` and `ingredient_id`. RecipeNotes are user-specific notes/photos linked to recipes.

**Ingredient.inBank:** Whether ingredient is currently in the wheel bank.

## Testing

- Mock Supabase: `vi.mock("@/integrations/supabase/client")`
- Mock toast: Uses `sonner` library
- Use `@tests/utils` for rendering with providers
- Use `@/` imports for source code
- Mock factories available: `createMockUser`, `createMockIngredient`, `createMockRecipe`, `createMockNote`, `createMockEvent`

## Commands

| Command | Use |
|---------|-----|
| `npm run test:coverage` | **Primary** - verify 100% coverage |
| `npm run test:run` | Run all tests once |
| `npm run build` | TypeScript compilation |
| `npm run lint` | Code style check |
