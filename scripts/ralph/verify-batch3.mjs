import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportPath = path.join(__dirname, '../../test-combine/evaluation-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const SUPABASE_URL = 'http://127.0.0.1:54321';
const API_KEY = 'REDACTED';

// Read recipes.ts to identify batch 3
const recipesPath = path.join(__dirname, '../../test-combine/src/data/recipes.ts');
const recipesContent = fs.readFileSync(recipesPath, 'utf8');
const recipeRegex = /\{\s*\n\s*id:\s*"([^"]+)",\s*\n\s*name:\s*"([^"]+)",/g;
const allRecipes = [];
let m;
while ((m = recipeRegex.exec(recipesContent)) !== null) {
  allRecipes.push({ id: m[1], name: m[2] });
}
const batch3Names = new Set(allRecipes.slice(40, 60).map(r => r.name));

// Get batch 3 issues
const batch3Issues = report.issues.filter(i => batch3Names.has(i.recipeName));

// Fetch actual ingredient data for batch 3 recipes
const batch3RecipeNames = [...new Set(batch3Issues.map(i => i.recipeName))];

async function fetchIngredients(recipeName) {
  // Get recipe ID
  const recipeRes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?name=eq.${encodeURIComponent(recipeName)}&select=id,name`,
    { headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` } }
  );
  const recipes = await recipeRes.json();
  if (!recipes.length) return [];

  const ingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipe_ingredients?recipe_id=eq.${recipes[0].id}&select=name,quantity,unit,category,raw_text&order=sort_order`,
    { headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` } }
  );
  return ingRes.json();
}

async function main() {
  console.log('=== VERIFYING BATCH 3 ISSUES AGAINST ACTUAL DB DATA ===\n');

  for (const issue of batch3Issues) {
    const ingredients = await fetchIngredients(issue.recipeName);
    const match = ingredients.find(ing =>
      ing.name === issue.ingredientName ||
      ing.name.includes(issue.ingredientName) ||
      issue.ingredientName.includes(ing.name)
    );

    if (!match) {
      console.log(`[${issue.issueType}] ${issue.recipeName} / "${issue.ingredientName}" -> NOT FOUND in DB`);
      continue;
    }

    let isFP = false;
    let reason = '';

    switch (issue.issueType) {
      case 'quantity_precision': {
        const qty = match.quantity;
        const decimals = String(qty).includes('.') ? String(qty).split('.')[1].length : 0;
        if (decimals <= 2) {
          isFP = true;
          reason = `quantity=${qty} has ${decimals} decimal places (<=2, acceptable)`;
        } else {
          reason = `quantity=${qty} has ${decimals} decimal places (>2, TRUE ISSUE)`;
        }
        break;
      }
      case 'pluralization': {
        const name = match.name;
        // Check if it's actually plural
        if (name === issue.suggestedFix || issue.suggestedFix.includes('already singular')) {
          isFP = true;
          reason = `name="${name}" is already singular`;
        } else {
          reason = `name="${name}" vs suggested="${issue.suggestedFix}"`;
        }
        break;
      }
      case 'count_unit_in_name': {
        const unit = match.unit;
        const name = match.name;
        // If the unit is already in the unit field, it's a FP
        if (issue.suggestedFix.includes('already correctly') || issue.suggestedFix.includes('no issue')) {
          isFP = true;
          reason = `unit="${unit}" already correct, name="${name}"`;
        } else {
          reason = `name="${name}", unit="${unit}", raw="${match.raw_text}"`;
        }
        break;
      }
      case 'prep_adjective': {
        reason = `name="${match.name}", raw="${match.raw_text}"`;
        break;
      }
      case 'non_standard_unit': {
        reason = `unit="${match.unit}", name="${match.name}"`;
        break;
      }
      case 'category_inconsistency': {
        reason = `category="${match.category}", name="${match.name}"`;
        break;
      }
      default:
        reason = `name="${match.name}", unit="${match.unit}", qty=${match.quantity}`;
    }

    const label = isFP ? 'FALSE POSITIVE' : 'ISSUE';
    console.log(`[${issue.issueType}] [${label}] ${issue.recipeName} / "${match.name}" (unit=${match.unit}, qty=${match.quantity}, cat=${match.category})`);
    console.log(`  ${reason}`);
    console.log(`  raw: "${match.raw_text}"`);
    console.log();
  }
}

main().catch(console.error);
