import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE_URL = 'http://127.0.0.1:54321';
const API_KEY = 'REDACTED';

// Check the prep adjective issues more carefully
const recipesToCheck = [
  'Biryani', 'Fried Chicken', 'Chicken Pot Pie', 'Chicken Noodle Soup'
];

async function main() {
  for (const recipeName of recipesToCheck) {
    const recipeRes = await fetch(
      `${SUPABASE_URL}/rest/v1/recipes?name=eq.${encodeURIComponent(recipeName)}&select=id,name`,
      { headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` } }
    );
    const recipes = await recipeRes.json();
    if (!recipes.length) continue;

    const ingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/recipe_ingredients?recipe_id=eq.${recipes[0].id}&select=name,quantity,unit,category,raw_text&order=sort_order`,
      { headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` } }
    );
    const ingredients = await ingRes.json();

    console.log(`\n=== ${recipeName} ===`);
    ingredients.forEach(i => {
      // Check if name contains prep adjectives
      const prepWords = ['chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded', 'crispy', 'fried', 'toasted', 'ground'];
      const found = prepWords.filter(w => i.name.includes(w));
      if (found.length > 0) {
        console.log(`  PREP IN NAME: "${i.name}" (unit=${i.unit}, qty=${i.quantity})`);
        console.log(`    raw: "${i.raw_text}"`);
        console.log(`    prep words found: ${found.join(', ')}`);
      }
    });

    // Also check for crispy onion specifically
    const crispy = ingredients.find(i => i.name.includes('crispy'));
    if (crispy) {
      console.log(`  CRISPY: "${crispy.name}" (unit=${crispy.unit}, qty=${crispy.quantity})`);
      console.log(`    raw: "${crispy.raw_text}"`);
    }
  }

  // Also check count_unit_in_name issues
  console.log('\n\n=== COUNT UNIT IN NAME CHECKS ===');

  // Biryani clove
  const birRes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?name=eq.Biryani&select=id`,
    { headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` } }
  );
  const bir = await birRes.json();
  const birIngRes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipe_ingredients?recipe_id=eq.${bir[0].id}&select=name,quantity,unit,category,raw_text&order=sort_order`,
    { headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` } }
  );
  const birIngs = await birIngRes.json();

  console.log('\nBiryani - all ingredients:');
  birIngs.forEach(i => console.log(`  name="${i.name}", unit=${i.unit}, qty=${i.quantity}, cat=${i.category}, raw="${i.raw_text}"`));

  // Tomato Soup - onion with slice unit
  const tsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?name=eq.Tomato%20Soup&select=id`,
    { headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` } }
  );
  const ts = await tsRes.json();
  const tsIngRes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipe_ingredients?recipe_id=eq.${ts[0].id}&select=name,quantity,unit,category,raw_text&order=sort_order`,
    { headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` } }
  );
  const tsIngs = await tsIngRes.json();

  console.log('\nTomato Soup - all ingredients:');
  tsIngs.forEach(i => console.log(`  name="${i.name}", unit=${i.unit}, qty=${i.quantity}, cat=${i.category}, raw="${i.raw_text}"`));

  // Biscuits and Gravy - pork sausage crumbles
  const bgRes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?name=eq.Biscuits%20and%20Gravy&select=id`,
    { headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` } }
  );
  const bg = await bgRes.json();
  const bgIngRes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipe_ingredients?recipe_id=eq.${bg[0].id}&select=name,quantity,unit,category,raw_text&order=sort_order`,
    { headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` } }
  );
  const bgIngs = await bgIngRes.json();

  console.log('\nBiscuits and Gravy - all ingredients:');
  bgIngs.forEach(i => console.log(`  name="${i.name}", unit=${i.unit}, qty=${i.quantity}, cat=${i.category}, raw="${i.raw_text}"`));
}

main().catch(console.error);
