/**
 * Custom ESM loader that provides a mock for the Supabase client module.
 * This allows scripts to import from src/lib/groceryList.ts without
 * needing a real Supabase connection or Vite's import.meta.env.
 */

export async function resolve(specifier, context, nextResolve) {
  // Intercept the supabase client import
  if (specifier.includes("integrations/supabase/client")) {
    return {
      shortCircuit: true,
      url: "mock:supabase-client",
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === "mock:supabase-client") {
    return {
      shortCircuit: true,
      format: "module",
      source: `export const supabase = { functions: { invoke: async () => ({}) } };`,
    };
  }
  return nextLoad(url, context);
}
