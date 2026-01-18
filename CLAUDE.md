# Recipe Club Hub - Claude Code Instructions

## ⚠️ MANDATORY: 100% Test Coverage

**Every change MUST achieve 100% test coverage before completion.**

Run this sequence for ALL changes:
1. `npm run test:coverage` - Must show 100% coverage
2. `npm run build` - Must compile without errors
3. `npm run lint` - Must pass

**One exception:** `src/components/wheel/IngredientWheel.tsx` is exempt (~55% acceptable) due to Radix UI Dialog + fake timer limitations.

## Project Structure

- `src/components/` - React components (auth, events, ingredients, recipes, ui, wheel)
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utilities and constants
- `src/integrations/` - Supabase client
- `tests/unit/` - Unit tests mirroring src/ structure
- `tests/integration/` - Data flow tests
- `tests/utils.tsx` - Mock factories (`createMockUser`, `createMockIngredient`, etc.)

## Key Concepts

**Event lifecycle:** `scheduled` → `completed` (increments ingredient usedCount) or `canceled` (no count change)

**Recipe vs Contribution:** Recipes are canonical definitions; RecipeContributions are user-specific submissions linked to events.

**Ingredient.inBank:** Whether ingredient is currently in the wheel bank.

## Testing

- Mock Supabase: `vi.mock("@/integrations/supabase/client")`
- Mock toast: Uses `sonner` library
- Use `@tests/utils` for rendering with providers
- Use `@/` imports for source code

## Commands

| Command | Use |
|---------|-----|
| `npm run test:coverage` | **Primary** - verify 100% coverage |
| `npm run test:run` | Run all tests once |
| `npm run build` | TypeScript compilation |
| `npm run lint` | Code style check |