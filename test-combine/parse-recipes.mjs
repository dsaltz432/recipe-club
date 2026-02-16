#!/usr/bin/env node

/**
 * Parse recipe URLs and populate ingredients in recipes.ts
 *
 * Usage:
 *   node parse-recipes.mjs              # parse all recipes with empty ingredients
 *   node parse-recipes.mjs --dry-run    # fetch & parse but don't write to file
 *   node parse-recipes.mjs --id=beer-bread --id=gobi-65   # parse specific recipes
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_FILE = path.join(__dirname, "src/data/recipes.ts");

const API_KEY = process.env.ANTHROPIC_API_KEY || fs.readFileSync(
  path.join(__dirname, "../supabase/functions/.env"), "utf-8"
).match(/ANTHROPIC_API_KEY=(.*)/)?.[1]?.trim();

if (!API_KEY) {
  console.error("No ANTHROPIC_API_KEY found");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const targetIds = args.filter(a => a.startsWith("--id=")).map(a => a.slice(5));

// ---------- JSON-LD extraction (same logic as edge function) ----------

function extractJsonLdRecipe(html) {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))) {
          return item;
        }
        if (item["@graph"]) {
          for (const node of item["@graph"]) {
            if (node["@type"] === "Recipe" || (Array.isArray(node["@type"]) && node["@type"].includes("Recipe"))) {
              return node;
            }
          }
        }
      }
    } catch {
      // skip invalid JSON
    }
  }
  return null;
}

// ---------- AI prompt (same as edge function) ----------

const SYSTEM_PROMPT = `You are a recipe parser. Extract structured data from recipe content. Return ONLY valid JSON with no markdown formatting.

The JSON should have this structure:
{
  "ingredients": [
    {
      "name": "ingredient name (e.g. 'onion')",
      "quantity": 2,
      "unit": "cup",
      "category": "produce",
      "rawText": "2 cups diced onion"
    }
  ]
}

Categories must be one of: produce, meat_seafood, dairy, pantry, spices, frozen, bakery, beverages, condiments, other.
Category guidance:
- All cooking oils (olive oil, vegetable oil, canola oil, sesame oil, coconut oil) → "pantry"
- Eggs → "pantry"
- Vinegars and sauces (soy sauce, fish sauce, hot sauce, worcestershire sauce) → "condiments"
- Proteins including tofu, tempeh, and seitan → "meat_seafood" (this category covers all proteins)
- Water → "other" (NEVER "beverages")
- Seeds (sesame seed, poppy seed, etc.) → "spices"
- Lemon/lime juice → "produce" (it comes from produce)
- Canned/jarred tomato products (crushed tomato, tomato paste, diced tomato, tomato sauce) → "pantry" (they are shelf-stable pantry items)
- Fresh tomatoes → "produce"
- Dried fruits (dried apricot, dried cranberry, dried cherry, etc.) → "pantry" (they are shelf-stable)
- Taco shells, tortilla chips, pita chips → "bakery"
For quantity, use null if the amount is "to taste" or unspecified. Unit should be null only for truly unitless countable items (e.g. "3 eggs", "1 onion", "2 carrots").
- COUNT UNITS are real units — put them in the "unit" field, NOT in the name: "head", "bunch", "stalk", "clove", "sprig", "ear", "strip", "slice", "piece".
  Example: "2 medium heads of broccoli" → { "name": "broccoli", "quantity": 2, "unit": "head" }
  Example: "3 garlic cloves" → { "name": "garlic", "quantity": 3, "unit": "clove" }
  Example: "1 bunch cilantro" → { "name": "cilantro", "quantity": 1, "unit": "bunch" }
- When both metric and imperial are listed (e.g. "800g / 28 oz"), prefer the imperial measurement (use 28, "oz").
- Non-standard units like "dash", "pinch", "splash" should be converted: use "tsp" with a small quantity (e.g. 0.125) or null if truly negligible.

For ingredient names:
- Use the BASE ingredient name only, without preparation adjectives or count units.
  YES: "broccoli", "garlic", "ginger", "sesame oil", "soy sauce", "cilantro", "celery"
  NO: "fresh garlic", "broccoli florets", "minced ginger", "toasted sesame oil", "garlic clove", "broccoli head"
- The name should NEVER contain a count unit word (head, clove, bunch, stalk, sprig, ear, strip, slice, piece) — those go in the "unit" field.
- ALWAYS use SINGULAR forms. Common examples:
  "onion" not "onions", "tomato" not "tomatoes", "egg" not "eggs",
  "peanut" not "peanuts", "chestnut" not "chestnuts", "shallot" not "shallots",
  "short rib" not "short ribs", "peppercorn" not "peppercorns",
  "sesame seed" not "sesame seeds", "cherry tomato" not "cherry tomatoes"
  Exception: compound product names where the plural is the standard product name:
  "red pepper flakes" (not "red pepper flake"), "rice noodles" (not "rice noodle"),
  "rolled oats" (not "rolled oat"), "lo mein noodles", "breadcrumbs"
- Keep qualifiers that identify a DIFFERENT product or form:
  YES (different products): "sesame oil", "rice vinegar", "low sodium soy sauce", "romaine lettuce heart"
  YES (distinct product forms): "crushed tomato" (a canned product), "red pepper flakes" (a spice product), "dried apricot" (different from fresh apricot), "dry white wine" (wine classification), "chili oil" (a product), "pickled jalapeño" (a distinct jarred product), "pickled red onion" (a distinct prepared product)
  NO (just preparation state): "fresh broccoli" (same as "broccoli"), "cold water" (same as "water"), "minced garlic" (same as "garlic"), "diced onion" (same as "onion"), "toasted sesame seed" (same as "sesame seed"), "fried shallot" (same as "shallot")
- Use standard abbreviated units: "tsp", "tbsp", "cup", "oz", "lb". NEVER use metric units (g, kg, ml, L) — always convert to the nearest imperial equivalent (e.g. 200g → 7 oz, 500ml → 2 cups)
- Use decimal numbers for quantities, not fractions: 0.25 not 1/4, 0.5 not 1/2, 0.33 not 1/3, 0.67 not 2/3. Round to 2 decimal places maximum (0.33 not 0.333, 0.67 not 0.667)
- For compound ingredients, use the most common single-word form when one exists:
  "cornstarch" not "corn starch"
- Use proper diacritical marks for ingredient names: "jalapeño" not "jalapeno", "crème fraîche" not "creme fraiche", "añejo" not "anejo"
- "wedge" is not a standard unit — convert to "piece": e.g. "1 lime wedge" → { "name": "lime", "quantity": 1, "unit": "piece" }
- "inch" is not a standard unit — convert to "piece": e.g. "1 inch ginger" → { "name": "ginger", "quantity": 1, "unit": "piece" }
- Sub-recipe components (e.g. "1 recipe fajita veggies") — use null for unit and 1 for quantity: { "name": "fajita veggies", "quantity": 1, "unit": null }
- "fresh mozzarella" is a DISTINCT product from regular mozzarella — keep the qualifier "fresh mozzarella"
- "dry oregano" / "dried oregano" are distinct from fresh oregano — keep as "dried oregano"`;

// ---------- Fetch & parse a single recipe ----------

async function fetchRecipeContent(url, name) {
  const isStorageUrl = url.includes("supabase") && url.includes("storage");
  const isPdfOrImage = /\.(pdf|jpg|jpeg|png|webp)(\?|$)/i.test(url);

  if (isStorageUrl || isPdfOrImage) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return { isImage: true, base64 };
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  const html = await response.text();

  const jsonLd = extractJsonLdRecipe(html);
  if (jsonLd) {
    let text = `STRUCTURED RECIPE DATA (from JSON-LD Schema.org/Recipe):\nName: ${jsonLd.name ?? name}\n`;
    if (jsonLd.recipeYield) text += `Yield: ${jsonLd.recipeYield}\n`;
    if (jsonLd.prepTime) text += `Prep time: ${jsonLd.prepTime}\n`;
    if (jsonLd.cookTime) text += `Cook time: ${jsonLd.cookTime}\n`;
    text += `\nIngredients:\n`;
    for (const ing of jsonLd.recipeIngredient ?? []) text += `- ${ing}\n`;
    if (jsonLd.recipeInstructions) {
      text += `\nInstructions:\n`;
      for (const step of jsonLd.recipeInstructions) {
        if (typeof step === "string") text += `- ${step}\n`;
        else if (step?.text) text += `- ${step.text}\n`;
      }
    }
    return { isImage: false, text };
  }

  // Fallback: strip HTML
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15000);
  return { isImage: false, text };
}

async function parseWithAI(name, content) {
  const userContent = content.isImage
    ? [
        { type: "text", text: `Parse this recipe "${name}" and extract all ingredients.` },
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: content.base64 } },
      ]
    : `Parse this recipe "${name}" from the following text and extract all ingredients:\n\n${content.text}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const result = await res.json();
  const text = result.content?.[0]?.text || "";

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const parsed = JSON.parse(jsonMatch[1].trim());
  return parsed.ingredients || [];
}

// ---------- Read recipes.ts, find empties, update ----------

function readRecipesFile() {
  return fs.readFileSync(RECIPES_FILE, "utf-8");
}

function findEmptyRecipes(source) {
  // Match recipe blocks with `ingredients: [],`
  const regex = /\{\s*\n\s*id:\s*"([^"]+)",\s*\n\s*name:\s*"([^"]+)",\s*\n\s*cuisine:\s*"[^"]+",\s*\n\s*url:\s*"([^"]+)",\s*\n\s*ingredients:\s*\[\],?\s*\n\s*\}/g;
  const recipes = [];
  let match;
  while ((match = regex.exec(source)) !== null) {
    recipes.push({ id: match[1], name: match[2], url: match[3], fullMatch: match[0] });
  }
  return recipes;
}

function formatIngredients(ingredients) {
  return ingredients.map(ing => {
    const qty = ing.quantity != null ? String(ing.quantity) : "null";
    const unit = ing.unit != null ? `"${ing.unit}"` : "null";
    const rawText = (ing.rawText || ing.raw_text || "").replace(/"/g, '\\"');
    return `      { name: "${ing.name}", quantity: ${qty}, unit: ${unit}, category: "${ing.category}", rawText: "${rawText}" }`;
  }).join(",\n");
}

function updateRecipeInSource(source, recipe, ingredients) {
  const formatted = formatIngredients(ingredients);
  const replacement = recipe.fullMatch.replace(
    /ingredients:\s*\[\],?/,
    `ingredients: [\n${formatted},\n    ]`
  );
  return source.replace(recipe.fullMatch, replacement);
}

// ---------- Main ----------

async function main() {
  let source = readRecipesFile();
  const empties = findEmptyRecipes(source);

  const toProcess = targetIds.length > 0
    ? empties.filter(r => targetIds.includes(r.id))
    : empties;

  console.log(`Found ${empties.length} recipes with empty ingredients`);
  console.log(`Processing ${toProcess.length} recipes${dryRun ? " (dry run)" : ""}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const recipe of toProcess) {
    const idx = toProcess.indexOf(recipe) + 1;
    process.stdout.write(`[${idx}/${toProcess.length}] ${recipe.name}... `);

    try {
      const content = await fetchRecipeContent(recipe.url, recipe.name);
      const ingredients = await parseWithAI(recipe.name, content);
      console.log(`${ingredients.length} ingredients`);

      if (!dryRun) {
        source = updateRecipeInSource(source, recipe, ingredients);
      } else {
        for (const ing of ingredients) {
          console.log(`    ${ing.quantity ?? "?"} ${ing.unit ?? ""} ${ing.name} (${ing.category})`);
        }
      }
      successCount++;

      // Small delay to avoid rate limiting
      if (idx < toProcess.length) await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failCount++;
    }
  }

  if (!dryRun && successCount > 0) {
    fs.writeFileSync(RECIPES_FILE, source, "utf-8");
    console.log(`\nWrote ${successCount} recipes to ${RECIPES_FILE}`);
  }

  console.log(`\nDone: ${successCount} success, ${failCount} failed`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
