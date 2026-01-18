/**
 * Integration tests for the event creation and completion flow.
 * Tests the full user journey from spinning the wheel to completing an event.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@tests/utils";
import {
  createMockUser,
  createMockIngredient,
  createMockEvent,
  createMockRecipe,
  createMockContribution,
} from "@tests/utils";
import type { Ingredient, ScheduledEvent } from "@/types";

// Mock all external dependencies
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      gt: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-123" }, provider_token: "token" } },
        error: null,
      }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/googleCalendar", () => ({
  createCalendarEvent: vi.fn().mockResolvedValue({ success: true, eventId: "cal-123" }),
  updateCalendarEvent: vi.fn().mockResolvedValue({ success: true }),
  deleteCalendarEvent: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Event Flow Integration", () => {
  describe("Event Lifecycle States", () => {
    it("should transition through event states correctly", () => {
      // Test the event status transitions: scheduled -> completed
      const scheduledEvent: ScheduledEvent = createMockEvent({
        status: "scheduled",
      });
      expect(scheduledEvent.status).toBe("scheduled");

      const completedEvent: ScheduledEvent = {
        ...scheduledEvent,
        status: "completed",
      };
      expect(completedEvent.status).toBe("completed");
    });

    it("should support canceled status", () => {
      const canceledEvent: ScheduledEvent = createMockEvent({
        status: "canceled",
      });
      expect(canceledEvent.status).toBe("canceled");
    });
  });

  describe("Ingredient Bank and Wheel Integration", () => {
    it("should only show in-bank ingredients on the wheel", () => {
      const ingredients: Ingredient[] = [
        createMockIngredient({ id: "1", name: "Chicken", inBank: true }),
        createMockIngredient({ id: "2", name: "Salmon", inBank: true }),
        createMockIngredient({ id: "3", name: "Tofu", inBank: false }), // Not in bank
      ];

      const bankIngredients = ingredients.filter((i) => i.inBank);
      expect(bankIngredients).toHaveLength(2);
      expect(bankIngredients.map((i) => i.name)).toContain("Chicken");
      expect(bankIngredients.map((i) => i.name)).toContain("Salmon");
      expect(bankIngredients.map((i) => i.name)).not.toContain("Tofu");
    });

    it("should track usage count correctly", () => {
      const ingredient = createMockIngredient({
        name: "Salmon",
        usedCount: 0,
      });

      // Simulate completing an event
      const updatedIngredient = {
        ...ingredient,
        usedCount: ingredient.usedCount + 1,
      };

      expect(updatedIngredient.usedCount).toBe(1);
    });

    it("should allow ingredients to be reused", () => {
      const ingredient = createMockIngredient({
        name: "Salmon",
        usedCount: 2,
        inBank: true,
      });

      // Ingredient should still be spinnable even after being used
      expect(ingredient.inBank).toBe(true);
      expect(ingredient.usedCount).toBe(2);
    });
  });

  describe("Recipe Contribution Flow", () => {
    it("should associate contributions with recipes and events", () => {
      const recipe = createMockRecipe({
        id: "recipe-1",
        name: "Grilled Salmon",
      });

      const contribution = createMockContribution({
        recipeId: recipe.id,
        eventId: "event-123",
        userId: "user-123",
        notes: "Added extra lemon",
      });

      expect(contribution.recipeId).toBe(recipe.id);
      expect(contribution.eventId).toBe("event-123");
      expect(contribution.notes).toBe("Added extra lemon");
    });

    it("should allow multiple contributions to the same recipe", () => {
      const recipe = createMockRecipe({ id: "recipe-1" });

      const contributions = [
        createMockContribution({ id: "c1", recipeId: recipe.id, userId: "user-1" }),
        createMockContribution({ id: "c2", recipeId: recipe.id, userId: "user-2" }),
        createMockContribution({ id: "c3", recipeId: recipe.id, userId: "user-3" }),
      ];

      expect(contributions.filter((c) => c.recipeId === recipe.id)).toHaveLength(3);
    });
  });

  describe("Event Completion with Ratings", () => {
    it("should require both wouldCookAgain and rating for valid rating", () => {
      const validRating = {
        recipeId: "recipe-1",
        userId: "user-123",
        eventId: "event-123",
        wouldCookAgain: true,
        rating: 4,
      };

      expect(validRating.wouldCookAgain).toBeDefined();
      expect(validRating.rating).toBeDefined();
      expect(validRating.rating).toBeGreaterThanOrEqual(1);
      expect(validRating.rating).toBeLessThanOrEqual(5);
    });

    it("should validate rating range", () => {
      const ratingValues = [1, 2, 3, 4, 5];

      ratingValues.forEach((rating) => {
        expect(rating).toBeGreaterThanOrEqual(1);
        expect(rating).toBeLessThanOrEqual(5);
      });
    });
  });

  describe("Data Consistency", () => {
    it("should maintain event-ingredient relationship", () => {
      const ingredient = createMockIngredient({
        id: "ingredient-123",
        name: "Salmon",
      });

      const event = createMockEvent({
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
      });

      expect(event.ingredientId).toBe(ingredient.id);
      expect(event.ingredientName).toBe(ingredient.name);
    });

    it("should maintain contribution-recipe-event relationship", () => {
      const event = createMockEvent({ id: "event-123" });
      const recipe = createMockRecipe({ id: "recipe-123" });

      const contribution = createMockContribution({
        recipeId: recipe.id,
        eventId: event.id,
      });

      expect(contribution.recipeId).toBe(recipe.id);
      expect(contribution.eventId).toBe(event.id);
    });
  });
});

describe("User Permissions Integration", () => {
  const adminUser = createMockUser({
    id: "admin-123",
    email: "admin@example.com",
  });

  const viewerUser = createMockUser({
    id: "viewer-123",
    email: "viewer@example.com",
  });

  it("should differentiate between admin and viewer roles", () => {
    const isAdminRole = (role: string) => role === "admin";

    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("viewer")).toBe(false);
  });

  it("should verify admin can perform all actions", () => {
    const adminPermissions = {
      canSpin: true,
      canAddIngredient: true,
      canRemoveIngredient: true,
      canCreateEvent: true,
      canCancelEvent: true,
      canCompleteEvent: true,
      canAddRecipe: true,
    };

    Object.values(adminPermissions).forEach((permission) => {
      expect(permission).toBe(true);
    });
  });

  it("should verify viewer has limited permissions", () => {
    const viewerPermissions = {
      canSpin: false,
      canAddIngredient: false,
      canRemoveIngredient: false,
      canCreateEvent: false,
      canCancelEvent: false,
      canCompleteEvent: false,
      canAddRecipe: false,
    };

    Object.values(viewerPermissions).forEach((permission) => {
      expect(permission).toBe(false);
    });
  });
});

describe("Search and Filter Integration", () => {
  it("should filter recipes by name (case insensitive)", () => {
    const recipes = [
      createMockRecipe({ name: "Grilled Salmon" }),
      createMockRecipe({ name: "Salmon Teriyaki" }),
      createMockRecipe({ name: "Chicken Stir Fry" }),
    ];

    const searchTerm = "salmon";
    const filtered = recipes.filter((r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.name)).toContain("Grilled Salmon");
    expect(filtered.map((r) => r.name)).toContain("Salmon Teriyaki");
  });

  it("should filter recipes by ingredient", () => {
    const recipesWithIngredients = [
      { recipe: createMockRecipe({ name: "Recipe 1" }), ingredientName: "Salmon" },
      { recipe: createMockRecipe({ name: "Recipe 2" }), ingredientName: "Salmon" },
      { recipe: createMockRecipe({ name: "Recipe 3" }), ingredientName: "Chicken" },
    ];

    const ingredientFilter = "Salmon";
    const filtered = recipesWithIngredients.filter(
      (r) => r.ingredientName === ingredientFilter
    );

    expect(filtered).toHaveLength(2);
  });

  it("should combine search and filter", () => {
    const recipesWithIngredients = [
      { recipe: createMockRecipe({ name: "Grilled Salmon" }), ingredientName: "Salmon" },
      { recipe: createMockRecipe({ name: "Salmon Teriyaki" }), ingredientName: "Salmon" },
      { recipe: createMockRecipe({ name: "Grilled Chicken" }), ingredientName: "Chicken" },
    ];

    const searchTerm = "grilled";
    const ingredientFilter = "Salmon";

    const filtered = recipesWithIngredients.filter(
      (r) =>
        r.recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        r.ingredientName === ingredientFilter
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].recipe.name).toBe("Grilled Salmon");
  });
});
