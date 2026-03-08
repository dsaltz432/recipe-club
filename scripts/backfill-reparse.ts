/**
 * Backfill re-parse script
 * Re-parses all existing recipes with the improved prompt to get cleaner instructions.
 *
 * Usage: npx tsx scripts/backfill-reparse.ts
 *
 * Required env vars:
 *   SUPABASE_URL           - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (bypasses RLS)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DELAY_MS = 2000;
const MODEL = "claude-sonnet-4-6";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Fetching recipes to re-parse...");

  // Query all recipes with completed recipe_content and a URL
  // Skips custom meals (no URL)
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("id, name, url, recipe_content!inner(status)")
    .eq("recipe_content.status", "completed")
    .not("url", "is", null);

  if (error) {
    console.error("Failed to fetch recipes:", error.message);
    process.exit(1);
  }

  if (!recipes || recipes.length === 0) {
    console.log("No recipes found to re-parse.");
    return;
  }

  console.log(`Found ${recipes.length} recipe(s) to re-parse.\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];

    // Skip recipes without a URL (should be filtered by query, but defensive check)
    if (!recipe.url) {
      console.log(`Skipping "${recipe.name}" — no URL`);
      continue;
    }

    process.stdout.write(`Re-parsing "${recipe.name}"... `);

    try {
      const { error: invokeError } = await supabase.functions.invoke(
        "parse-recipe",
        {
          body: {
            recipeId: recipe.id,
            url: recipe.url,
            model: MODEL,
          },
        }
      );

      if (invokeError) {
        console.log("FAILED");
        console.error(`  Error: ${invokeError.message}`);
        failCount++;
      } else {
        console.log("OK");
        successCount++;
      }
    } catch (err) {
      console.log("FAILED");
      console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
      failCount++;
    }

    // Delay between calls to avoid rate limits (skip delay after last recipe)
    if (i < recipes.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(
    `\nDone. ${successCount} succeeded, ${failCount} failed.`
  );
}

main();
