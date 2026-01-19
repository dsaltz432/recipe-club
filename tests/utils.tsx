/* eslint-disable react-refresh/only-export-components */
import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { User, Ingredient, Recipe, RecipeNote, ScheduledEvent } from "@/types";

// Create a new query client for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

// Wrapper component with all providers
interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

// Custom render function
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything from testing-library
export * from "@testing-library/react";
export { customRender as render };

// Mock data factories
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: "user-123",
  name: "Test User",
  email: "test@example.com",
  avatar_url: "https://example.com/avatar.jpg",
  ...overrides,
});

export const createMockIngredient = (overrides?: Partial<Ingredient>): Ingredient => ({
  id: "ingredient-123",
  name: "Test Ingredient",
  usedCount: 0,
  inBank: true,
  ...overrides,
});

export const createMockRecipe = (overrides?: Partial<Recipe>): Recipe => ({
  id: "recipe-123",
  name: "Test Recipe",
  url: "https://example.com/recipe",
  eventId: "event-123",
  ingredientId: "ingredient-123",
  createdBy: "user-123",
  createdAt: new Date().toISOString(),
  notesCount: 1,
  contributors: ["Test User"],
  ...overrides,
});

export const createMockNote = (
  overrides?: Partial<RecipeNote>
): RecipeNote => ({
  id: "note-123",
  recipeId: "recipe-123",
  userId: "user-123",
  notes: "Test notes",
  photos: [],
  createdAt: new Date().toISOString(),
  userName: "Test User",
  userAvatar: "https://example.com/avatar.jpg",
  ...overrides,
});

// Alias for backward compatibility
export const createMockContribution = createMockNote;

export const createMockEvent = (overrides?: Partial<ScheduledEvent>): ScheduledEvent => ({
  id: "event-123",
  ingredientId: "ingredient-123",
  eventDate: "2025-01-20",
  eventTime: "19:00",
  createdBy: "user-123",
  status: "scheduled",
  ingredientName: "Test Ingredient",
  ...overrides,
});

// Helper to wait for async operations
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));
