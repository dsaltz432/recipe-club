# Recipe Club Hub - Claude Code Instructions

## Testing

Write tests for new features and bug fixes. Focus on meaningful coverage — test user-facing behavior, not branch coverage for defensive code.

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
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:run` | Run all tests once |
| `npm run build` | TypeScript compilation |
| `npm run lint` | Code style check |
