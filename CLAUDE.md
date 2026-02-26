# Recipe Club Hub - Claude Code Instructions

## ⚠️ MANDATORY: 100% Test Coverage Requirement

Every code change MUST achieve 100% test coverage. Write tests alongside code — don't wait for commit time.

**Required 100% directories:** `src/components/events/`, `src/components/ingredients/`, `src/components/mealplan/`, `src/components/recipes/`, `src/lib/`

**Only exception:** `src/components/wheel/IngredientWheel.tsx` (~55% acceptable due to Radix UI Dialog + fake timer limitations).

A pre-commit hook enforces this automatically. Run `npm run test:coverage` during development to catch gaps early.

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
